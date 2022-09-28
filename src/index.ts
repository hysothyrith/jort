import axios from "axios";
import cors from "cors";
import express from "express";
import FormData from "form-data";
import http from "http";
import multer from "multer";
import qrcode from "qrcode";
import { Server } from "socket.io";
import { z } from "zod";
import { validateRequest } from "zod-express-middleware";
import { prisma } from "./core/prisma";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const port = process.env.PORT || 3000;

const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());
app.use(express.raw({ type: "application/vnd.custom-type" }));
app.use(express.text({ type: "text/html" }));
app.use(cors({ origin: "*" }));

io.of("/gate").on("connection", (socket) => {
  socket.on("start", async (payload) => {
    if (await prisma.gate.findFirst({ where: { id: payload.gateId } })) {
      socket.join(`connected_gates#${payload.gateId}`);

      const qr = await qrcode.toDataURL(
        JSON.stringify({ gateId: payload.gateId }),
        { width: 500 }
      );

      socket.emit("connected", { qr });
    } else {
      socket.emit("toast", {
        type: "error",
        message: "Gate with given id does not exist.",
      });
    }
  });
});

io.of("/stats").on("connection", (socket) => {
  socket.on("subscribe", async (payload) => {
    const parkingLot = await prisma.parkingLot.findFirst({
      where: { id: payload.parkingLotId },
    });
    if (!parkingLot) {
      socket.emit("toast", {
        type: "error",
        message: "Parking lot with given id does not exist.",
      });
      return;
    }

    socket.join(`stats_subscription#${payload.parkingLotId}`);

    socket.emit("changed", {
      smallVehicleCapacity: parkingLot.smallVehicleCapacity,
      smallVehicleCapacityAvailable: 0,
      largeVehicleCapacity: parkingLot.largeVehicleCapacity,
      largeVehicleCapacityAvailable: 0,
    });
  });
});

app.post(
  "/scans",
  validateRequest({
    body: z.object({
      deviceId: z.string(),
      gateId: z.string(),
    }),
  }),
  handle(async ({ body: { gateId, deviceId } }, res) => {
    if (!(await prisma.gate.findFirst({ where: { id: gateId } }))) {
      return badRequest(res, "Gate with given id does not exist.");
    }

    const existingTenancy = await prisma.tenancy.findFirst({
      where: { deviceId: deviceId, exitTime: null },
    });

    if (!existingTenancy) {
      const tenancy = await prisma.tenancy.create({
        data: { deviceId, entryGateId: gateId },
        select: { id: true },
      });

      io.of("/gate")
        .to(`connected_gates#${gateId}`)
        .emit("capture", { tenancyId: tenancy.id });

      return success(res, { message: "Tenancy created" });
    }

    const hasEntered = Boolean(existingTenancy.entryTime);
    if (!hasEntered) {
      return success(res, { message: "Images not yet received" });
    } else {
      await prisma.tenancy.update({
        where: { id: existingTenancy.id },
        data: { exitGateId: gateId },
      });

      io.of("/gate")
        .to(`connected_gates#${gateId}`)
        .emit("capture", { tenancyId: existingTenancy.id });

      return res.sendStatus(200);
    }
  })
);

app.post(
  "/captures",
  upload.array("images", 5),
  validateRequest({
    body: z.object({
      tenancyId: z.string(),
      gateId: z.string(),
    }),
  }),
  handle(async (req, res) => {
    const tenancy = await prisma.tenancy.findFirst({
      where: { id: req.body.tenancyId },
    });
    if (!tenancy) {
      return badRequest(res, "Tenancy with the given id does not exist.");
    }

    const images = req.files as Express.Multer.File[];

    const firstImage = images[0];

    const formData = new FormData();
    formData.append("upload", firstImage.buffer.toString("base64"));

    const result: any = await axios
      .post("https://api.platerecognizer.com/v1/plate-reader/", formData, {
        headers: {
          Authorization: `Token d67da8cb1e381db35cead8b8a0c19fd794c03df7`,
        },
      })
      .catch((err) => {
        console.error(err);
      });

    const licensePlateResult = result.data;

    console.log({ licensePlateResult });

    const licensePlate = licensePlateResult?.results?.length
      ? licensePlateResult.results[0].plate
      : null;

    const isEntry = !Boolean(tenancy.exitGateId);

    if (isEntry) {
      await prisma.tenancy.update({
        where: { id: tenancy.id },
        data: {
          vehiclePlateNumber: licensePlate,
          entryTime: new Date(),
        },
      });

      io.of("/gate")
        .to(`connected_gates#${req.body.gateId}`)
        .emit("toast", {
          type: "success",
          message: licensePlate ? `Welcome ${licensePlate}!` : "Welcome!",
        });
    } else {
      if (tenancy.vehiclePlateNumber !== licensePlate) {
        io.of("/gate").to(`connected_gates#${req.body.gateId}`).emit("deny");

        io.of("/gate").to(`connected_gates#${req.body.gateId}`).emit("toast", {
          type: "error",
          message: "License plate does not match.",
        });
        return badRequest(res, "License plate does not match.");
      }

      await prisma.tenancy.update({
        where: { id: tenancy.id },
        data: { exitTime: new Date() },
      });

      io.of("/gate")
        .to(`connected_gates#${req.body.gateId}`)
        .emit("toast", { type: "success", message: "Goodbye!" });
    }

    io.of("/gate").to(`connected_gates#${req.body.gateId}`).emit("allow");

    return success(res, { message: "OK" });
  })
);

app.get("/parking-lots/:id/stats", async (req, res) => {
  return res.sendFile("/Users/sothyrith/code/jort/src/stats.html");
});

function handle(
  handler: (req: express.Request, res: express.Response) => any | Promise<any>
) {
  return async (req: express.Request, res: express.Response) => {
    try {
      return await handler(req, res);
    } catch (err) {
      console.error(err);
      return error(res, "Something went wrong...");
    }
  };
}

function success(
  res: express.Response,
  body: Record<any, any> | null = null,
  status = 200
) {
  return res.status(status).json(body);
}

function badRequest(res: express.Response, message: string) {
  return error(res, message, 400);
}

function error(res: express.Response, message: string, status: number = 500) {
  return res.status(status).json({ error: message });
}

server.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
});
