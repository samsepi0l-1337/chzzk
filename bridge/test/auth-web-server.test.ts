import net from "node:net";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { startAuthWebServer } from "../src/auth-web-server";
import type { StoredToken } from "../src/token-store";

async function getFreePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to allocate a free port"));
        return;
      }
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(address.port);
      });
    });
  });
}

let cleanup: (() => Promise<void>) | undefined;
let tempDir: string | undefined;

afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe("startAuthWebServer", () => {
  it("serves a protected login page and stores the callback token", async () => {
    const port = await getFreePort();
    const savedTokens: StoredToken[] = [];
    const server = await startAuthWebServer({
      redirectUri: `http://127.0.0.1:${port}/chzzk/oauth/callback`,
      clientId: "client-id",
      clientSecret: "client-secret",
      pageSecret: "page-secret",
      tokenStorePath: "/tmp/tokens.json",
      createOAuthState: () => "state-value",
      exchangeAuthorizationCode: async (options) => {
        expect(options).toEqual({
          clientId: "client-id",
          clientSecret: "client-secret",
          code: "code-value",
          state: "state-value",
          baseUrl: "https://openapi.chzzk.naver.com"
        });
        return {
          accessToken: "access-token",
          refreshToken: "refresh-token",
          tokenType: "Bearer",
          expiresAt: "2026-05-25T00:00:00.000Z",
          scope: "donation chat"
        };
      },
      createTokenStore: (path) => {
        expect(path).toBe("/tmp/tokens.json");
        return {
          save: async (token) => {
            savedTokens.push(token);
          }
        };
      }
    });
    cleanup = server.close;

    const forbidden = await fetch(`http://127.0.0.1:${port}/chzzk/oauth/login`);
    expect(forbidden.status).toBe(403);

    const login = await fetch(`http://127.0.0.1:${port}/chzzk/oauth/login?secret=page-secret`);
    expect(login.status).toBe(200);
    const loginHtml = await login.text();
    expect(loginHtml).toContain("CHZZK 스트리머 인증");
    expect(loginHtml).toContain("clientId=client-id");
    expect(loginHtml).toContain("state=state-value");
    expect(loginHtml).toContain(
      encodeURIComponent(`http://127.0.0.1:${port}/chzzk/oauth/callback`)
    );

    const callback = await fetch(
      `http://127.0.0.1:${port}/chzzk/oauth/callback?code=code-value&state=state-value`
    );
    expect(callback.status).toBe(200);
    expect(await callback.text()).toContain("토큰 저장이 완료되었습니다.");
    expect(savedTokens).toEqual([
      {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        tokenType: "Bearer",
        expiresAt: "2026-05-25T00:00:00.000Z",
        scope: "donation chat"
      }
    ]);
  });

  it("rejects callbacks for states that were not issued by the login page", async () => {
    const port = await getFreePort();
    const server = await startAuthWebServer({
      redirectUri: `http://127.0.0.1:${port}/chzzk/oauth/callback`,
      clientId: "client-id",
      clientSecret: "client-secret",
      pageSecret: "page-secret",
      tokenStorePath: "/tmp/tokens.json",
      createOAuthState: () => "state-value",
      exchangeAuthorizationCode: async () => {
        throw new Error("should not exchange unissued state");
      },
      createTokenStore: () => ({
        save: async () => {
          throw new Error("should not save unissued state");
        }
      })
    });
    cleanup = server.close;

    const callback = await fetch(
      `http://127.0.0.1:${port}/chzzk/oauth/callback?code=code-value&state=state-value`
    );

    expect(callback.status).toBe(400);
    expect(await callback.text()).toContain("알 수 없는 OAuth state입니다.");
  });

  it("returns not found for unknown paths", async () => {
    const port = await getFreePort();
    const server = await startAuthWebServer({
      redirectUri: `http://127.0.0.1:${port}/chzzk/oauth/callback`,
      clientId: "client-id",
      clientSecret: "client-secret",
      pageSecret: "page-secret",
      tokenStorePath: "/tmp/tokens.json"
    });
    cleanup = server.close;

    const response = await fetch(`http://127.0.0.1:${port}/unknown`);

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not Found");
  });

  it("binds public redirect hosts on all interfaces by default", async () => {
    const port = await getFreePort();
    const server = await startAuthWebServer({
      redirectUri: `http://203.0.113.42:${port}/chzzk/oauth/callback`,
      clientId: "client-id",
      clientSecret: "client-secret",
      pageSecret: "page-secret",
      tokenStorePath: "/tmp/tokens.json",
      createOAuthState: () => "state-value"
    });
    cleanup = server.close;

    const response = await fetch(`http://127.0.0.1:${port}/chzzk/oauth/login?secret=page-secret`);

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("CHZZK 스트리머 인증");
  });

  it("stores callback tokens with the default token store", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "chzzk-auth-web-store-"));
    const tokenStorePath = join(tempDir, "tokens.json");
    const port = await getFreePort();
    const server = await startAuthWebServer({
      redirectUri: `http://127.0.0.1:${port}/chzzk/oauth/callback`,
      clientId: "client-id",
      clientSecret: "client-secret",
      pageSecret: "page-secret",
      tokenStorePath,
      createOAuthState: () => "state-value",
      exchangeAuthorizationCode: async () => ({
        accessToken: "access-token",
        refreshToken: "refresh-token",
        tokenType: "Bearer",
        expiresAt: "2026-05-25T00:00:00.000Z"
      })
    });
    cleanup = server.close;

    await fetch(`http://127.0.0.1:${port}/chzzk/oauth/login?secret=page-secret`);
    const callback = await fetch(
      `http://127.0.0.1:${port}/chzzk/oauth/callback?code=code-value&state=state-value`
    );

    expect(callback.status).toBe(200);
    expect(JSON.parse(await readFile(tokenStorePath, "utf8"))).toEqual({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      tokenType: "Bearer",
      expiresAt: "2026-05-25T00:00:00.000Z"
    });
  });

  it("shows token exchange errors on the callback page", async () => {
    const port = await getFreePort();
    const server = await startAuthWebServer({
      redirectUri: `http://127.0.0.1:${port}/chzzk/oauth/callback`,
      clientId: "client-id",
      clientSecret: "client-secret",
      pageSecret: "page-secret",
      tokenStorePath: "/tmp/tokens.json",
      createOAuthState: () => "state-value",
      exchangeAuthorizationCode: async () => {
        throw new Error("<token failed>");
      }
    });
    cleanup = server.close;

    await fetch(`http://127.0.0.1:${port}/chzzk/oauth/login?secret=page-secret`);
    const callback = await fetch(
      `http://127.0.0.1:${port}/chzzk/oauth/callback?code=code-value&state=state-value`
    );

    expect(callback.status).toBe(500);
    expect(await callback.text()).toContain("&lt;token failed&gt;");
  });

  it("renders non-error token exchange failures", async () => {
    const port = await getFreePort();
    const server = await startAuthWebServer({
      redirectUri: `http://127.0.0.1:${port}/chzzk/oauth/callback`,
      clientId: "client-id",
      clientSecret: "client-secret",
      pageSecret: "page-secret",
      tokenStorePath: "/tmp/tokens.json",
      createOAuthState: () => "state-value",
      exchangeAuthorizationCode: async () => {
        throw "token failed";
      }
    });
    cleanup = server.close;

    await fetch(`http://127.0.0.1:${port}/chzzk/oauth/login?secret=page-secret`);
    const callback = await fetch(
      `http://127.0.0.1:${port}/chzzk/oauth/callback?code=code-value&state=state-value`
    );

    expect(callback.status).toBe(500);
    expect(await callback.text()).toContain("token failed");
  });
});
