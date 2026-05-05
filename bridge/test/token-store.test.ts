import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { TokenStore } from "../src/token-store";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
  }
});

describe("TokenStore", () => {
  it("persists replacement tokens", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "chzzk-token-"));
    const path = join(tempDir, "tokens.json");
    const store = new TokenStore(path);

    await store.save({
      accessToken: "access",
      refreshToken: "refresh",
      tokenType: "Bearer",
      expiresAt: "2026-05-06T00:00:00.000Z"
    });

    await store.save({
      accessToken: "next-access",
      refreshToken: "next-refresh",
      tokenType: "Bearer",
      expiresAt: "2026-05-07T00:00:00.000Z"
    });

    await expect(store.load()).resolves.toMatchObject({ refreshToken: "next-refresh" });
    expect(await readFile(path, "utf8")).toContain("next-access");
  });
});
