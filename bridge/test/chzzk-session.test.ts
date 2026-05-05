import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createUserSessionUrl,
  startChzzkDonationSession,
  subscribeDonationEvent
} from "../src/chzzk-session";

const { ioMock, socket } = vi.hoisted(() => {
  type Handler = (...args: unknown[]) => void;
  const handlers = new Map<string, Handler[]>();
  const fakeSocket = {
    on(event: string, handler: Handler) {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
      return fakeSocket;
    },
    emit(event: string, ...args: unknown[]) {
      for (const handler of handlers.get(event) ?? []) {
        handler(...args);
      }
    },
    removeAllListeners() {
      handlers.clear();
    }
  };

  return {
    socket: fakeSocket,
    ioMock: vi.fn(() => fakeSocket)
  };
});

vi.mock("socket.io-client", () => ({
  default: ioMock
}));

const sessionConfig = {
  accessToken: "access",
  baseUrl: "https://chzzk.test"
};

function okJson(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

async function flush(): Promise<void> {
  for (let index = 0; index < 10; index += 1) {
    await Promise.resolve();
  }
}

describe("createUserSessionUrl", () => {
  it("requests a user session URL with bearer auth", async () => {
    const requests: { url: string; auth: string | null }[] = [];
    const url = await createUserSessionUrl(sessionConfig, async (requestUrl, init) => {
      requests.push({
        url: requestUrl,
        auth: new Headers(init.headers).get("Authorization")
      });
      return okJson({ content: { url: "wss://session.test/socket" } });
    });

    expect(url).toBe("wss://session.test/socket");
    expect(requests).toEqual([
      {
        url: "https://chzzk.test/open/v1/sessions/auth",
        auth: "Bearer access"
      }
    ]);
  });

  it("reports failed and malformed session URL responses", async () => {
    await expect(createUserSessionUrl(sessionConfig, async () =>
      new Response("denied", { status: 401 })
    )).rejects.toThrow(/401 denied/);
    await expect(createUserSessionUrl(sessionConfig, async () =>
      okJson({ content: {} })
    )).rejects.toThrow(/missing url/);
  });

  it("uses the official CHZZK base URL by default", async () => {
    const requests: string[] = [];
    await createUserSessionUrl({ accessToken: "access" }, async (url) => {
      requests.push(url);
      return okJson({ content: { url: "wss://session.test/socket" } });
    });

    expect(requests).toEqual([
      "https://openapi.chzzk.naver.com/open/v1/sessions/auth"
    ]);
  });
});

describe("subscribeDonationEvent", () => {
  it("subscribes the connected session to donation events", async () => {
    const requests: { url: string; body: unknown }[] = [];
    await subscribeDonationEvent(sessionConfig, "session-key", async (url, init) => {
      requests.push({ url, body: JSON.parse(String(init.body)) });
      return new Response(null, { status: 204 });
    });

    expect(requests).toEqual([
      {
        url: "https://chzzk.test/open/v1/sessions/events/subscribe/donation",
        body: { sessionKey: "session-key" }
      }
    ]);
  });

  it("reports failed donation subscriptions", async () => {
    await expect(subscribeDonationEvent(sessionConfig, "session-key", async () =>
      new Response("bad session", { status: 400 })
    )).rejects.toThrow(/400 bad session/);
  });

  it("uses the official CHZZK base URL for subscriptions by default", async () => {
    const requests: string[] = [];
    await subscribeDonationEvent({ accessToken: "access" }, "session-key", async (url) => {
      requests.push(url);
      return new Response(null, { status: 204 });
    });

    expect(requests).toEqual([
      "https://openapi.chzzk.naver.com/open/v1/sessions/events/subscribe/donation"
    ]);
  });
});

describe("startChzzkDonationSession", () => {
  beforeEach(() => {
    ioMock.mockClear();
    socket.removeAllListeners();
  });

  it("connects with Socket.IO options and handles native CHZZK events", async () => {
    const fetchCalls: { url: string; body?: unknown }[] = [];
    const sent: unknown[] = [];
    const socketInstance = await startChzzkDonationSession(
      sessionConfig,
      { send: vi.fn(async (payload) => sent.push(payload)) },
      async (url, init) => {
        fetchCalls.push({
          url,
          body: init.body ? JSON.parse(String(init.body)) : undefined
        });
        if (init.method === "GET") {
          return okJson({ content: { url: "wss://session.test/socket" } });
        }
        return new Response(null, { status: 204 });
      }
    );

    socket.emit("SYSTEM", { type: "connected", data: { sessionKey: "session-1" } });
    socket.emit("SYSTEM", { type: "connected", data: {} });
    socket.emit("SYSTEM", { type: "subscribed" });
    socket.emit("DONATION", {
      payAmount: "1,000",
      donatorNickname: "viewer",
      donationText: "hello"
    });
    await flush();

    expect(socketInstance).toBe(socket);
    expect(ioMock).toHaveBeenCalledWith("wss://session.test/socket", {
      reconnection: true,
      forceNew: true,
      timeout: 3000,
      transports: ["websocket"]
    });
    expect(fetchCalls[1]).toEqual({
      url: "https://chzzk.test/open/v1/sessions/events/subscribe/donation",
      body: { sessionKey: "session-1" }
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      amount: 1000,
      donatorNickname: "viewer",
      message: "hello"
    });
  });

  it("routes typed message envelopes by eventType and type", async () => {
    const subscribed: unknown[] = [];
    const sent: unknown[] = [];
    await startChzzkDonationSession(
      sessionConfig,
      { send: vi.fn(async (payload) => sent.push(payload)) },
      async (_url, init) => {
        if (init.method === "GET") {
          return okJson({ content: { url: "wss://session.test/socket" } });
        }
        subscribed.push(JSON.parse(String(init.body)));
        return new Response(null, { status: 204 });
      }
    );

    socket.emit("message", {
      eventType: "SYSTEM",
      data: { type: "connected", data: { sessionKey: "event-type-key" } }
    });
    socket.emit("message", {
      type: "SYSTEM",
      data: { type: "connected", data: { sessionKey: "type-key" } }
    });
    socket.emit("message", {
      eventType: "DONATION",
      data: { payAmount: "2,000", donatorNickname: "a", donationText: "x" }
    });
    socket.emit("message", {
      type: "DONATION",
      data: { payAmount: "3,000", donatorNickname: "b", donationText: "y" }
    });
    socket.emit("message", {
      eventType: "SYSTEM",
      type: "connected",
      data: { sessionKey: "message-key" }
    });
    socket.emit("message", {
      eventType: "SYSTEM",
      type: "connected"
    });
    socket.emit("message", {
      eventType: "DONATION",
      payAmount: "4,000",
      donatorNickname: "c",
      donationText: "z"
    });
    socket.emit("message", { eventType: "IGNORED" });
    await flush();

    expect(subscribed).toEqual([
      { sessionKey: "event-type-key" },
      { sessionKey: "type-key" }
    ]);
    expect(sent).toHaveLength(3);
    expect(sent).toEqual([
      expect.objectContaining({ amount: 2000, donatorNickname: "a" }),
      expect.objectContaining({ amount: 3000, donatorNickname: "b" }),
      expect.objectContaining({ amount: 4000, donatorNickname: "c" })
    ]);
  });

  it("logs async event handling and socket failures", async () => {
    const logger = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn()
    };
    await startChzzkDonationSession(
      { ...sessionConfig, logger },
      { send: vi.fn(async () => { throw new Error("send failed"); }) },
      async (_url, init) => {
        if (init.method === "GET") {
          return okJson({ content: { url: "wss://session.test/socket" } });
        }
        return new Response("subscribe failed", { status: 500 });
      }
    );

    socket.emit("SYSTEM", { type: "connected", data: { sessionKey: "bad" } });
    socket.emit("DONATION", { payAmount: "1000" });
    socket.emit("message", {
      eventType: "SYSTEM",
      data: { type: "connected", data: { sessionKey: "bad-typed" } }
    });
    socket.emit("connect_error", new Error("connect failed"));
    socket.emit("disconnect", "transport close");
    await flush();

    expect(logger.error).toHaveBeenCalledWith(
      "CHZZK socket connection failed",
      expect.any(Error)
    );
    expect(logger.error).toHaveBeenCalledWith(
      "CHZZK SYSTEM handling failed",
      expect.any(Error)
    );
    expect(logger.error).toHaveBeenCalledWith(
      "CHZZK DONATION delivery failed",
      expect.any(Error)
    );
    expect(logger.error).toHaveBeenCalledWith(
      "CHZZK typed message handling failed",
      expect.any(Error)
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "CHZZK socket disconnected",
      "transport close"
    );
  });
});
