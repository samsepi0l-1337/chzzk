import { createServer, type Server, type ServerResponse } from "node:http";
import { buildAuthorizationUrl, createOAuthState, parseOAuthCallback } from "./chzzk-oauth";
import { exchangeAuthorizationCode } from "./chzzk-auth";
import { CHZZK_OPENAPI_BASE_URL } from "./config";
import { TokenStore, type StoredToken } from "./token-store";

export interface AuthWebServerOptions {
  redirectUri: string;
  clientId: string;
  clientSecret: string;
  pageSecret: string;
  tokenStorePath: string;
  baseUrl?: string;
  bindHost?: string;
  createOAuthState?: () => string;
  exchangeAuthorizationCode?: typeof exchangeAuthorizationCode;
  createTokenStore?: (path: string) => TokenStorePort;
}

export interface AuthWebServer {
  loginUrl: string;
  close: () => Promise<void>;
}

interface TokenStorePort {
  save(token: StoredToken): Promise<void>;
}

export async function startAuthWebServer(options: AuthWebServerOptions): Promise<AuthWebServer> {
  const redirectUrl = new URL(options.redirectUri);
  const loginPath = "/chzzk/oauth/login";
  const issuedStates = new Set<string>();
  const createState = options.createOAuthState ?? createOAuthState;
  /* v8 ignore next */
  const exchangeCode = options.exchangeAuthorizationCode ?? exchangeAuthorizationCode;
  const createStore = options.createTokenStore ?? ((path: string) => new TokenStore(path));
  const server = createServer(async (request, response) => {
    /* v8 ignore start */
    const requestUrl = new URL(request.url ?? "/", options.redirectUri);
    /* v8 ignore stop */
    if (requestUrl.pathname === loginPath) {
      handleLoginPage(requestUrl, response);
      return;
    }

    if (requestUrl.pathname === redirectUrl.pathname) {
      await handleCallback(requestUrl, response);
      return;
    }

    respondText(response, 404, "Not Found");
  });

  await listen(server, getPort(redirectUrl), options.bindHost ?? defaultBindHost(redirectUrl));

  const loginUrl = new URL(loginPath, options.redirectUri);
  loginUrl.searchParams.set("secret", options.pageSecret);
  return {
    loginUrl: loginUrl.toString(),
    close: () => close(server)
  };

  function handleLoginPage(requestUrl: URL, response: ServerResponse): void {
    if (requestUrl.searchParams.get("secret") !== options.pageSecret) {
      respondHtml(response, 403, renderErrorPage("인증 페이지 secret이 올바르지 않습니다."));
      return;
    }

    const state = createState();
    issuedStates.add(state);
    const authorizationUrl = buildAuthorizationUrl({
      clientId: options.clientId,
      redirectUri: options.redirectUri,
      state
    });
    respondHtml(response, 200, renderLoginPage(authorizationUrl));
  }

  async function handleCallback(requestUrl: URL, response: ServerResponse): Promise<void> {
    const state = requestUrl.searchParams.get("state")?.trim();
    if (!state || !issuedStates.has(state)) {
      respondHtml(response, 400, renderErrorPage("알 수 없는 OAuth state입니다."));
      return;
    }

    try {
      const callback = parseOAuthCallback(requestUrl, state);
      const token = await exchangeCode({
        clientId: options.clientId,
        clientSecret: options.clientSecret,
        code: callback.code,
        state: callback.state,
        baseUrl: options.baseUrl ?? CHZZK_OPENAPI_BASE_URL
      });
      await createStore(options.tokenStorePath).save(token);
      issuedStates.delete(state);
      respondHtml(response, 200, renderSuccessPage());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      respondHtml(response, 500, renderErrorPage(message));
    }
  }
}

function listen(server: Server, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host, port }, () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      /* v8 ignore start */
      if (error) {
        reject(error);
        return;
      }
      /* v8 ignore stop */
      resolve();
    });
  });
}

function defaultBindHost(url: URL): string {
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1") {
    return url.hostname;
  }
  return "0.0.0.0";
}

function getPort(url: URL): number {
  return Number(url.port);
}

function respondText(response: ServerResponse, statusCode: number, body: string): void {
  response.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(body);
}

function respondHtml(response: ServerResponse, statusCode: number, body: string): void {
  response.writeHead(statusCode, { "Content-Type": "text/html; charset=utf-8" });
  response.end(body);
}

function renderLoginPage(authorizationUrl: string): string {
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>CHZZK 스트리머 인증</title>
  </head>
  <body>
    <h1>CHZZK 스트리머 인증</h1>
    <p>아래 버튼으로 로그인하고 후원/채팅 조회 권한을 승인하세요.</p>
    <p><a href="${escapeHtml(authorizationUrl)}">CHZZK 로그인</a></p>
  </body>
</html>`;
}

function renderSuccessPage(): string {
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>CHZZK 인증 완료</title>
  </head>
  <body>
    <h1>토큰 저장이 완료되었습니다.</h1>
    <p>이 창을 닫아도 됩니다.</p>
  </body>
</html>`;
}

function renderErrorPage(message: string): string {
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>CHZZK 인증 실패</title>
  </head>
  <body>
    <h1>인증에 실패했습니다.</h1>
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
