import net from "node:net";
import { describe, expect, it } from "vitest";
import { startOAuthCallbackServer } from "../src/oauth-callback-server";

async function getFreePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to allocate a free port"));
        return;
      }

      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

describe("startOAuthCallbackServer", () => {
  it("ignores unmatched paths and handles a successful callback", async () => {
    const port = await getFreePort();
    const callbackPromise = startOAuthCallbackServer({
      redirectUri: `http://127.0.0.1:${port}/chzzk/oauth/callback`,
      expectedState: "expected-state"
    });

    const wrongResponse = await fetch(
      `http://127.0.0.1:${port}/wrong-path?code=code-value&state=expected-state`
    );
    expect(wrongResponse.status).toBe(404);
    expect(await wrongResponse.text()).toBe("Not Found");

    const responsePromise = fetch(
      `http://127.0.0.1:${port}/chzzk/oauth/callback?code=code-value&state=expected-state`
    );
    await expect(callbackPromise).resolves.toEqual({
      code: "code-value",
      state: "expected-state"
    });

    const response = await responsePromise;
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("로그인이 완료되었습니다.");
  });

  it("ignores a second pipelined callback request", async () => {
    const port = await getFreePort();
    const callbackPromise = startOAuthCallbackServer({
      redirectUri: `http://127.0.0.1:${port}/chzzk/oauth/callback`,
      expectedState: "expected-state"
    });

    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.once("error", () => {});
    socket.end(
      [
        "GET /chzzk/oauth/callback?code=code-value&state=expected-state HTTP/1.1",
        `Host: 127.0.0.1:${port}`,
        "Connection: keep-alive",
        "",
        "GET /chzzk/oauth/callback?code=code-value&state=expected-state HTTP/1.1",
        `Host: 127.0.0.1:${port}`,
        "Connection: close",
        "",
        ""
      ].join("\r\n")
    );

    await expect(callbackPromise).resolves.toEqual({
      code: "code-value",
      state: "expected-state"
    });
    socket.destroy();
  });

  it("returns an error page when callback parameters are missing", async () => {
    const port = await getFreePort();
    const callbackPromise = startOAuthCallbackServer({
      redirectUri: `http://127.0.0.1:${port}/chzzk/oauth/callback`,
      expectedState: "expected-state",
      timeoutMs: 5000
    });
    const rejection = expect(callbackPromise).rejects.toThrow("OAuth callback missing code");

    const response = await fetch(
      `http://127.0.0.1:${port}/chzzk/oauth/callback?state=expected-state`
    );

    await rejection;
    expect(response.status).toBe(400);
    expect(await response.text()).toContain("OAuth callback missing code");
  });

  it("times out when no callback arrives", async () => {
    const port = await getFreePort();

    await expect(
      startOAuthCallbackServer({
        redirectUri: `http://127.0.0.1:${port}/chzzk/oauth/callback`,
        expectedState: "expected-state",
        timeoutMs: 25
      })
    ).rejects.toThrow("OAuth callback timed out after 25ms");
  });

  it("rejects when the callback port is already in use", async () => {
    const blocker = net.createServer();
    await new Promise<void>((resolve, reject) => {
      blocker.once("error", reject);
      blocker.listen(0, "127.0.0.1", () => resolve());
    });

    const address = blocker.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to occupy a port");
    }

    await expect(
      startOAuthCallbackServer({
        redirectUri: `http://127.0.0.1:${address.port}/chzzk/oauth/callback`,
        expectedState: "expected-state",
        timeoutMs: 5000
      })
    ).rejects.toThrow();

    await new Promise<void>((resolve, reject) => {
      blocker.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  });
});
