import { io, type Socket } from "socket.io-client";
import { normalizeDonation, type ChzzkDonationEvent } from "./donation-parser";
import { CHZZK_OPENAPI_BASE_URL } from "./config";
import type { MinecraftWebhookClient } from "./webhook-client";

export interface ChzzkSessionConfig {
  accessToken: string;
  baseUrl?: string;
  logger?: Pick<Console, "error" | "warn" | "info">;
}

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

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
  const response = await fetcher(
    `${config.baseUrl ?? CHZZK_OPENAPI_BASE_URL}/open/v1/sessions/events/subscribe/donation`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ sessionKey })
    }
  );

  if (!response.ok) {
    throw new Error(`CHZZK donation subscribe failed: ${response.status} ${await response.text()}`);
  }
}

export async function startChzzkDonationSession(
  config: ChzzkSessionConfig,
  webhookClient: MinecraftWebhookClient,
  fetcher: Fetcher = fetch
): Promise<Socket> {
  const sessionUrl = await createUserSessionUrl(config, fetcher);
  const socket = io(sessionUrl, {
    reconnection: true,
    forceNew: true,
    timeout: 3000,
    transports: ["websocket"]
  });
  const logger = config.logger ?? console;

  socket.on("SYSTEM", (message) => {
    void logFailure(logger, "CHZZK SYSTEM handling failed", () =>
      handleSystemMessage(config, message, fetcher)
    );
  });
  socket.on("DONATION", (message) => {
    void logFailure(logger, "CHZZK DONATION delivery failed", () =>
      handleDonationMessage(message, webhookClient)
    );
  });
  socket.on("message", (message) => {
    void logFailure(logger, "CHZZK typed message handling failed", () =>
      handleTypedMessage(config, message, webhookClient, fetcher)
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

async function handleSystemMessage(
  config: ChzzkSessionConfig,
  message: unknown,
  fetcher: Fetcher
): Promise<void> {
  const system = message as ChzzkSystemMessage;
  if (system.type === "connected" && system.data?.sessionKey) {
    await subscribeDonationEvent(config, system.data.sessionKey, fetcher);
  }
}

async function handleTypedMessage(
  config: ChzzkSessionConfig,
  message: unknown,
  webhookClient: MinecraftWebhookClient,
  fetcher: Fetcher
): Promise<void> {
  const typed = message as ChzzkTypedMessage;
  if (typed.eventType === "SYSTEM" || typed.type === "SYSTEM") {
    await handleSystemMessage(config, typed.data ?? message, fetcher);
    return;
  }
  if (typed.eventType === "DONATION" || typed.type === "DONATION") {
    await handleDonationMessage(typed.data ?? message, webhookClient);
  }
}

async function handleDonationMessage(
  message: unknown,
  webhookClient: MinecraftWebhookClient
): Promise<void> {
  const donation = message as ChzzkDonationEvent;
  await webhookClient.send(normalizeDonation(donation));
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
