import { describe, expect, it } from "vitest";
import { refreshAccessToken } from "../src/chzzk-auth";

describe("refreshAccessToken", () => {
  it("uses CHZZK refresh_token grant and stores the replacement refresh token", async () => {
    const requests: unknown[] = [];
    const fetcher = async (url: string, init: RequestInit) => {
      requests.push({ url, body: JSON.parse(String(init.body)) });
      return new Response(
        JSON.stringify({
          content: {
            accessToken: "new-access",
            refreshToken: "new-refresh",
            tokenType: "Bearer",
            expiresIn: "86400"
          }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    };

    const token = await refreshAccessToken(
      {
        clientId: "client",
        clientSecret: "secret",
        refreshToken: "old-refresh"
      },
      fetcher,
      new Date("2026-05-05T00:00:00.000Z")
    );

    expect(requests).toEqual([
      {
        url: "https://openapi.chzzk.naver.com/auth/v1/token",
        body: {
          grantType: "refresh_token",
          refreshToken: "old-refresh",
          clientId: "client",
          clientSecret: "secret"
        }
      }
    ]);
    expect(token.refreshToken).toBe("new-refresh");
    expect(token.expiresAt).toBe("2026-05-06T00:00:00.000Z");
  });
});
