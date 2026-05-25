import io, { type Socket } from "socket.io-client";
import { normalizeChatDonationCommand, type ChzzkChatEvent } from "./chat-command";
import { normalizeDonation, type ChzzkDonationEvent } from "./donation-parser";
import { CHZZK_OPENAPI_BASE_URL } from "./config";
import type { MinecraftWebhookClient } from "./webhook-client";

export interface ChzzkSessionConfig {
  accessToken: string;
  targetChannelId?: string;
  baseUrl?: string;
  logger?: Pick<Console, "error" | "warn" | "info">;
}

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;
type WebhookClient = Pick<MinecraftWebhookClient, "send">;

interface ChzzkUrlResponse {
  content?: {
    url?: string;
  };
}

interface ChzzkSystemMessage {
  type?: string;
  data?: {
    sessionKey?: string;
  };
}

interface ChzzkTypedMessage {
  eventType?: string;
  type?: string;
  data?: unknown;
}

export async function createUserSessionUrl(
  config: ChzzkSessionConfig,
  fetcher: Fetcher = fetch
): Promise<string> {
  const response = await fetcher(`${config.baseUrl ?? CHZZK_OPENAPI_BASE_URL}/open/v1/sessions/auth`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json"
    }
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`CHZZK session auth failed: ${response.status} ${text}`);
  }

  const parsed = JSON.parse(text) as ChzzkUrlResponse;
  if (!parsed.content?.url) {
    throw new Error("CHZZK session auth response missing url");
  }
  return parsed.content.url;
}

export async function subscribeDonationEvent(
  config: ChzzkSessionConfig,
  sessionKey: string,
  fetcher: Fetcher = fetch
): Promise<void> {
  const url = new URL(`${config.baseUrl ?? CHZZK_OPENAPI_BASE_URL}/open/v1/sessions/events/subscribe/donation`);
  url.searchParams.set("sessionKey", sessionKey);

  const response = await fetcher(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`CHZZK donation subscribe failed: ${response.status} ${await response.text()}`);
  }
}

export async function subscribeChatEvent(
  config: ChzzkSessionConfig,
  sessionKey: string,
  fetcher: Fetcher = fetch
): Promise<void> {
  const url = new URL(`${config.baseUrl ?? CHZZK_OPENAPI_BASE_URL}/open/v1/sessions/events/subscribe/chat`);
  url.searchParams.set("sessionKey", sessionKey);

  const response = await fetcher(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`CHZZK chat subscribe failed: ${response.status} ${await response.text()}`);
  }
}

export async function startChzzkDonationSession(
  config: ChzzkSessionConfig,
  webhookClient: WebhookClient,
  fetcher: Fetcher = fetch
): Promise<Socket> {
  const sessionUrl = await createUserSessionUrl(config, fetcher);
  const socket = io(sessionUrl, {
    reconnection: true,
    forceNode: true,
    forceNew: true,
    timeout: 3000,
    transports: ["websocket"]
  });
  const logger = config.logger ?? console;

  socket.on("SYSTEM", (message) => {
    void logFailure(logger, "CHZZK SYSTEM handling failed", () =>
      handleSystemMessage(config, parseSessionMessage(message), fetcher, logger)
    );
  });
  socket.on("DONATION", (message) => {
    void logFailure(logger, "CHZZK DONATION delivery failed", () =>
      handleDonationMessage(config, parseSessionMessage(message), webhookClient, logger)
    );
  });
  socket.on("CHAT", (message) => {
    void logFailure(logger, "CHZZK CHAT command delivery failed", () =>
      handleChatMessage(config, parseSessionMessage(message), webhookClient, logger)
    );
  });
  socket.on("message", (message) => {
    void logFailure(logger, "CHZZK typed message handling failed", () =>
      handleTypedMessage(config, parseSessionMessage(message), webhookClient, fetcher, logger)
    );
  });
  socket.on("connect_error", (error) => {
    logger.error("CHZZK socket connection failed", error);
  });
  socket.on("disconnect", (reason) => {
    logger.warn("CHZZK socket disconnected", reason);
  });

  return socket;
}

