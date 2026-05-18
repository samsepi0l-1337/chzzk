import { readFile } from "node:fs/promises";

export async function loadEnvFile(
  path: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<void> {
  const content = await readFile(path, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    const key = (separatorIndex === -1 ? trimmed : trimmed.slice(0, separatorIndex)).trim();
    if (!key) {
      continue;
    }

    const rawValue = separatorIndex === -1 ? "" : trimmed.slice(separatorIndex + 1).trim();
    if (env[key] === undefined) {
      env[key] = stripQuotes(rawValue);
    }
  }
}

function stripQuotes(value: string): string {
  if (value.length < 2) {
    return value;
  }

  const first = value[0];
  const last = value[value.length - 1];
  if (first === last && (first === '"' || first === "'")) {
    return value.slice(1, -1);
  }
  return value;
}
