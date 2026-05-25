import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { CHZZK_OPENAPI_BASE_URL } from "../src/config";
import { main } from "../src/auth-login-cli";
import type { StoredToken } from "../src/token-store";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
  }
});

describe("auth-login cli", () => {
  it("logs in and stores exchanged tokens from env-file", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "chzzk-auth-login-"));
    const envPath = join(tempDir, ".env");
    await writeFile(
      envPath,
      [
        "CHZZK_CLIENT_ID=client-id",
        "CHZZK_CLIENT_SECRET=client-secret",
        "CHZZK_TOKEN_STORE=/tmp/tokens.json",
        "CHZZK_REDIRECT_URI=http://127.0.0.1:8080/chzzk/oauth/callback"
      ].join("\n"),
      "utf8"
    );

    const logs: string[] = [];
    const callbackRequests: unknown[] = [];
    const exchangeRequests: unknown[] = [];
    const savedTokens: StoredToken[] = [];
    let tokenStorePath: string | undefined;

    await main({
      argv: ["--env-file", envPath],
      env: {},
      stdout: {
        log: (value: string) => {
          logs.push(value);
        }
      },
      createOAuthState: () => "state-value",
      startOAuthCallbackServer: async (options) => {
        callbackRequests.push(options);
        return { code: "code-value", state: "state-value" };
      },
      exchangeAuthorizationCode: async (options) => {
        exchangeRequests.push(options);
        return {
          accessToken: "access-token",
          refreshToken: "refresh-token",
          tokenType: "Bearer",
          expiresAt: "2026-05-17T00:00:00.000Z"
        };
      },
      createTokenStore: (path) => {
        tokenStorePath = path;
        return {
          save: async (token) => {
            savedTokens.push(token);
          }
        };
      }
    });

    const url = new URL(logs[1]);
    expect(logs[0]).toBe("브라우저에서 아래 URL로 CHZZK 로그인을 진행하세요.");
    expect(url.searchParams.get("clientId")).toBe("client-id");
    expect(url.searchParams.get("state")).toBe("state-value");
    expect(logs[2]).toBe("state=state-value");
    expect(logs[3]).toBe("CHZZK Developers에 같은 redirectUri를 등록하세요: http://127.0.0.1:8080/chzzk/oauth/callback");
    expect(logs[4]).toBe("토큰 저장 완료: /tmp/tokens.json");
    expect(callbackRequests).toEqual([
      {
        redirectUri: "http://127.0.0.1:8080/chzzk/oauth/callback",
        expectedState: "state-value",
        bindHost: undefined
      }
    ]);
    expect(exchangeRequests).toEqual([
      {
        clientId: "client-id",
        clientSecret: "client-secret",
        code: "code-value",
        state: "state-value",
        baseUrl: CHZZK_OPENAPI_BASE_URL
      }
    ]);
    expect(tokenStorePath).toBe("/tmp/tokens.json");
    expect(savedTokens).toEqual([
      {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        tokenType: "Bearer",
        expiresAt: "2026-05-17T00:00:00.000Z"
      }
    ]);
  });

  it("uses existing env without loading an env-file", async () => {
    const logs: string[] = [];
    let loadEnvFileCalled = false;

    await main({
      argv: [],
      env: {
        CHZZK_CLIENT_ID: "client-id",
        CHZZK_CLIENT_SECRET: "client-secret"
      },
      stdout: {
        log: (value: string) => {
          logs.push(value);
        }
      },
      createOAuthState: () => "state-value",
      loadEnvFile: async () => {
        loadEnvFileCalled = true;
      },
      startOAuthCallbackServer: async () => ({
        code: "code-value",
        state: "state-value"
      }),
      exchangeAuthorizationCode: async () => ({
        accessToken: "access-token",
        refreshToken: "refresh-token",
        tokenType: "Bearer",
        expiresAt: "2026-05-17T00:00:00.000Z"
      }),
      createTokenStore: () => ({
        save: async () => {}
      })
    });

    expect(loadEnvFileCalled).toBe(false);
    expect(logs[2]).toBe("state=state-value");
    expect(new URL(logs[1]).searchParams.get("state")).toBe("state-value");
  });

  it("passes an explicit callback bind host for EC2 public redirects", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "chzzk-auth-login-"));
    const envPath = join(tempDir, ".env");
    await writeFile(
      envPath,
      [
        "CHZZK_CLIENT_ID=client-id",
        "CHZZK_CLIENT_SECRET=client-secret",
        "CHZZK_REDIRECT_URI=http://203.0.113.42:8080/chzzk/oauth/callback",
        "CHZZK_AUTH_CALLBACK_BIND_HOST=0.0.0.0"
      ].join("\n"),
      "utf8"
    );

    const logs: string[] = [];
    const callbackRequests: unknown[] = [];

    await main({
      argv: ["--env-file", envPath],
      env: {},
      stdout: {
        log: (value: string) => {
          logs.push(value);
        }
      },
      createOAuthState: () => "state-value",
      startOAuthCallbackServer: async (options) => {
        callbackRequests.push(options);
        return { code: "code-value", state: "state-value" };
      },
      exchangeAuthorizationCode: async () => ({
        accessToken: "access-token",
        refreshToken: "refresh-token",
        tokenType: "Bearer",
        expiresAt: "2026-05-17T00:00:00.000Z"
      }),
      createTokenStore: () => ({
        save: async () => {}
      })
    });

    expect(logs).toContain("OAuth callback bind host: 0.0.0.0");
    expect(callbackRequests).toEqual([
      {
        redirectUri: "http://203.0.113.42:8080/chzzk/oauth/callback",
        expectedState: "state-value",
        bindHost: "0.0.0.0"
      }
    ]);
  });
});
