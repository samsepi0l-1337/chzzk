import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createUserSessionUrl,
  startChzzkDonationSession,
  subscribeChatEvent,
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
  baseUrl: "https://chzzk.test",
  targetChannelId: "target-channel"
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
    const requests: { url: string; body?: BodyInit | null }[] = [];
    await subscribeDonationEvent(sessionConfig, "session-key", async (url, init) => {
      requests.push({ url, body: init.body });
      return new Response(null, { status: 204 });
    });

    expect(requests).toEqual([
      {
        url: "https://chzzk.test/open/v1/sessions/events/subscribe/donation?sessionKey=session-key",
        body: undefined
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
      "https://openapi.chzzk.naver.com/open/v1/sessions/events/subscribe/donation?sessionKey=session-key"
    ]);
  });
});

describe("subscribeChatEvent", () => {
  it("subscribes the connected session to chat events", async () => {
    const requests: { url: string; body?: BodyInit | null }[] = [];
    await subscribeChatEvent(sessionConfig, "session-key", async (url, init) => {
      requests.push({ url, body: init.body });
      return new Response(null, { status: 204 });
    });

    expect(requests).toEqual([
      {
        url: "https://chzzk.test/open/v1/sessions/events/subscribe/chat?sessionKey=session-key",
        body: undefined
      }
    ]);
  });

  it("reports failed chat subscriptions", async () => {
    await expect(subscribeChatEvent(sessionConfig, "session-key", async () =>
      new Response("bad session", { status: 400 })
    )).rejects.toThrow(/400 bad session/);
  });

  it("uses the official CHZZK base URL for chat subscriptions by default", async () => {
    const requests: string[] = [];
    await subscribeChatEvent({ accessToken: "access" }, "session-key", async (url) => {
      requests.push(url);
      return new Response(null, { status: 204 });
    });

    expect(requests).toEqual([
      "https://openapi.chzzk.naver.com/open/v1/sessions/events/subscribe/chat?sessionKey=session-key"
    ]);
  });
});

