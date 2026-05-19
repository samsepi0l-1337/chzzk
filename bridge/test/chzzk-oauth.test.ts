import { describe, expect, it } from "vitest";
import {
  CHZZK_ACCOUNT_INTERLOCK_URL,
  buildAuthorizationUrl,
  createOAuthState,
  parseOAuthCallback
} from "../src/chzzk-oauth";

describe("buildAuthorizationUrl", () => {
  it("builds the CHZZK account interlock URL", () => {
    const url = new URL(
      buildAuthorizationUrl({
        clientId: "client-id",
        redirectUri: "http://127.0.0.1:8080/chzzk/oauth/callback",
        state: "state-value"
      })
    );

    expect(url.toString()).toBe(
      "https://chzzk.naver.com/account-interlock?clientId=client-id&redirectUri=http%3A%2F%2F127.0.0.1%3A8080%2Fchzzk%2Foauth%2Fcallback&state=state-value"
    );
    expect(url.origin + url.pathname).toBe(CHZZK_ACCOUNT_INTERLOCK_URL);
    expect(url.searchParams.get("clientId")).toBe("client-id");
    expect(url.searchParams.get("redirectUri")).toBe("http://127.0.0.1:8080/chzzk/oauth/callback");
    expect(url.searchParams.get("state")).toBe("state-value");
  });
});

describe("createOAuthState", () => {
  it("creates a hex state token", () => {
    const state = createOAuthState();

    expect(state).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("parseOAuthCallback", () => {
  it("parses URLSearchParams callbacks", () => {
    expect(
      parseOAuthCallback(new URLSearchParams("code=code-value&state=expected-state"), "expected-state")
    ).toEqual({
      code: "code-value",
      state: "expected-state"
    });
  });

  it("parses URL callbacks", () => {
    expect(
      parseOAuthCallback(
        new URL("http://127.0.0.1:8080/chzzk/oauth/callback?code=code-value&state=expected-state"),
        "expected-state"
      )
    ).toEqual({
      code: "code-value",
      state: "expected-state"
    });
  });

  it("rejects missing code", () => {
    expect(() => parseOAuthCallback(new URLSearchParams("state=expected-state"), "expected-state")).toThrow(
      "OAuth callback missing code"
    );
  });

  it("rejects missing state", () => {
    expect(() => parseOAuthCallback(new URLSearchParams("code=code-value"), "expected-state")).toThrow(
      "OAuth callback missing state"
    );
  });

  it("rejects mismatched state", () => {
    expect(() =>
      parseOAuthCallback(
        new URL("http://127.0.0.1:8080/chzzk/oauth/callback?code=code-value&state=wrong-state"),
        "expected-state"
      )
    ).toThrow("OAuth callback state mismatch");
  });
});
