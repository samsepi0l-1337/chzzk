import { createServer } from "node:http";
import type { OAuthCallbackPayload } from "./chzzk-oauth";
import { parseOAuthCallback } from "./chzzk-oauth";

export interface OAuthCallbackServerOptions {
  redirectUri: string;
  expectedState: string;
  bindHost?: string;
  timeoutMs?: number;
}

export function startOAuthCallbackServer(
  options: OAuthCallbackServerOptions
): Promise<OAuthCallbackPayload> {
  const redirectUrl = new URL(options.redirectUri);
  const timeoutMs = options.timeoutMs ?? 300000;

  return new Promise((resolve, reject) => {
    let settled = false;
    const server = createServer((request, response) => {
      const requestUrl = new URL(request.url!, "http://127.0.0.1");
      if (requestUrl.pathname !== redirectUrl.pathname) {
        respondNotFound(response);
        return;
      }

      try {
        const callback = parseOAuthCallback(requestUrl, options.expectedState);
        respondHtml(response, 200, renderSuccessPage());
        settleSuccess(callback);
      } catch (error) {
        const failure = error as Error;
        respondHtml(response, 400, renderErrorPage(failure.message));
        settleFailure(failure);
      }
    });

    const timeoutId = setTimeout(() => {
      settleFailure(new Error(`OAuth callback timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    timeoutId.unref();

    server.once("error", (error) => {
      settleFailure(error as Error);
    });
    server.listen({
      host: options.bindHost ?? defaultBindHost(redirectUrl),
      port: getPort(redirectUrl)
    });

    function settleSuccess(value: OAuthCallbackPayload): void {
      settle(() => resolve(value));
    }

    function settleFailure(error: Error): void {
      settle(() => reject(error));
    }

    function settle(action: () => void): void {
      /* v8 ignore next */
      if (settled) return;

      settled = true;
      clearTimeout(timeoutId);
      server.close();
      action();
    }
  });
}

function defaultBindHost(url: URL): string {
  if (isLoopbackHost(url.hostname)) {
    return url.hostname;
  }
  return "0.0.0.0";
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function getPort(url: URL): number {
  return Number(url.port);
}

function respondNotFound(response: import("node:http").ServerResponse): void {
  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not Found");
}

function respondHtml(
  response: import("node:http").ServerResponse,
  statusCode: number,
  body: string
): void {
  response.writeHead(statusCode, { "Content-Type": "text/html; charset=utf-8" });
  response.end(body);
}

function renderSuccessPage(): string {
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>CHZZK 로그인 완료</title>
  </head>
  <body>
    <h1>로그인이 완료되었습니다.</h1>
    <p>이 창을 닫고 터미널로 돌아가세요.</p>
  </body>
</html>`;
}

function renderErrorPage(message: string): string {
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>CHZZK 로그인 실패</title>
  </head>
  <body>
    <h1>로그인에 실패했습니다.</h1>
    <p>${escapeHtml(message)}</p>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
