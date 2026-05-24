import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";

const repoRoot = resolve(__dirname, "../..");
const scriptNames = ["aws-ec2-provision.sh", "aws-ec2-user-data.sh", "aws-ec2-bootstrap.sh", "aws-ec2-deploy.sh", "aws-ec2-pregenerate.sh", "aws-ec2-verify.sh", "aws-ec2-backup.sh"];
const scriptPaths = scriptNames.map((name) => join(repoRoot, "scripts", name));
const awsDocsFile = join(repoRoot, "docs/infra/aws-ec2-deployment.md");
const awsConfigExampleFile = join(repoRoot, "config/aws-ec2.env.example");
const rootPackageFile = join(repoRoot, "package.json");

function readScript(name: string) {
  return readFileSync(join(repoRoot, "scripts", name), "utf8");
}

function writeExecutable(path: string, body: string) {
  writeFileSync(path, body);
  chmodSync(path, 0o755);
}

function runScriptWithFakes(scriptName: string, fakeDocker: string, env: NodeJS.ProcessEnv = {}, fakeTools: Record<string, string> = {}) {
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

const deployEnv = { EULA: "true", CHZZK_CLIENT_ID: "client", CHZZK_CLIENT_SECRET: "secret", CHZZK_CHANNEL_ID: "channel", MINECRAFT_WEBHOOK_SECRET: "webhook" };
const provisionBaseConfig = ["AWS_REGION=ap-northeast-2", "AWS_EC2_APPLY=false", "EC2_INSTANCE_TYPE=t4g.xlarge", "EC2_KEY_NAME=test-key", "SSH_CIDR=203.0.113.10/32", "MINECRAFT_CIDR=0.0.0.0/0", "ROOT_VOLUME_SIZE_GB=20", "EC2_USER_DATA_FILE="];

function writeTempAwsConfig(prefix: string, extraLines: string[] = []) {
  const tempDir = mkdtempSync(join(tmpdir(), prefix));
  const configFile = join(tempDir, "aws.env");
  writeFileSync(configFile, [...provisionBaseConfig, ...extraLines].join("\n"));
  return { tempDir, configFile };
}

const fakeApplyAws = `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$DOCKER_LOG"
case "$*" in
  *"authorize-security-group-ingress"*) exit 0 ;;
  *"allocate-address"*) echo eipalloc-1234567890abcdef0; exit 0 ;;
  *"associate-address"*) echo eipassoc-1234567890abcdef0; exit 0 ;;
  *"describe-addresses"*) echo 203.0.113.42; exit 0 ;;
  *"run-instances"*) echo i-1234567890abcdef0; exit 0 ;;
  *"wait instance-running"*) exit 0 ;;
  *"describe-instances"*) echo ec2-203-0-113-10.ap-northeast-2.compute.amazonaws.com; exit 0 ;;
esac
exit 1
`;

const fakeCreateSecurityGroupAws = `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$DOCKER_LOG"
case "$*" in
  *"describe-vpcs"*) echo vpc-default; exit 0 ;;
  *"describe-security-groups"*) echo None; exit 0 ;;
  *"create-security-group"*) echo sg-created; exit 0 ;;
  *"authorize-security-group-ingress"*) exit 0 ;;
  *"allocate-address"*) echo eipalloc-1234567890abcdef0; exit 0 ;;
  *"associate-address"*) echo eipassoc-1234567890abcdef0; exit 0 ;;
  *"describe-addresses"*) echo 203.0.113.42; exit 0 ;;
  *"run-instances"*) echo i-1234567890abcdef0; exit 0 ;;
  *"wait instance-running"*) exit 0 ;;
  *"describe-instances"*) echo ec2-203-0-113-10.ap-northeast-2.compute.amazonaws.com; exit 0 ;;
esac
exit 1
`;

const fakeGradle = `#!/usr/bin/env bash
printf 'gradle %s\\n' "$*" >> "$DOCKER_LOG"
mkdir -p "$PWD/plugin/build/libs"
printf 'jar\\n' > "$PWD/plugin/build/libs/chzzk-donation-0.1.0.jar"
`;

const fakeNpm = `#!/usr/bin/env bash
printf 'npm %s\\n' "$*" >> "$DOCKER_LOG"
`;

const fakeDownloadCurl = `#!/usr/bin/env bash
printf 'curl %s\\n' "$*" >> "$DOCKER_LOG"
out=
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-o" ]; then shift; out="$1"; fi
  shift || true
done
if [ -n "$out" ]; then mkdir -p "$(dirname "$out")"; printf 'paper\\n' > "$out"; fi
`;

const fakeTmux = `#!/usr/bin/env bash
printf 'tmux %s\\n' "$*" >> "$DOCKER_LOG"
`;

describe("AWS EC2 deployment scripts", () => {
  test("all scripts exist and pass bash syntax checks", () => {
    for (const scriptPath of scriptPaths) {
      expect(existsSync(scriptPath)).toBe(true);
      execFileSync("bash", ["-n", scriptPath], { cwd: repoRoot });
    }
  });

  test("AWS EC2 config example separates AWS resource settings from app secrets", () => {
    const config = readFileSync(awsConfigExampleFile, "utf8");

    expect(config).toContain("AWS_REGION=ap-northeast-2");
    expect(config).toContain("EC2_INSTANCE_TYPE=t4g.xlarge");
    expect(config).toContain("EC2_ALLOCATE_ELASTIC_IP=true");
    expect(config).toContain("al2023-ami-kernel-default-arm64");
    expect(config).toContain("EC2_KEY_NAME=");
    expect(config).toContain("SSH_CIDR=203.0.113.10/32");
    expect(config).toContain("MINECRAFT_CIDR=0.0.0.0/0");
    expect(config).toContain("ROOT_VOLUME_SIZE_GB=20");
    expect(config).toContain("AWS_EC2_APPLY=false");
    expect(config).not.toContain("MINECRAFT_WEBHOOK_SECRET");
    expect(config).not.toContain("CHZZK_CLIENT_SECRET");
    expect(config).not.toContain("CHZZK_REFRESH_TOKEN");
  });

  test("provision script is plan-only by default and avoids AWS API calls", () => {
    const { tempDir, configFile } = writeTempAwsConfig("chzzk-aws-plan-");
    const fakeAws = `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$DOCKER_LOG"
exit 99
`;

    const { result, log } = runScriptWithFakes(
      "aws-ec2-provision.sh",
      passingComposeFake,
      { CONFIG_FILE: configFile },
      { aws: fakeAws }
    );
    rmSync(tempDir, { recursive: true, force: true });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Plan only");
    expect(log).toBe("");
  });

  test("provision script creates only SSH and Minecraft ingress when explicitly applied", () => {
    const { tempDir, configFile } = writeTempAwsConfig("chzzk-aws-apply-", [
      "EC2_SECURITY_GROUP_ID=sg-existing"
    ]);

    const { result, log } = runScriptWithFakes(
      "aws-ec2-provision.sh",
      passingComposeFake,
      { CONFIG_FILE: configFile, AWS_EC2_APPLY: "true" },
      { aws: fakeApplyAws }
    );
    rmSync(tempDir, { recursive: true, force: true });

    expect(result.status).toBe(0);
    expect(log).toContain("--port 22 --cidr 203.0.113.10/32");
    expect(log).toContain("--port 25565 --cidr 0.0.0.0/0");
    expect(log).toContain("run-instances");
    expect(log).toContain("allocate-address");
    expect(log).toContain("associate-address");
    expect(log).toContain("--metadata-options HttpTokens=required,HttpEndpoint=enabled");
    expect(log).not.toContain("--port 29371");
  });

  test("provision script creates a reusable security group without contaminating the id", () => {
    const { tempDir, configFile } = writeTempAwsConfig("chzzk-aws-sg-");

    const { result, log } = runScriptWithFakes(
      "aws-ec2-provision.sh",
      passingComposeFake,
      { CONFIG_FILE: configFile, AWS_EC2_APPLY: "true" },
      { aws: fakeCreateSecurityGroupAws }
    );
    rmSync(tempDir, { recursive: true, force: true });

    expect(result.status).toBe(0);
    expect(log).toContain("describe-vpcs");
    expect(log).toContain("create-security-group");
    expect(log).toContain("--security-group-ids sg-created");
    expect(log).not.toContain("--security-group-ids [aws-ec2-provision]");
  });

  test("deploy script supports native tmux deployment without Docker or a .env file", () => {
    const missingEnvFile = join(tmpdir(), "missing-chzzk-deploy.env");
    const runtimeDir = mkdtempSync(join(tmpdir(), "chzzk-aws-runtime-"));
    const { result, log } = runScriptWithFakes(
      "aws-ec2-deploy.sh",
      passingComposeFake,
      {
        ...deployEnv,
        AWS_RUNTIME_DIR: runtimeDir,
        ENV_FILE: missingEnvFile,
        GRADLE_CMD: "gradle",
        NPM_CMD: "npm",
        CURL_CMD: "curl",
        AWS_PROCESS_MANAGER: "tmux"
      },
      { gradle: fakeGradle, npm: fakeNpm, curl: fakeDownloadCurl, tmux: fakeTmux }
    );

    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain("missing");
    expect(log).toContain("gradle --no-daemon :plugin:shadowJar");
    expect(log).toContain("npm --prefix");
    expect(log).toContain("prune --omit=dev");
    expect(log).toContain("curl -fsSL");
    expect(log).toContain("tmux new-session -d -s chzzk-paper");
    expect(log).toContain("tmux new-session -d -s chzzk-bridge");
    expect(log).not.toContain("compose");
    expect(readFileSync(join(runtimeDir, "paper/plugins/ChzzkDonation/config.yml"), "utf8")).toContain('host: "127.0.0.1"');
    const serverProperties = readFileSync(join(runtimeDir, "paper/server.properties"), "utf8");
    expect(serverProperties).toContain("network-compression-threshold=256");
    expect(serverProperties).toContain("use-native-transport=true");
    expect(serverProperties).toContain("difficulty=easy");
    const paperGlobal = readFileSync(join(runtimeDir, "paper/config/paper-global.yml"), "utf8");
    expect(paperGlobal).toContain("io-threads: 3");
    expect(paperGlobal).toContain("worker-threads: 4");
    expect(paperGlobal).toContain("player-max-chunk-load-rate: 2400.0");
    expect(paperGlobal).toContain("player-max-chunk-send-rate: 1800.0");
    expect(paperGlobal).toContain("player-max-concurrent-chunk-loads: 96");
    const paperWorldDefaults = readFileSync(join(runtimeDir, "paper/config/paper-world-defaults.yml"), "utf8");
    expect(paperWorldDefaults).toContain("delay-chunk-unloads-by: 180s");
    const bridgeStarter = readFileSync(join(runtimeDir, "bin/start-bridge.sh"), "utf8");
    expect(bridgeStarter).toContain('export NODE_ENV="production"');
    expect(bridgeStarter).toContain('export NODE_OPTIONS="--max-old-space-size=256"');
    expect(bridgeStarter).toContain('export UV_THREADPOOL_SIZE="2"');
    expect(bridgeStarter).toContain('exec "node"');
    expect(bridgeStarter).toContain("dist/index.js");
    expect(bridgeStarter).not.toContain("npm\" run start");
    rmSync(runtimeDir, { recursive: true, force: true });
  });

  test("deploy script reuses the selected env file for native startup scripts", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "chzzk-aws-env-"));
    const envFile = join(tempDir, "deploy.env");
    const runtimeDir = join(tempDir, "runtime");
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

    const { result, log } = runScriptWithFakes(
      "aws-ec2-deploy.sh",
      passingComposeFake,
      {
        AWS_RUNTIME_DIR: runtimeDir,
        ENV_FILE: envFile,
        GRADLE_CMD: "gradle",
        NPM_CMD: "npm",
        CURL_CMD: "curl",
        AWS_PROCESS_MANAGER: "tmux"
      },
      { gradle: fakeGradle, npm: fakeNpm, curl: fakeDownloadCurl, tmux: fakeTmux }
    );
    const bridgeStarter = readFileSync(join(runtimeDir, "bin/start-bridge.sh"), "utf8");
    rmSync(tempDir, { recursive: true, force: true });

    expect(result.status).toBe(0);
    expect(bridgeStarter).toContain(`. "${envFile}"`);
    expect(bridgeStarter).toContain("CHZZK_TOKEN_STORE");
    expect(bridgeStarter).toContain("NODE_ENV");
    expect(log).not.toContain("compose");
  });

  test("verify script checks tmux sessions and loopback webhook without Docker", () => {
    const fakeDocker = `#!/usr/bin/env bash
printf 'docker %s\\n' "$*" >> "$DOCKER_LOG"
exit 99
`;
    const fakeSs = `#!/usr/bin/env bash
printf 'State Recv-Q Send-Q Local Address:Port Peer Address:Port\\n'
printf 'LISTEN 0 128 0.0.0.0:25565 0.0.0.0:*\\n'
printf 'LISTEN 0 128 [::ffff:127.0.0.1]:29371 0.0.0.0:*\\n'
`;
    const fakeHealthCurl = `#!/usr/bin/env bash
printf 'curl %s\\n' "$*" >> "$DOCKER_LOG"
printf '{"status":"ok"}\\n'
`;
    const fakeHasTmux = `#!/usr/bin/env bash
printf 'tmux %s\\n' "$*" >> "$DOCKER_LOG"
case "$*" in *"has-session"*) exit 0 ;; esac
`;

    const { result, log } = runScriptWithFakes(
      "aws-ec2-verify.sh",
      fakeDocker,
      { AWS_PROCESS_MANAGER: "tmux" },
      { ss: fakeSs, curl: fakeHealthCurl, tmux: fakeHasTmux }
    );

    expect(result.status).toBe(0);
    expect(log).toContain("tmux has-session -t chzzk-paper");
    expect(log).toContain("tmux has-session -t chzzk-bridge");
    expect(log).toContain("curl -fsS http://127.0.0.1:29371/chzzk/donations/health");
    expect(log).not.toContain("docker");
  });

  test("backup script archives native runtime directories and warns about token secrets", () => {
    const script = readScript("aws-ec2-backup.sh");

    expect(script).toContain("AWS_RUNTIME_DIR");
    expect(script).toContain("PAPER_DIR");
    expect(script).toContain("BRIDGE_DATA_DIR");
    expect(script).toContain("BACKUP_STOP_STACK");
    expect(script).toContain("token store secrets");
    expect(script).not.toContain("docker volume");
  });

  test("backup script archives native paper and bridge data without Docker", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "chzzk-aws-backup-"));
    const backupDir = join(tempDir, "backups");
    const runtimeDir = join(tempDir, "runtime");
    mkdirSync(join(runtimeDir, "paper"), { recursive: true });
    mkdirSync(join(runtimeDir, "bridge"), { recursive: true });
    writeFileSync(join(runtimeDir, "paper/world.txt"), "world");
    writeFileSync(join(runtimeDir, "bridge/.chzzk-tokens.json"), "{}");
    const fakeDocker = `#!/usr/bin/env bash
printf 'docker %s\\n' "$*" >> "$DOCKER_LOG"
exit 1
`;

    const { result, log } = runScriptWithFakes("aws-ec2-backup.sh", fakeDocker, {
      BACKUP_DIR: backupDir,
      AWS_RUNTIME_DIR: runtimeDir
    });
    const backupFiles = existsSync(backupDir) ? readdirSync(backupDir) : [];
    rmSync(tempDir, { recursive: true, force: true });

    expect(result.status).toBe(0);
    expect(log).not.toContain("docker");
    expect(backupFiles.some((name) => name.startsWith("paper-"))).toBe(true);
    expect(backupFiles.some((name) => name.startsWith("bridge-data-"))).toBe(true);
  });

  test("AWS EC2 docs reference the deployment kit scripts", () => {
    const docs = readFileSync(awsDocsFile, "utf8");

    for (const scriptName of scriptNames) {
      expect(docs).toContain(`scripts/${scriptName}`);
    }
    expect(docs).toContain("config/aws-ec2.env.example");
    expect(docs).toContain("Docker 없이");
    expect(docs).toContain("tmux");
    expect(docs).toContain("screen");
    expect(docs).toContain("29371");
    expect(docs).toContain("25565");
  });

  test("root package exposes AWS EC2 helper commands without executing deployment by default", () => {
    const rootPackage = JSON.parse(readFileSync(rootPackageFile, "utf8"));

    expect(rootPackage.scripts["aws:ec2:plan"]).toBe("bash scripts/aws-ec2-provision.sh");
    expect(rootPackage.scripts["aws:ec2:provision"]).toBe(
      "AWS_EC2_APPLY=true bash scripts/aws-ec2-provision.sh"
    );
    expect(rootPackage.scripts["aws:ec2:deploy"]).toBe("bash scripts/aws-ec2-deploy.sh");
    expect(rootPackage.scripts["aws:ec2:pregenerate"]).toBe("bash scripts/aws-ec2-pregenerate.sh");
    expect(rootPackage.scripts["aws:ec2:verify"]).toBe("bash scripts/aws-ec2-verify.sh");
    expect(rootPackage.scripts["aws:ec2:backup"]).toBe("bash scripts/aws-ec2-backup.sh");
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
