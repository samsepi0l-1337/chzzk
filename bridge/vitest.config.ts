import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: [
        "src/auth-login-cli.ts",
        "src/auth-url-cli.ts",
        "src/chzzk-auth.ts",
        "src/chzzk-oauth.ts",
        "src/chzzk-session.ts",
        "src/config.ts",
        "src/donation-parser.ts",
        "src/e2e-check-env-cli.ts",
        "src/e2e-health-cli.ts",
        "src/e2e-tools.ts",
        "src/e2e-webhook-cli.ts",
        "src/load-env-file.ts",
        "src/index.ts",
        "src/oauth-callback-server.ts",
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
