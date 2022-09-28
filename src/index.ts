import cors from "cors";
import express from "express";
import http from "http";
import multer from "multer";
import qrcode from "qrcode";
import { nanoid } from "nanoid";
import { Server } from "socket.io";
import { z } from "zod";
import { validateRequest } from "zod-express-middleware";
import { prisma } from "./core/prisma";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const port = process.env.PORT || 3000;

const inferExtensionFromMimetype = (mimetype: string) =>
  mimetype === "image/jpeg" ? "jpg" : "png";
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "storage/uploads/");
  },
  filename: function (req, file, cb) {
    const extension = inferExtensionFromMimetype(file.mimetype);

    cb(null, `${nanoid()}.${extension}`);
  },
});
const upload = multer({ storage });

app.use(express.json());
app.use(express.raw({ type: "application/vnd.custom-type" }));
app.use(express.text({ type: "text/html" }));
app.use(cors({ origin: "*" }));

io.of("/gate").on("connection", (socket) => {
  socket.on("start", async (payload) => {
    if (await prisma.gate.findFirst({ where: { id: payload.gateId } })) {
      socket.join(`connected_gates#${payload.gateId}`);

      const qr = await qrcode.toDataURL(
        JSON.stringify({ gateId: payload.gateId })
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
      where: { deviceId: deviceId, exitGateId: null, exitTime: null },
    });

    if (!existingTenancy) {
      const tenancy = await prisma.tenancy.create({
        data: { deviceId, entryGateId: gateId, entryTime: new Date() },
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
        data: { exitGateId: gateId, exitTime: new Date() },
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
    const imagesData = images.map((image) => ({
      url: image.path,
      captureTime: new Date(),
    }));

    const isEntry = !Boolean(tenancy.exitGateId);

    if (isEntry) {
      await prisma.tenancy.update({
        where: { id: tenancy.id },
        data: { imageCaptures: { createMany: { data: imagesData } } },
      });

      io.of("/gate")
        .to(`connected_gates#${req.body.gateId}`)
        .emit("toast", { type: "success", message: "Welcome!" });
    } else {
      await prisma.tenancy.update({
        where: { id: tenancy.id },
        data: { imageCaptures: { createMany: { data: imagesData } } },
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
