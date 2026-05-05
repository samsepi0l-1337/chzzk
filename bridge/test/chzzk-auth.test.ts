import { describe, expect, it } from "vitest";
import { exchangeAuthorizationCode, refreshAccessToken } from "../src/chzzk-auth";

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

  it("reports failed token responses", async () => {
    await expect(refreshAccessToken(
      {
        clientId: "client",
        clientSecret: "secret",
        refreshToken: "old-refresh"
      },
      async () => new Response("bad refresh", { status: 401 })
    )).rejects.toThrow(/401 bad refresh/);
  });
});

describe("exchangeAuthorizationCode", () => {
  it("uses CHZZK authorization_code grant and preserves scope", async () => {
    const requests: unknown[] = [];
    const token = await exchangeAuthorizationCode(
      {
        clientId: "client",
        clientSecret: "secret",
        code: "code",
        state: "state",
        baseUrl: "https://chzzk.test"
      },
      async (url, init) => {
        requests.push({ url, body: JSON.parse(String(init.body)) });
        return new Response(
          JSON.stringify({
            content: {
              accessToken: "access",
              refreshToken: "refresh",
              tokenType: "Bearer",
              expiresIn: "60",
              scope: "donation"
            }
          }),
          { status: 200 }
        );
      },
      new Date("2026-05-05T00:00:00.000Z")
    );

    expect(requests).toEqual([
      {
        url: "https://chzzk.test/auth/v1/token",
        body: {
          grantType: "authorization_code",
          clientId: "client",
          clientSecret: "secret",
          code: "code",
          state: "state"
        }
      }
    ]);
    expect(token.scope).toBe("donation");
    expect(token.expiresAt).toBe("2026-05-05T00:01:00.000Z");
  });

  it("rejects malformed successful token responses", async () => {
    const baseConfig = {
      clientId: "client",
      clientSecret: "secret",
      code: "code",
      state: "state"
    };

    await expect(exchangeAuthorizationCode(baseConfig, async () =>
      new Response(JSON.stringify({}), { status: 200 })
    )).rejects.toThrow(/missing content/);
    await expect(exchangeAuthorizationCode(baseConfig, async () =>
      new Response(JSON.stringify({
        content: {
          accessToken: "access",
          refreshToken: "refresh",
          tokenType: "Bearer",
          expiresIn: "soon"
        }
      }), { status: 200 })
    )).rejects.toThrow(/Invalid CHZZK expiresIn: soon/);
    await expect(exchangeAuthorizationCode(baseConfig, async () =>
      new Response(JSON.stringify({
        content: {
          accessToken: "access",
          refreshToken: "refresh",
          tokenType: "Bearer",
          expiresIn: "0"
        }
      }), { status: 200 })
    )).rejects.toThrow(/Invalid CHZZK expiresIn: 0/);
  });
});