describe("startChzzkDonationSession", () => {
  beforeEach(() => {
    ioMock.mockClear();
    socket.removeAllListeners();
  });

  it("connects with Socket.IO options and handles native CHZZK events", async () => {
    const fetchCalls: { url: string; body?: BodyInit | null }[] = [];
    const sent: unknown[] = [];
    const socketInstance = await startChzzkDonationSession(
      sessionConfig,
      { send: vi.fn(async (payload) => sent.push(payload)) },
      async (url, init) => {
        fetchCalls.push({
          url,
          body: init.body
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
      channelId: "target-channel",
      payAmount: "1,000",
      donatorNickname: "viewer",
      donationText: "hello"
    });
    socket.emit("DONATION", {
      channelId: "other-channel",
      payAmount: "1,000",
      donatorNickname: "ignored-viewer",
      donationText: "ignored"
    });
    socket.emit("DONATION", {
      payAmount: "1,000",
      donatorNickname: "missing-channel",
      donationText: "ignored"
    });
    socket.emit("CHAT", {
      channelId: "target-channel",
      profile: { nickname: "chat-tester" },
      content: "!치지직마크 2,000",
      messageTime: Date.parse("2026-05-05T00:00:00.000Z")
    });
    socket.emit("CHAT", {
      channelId: "other-channel",
      profile: { nickname: "ignored-chat" },
      content: "!치지직마크 3,000"
    });
    socket.emit("CHAT", {
      profile: { nickname: "missing-channel-chat" },
      content: "!치지직마크 4,000"
    });
    socket.emit("CHAT", {
      channelId: "target-channel",
      profile: { nickname: "normal-chat" },
      content: "hello"
    });
    await flush();

    expect(socketInstance).toBe(socket);
    expect(ioMock).toHaveBeenCalledWith("wss://session.test/socket", {
      reconnection: true,
      forceNode: true,
      forceNew: true,
      timeout: 3000,
      transports: ["websocket"]
    });
    expect(fetchCalls.slice(1)).toEqual([
      {
        url: "https://chzzk.test/open/v1/sessions/events/subscribe/donation?sessionKey=session-1",
        body: undefined
      },
      {
        url: "https://chzzk.test/open/v1/sessions/events/subscribe/chat?sessionKey=session-1",
        body: undefined
      }
    ]);
    expect(sent).toHaveLength(2);
    expect(sent[0]).toMatchObject({
      amount: 1000,
      donatorNickname: "viewer",
      message: "hello"
    });
    expect(sent[1]).toMatchObject({
      amount: 2000,
      donatorNickname: "chat-tester",
      message: "chat command: !치지직마크 2,000",
      receivedAt: "2026-05-05T00:00:00.000Z"
    });
  });

  it("routes typed message envelopes by eventType and type", async () => {
    const subscribed: string[] = [];
    const sent: unknown[] = [];
    await startChzzkDonationSession(
      sessionConfig,
      { send: vi.fn(async (payload) => sent.push(payload)) },
      async (url, init) => {
        if (init.method === "GET") {
          return okJson({ content: { url: "wss://session.test/socket" } });
        }
        subscribed.push(url);
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
      data: {
        channelId: "target-channel",
        payAmount: "2,000",
        donatorNickname: "a",
        donationText: "x"
      }
    });
    socket.emit("message", {
      type: "DONATION",
      data: {
        channelId: "target-channel",
        payAmount: "3,000",
        donatorNickname: "b",
        donationText: "y"
      }
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
      channelId: "target-channel",
      payAmount: "4,000",
      donatorNickname: "c",
      donationText: "z"
    });
    socket.emit("message", {
      eventType: "CHAT",
      data: {
        channelId: "target-channel",
        profile: { nickname: "chat-a" },
        content: "!치지직마크 10,000"
      }
    });
    socket.emit("message", {
      type: "CHAT",
      data: {
        channelId: "target-channel",
        profile: { nickname: "chat-b" },
        content: "!치지직마크 30,000"
      }
    });
    socket.emit("message", {
      eventType: "CHAT",
      channelId: "target-channel",
      profile: { nickname: "chat-c" },
      content: "!치지직마크 50,000"
    });
    socket.emit("message", {
      eventType: "DONATION",
      data: {
        channelId: "other-channel",
        payAmount: "5,000",
        donatorNickname: "ignored",
        donationText: "no"
      }
    });
    socket.emit("message", {
      type: "DONATION",
      data: {
        payAmount: "6,000",
        donatorNickname: "missing",
        donationText: "no"
      }
    });
    socket.emit("message", { eventType: "IGNORED" });
    await flush();

    expect(subscribed).toHaveLength(4);
    expect(subscribed).toEqual(expect.arrayContaining([
      "https://chzzk.test/open/v1/sessions/events/subscribe/donation?sessionKey=event-type-key",
      "https://chzzk.test/open/v1/sessions/events/subscribe/chat?sessionKey=event-type-key",
      "https://chzzk.test/open/v1/sessions/events/subscribe/donation?sessionKey=type-key",
      "https://chzzk.test/open/v1/sessions/events/subscribe/chat?sessionKey=type-key"
    ]));
    expect(sent).toHaveLength(6);
    expect(sent).toEqual([
      expect.objectContaining({ amount: 2000, donatorNickname: "a" }),
      expect.objectContaining({ amount: 3000, donatorNickname: "b" }),
      expect.objectContaining({ amount: 4000, donatorNickname: "c" }),
      expect.objectContaining({ amount: 10000, donatorNickname: "chat-a" }),
      expect.objectContaining({ amount: 30000, donatorNickname: "chat-b" }),
      expect.objectContaining({ amount: 50000, donatorNickname: "chat-c" })
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
    socket.emit("DONATION", { channelId: "target-channel", payAmount: "1000" });
    socket.emit("CHAT", {
      channelId: "target-channel",
      profile: { nickname: "chat" },
      content: "!치지직마크 1000"
    });
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
      "CHZZK CHAT command delivery failed",
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
