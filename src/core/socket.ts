import type { WebSocket } from "ws";
import { Server } from "ws";
import { z } from "zod";

const server = new Server({ noServer: true });

const connections = new Map<WebSocket, { isAlive: boolean }>();

const WsMessage = z.object({
  event: z.string(),
  payload: z.unknown(),
});

type EventHandler<T extends z.ZodSchema> = (
  data: z.infer<
    z.ZodIntersection<
      z.ZodObject<{ event: z.ZodString }>,
      z.ZodObject<{ payload: T }>
    >
  >,
  response: Responder
) => Promise<void>;

const listeners = new Map<
  string,
  Set<{ schema: z.ZodSchema; handler: EventHandler<any> }>
>();

server.on("connection", (ws) => {
  connections.set(ws, {
    isAlive: true,
  });

  ws.on("message", (message) => {
    const result = WsMessage.safeParse(JSON.parse(message.toString()));
    if (!result.success) {
      return error(ws, { reason: "Invalid message", ...result.error });
    }
    dispatch(ws, result.data);
  });

  ws.on("pong", function heartbeat() {
    connections.set(ws, { ...connections.get(ws), isAlive: true });
  });

  ws.on("close", () => {
    connections.delete(ws);
  });

  return success(ws, { message: "Connected" });
});

const heartbeatInterval = setInterval(function ping() {
  server.clients.forEach((ws) => {
    if (!connections.get(ws)?.isAlive) {
      connections.delete(ws);
      return ws.terminate();
    }

    connections.set(ws, { ...connections.get(ws), isAlive: false });
    ws.ping();
  });
}, 30_000);

server.on("close", () => {
  clearInterval(heartbeatInterval);
});

const connect: typeof server.handleUpgrade = (request, socket, head) => {
  server.handleUpgrade(request, socket, head, (ws) => {
    server.emit("connection", ws, request);
  });
};

function on<PayloadSchema extends z.ZodSchema>(
  event: string,
  schema: PayloadSchema,
  handler: EventHandler<PayloadSchema>
) {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }

  listeners.get(event)!.add({ schema, handler });
}

async function dispatch(
  ws: WebSocket,
  { event, payload }: z.infer<typeof WsMessage>
) {
  if (!listeners.has(event)) {
    return error(ws, { reason: "Invalid event" });
  }

  listeners.get(event)!.forEach(({ schema, handler }) => {
    const result = z
      .intersection(
        z.object({ event: z.string() }),
        z.object({ payload: schema })
      )
      .safeParse({ event, payload });

    if (!result.success) {
      return error(ws, { reason: "Invalid payload", ...result.error });
    }

    handler(result.data, makeResponder(ws));
  });
}

function success(ws: WebSocket, payload: Record<string, any>) {
  ws.send(JSON.stringify({ event: "success", payload }));
}

function error(ws: WebSocket, payload: Record<string, any>) {
  ws.send(JSON.stringify({ event: "error", payload }));
}

function makeResponder(ws: WebSocket) {
  return {
    send: (event: string, payload?: any) =>
      ws.send(JSON.stringify({ event, payload })),
    success: (payload: Record<string, any>) => success(ws, payload),
    error: (payload: Record<string, any>) => error(ws, payload),
    __ws: ws,
  };
}

export type Responder = ReturnType<typeof makeResponder>;

function pool<K = string>() {
  const pool = new Map<K, WebSocket>();

  function add(key: K, responder: Responder) {
    pool.set(key, responder.__ws);
  }

  function get(key: K) {
    if (
      !pool.has(key) ||
      !server.clients.has(pool.get(key)!) ||
      !connections.get(pool.get(key)!)?.isAlive
    ) {
      remove(key);
      return null;
    }

    return makeResponder(pool.get(key)!);
  }

  function remove(key: K) {
    pool.delete(key);
  }

  function forEach(callback: (responder: Responder) => void) {
    pool.forEach((ws) => {
      callback(makeResponder(ws));
    });
  }

  return { add, get, remove, forEach };
}

const socket = {
  connect,
  on,
  pool,
};

export default socket;
