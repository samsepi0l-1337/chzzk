package dev.samsepiol.chzzk.webhook;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import dev.samsepiol.chzzk.donation.DonationEvent;
import dev.samsepiol.chzzk.donation.DonationResult;
import dev.samsepiol.chzzk.donation.DonationService;
import dev.samsepiol.chzzk.donation.DonationStatus;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.concurrent.Executors;
import java.util.logging.Logger;

public final class DonationWebhookServer {
    private final Gson gson = new Gson();
    private final DonationService donationService;
    private final HmacVerifier hmacVerifier;
    private final Logger logger;
    private final String host;
    private final int port;
    private final String path;
    private HttpServer server;

    public DonationWebhookServer(
            DonationService donationService,
            HmacVerifier hmacVerifier,
            Logger logger,
            String host,
            int port,
            String path) {
        this.donationService = donationService;
        this.hmacVerifier = hmacVerifier;
        this.logger = logger;
        this.host = host;
        this.port = port;
        this.path = path;
    }

    public void start() {
        try {
            server = HttpServer.create(new InetSocketAddress(host, port), 0);
            server.createContext(path, this::handle);
            server.setExecutor(Executors.newSingleThreadExecutor(runnable -> {
                Thread thread = new Thread(runnable, "chzzk-webhook");
                thread.setDaemon(true);
                return thread;
            }));
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
    }

    private void handle(HttpExchange exchange) throws IOException {
        if (!"POST".equals(exchange.getRequestMethod())) {
            send(exchange, 405, "{\"status\":\"method_not_allowed\"}");
            return;
        }
        byte[] body = exchange.getRequestBody().readAllBytes();
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
        send(exchange, statusCode(result.status()), gson.toJson(result));
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

    private static void send(HttpExchange exchange, int statusCode, String body) throws IOException {
        byte[] response = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        exchange.sendResponseHeaders(statusCode, response.length);
        exchange.getResponseBody().write(response);
        exchange.close();
    }
}
