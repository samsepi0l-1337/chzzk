import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";

const repoRoot = resolve(__dirname, "../..");
const scriptNames = [
  "aws-ec2-bootstrap.sh",
  "aws-ec2-deploy.sh",
  "aws-ec2-verify.sh",
  "aws-ec2-backup.sh"
];
const scriptPaths = scriptNames.map((name) => join(repoRoot, "scripts", name));
const awsDocsFile = join(repoRoot, "docs/infra/aws-ec2-deployment.md");

function readScript(name: string) {
  return readFileSync(join(repoRoot, "scripts", name), "utf8");
}

function writeExecutable(path: string, body: string) {
  writeFileSync(path, body);
  chmodSync(path, 0o755);
}

function runScriptWithFakes(
  scriptName: string,
  fakeDocker: string,
  env: NodeJS.ProcessEnv = {},
  fakeTools: Record<string, string> = {}
) {
  const tempDir = mkdtempSync(join(tmpdir(), "chzzk-aws-script-"));
  const binDir = join(tempDir, "bin");
  const dockerLog = join(tempDir, "docker.log");
  mkdirSync(binDir);
  writeExecutable(join(binDir, "docker"), fakeDocker);
  for (const [name, body] of Object.entries(fakeTools)) {
    writeExecutable(join(binDir, name), body);
  }

  const result = spawnSync("bash", [join(repoRoot, "scripts", scriptName)], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      ...env,
      DOCKER_LOG: dockerLog,
      PATH: `${binDir}:${process.env.PATH ?? ""}`
    }
  });
  const log = existsSync(dockerLog) ? readFileSync(dockerLog, "utf8") : "";
  rmSync(tempDir, { recursive: true, force: true });
  return { result, log };
}

const passingComposeFake = `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$DOCKER_LOG"
if [ "$1" = "compose" ] && [ "$2" = "version" ]; then exit 0; fi
if [ "$1" = "compose" ]; then exit 0; fi
exit 1
`;

const deployEnv = {
  EULA: "true",
  CHZZK_CLIENT_ID: "client",
  CHZZK_CLIENT_SECRET: "secret",
  CHZZK_CHANNEL_ID: "channel",
  MINECRAFT_WEBHOOK_SECRET: "webhook"
};

