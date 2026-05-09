package dev.samsepiol.chzzk.webhook;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import dev.samsepiol.chzzk.donation.DonationEvent;
import dev.samsepiol.chzzk.donation.DonationResult;
import dev.samsepiol.chzzk.donation.DonationService;
import dev.samsepiol.chzzk.donation.DonationStatus;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.logging.Level;
import java.util.logging.Logger;

public final class DonationWebhookServer {
    private static final int DEFAULT_MAX_BODY_BYTES = 16 * 1024;

    private final Gson gson = new Gson();
    private final DonationService donationService;
    private final HmacVerifier hmacVerifier;
    private final Logger logger;
    private final String host;
    private final int port;
    private final String path;
    private final int maxBodyBytes;
    private HttpServer server;
    private ExecutorService executor;

    public DonationWebhookServer(
            DonationService donationService,
            HmacVerifier hmacVerifier,
            Logger logger,
            String host,
            int port,
            String path) {
        this(donationService, hmacVerifier, logger, host, port, path, DEFAULT_MAX_BODY_BYTES);
    }

    public DonationWebhookServer(
            DonationService donationService,
            HmacVerifier hmacVerifier,
            Logger logger,
            String host,
            int port,
            String path,
            int maxBodyBytes) {
        this.donationService = donationService;
        this.hmacVerifier = hmacVerifier;
        this.logger = logger;
        this.host = host;
        this.port = port;
        this.path = path;
        this.maxBodyBytes = Math.max(1, maxBodyBytes);
    }

    public void start() {
        try {
            server = HttpServer.create(new InetSocketAddress(host, port), 0);
            server.createContext(path, this::handle);
            server.createContext(path + "/health", this::handleHealth);
            executor = Executors.newSingleThreadExecutor(runnable -> {
                Thread thread = new Thread(runnable, "chzzk-webhook");
                thread.setDaemon(true);
                return thread;
            });
            server.setExecutor(executor);
            server.start();
            logger.info("CHZZK webhook listening on http://" + host + ":" + port + path);
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to start webhook server", exception);
        }
    }

    public void stop() {
        if (server != null) {
            server.stop(0);
            server = null;
        }
        if (executor != null) {
            executor.shutdownNow();
            executor = null;
        }
    }

    public int boundPort() {
        if (server == null) {
            throw new IllegalStateException("Webhook server is not started");
        }
        return server.getAddress().getPort();
    }

    private void handle(HttpExchange exchange) throws IOException {
        try {
            handleDonation(exchange);
        } catch (RuntimeException exception) {
            logger.log(Level.SEVERE, "Unhandled CHZZK webhook request failure", exception);
            send(exchange, 500, "{\"status\":\"internal_error\"}");
        }
    }

    private void handleDonation(HttpExchange exchange) throws IOException {
        if (!"POST".equals(exchange.getRequestMethod())) {
            send(exchange, 405, "{\"status\":\"method_not_allowed\"}");
            return;
        }
        byte[] body;
        try {
            body = readLimitedBody(exchange);
        } catch (BodyTooLargeException exception) {
            send(exchange, 413, "{\"status\":\"payload_too_large\"}");
            return;
        }
        String signature = exchange.getRequestHeaders().getFirst("X-Chzzk-Signature");
        if (!hmacVerifier.verify(body, signature)) {
            send(exchange, 401, "{\"status\":\"invalid_signature\"}");
            return;
        }
        DonationEvent event;
        try {
            event = parseEvent(body);
        } catch (RuntimeException exception) {
            send(exchange, 400, "{\"status\":\"bad_request\"}");
            return;
        }
        DonationResult result = donationService.handle(event);
        send(exchange, statusCode(result.status()), resultJson(result));
    }

    private void handleHealth(HttpExchange exchange) throws IOException {
        if (!"GET".equals(exchange.getRequestMethod())) {
            send(exchange, 405, "{\"status\":\"method_not_allowed\"}");
            return;
        }
        send(exchange, 200, "{\"status\":\"ok\"}");
    }

    private DonationEvent parseEvent(byte[] body) {
        JsonObject json = gson.fromJson(new String(body, StandardCharsets.UTF_8), JsonObject.class);
        return new DonationEvent(
                json.get("eventId").getAsString(),
                json.get("amount").getAsInt(),
                stringValue(json, "donatorNickname"),
                stringValue(json, "message"),
                Instant.parse(json.get("receivedAt").getAsString()));
    }

    private static String stringValue(JsonObject json, String name) {
        return json.has(name) && !json.get(name).isJsonNull() ? json.get(name).getAsString() : "";
    }

    private static int statusCode(DonationStatus status) {
        return switch (status) {
            case ACCEPTED, UNKNOWN_AMOUNT, NO_TARGET, TARGET_OFFLINE -> 202;
            case DUPLICATE -> 409;
            case EFFECT_FAILED -> 500;
        };
    }

    private String resultJson(DonationResult result) {
        return "{\"status\":\"" + result.status().name() + "\",\"message\":"
                + gson.toJson(result.message()) + "}";
    }

    private static void send(HttpExchange exchange, int statusCode, String body) throws IOException {
        byte[] response = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        exchange.sendResponseHeaders(statusCode, response.length);
        exchange.getResponseBody().write(response);
        exchange.close();
    }

    private byte[] readLimitedBody(HttpExchange exchange) throws IOException {
        String contentLength = exchange.getRequestHeaders().getFirst("Content-Length");
        if (contentLength != null && Long.parseLong(contentLength) > maxBodyBytes) {
            throw new BodyTooLargeException();
        }

        try (InputStream input = exchange.getRequestBody();
                ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int total = 0;
            int read;
            while ((read = input.read(buffer)) != -1) {
                total += read;
                if (total > maxBodyBytes) {
                    throw new BodyTooLargeException();
                }
                output.write(buffer, 0, read);
            }
            return output.toByteArray();
        }
    }

    private static final class BodyTooLargeException extends IOException {
    }
}
