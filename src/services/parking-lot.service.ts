import socket from "../core/socket";
import { z } from "zod";
import { prisma } from "../core/prisma";

const parkingLots = socket.pool();

socket.on(
  "stats.subscribe",
  z.object({
    parkingLotId: z.string(),
  }),
  async ({ payload }, res) => {
    const parkingLot = await prisma.parkingLot.findFirst({
      where: { id: payload.parkingLotId },
    });
    if (!parkingLot) {
      return res.error({ reason: "Parking lot with given id does not exist." });
    }

    res.send("stats.changed", {
      smallVehicleCapacity: 0,
      smallVehicleCapacityAvailable: 0,
      largeVehicleCapacity: 0,
      largeVehicleCapacityAvailable: 0,
    });

    parkingLots.add(payload.parkingLotId, res);
  }
);

let t = 0;
setInterval(() => {
  t++;
  parkingLots.forEach((res) => {
    res.send("stats.changed", {
      smallVehicleCapacity: t,
      smallVehicleCapacityAvailable: 0,
      largeVehicleCapacity: 0,
      largeVehicleCapacityAvailable: 0,
    });
  });
}, 1000);

function boot() {}

export const parkingLotService = { boot };
