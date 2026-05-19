package dev.samsepiol.chzzk.webhook;

import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpPrincipal;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.function.Function;

final class FakeHttpExchange extends HttpExchange {
    private final Headers requestHeaders = new Headers();
    private final Headers responseHeaders = new Headers();
    private final URI requestUri;
    private final InputStream requestBody;
    private final ByteArrayOutputStream responseBody = new ByteArrayOutputStream();
    private int statusCode;

    private FakeHttpExchange(String path, String body) {
        requestUri = URI.create(path);
        requestBody = new ByteArrayInputStream(body.getBytes(StandardCharsets.UTF_8));
    }

    static FakeHttpExchange post(String path, String body, Function<String, String> signer) {
        FakeHttpExchange exchange = new FakeHttpExchange(path, body);
        exchange.requestHeaders.set("X-Chzzk-Signature", signer.apply(body));
        return exchange;
    }

    int statusCode() {
        return statusCode;
    }

    String responseBody() {
        return responseBody.toString(StandardCharsets.UTF_8);
    }

    @Override
    public Headers getRequestHeaders() {
        return requestHeaders;
    }

    @Override
    public Headers getResponseHeaders() {
        return responseHeaders;
    }

    @Override
    public URI getRequestURI() {
        return requestUri;
    }

    @Override
    public String getRequestMethod() {
        return "POST";
    }

    @Override
    public com.sun.net.httpserver.HttpContext getHttpContext() {
        return null;
    }

    @Override
    public void close() {
    }

    @Override
    public InputStream getRequestBody() {
        return requestBody;
    }

    @Override
    public OutputStream getResponseBody() {
        return responseBody;
    }

    @Override
    public void sendResponseHeaders(int responseCode, long responseLength) {
        statusCode = responseCode;
    }

    @Override
    public InetSocketAddress getRemoteAddress() {
        return null;
    }

    @Override
    public int getResponseCode() {
        return statusCode;
    }

    @Override
    public InetSocketAddress getLocalAddress() {
        return null;
    }

    @Override
    public String getProtocol() {
        return "HTTP/1.1";
    }

    @Override
    public Object getAttribute(String name) {
        return null;
    }

    @Override
    public void setAttribute(String name, Object value) {
    }

    @Override
    public void setStreams(InputStream input, OutputStream output) {
    }

    @Override
    public HttpPrincipal getPrincipal() {
        return null;
    }
}
