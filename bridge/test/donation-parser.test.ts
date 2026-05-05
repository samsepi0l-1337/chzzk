import { describe, expect, it } from "vitest";
import { isChzzkDonationEvent, normalizeDonation, parsePayAmount } from "../src/donation-parser";

describe("normalizeDonation", () => {
  it("parses CHZZK payAmount strings into webhook payloads", () => {
    const payload = normalizeDonation(
      {
        channelId: "channel",
        donatorChannelId: "donator-channel",
        donatorNickname: "viewer",
        payAmount: "1,000",
        donationText: "hello"
      },
      {
        now: () => new Date("2026-05-05T00:00:00.000Z"),
        id: () => "evt-1"
      }
    );

    expect(payload).toEqual({
      eventId: "evt-1",
      amount: 1000,
      donatorNickname: "viewer",
      message: "hello",
      receivedAt: "2026-05-05T00:00:00.000Z"
    });
  });

  it("rejects invalid amounts", () => {
    expect(() => normalizeDonation({ payAmount: "10.5" })).toThrow(/Invalid payAmount/);
    expect(() => parsePayAmount(undefined)).toThrow(/expected string, got undefined/);
    expect(() => parsePayAmount("0")).toThrow(/Invalid payAmount: 0/);
    expect(() => parsePayAmount(String(Number.MAX_SAFE_INTEGER + 1))).toThrow(/Invalid payAmount/);
  });

  it("normalizes optional donation fields and detects donation events", () => {
    const payload = normalizeDonation(
      {
        donatorNickname: "  ",
        payAmount: "1000"
      },
      {
        now: () => new Date("2026-05-05T00:00:00.000Z"),
        id: () => "evt-empty"
      }
    );

    expect(payload.donatorNickname).toBe("anonymous");
    expect(payload.message).toBe("");
    expect(isChzzkDonationEvent({ payAmount: "1000" })).toBe(true);
    expect(isChzzkDonationEvent({ amount: 1000 })).toBe(false);
    expect(isChzzkDonationEvent(null)).toBe(false);
  });
});
