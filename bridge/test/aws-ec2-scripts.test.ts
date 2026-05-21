import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
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
    expect(script).toContain("docker compose --env-file");
    expect(script).toContain("-f \"$COMPOSE_FILE\" up -d --build");
    expect(script).toContain("docker-compose.yml");
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

  test("backup script archives both persistent volumes and warns about token secrets", () => {
    const script = readScript("aws-ec2-backup.sh");

    expect(script).toContain("paper-data");
    expect(script).toContain("bridge-data");
    expect(script).toContain("/server");
    expect(script).toContain("/data");
    expect(script).toContain("BACKUP_STOP_STACK");
    expect(script).toContain("token store secrets");
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
