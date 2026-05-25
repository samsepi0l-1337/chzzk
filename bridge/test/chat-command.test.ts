import { describe, expect, it } from "vitest";
import { normalizeChatDonationCommand, parseChatDonationCommand } from "../src/chat-command";

describe("parseChatDonationCommand", () => {
  it("accepts the CHZZK Minecraft chat test command with exact amount text", () => {
    expect(parseChatDonationCommand("!치지직마크 50,000")).toBe(50000);
  });

  it("ignores normal chat and malformed chat test commands", () => {
    expect(parseChatDonationCommand("hello")).toBeNull();
    expect(parseChatDonationCommand("!치지직마크")).toBeNull();
    expect(parseChatDonationCommand("!치지직마크 1000 now")).toBeNull();
    expect(parseChatDonationCommand("!치지직마크 0")).toBeNull();
  });
});

describe("normalizeChatDonationCommand", () => {
  it("turns a chat test command into a Minecraft webhook donation payload", () => {
    const payload = normalizeChatDonationCommand(
      {
        channelId: "target-channel",
        profile: { nickname: "tester" },
        content: "!치지직마크 1000",
        messageTime: Date.parse("2026-05-05T00:00:00.000Z")
      },
      {
        id: () => "evt-1",
        now: () => new Date("2026-05-06T00:00:00.000Z")
      }
    );

    expect(payload).toEqual({
      eventId: "chat-test-evt-1",
      amount: 1000,
      donatorNickname: "tester",
      message: "chat command: !치지직마크 1000",
      receivedAt: "2026-05-05T00:00:00.000Z"
    });
  });

  it("falls back for anonymous users and missing messageTime", () => {
    const payload = normalizeChatDonationCommand(
      {
        content: "!치지직마크 2000",
        profile: { nickname: " " }
      },
      {
        id: () => "evt-2",
        now: () => new Date("2026-05-06T00:00:00.000Z")
      }
    );

    expect(payload).toMatchObject({
      eventId: "chat-test-evt-2",
      amount: 2000,
      donatorNickname: "anonymous",
      receivedAt: "2026-05-06T00:00:00.000Z"
    });
  });

  it("returns null for non-command chat events", () => {
    expect(normalizeChatDonationCommand({ content: "hello" })).toBeNull();
    expect(normalizeChatDonationCommand({ content: undefined })).toBeNull();
  });
});
