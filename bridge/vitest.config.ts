import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: [
        "src/chzzk-auth.ts",
        "src/chzzk-session.ts",
        "src/config.ts",
        "src/donation-parser.ts",
        "src/index.ts",
        "src/token-store.ts",
        "src/webhook-client.ts"
      ],
      reporter: ["text", "json-summary"],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100
      }
    }
  }
});
