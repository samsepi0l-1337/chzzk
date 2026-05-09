import { randomUUID } from "node:crypto";

export interface ChzzkDonationEvent {
  donationType?: string;
  channelId?: string;
  donatorChannelId?: string;
  donatorNickname?: string;
  payAmount?: unknown;
  donationText?: string;
  emojis?: Record<string, string>;
}

export interface MinecraftDonationPayload {
  eventId: string;
  amount: number;
  donatorNickname: string;
  message: string;
  receivedAt: string;
}

export interface DonationNormalizeDeps {
  now?: () => Date;
  id?: () => string;
}

export function normalizeDonation(
  event: ChzzkDonationEvent,
  deps: DonationNormalizeDeps = {}
): MinecraftDonationPayload {
  const amount = parsePayAmount(event.payAmount);
  const now = deps.now ?? (() => new Date());
  const id = deps.id ?? randomUUID;

  return {
    eventId: id(),
    amount,
    donatorNickname: event.donatorNickname?.trim() || "anonymous",
    message: event.donationText ?? "",
    receivedAt: now().toISOString()
  };
}

export function parsePayAmount(payAmount: unknown): number {
  if (typeof payAmount !== "string") {
    throw new Error(`Invalid payAmount: expected string, got ${typeof payAmount}`);
  }

  const normalized = payAmount.trim().replaceAll(",", "");
  if (!/^[0-9]+$/.test(normalized)) {
    throw new Error(`Invalid payAmount: ${payAmount}`);
  }

  const amount = Number(normalized);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error(`Invalid payAmount: ${payAmount}`);
  }

  return amount;
}

export function isChzzkDonationEvent(value: unknown): value is ChzzkDonationEvent {
  return (
    typeof value === "object" &&
    value !== null &&
    "payAmount" in value
  );
}
