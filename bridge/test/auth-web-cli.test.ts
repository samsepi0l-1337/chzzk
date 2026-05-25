import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { main } from "../src/auth-web-cli";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
  }
});

describe("auth web cli", () => {
  it("loads env-file and starts the auth web server", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "chzzk-auth-web-"));
    const envPath = join(tempDir, ".env");
    await writeFile(
      envPath,
      [
        "CHZZK_CLIENT_ID=client-id",
        "CHZZK_CLIENT_SECRET=client-secret",
        "CHZZK_REDIRECT_URI=http://203.0.113.42:8080/chzzk/oauth/callback",
        "CHZZK_AUTH_CALLBACK_BIND_HOST=0.0.0.0",
        "CHZZK_AUTH_PAGE_SECRET=page-secret",
        "CHZZK_TOKEN_STORE=/tmp/tokens.json"
      ].join("\n"),
      "utf8"
    );

    const logs: string[] = [];
    const startedServers: unknown[] = [];

    await main({
      argv: ["--env-file", envPath, "--once"],
      env: {},
      stdout: {
        log: (value: string) => {
          logs.push(value);
        }
      },
      startAuthWebServer: async (options) => {
        startedServers.push(options);
        return {
          loginUrl: "http://203.0.113.42:8080/chzzk/oauth/login?secret=page-secret",
          close: async () => {}
        };
      }
    });

    expect(startedServers).toEqual([
      {
        redirectUri: "http://203.0.113.42:8080/chzzk/oauth/callback",
        bindHost: "0.0.0.0",
        clientId: "client-id",
        clientSecret: "client-secret",
        pageSecret: "page-secret",
        tokenStorePath: "/tmp/tokens.json",
        baseUrl: "https://openapi.chzzk.naver.com"
      }
    ]);
    expect(logs).toEqual([
      "CHZZK 스트리머 인증 페이지가 열렸습니다.",
      "접속 URL: http://203.0.113.42:8080/chzzk/oauth/login?secret=page-secret",
      "CHZZK Developers 로그인 리디렉션 URL: http://203.0.113.42:8080/chzzk/oauth/callback"
    ]);
  });

  it("requires an auth page secret", async () => {
    await expect(
      main({
        argv: ["--once"],
        env: {
          CHZZK_CLIENT_ID: "client-id",
          CHZZK_CLIENT_SECRET: "client-secret"
        },
        stdout: { log: () => {} },
        startAuthWebServer: async () => {
          throw new Error("should not start without a page secret");
        }
      })
    ).rejects.toThrow("Missing required environment variable: CHZZK_AUTH_PAGE_SECRET");
  });

  it("keeps the auth web server running without --once", async () => {
    const logs: string[] = [];
    let waited = false;

    await main({
      argv: [],
      env: {
        CHZZK_CLIENT_ID: "client-id",
        CHZZK_CLIENT_SECRET: "client-secret",
        CHZZK_AUTH_PAGE_SECRET: "page-secret"
      },
      stdout: {
        log: (value: string) => {
          logs.push(value);
        }
      },
      startAuthWebServer: async () => ({
        loginUrl: "http://127.0.0.1:8080/chzzk/oauth/login?secret=page-secret",
        close: async () => {
          throw new Error("should not close persistent auth web server");
        }
      }),
      waitUntilStopped: async () => {
        waited = true;
      }
    });

    expect(waited).toBe(true);
    expect(logs[1]).toBe("접속 URL: http://127.0.0.1:8080/chzzk/oauth/login?secret=page-secret");
  });
});
