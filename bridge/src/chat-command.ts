import { randomUUID } from "node:crypto";
import {
  parsePayAmount,
  type DonationNormalizeDeps,
  type MinecraftDonationPayload
} from "./donation-parser";

const CHAT_DONATION_COMMAND = "!치지직마크";

export interface ChzzkChatEvent {
  channelId?: string;
  senderChannelId?: string;
  profile?: {
    nickname?: string;
  };
  content?: unknown;
  emojis?: Record<string, string>;
  messageTime?: unknown;
}

export function parseChatDonationCommand(content: string): number | null {
  const parts = content.trim().split(/\s+/u);
  if (parts.length !== 2 || parts[0] !== CHAT_DONATION_COMMAND) {
    return null;
  }

  try {
    return parsePayAmount(parts[1]);
  } catch {
    return null;
  }
}

export function normalizeChatDonationCommand(
  event: ChzzkChatEvent,
  deps: DonationNormalizeDeps = {}
): MinecraftDonationPayload | null {
  if (typeof event.content !== "string") {
    return null;
  }

  const content = event.content.trim();
  const amount = parseChatDonationCommand(content);
  if (amount === null) {
    return null;
  }

  const now = deps.now ?? (() => new Date());
  const id = deps.id ?? randomUUID;
  const receivedAt = typeof event.messageTime === "number" && Number.isFinite(event.messageTime)
    ? new Date(event.messageTime).toISOString()
    : now().toISOString();

  return {
    eventId: `chat-test-${id()}`,
    amount,
    donatorNickname: event.profile?.nickname?.trim() || "anonymous",
    message: `chat command: ${content}`,
    receivedAt
  };
}
