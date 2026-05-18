import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { loadEnvFile } from "../src/load-env-file";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
  }
});

describe("loadEnvFile", () => {
  it("loads values from env files", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "chzzk-env-"));
    const envPath = join(tempDir, ".env");

    await writeFile(
      envPath,
      `
# comment
=missing-key
SIMPLE=value
SPACED = spaced value
DOUBLE="quoted value"
SINGLE='single quoted value'
MIXED=one=two=three
EMPTY=
NO_EQUALS
PRESERVE=from-file
`,
      "utf8"
    );

    const env: NodeJS.ProcessEnv = {
      PRESERVE: "keep-me"
    };

    await loadEnvFile(envPath, env);

    expect(env).toMatchObject({
      SIMPLE: "value",
      SPACED: "spaced value",
      DOUBLE: "quoted value",
      SINGLE: "single quoted value",
      MIXED: "one=two=three",
      EMPTY: "",
      NO_EQUALS: "",
      PRESERVE: "keep-me"
    });
  });
});