function parseSessionMessage(message: unknown): unknown {
  if (typeof message !== "string") {
    return message;
  }

  try {
    return JSON.parse(message) as unknown;
  } catch {
    return message;
  }
}

async function handleSystemMessage(
  config: ChzzkSessionConfig,
  message: unknown,
  fetcher: Fetcher,
  logger: Pick<Console, "info">
): Promise<void> {
  const system = message as ChzzkSystemMessage;
  if (system.type === "connected" && system.data?.sessionKey) {
    await subscribeDonationEvent(config, system.data.sessionKey, fetcher);
    await subscribeChatEvent(config, system.data.sessionKey, fetcher);
    logger.info("Subscribed CHZZK session events", {
      events: ["DONATION", "CHAT"]
    });
  }
}

async function handleTypedMessage(
  config: ChzzkSessionConfig,
  message: unknown,
  webhookClient: WebhookClient,
  fetcher: Fetcher,
  logger: Pick<Console, "info">
): Promise<void> {
  const typed = message as ChzzkTypedMessage;
  if (typed.eventType === "SYSTEM" || typed.type === "SYSTEM") {
    await handleSystemMessage(config, parseSessionMessage(typed.data ?? message), fetcher, logger);
    return;
  }
  if (typed.eventType === "DONATION" || typed.type === "DONATION") {
    await handleDonationMessage(config, parseSessionMessage(typed.data ?? message), webhookClient, logger);
    return;
  }
  if (typed.eventType === "CHAT" || typed.type === "CHAT") {
    await handleChatMessage(config, parseSessionMessage(typed.data ?? message), webhookClient, logger);
  }
}

async function handleDonationMessage(
  config: ChzzkSessionConfig,
  message: unknown,
  webhookClient: WebhookClient,
  logger: Pick<Console, "info">
): Promise<void> {
  const donation = message as ChzzkDonationEvent;
  const matchesTarget = !config.targetChannelId || donation.channelId === config.targetChannelId;
  logger.info("Received CHZZK donation", {
    hasChannelId: Boolean(donation.channelId),
    matchesTarget,
    payAmountType: typeof donation.payAmount,
    donationType: donation.donationType ?? null,
    hasMessage: Boolean(donation.donationText)
  });

  if (config.targetChannelId && donation.channelId !== config.targetChannelId) {
    logger.info("Ignored CHZZK donation from non-target channel", {
      channelId: donation.channelId ?? null,
      targetChannelId: config.targetChannelId
    });
    return;
  }

  const payload = normalizeDonation(donation);
  logger.info("Forwarding CHZZK donation to Minecraft webhook", {
    eventId: payload.eventId,
    amount: payload.amount
  });
  const delivery = await webhookClient.send(payload);
  logger.info("Forwarded CHZZK donation to Minecraft webhook", {
    eventId: payload.eventId,
    amount: payload.amount,
    webhookStatus: delivery.status,
    webhookBody: delivery.body
  });
}

async function handleChatMessage(
  config: ChzzkSessionConfig,
  message: unknown,
  webhookClient: WebhookClient,
  logger: Pick<Console, "info">
): Promise<void> {
  const chat = message as ChzzkChatEvent;
  if (config.targetChannelId && chat.channelId !== config.targetChannelId) {
    logger.info("Ignored CHZZK chat from non-target channel", {
      channelId: chat.channelId ?? null,
      targetChannelId: config.targetChannelId
    });
    return;
  }

  const payload = normalizeChatDonationCommand(chat);
  if (payload === null) {
    return;
  }
  await webhookClient.send(payload);
}

async function logFailure(
  logger: Pick<Console, "error">,
  message: string,
  action: () => Promise<void>
): Promise<void> {
  try {
    await action();
  } catch (error) {
    logger.error(message, error);
  }
}
