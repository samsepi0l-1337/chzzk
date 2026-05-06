import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";

const repoRoot = resolve(__dirname, "../..");
const composeFile = join(repoRoot, "docker-compose.yml");
const entrypoint = join(repoRoot, "docker/paper-entrypoint.sh");
const envExample = join(repoRoot, ".env.example");
const bridgeDockerfile = join(repoRoot, "docker/bridge.Dockerfile");

function composeConfig(env: NodeJS.ProcessEnv = {}) {
  return spawnSync("docker", ["compose", "-f", composeFile, "config", "--format", "json"], {
    cwd: repoRoot,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      ...env
    },
    encoding: "utf8"
  });
}

describe("Docker runtime configuration", () => {
  test("requires the Minecraft webhook secret during compose config", () => {
    const result = composeConfig({
      EULA: "true",
      CHZZK_CLIENT_ID: "test-client-id",
      CHZZK_CLIENT_SECRET: "test-client-secret",
      MINECRAFT_WEBHOOK_SECRET: ""
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("MINECRAFT_WEBHOOK_SECRET is required");
  });

  test("requires CHZZK credentials during compose config", () => {
    const result = composeConfig({
      EULA: "true",
      CHZZK_CLIENT_ID: "",
      CHZZK_CLIENT_SECRET: "",
      MINECRAFT_WEBHOOK_SECRET: "test-secret"
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("CHZZK_CLIENT_ID is required");
  });

  test("renders compose config with only Minecraft published to the host", () => {
    const result = composeConfig({
      EULA: "true",
      CHZZK_CLIENT_ID: "test-client-id",
      CHZZK_CLIENT_SECRET: "test-client-secret",
      MINECRAFT_WEBHOOK_SECRET: "test-secret"
    });

    expect(result.status).toBe(0);
    const config = JSON.parse(result.stdout);

    expect(config.services.paper.ports).toEqual([
      expect.objectContaining({ published: "25565", target: 25565 })
    ]);
    expect(JSON.stringify(config.services.paper.ports)).not.toContain("29371");
    expect(config.services.bridge.environment.MINECRAFT_WEBHOOK_URL).toBe(
      "http://paper:29371/chzzk/donations"
    );
    expect(config.services.bridge.environment.MINECRAFT_WEBHOOK_HEALTH_URL).toBe(
      "http://paper:29371/chzzk/donations/health"
    );
    expect(config.services.bridge.environment.CHZZK_CLIENT_ID).toBe("test-client-id");
    expect(config.services.bridge.environment.CHZZK_CLIENT_SECRET).toBe("test-client-secret");
    expect(config.services.bridge.depends_on.paper.condition).toBe("service_healthy");
  });

  test("documents EULA=true as the Docker default template value", () => {
    expect(readFileSync(envExample, "utf8")).toContain("EULA=true");
  });

  test("bridge image keeps the production token store on a volume", () => {
    expect(readFileSync(bridgeDockerfile, "utf8")).toContain('VOLUME ["/data"]');
  });

  test("paper entrypoint fails before writing runtime files when the webhook secret is missing", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "chzzk-paper-entrypoint-"));
    const serverDir = join(tempDir, "server");
    const pluginJar = join(tempDir, "chzzk-donation.jar");
    mkdirSync(serverDir);
    writeFileSync(pluginJar, "fake jar");

    try {
      const result = spawnSync("sh", [entrypoint, "true"], {
        cwd: repoRoot,
        env: {
          PATH: process.env.PATH,
          EULA: "true",
          MINECRAFT_WEBHOOK_SECRET: "",
          PAPER_SERVER_DIR: serverDir,
          PAPER_PLUGIN_JAR: pluginJar
        },
        encoding: "utf8"
      });

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("MINECRAFT_WEBHOOK_SECRET is required");
      expect(existsSync(join(serverDir, "eula.txt"))).toBe(false);
      expect(existsSync(join(serverDir, "plugins/chzzk-donation.jar"))).toBe(false);
      expect(existsSync(join(serverDir, "plugins/ChzzkDonation/config.yml"))).toBe(false);
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  test("paper entrypoint writes EULA and injects the webhook secret into plugin config", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "chzzk-paper-entrypoint-"));
    const serverDir = join(tempDir, "server");
    const pluginJar = join(tempDir, "chzzk-donation.jar");
    mkdirSync(serverDir);
    writeFileSync(pluginJar, "fake jar");

    try {
      execFileSync("sh", [entrypoint, "true"], {
        cwd: repoRoot,
        env: {
          ...process.env,
          EULA: "true",
          MINECRAFT_WEBHOOK_SECRET: "entrypoint-secret",
          PAPER_SERVER_DIR: serverDir,
          PAPER_PLUGIN_JAR: pluginJar
        }
      });

      expect(readFileSync(join(serverDir, "eula.txt"), "utf8")).toBe("eula=true\n");
      expect(readFileSync(join(serverDir, "plugins/ChzzkDonation/config.yml"), "utf8")).toContain(
        'shared-secret: "entrypoint-secret"'
      );
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });
});
