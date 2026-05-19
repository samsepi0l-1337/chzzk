import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { CHZZK_ACCOUNT_INTERLOCK_URL } from "../src/chzzk-oauth";
import { main } from "../src/auth-url-cli";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
  }
});

describe("auth-url cli", () => {
  it("prints the authorization URL from env-file", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "chzzk-auth-url-"));
    const envPath = join(tempDir, ".env");
    await writeFile(
      envPath,
      [
        "CHZZK_CLIENT_ID=client-id",
        "CHZZK_CLIENT_SECRET=client-secret",
        "CHZZK_REDIRECT_URI=http://127.0.0.1:8080/chzzk/oauth/callback"
      ].join("\n"),
      "utf8"
    );

    const logs: string[] = [];
    await main({
      argv: ["--env-file", envPath],
      env: {},
      stdout: {
        log: (value: string) => {
          logs.push(value);
        }
      },
      createOAuthState: () => "state-value"
    });

    const url = new URL(logs[0]);
    expect(url.origin + url.pathname).toBe(CHZZK_ACCOUNT_INTERLOCK_URL);
    expect(url.searchParams.get("clientId")).toBe("client-id");
    expect(url.searchParams.get("redirectUri")).toBe("http://127.0.0.1:8080/chzzk/oauth/callback");
    expect(url.searchParams.get("state")).toBe("state-value");
    expect(logs).toEqual([
      logs[0],
      "state=state-value",
      "CHZZK Developers에 같은 redirectUri를 등록하세요: http://127.0.0.1:8080/chzzk/oauth/callback"
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
      }
    });

    expect(loadEnvFileCalled).toBe(false);
    expect(logs[1]).toBe("state=state-value");
    expect(new URL(logs[0]).searchParams.get("state")).toBe("state-value");
  });
});
