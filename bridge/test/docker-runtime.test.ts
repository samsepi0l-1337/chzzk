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
const paperOnlyComposeFile = join(repoRoot, "docker-compose.paper.yml");
const entrypoint = join(repoRoot, "docker/paper-entrypoint.sh");
const envExample = join(repoRoot, ".env.example");
const bridgeDockerfile = join(repoRoot, "docker/bridge.Dockerfile");
const dockerignore = join(repoRoot, ".dockerignore");
const packageJsonFile = join(repoRoot, "package.json");
const dockerDocsFile = join(repoRoot, "docs/infra/docker-deployment.md");

function extractBlock(source: string, key: string, indent: number) {
  const lines = source.split("\n");
  const header = `${" ".repeat(indent)}${key}:`;
  const start = lines.findIndex((line) => line === header);

  if (start === -1) {
    throw new Error(`Missing block: ${header}`);
  }

  const blockLines = [];
  for (const line of lines.slice(start + 1)) {
    const leadingSpaces = line.match(/^ */)?.[0].length ?? 0;
    if (line.trim() !== "" && leadingSpaces <= indent) {
      break;
    }
    blockLines.push(line);
  }

  return blockLines.join("\n");
}

function listItems(block: string) {
  return block
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "));
}

function listBridgePackageManifestsCopiedByBridgeImage() {
  return readFileSync(bridgeDockerfile, "utf8")
    .split("\n")
    .flatMap((line) => {
      const match = line.match(/^COPY\s+(.+)\s+\.\/$/);
      if (!match) {
        return [];
      }

      return match[1].split(/\s+/).filter((source) => /^bridge\/package(?:-lock)?\.json$/.test(source));
    });
}

function listDockerignoreEntries() {
  return readFileSync(dockerignore, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));
}

function readScalar(block: string, key: string) {
  const line = block
    .split("\n")
    .map((sourceLine) => sourceLine.trim())
    .find((sourceLine) => sourceLine.startsWith(`${key}:`));

  if (!line) {
    throw new Error(`Missing scalar: ${key}`);
  }

  return line.slice(`${key}:`.length).trim();
}

function parseComposeDurationSeconds(value: string) {
  const match = value.match(/^(\d+)(ms|s|m|h)$/);
  if (!match) {
    throw new Error(`Unsupported compose duration: ${value}`);
  }

  const amount = Number.parseInt(match[1], 10);
  const unitToSeconds = { h: 3600, m: 60, ms: 0.001, s: 1 } as const;
  return amount * unitToSeconds[match[2] as keyof typeof unitToSeconds];
}

