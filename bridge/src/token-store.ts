import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export interface StoredToken {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresAt: string;
  scope?: string;
}

export class TokenStore {
  constructor(private readonly path: string) {}

  async load(): Promise<StoredToken | null> {
    try {
      const raw = await readFile(this.path, "utf8");
      return JSON.parse(raw) as StoredToken;
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async save(token: StoredToken): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const tempPath = `${this.path}.${process.pid}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(token, null, 2)}\n`, "utf8");
    await rename(tempPath, this.path);
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