describe("AWS EC2 deployment scripts", () => {
  test("all scripts exist and pass bash syntax checks", () => {
    for (const scriptPath of scriptPaths) {
      expect(existsSync(scriptPath)).toBe(true);
      execFileSync("bash", ["-n", scriptPath], { cwd: repoRoot });
    }
  });

  test("deploy script validates required production env before starting compose", () => {
    const script = readScript("aws-ec2-deploy.sh");

    for (const key of [
      "EULA",
      "CHZZK_CLIENT_ID",
      "CHZZK_CLIENT_SECRET",
      "CHZZK_CHANNEL_ID",
      "MINECRAFT_WEBHOOK_SECRET"
    ]) {
      expect(script).toContain(key);
    }
    expect(script).toContain("compose_cmd+=(--env-file \"$ENV_FILE\")");
    expect(script).toContain("\"${compose_cmd[@]}\" up -d --build");
    expect(script).toContain("docker-compose.yml");
  });

  test("deploy script supports environment-only configuration without a .env file", () => {
    const missingEnvFile = join(tmpdir(), "missing-chzzk-deploy.env");
    const { result, log } = runScriptWithFakes("aws-ec2-deploy.sh", passingComposeFake, {
      ...deployEnv,
      ENV_FILE: missingEnvFile
    });

    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain("missing");
    expect(log).not.toContain("--env-file");
    expect(log).toContain("compose -f docker-compose.yml config");
    expect(log).toContain("compose -f docker-compose.yml ps");
  });

  test("deploy script reuses the selected env file for validation, startup, and status", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "chzzk-aws-env-"));
    const envFile = join(tempDir, "deploy.env");
    writeFileSync(
      envFile,
      [
        "EULA=true",
        "CHZZK_CLIENT_ID=client",
        "CHZZK_CLIENT_SECRET=secret",
        "CHZZK_CHANNEL_ID=channel",
        "MINECRAFT_WEBHOOK_SECRET=webhook"
      ].join("\n")
    );

    const { result, log } = runScriptWithFakes("aws-ec2-deploy.sh", passingComposeFake, {
      ENV_FILE: envFile
    });
    rmSync(tempDir, { recursive: true, force: true });

    expect(result.status).toBe(0);
    expect(log).toContain(`compose --env-file ${envFile} -f docker-compose.yml config`);
    expect(log).toContain(`compose --env-file ${envFile} -f docker-compose.yml up -d --build`);
    expect(log).toContain(`compose --env-file ${envFile} -f docker-compose.yml ps`);
  });

  test("verify script enforces Minecraft-only host exposure", () => {
    const script = readScript("aws-ec2-verify.sh");

    expect(script).toContain('published: "25565"');
    expect(script).toContain('published: "29371"');
    expect(script).toContain("host_port_listens 25565");
    expect(script).toContain("host_port_listens 29371");
    expect(script).toContain("paper health");
    expect(script).toContain("bridge is not running");
  });

  test("verify script parses compose and execs through the selected env file", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "chzzk-aws-verify-"));
    const envFile = join(tempDir, "verify.env");
    writeFileSync(envFile, "COMPOSE_PROJECT_NAME=custom\n");
    const fakeDocker = `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$DOCKER_LOG"
last="\${!#}"
if [ "$1" = "compose" ] && [ "$2" = "version" ]; then exit 0; fi
if [ "$1" = "compose" ]; then
  case "$*" in
    *" config") printf 'services:\\n  paper:\\n    ports:\\n      - published: \"25565\"\\n'; exit 0 ;;
    *" ps -q paper") echo paperid; exit 0 ;;
    *" ps -q bridge") echo bridgeid; exit 0 ;;
    *" exec -T paper"*) exit 0 ;;
  esac
fi
if [ "$1" = "inspect" ]; then
  case "$last" in
    paperid) echo healthy; exit 0 ;;
    bridgeid) echo true; exit 0 ;;
  esac
fi
exit 1
`;
    const fakeSs = `#!/usr/bin/env bash
printf 'State Recv-Q Send-Q Local Address:Port Peer Address:Port\\n'
printf 'LISTEN 0 128 0.0.0.0:25565 0.0.0.0:*\\n'
`;

    const { result, log } = runScriptWithFakes(
      "aws-ec2-verify.sh",
      fakeDocker,
      { ENV_FILE: envFile },
      { ss: fakeSs }
    );
    rmSync(tempDir, { recursive: true, force: true });

    expect(result.status).toBe(0);
    expect(log).toContain(`compose --env-file ${envFile} -f docker-compose.yml config`);
    expect(log).toContain(`compose --env-file ${envFile} -f docker-compose.yml ps -q paper`);
    expect(log).toContain(`compose --env-file ${envFile} -f docker-compose.yml exec -T paper`);
  });

  test("backup script archives both persistent volumes and warns about token secrets", () => {
    const script = readScript("aws-ec2-backup.sh");

    expect(script).toContain("paper-data");
    expect(script).toContain("bridge-data");
    expect(script).toContain("/server");
    expect(script).toContain("/data");
    expect(script).toContain("BACKUP_STOP_STACK");
    expect(script).toContain("token store secrets");
  });

  test("backup script resolves stopped service mounts and restarts after backup failure", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "chzzk-aws-backup-"));
    const envFile = join(tempDir, "backup.env");
    const backupDir = join(tempDir, "backups");
    writeFileSync(envFile, "COMPOSE_PROJECT_NAME=custom\n");
    const fakeDocker = `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$DOCKER_LOG"
last="\${!#}"
if [ "$1" = "compose" ] && [ "$2" = "version" ]; then exit 0; fi
if [ "$1" = "compose" ]; then
  case "$*" in
    *" stop") exit 0 ;;
    *" ps --all -q paper") echo paper_container; exit 0 ;;
    *" ps --all -q bridge") echo bridge_container; exit 0 ;;
    *" up -d") exit 0 ;;
  esac
fi
if [ "$1" = "inspect" ]; then
  case "$last" in
    paper_container) echo custom_paper; exit 0 ;;
    bridge_container) echo custom_bridge; exit 0 ;;
  esac
fi
if [ "$1" = "volume" ] && [ "$2" = "inspect" ]; then
  if [ "$3" = "custom_bridge" ]; then exit 1; fi
  exit 0
fi
if [ "$1" = "run" ]; then exit 0; fi
exit 1
`;

    const { result, log } = runScriptWithFakes("aws-ec2-backup.sh", fakeDocker, {
      BACKUP_STOP_STACK: "true",
      BACKUP_DIR: backupDir,
      ENV_FILE: envFile
    });
    rmSync(tempDir, { recursive: true, force: true });

    expect(result.status).not.toBe(0);
    expect(log).toContain(`compose --env-file ${envFile} -f docker-compose.yml stop`);
    expect(log).toContain(`compose --env-file ${envFile} -f docker-compose.yml ps --all -q paper`);
    expect(log).toContain(`compose --env-file ${envFile} -f docker-compose.yml up -d`);
  });

  test("AWS EC2 docs reference the deployment kit scripts", () => {
    const docs = readFileSync(awsDocsFile, "utf8");

    for (const scriptName of scriptNames) {
      expect(docs).toContain(`scripts/${scriptName}`);
    }
    expect(docs).toContain("29371");
    expect(docs).toContain("25565");
  });

  test("scripts avoid secret value dumping patterns", () => {
    const secretDumpingPatterns = [
      /set -x/,
      /printenv/,
      /cat\s+\"?\$ENV_FILE\"?/,
      /echo\s+\"?\$\{?(MINECRAFT_WEBHOOK_SECRET|CHZZK_CLIENT_SECRET|CHZZK_REFRESH_TOKEN)/,
      /printf\s+['\"][^'\"]*%s[^'\"]*['\"]\s+\"?\$\{?(MINECRAFT_WEBHOOK_SECRET|CHZZK_CLIENT_SECRET|CHZZK_REFRESH_TOKEN)/
    ];

    for (const scriptPath of scriptPaths) {
      const script = readFileSync(scriptPath, "utf8");
      for (const pattern of secretDumpingPatterns) {
        expect(script).not.toMatch(pattern);
      }
    }
  });
});
