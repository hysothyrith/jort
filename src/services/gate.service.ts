import type { Gate, Tenancy } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../core/prisma";
import socket from "../core/socket";

const gates = socket.pool();

socket.on(
  "gate.start",
  z.object({ gateId: z.string() }),
  async ({ payload }, res) => {
    const gate = await prisma.gate.findFirst({ where: { id: payload.gateId } });
    if (!gate) {
      return res.error({ reason: "Gate with given id does not exist." });
    }

    gates.add(payload.gateId, res);
    res.success({ message: "Connected" });
  }
);

function capture(gateId: Gate["id"], tenancyId: Tenancy["id"]) {
  mustGetGate(gateId).send("gate.capture", { tenancyId });
}

function open(gateId: Gate["id"]) {
  mustGetGate(gateId).send("gate.open");
}

function withId(gateId: Gate["id"]) {
  return {
    capture: (tenancyId: Tenancy["id"]) => capture(gateId, tenancyId),
    open: () => open(gateId),
  };
}

function mustGetGate(gateId: Gate["id"]) {
  const gate = gates.get(gateId);
  if (!gate) {
    throw new Error("Gate is not connected");
  }
  return gate;
}

function boot() {}

export const gateService = { boot, withId };