describe("Docker runtime configuration", () => {
  test("requires the Minecraft webhook secret through compose interpolation", () => {
    const compose = readFileSync(composeFile, "utf8");

    expect(compose).toContain(
      "MINECRAFT_WEBHOOK_SECRET: ${MINECRAFT_WEBHOOK_SECRET:?MINECRAFT_WEBHOOK_SECRET is required}"
    );
  });

  test("requires CHZZK credentials through compose interpolation", () => {
    const compose = readFileSync(composeFile, "utf8");

    expect(compose).toContain("CHZZK_CLIENT_ID: ${CHZZK_CLIENT_ID:?CHZZK_CLIENT_ID is required}");
    expect(compose).toContain(
      "CHZZK_CLIENT_SECRET: ${CHZZK_CLIENT_SECRET:?CHZZK_CLIENT_SECRET is required}"
    );
  });

  test("keeps only Minecraft published to the host and bridge traffic internal", () => {
    const compose = readFileSync(composeFile, "utf8");
    const paperBlock = extractBlock(compose, "paper", 2);
    const paperPortsBlock = extractBlock(paperBlock, "ports", 4);
    const bridgeBlock = extractBlock(compose, "bridge", 2);
    const bridgeDependsOnBlock = extractBlock(bridgeBlock, "depends_on", 4);
    const bridgeDependsOnPaperBlock = extractBlock(bridgeDependsOnBlock, "paper", 6);

    expect(listItems(paperPortsBlock)).toEqual(['- "25565:25565"']);
    expect(paperPortsBlock).not.toMatch(/29371\s*:\s*29371/);
    expect(paperPortsBlock).not.toMatch(/published:\s*["']?29371["']?/);
    expect(compose).toContain("MINECRAFT_WEBHOOK_URL: http://paper:29371/chzzk/donations");
    expect(compose).toContain(
      "MINECRAFT_WEBHOOK_HEALTH_URL: http://paper:29371/chzzk/donations/health"
    );
    expect(bridgeDependsOnPaperBlock).toContain("condition: service_healthy");
  });

  test("paper-only compose starts Minecraft without the Node bridge or CHZZK credentials", () => {
    const compose = readFileSync(paperOnlyComposeFile, "utf8");
    const paperBlock = extractBlock(compose, "paper", 2);
    const paperPortsBlock = extractBlock(paperBlock, "ports", 4);

    expect(compose).toContain("services:");
    expect(compose).toContain("paper:");
    expect(compose).not.toContain("bridge:");
    expect(compose).not.toContain("CHZZK_CLIENT_ID");
    expect(compose).not.toContain("CHZZK_CLIENT_SECRET");
    expect(compose).not.toContain("CHZZK_REFRESH_TOKEN");
    expect(compose).toContain(
      "MINECRAFT_WEBHOOK_SECRET: ${MINECRAFT_WEBHOOK_SECRET:?MINECRAFT_WEBHOOK_SECRET is required}"
    );
    expect(listItems(paperPortsBlock)).toEqual(['- "25565:25565"']);
  });

  test("root scripts expose a Windows-friendly paper-only Docker command", () => {
    const scripts = JSON.parse(readFileSync(packageJsonFile, "utf8")).scripts;

    expect(scripts["docker:paper:build"]).toBe("docker compose -f docker-compose.paper.yml build");
    expect(scripts["docker:paper:up"]).toBe("docker compose -f docker-compose.paper.yml up --build");
  });

  test("Docker docs explain the Windows Tailscale paper-only path", () => {
    const docs = readFileSync(dockerDocsFile, "utf8");

    expect(docs).toContain("docker-compose.paper.yml");
    expect(docs).toContain("Windows PowerShell");
    expect(docs).toContain("tailscale ip -4");
    expect(docs).toContain("<windows-tailscale-ip>:25565");
    expect(docs).toContain("CHZZK credential");
  });

  test("documents EULA=true as the Docker default template value", () => {
    expect(readFileSync(envExample, "utf8")).toContain("EULA=true");
  });

  test("bridge image keeps the production token store on a volume", () => {
    expect(readFileSync(bridgeDockerfile, "utf8")).toContain('VOLUME ["/data"]');
  });

  test("bridge package manifests copied by Dockerfile are present in build context", () => {
    const manifestSources = [...new Set(listBridgePackageManifestsCopiedByBridgeImage())];
    const ignoredEntries = listDockerignoreEntries();

    expect(manifestSources).toEqual(
      expect.arrayContaining(["bridge/package.json", "bridge/package-lock.json"])
    );
    for (const manifestSource of manifestSources) {
      expect(existsSync(join(repoRoot, manifestSource))).toBe(true);
      expect(ignoredEntries).not.toContain(manifestSource);
    }
  });

  test("paper healthcheck waits long enough for first Paper world generation", () => {
    const compose = readFileSync(composeFile, "utf8");
    const paperBlock = extractBlock(compose, "paper", 2);
    const paperHealthcheckBlock = extractBlock(paperBlock, "healthcheck", 4);
    const intervalSeconds = parseComposeDurationSeconds(readScalar(paperHealthcheckBlock, "interval"));
    const retries = Number.parseInt(readScalar(paperHealthcheckBlock, "retries"), 10);
    const startPeriodSeconds = parseComposeDurationSeconds(
      readScalar(paperHealthcheckBlock, "start_period")
    );

    expect(paperHealthcheckBlock).toContain(
      "curl -fsS http://127.0.0.1:29371/chzzk/donations/health"
    );
    expect(startPeriodSeconds + intervalSeconds * retries).toBeGreaterThanOrEqual(480);
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

  test("paper entrypoint rejects non-true EULA before writing plugin runtime files", () => {
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
          EULA: "false",
          MINECRAFT_WEBHOOK_SECRET: "entrypoint-secret",
          PAPER_SERVER_DIR: serverDir,
          PAPER_PLUGIN_JAR: pluginJar
        },
        encoding: "utf8"
      });

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("Set EULA=true after accepting the Minecraft EULA");
      expect(readFileSync(join(serverDir, "eula.txt"), "utf8")).toBe("eula=false\n");
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
        "shared-secret: |-\n    entrypoint-secret"
      );
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  }, 10_000);

  test("paper entrypoint writes webhook secrets with quotes and newlines as YAML block content", () => {
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
          MINECRAFT_WEBHOOK_SECRET: 'first "quoted" line\nsecond line',
          PAPER_SERVER_DIR: serverDir,
          PAPER_PLUGIN_JAR: pluginJar
        }
      });

      expect(readFileSync(join(serverDir, "plugins/ChzzkDonation/config.yml"), "utf8")).toContain(
        '  shared-secret: |-\n    first "quoted" line\n    second line\n'
      );
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  }, 10_000);
});
