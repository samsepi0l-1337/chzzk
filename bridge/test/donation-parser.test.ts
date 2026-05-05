import { describe, expect, it } from "vitest";
import { normalizeDonation } from "../src/donation-parser";

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
  });
});
