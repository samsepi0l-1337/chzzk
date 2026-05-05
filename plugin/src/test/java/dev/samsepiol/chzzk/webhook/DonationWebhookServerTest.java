package dev.samsepiol.chzzk.webhook;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import dev.samsepiol.chzzk.donation.DonationService;
import dev.samsepiol.chzzk.donation.DonationStatus;
import dev.samsepiol.chzzk.donation.DonationTier;
import dev.samsepiol.chzzk.donation.TargetAvailability;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.logging.Logger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

final class DonationWebhookServerTest {
    private static final String PATH = "/chzzk/donations";
    private static final String SECRET = "secret";

    private DonationWebhookServer server;

    @AfterEach
    void stopServer() {
        if (server != null) {
            server.stop();
        }
    }

    @Test
    void acceptsSignedDonationRequests() throws Exception {
        List<DonationTier> effects = new ArrayList<>();
        int port = startServer(effects, 1024);
        String body = donationJson("evt-1", 1000);

        Response response = post(port, body, signature(body));

        assertEquals(202, response.statusCode());
        assertTrue(response.body().contains(DonationStatus.ACCEPTED.name()));
        assertEquals(List.of(DonationTier.RANDOM_BUFF), effects);
    }

    @Test
    void rejectsInvalidSignaturesBadRequestsAndUnsupportedMethods() throws Exception {
        List<DonationTier> effects = new ArrayList<>();
        int port = startServer(effects, 1024);

        assertEquals(405, get(port, PATH).statusCode());
        assertEquals(405, request(port, "POST", PATH + "/health", null, null, false).statusCode());
        assertEquals(401, post(port, donationJson("evt-3", 1000), "sha256=bad").statusCode());
        assertEquals(400, post(port, "{}", signature("{}")).statusCode());
        assertEquals(List.of(), effects);
    }

    @Test
    void rejectsOversizedBodiesBeforeHandling() throws Exception {
        List<DonationTier> effects = new ArrayList<>();
        int port = startServer(effects, 32);
        String oversizedBody = donationJson("evt-2", 1000) + " ".repeat(128);

        assertEquals(413, post(port, oversizedBody, signature(oversizedBody)).statusCode());
        assertEquals(413, postChunked(port, oversizedBody, signature(oversizedBody)).statusCode());
        assertEquals(List.of(), effects);
    }

    @Test
    void exposesHealthEndpointWithoutSignature() throws Exception {
        int port = startServer(new ArrayList<>(), 1024);

        Response response = get(port, PATH + "/health");

        assertEquals(200, response.statusCode());
        assertEquals("{\"status\":\"ok\"}", response.body());
    }

    @Test
    void supportsDefaultBodyLimitConstructor() throws Exception {
        List<DonationTier> effects = new ArrayList<>();
        DonationService service = new DonationService(
                new HashSet<>(),
                () -> TargetAvailability.AVAILABLE,
                effects::add);
        server = new DonationWebhookServer(
                service,
                new HmacVerifier(SECRET),
                Logger.getAnonymousLogger(),
                "127.0.0.1",
                0,
                PATH);
        server.start();
        String body = donationJson("evt-default", 1000);

        Response response = post(server.boundPort(), body, signature(body));

        assertEquals(202, response.statusCode());
        assertEquals(List.of(DonationTier.RANDOM_BUFF), effects);
    }

    @Test
    void reportsDuplicateAndEffectFailureResults() throws Exception {
        List<DonationTier> effects = new ArrayList<>();
        int port = startServer(effects, 1024);
        String body = donationJson("evt-4", 1000);

        assertEquals(202, post(port, body, signature(body)).statusCode());
        assertEquals(409, post(port, body, signature(body)).statusCode());

        server.stop();
        server = null;
        DonationService failingService = new DonationService(
                new HashSet<>(),
                () -> TargetAvailability.AVAILABLE,
                tier -> {
                    throw new IllegalStateException("effect failed");
                });
        port = startServer(failingService, 1024);
        String failedBody = donationJson("evt-5", 1000);
        assertEquals(500, post(port, failedBody, signature(failedBody)).statusCode());
    }

    @Test
    void acceptsChunkedBodiesWithBlankOptionalFields() throws Exception {
        List<DonationTier> effects = new ArrayList<>();
        int port = startServer(effects, 1024);
        String body = """
                {"eventId":"evt-6","amount":2000,"donatorNickname":null,"receivedAt":"2026-05-05T00:00:00Z"}""";

        Response response = postChunked(port, body, signature(body));

        assertEquals(202, response.statusCode());
        assertEquals(List.of(DonationTier.RANDOM_ITEM), effects);
    }

    @Test
    void reportsInternalFailuresAndLifecycleErrors() throws Exception {
        DonationService brokenService = new DonationService(
                new HashSet<>(),
                () -> {
                    throw new IllegalStateException("target lookup failed");
                },
                tier -> {});
        int port = startServer(brokenService, 1024);
        String body = donationJson("evt-7", 1000);

        Response response = post(port, body, signature(body));

        assertEquals(500, response.statusCode());
        assertEquals("{\"status\":\"internal_error\"}", response.body());

        DonationWebhookServer duplicate = newServer(
                new DonationService(new HashSet<>(), () -> TargetAvailability.AVAILABLE, tier -> {}),
                port,
                1024);
        assertThrows(IllegalStateException.class, duplicate::start);

        DonationWebhookServer notStarted = newServer(
                new DonationService(new HashSet<>(), () -> TargetAvailability.AVAILABLE, tier -> {}),
                0,
                1024);
        assertThrows(IllegalStateException.class, notStarted::boundPort);
        notStarted.stop();
    }

    private int startServer(List<DonationTier> effects, int maxBodyBytes) throws IOException {
        DonationService service = new DonationService(
                new HashSet<>(),
                () -> TargetAvailability.AVAILABLE,
                effects::add);
        return startServer(service, maxBodyBytes);
    }

    private int startServer(DonationService service, int maxBodyBytes) {
        server = newServer(service, 0, maxBodyBytes);
        server.start();
        return server.boundPort();
    }

    private static DonationWebhookServer newServer(DonationService service, int port, int maxBodyBytes) {
        return new DonationWebhookServer(
                service,
                new HmacVerifier(SECRET),
                Logger.getAnonymousLogger(),
                "127.0.0.1",
                port,
                PATH,
                maxBodyBytes);
    }

    private static Response get(int port, String path) throws IOException {
        return request(port, "GET", path, null, null, false);
    }

    private static Response post(int port, String body, String signature) throws IOException {
        return request(port, "POST", PATH, body, signature, false);
    }

    private static Response postChunked(int port, String body, String signature) throws IOException {
        return request(port, "POST", PATH, body, signature, true);
    }

    private static Response request(
            int port,
            String method,
            String path,
            String body,
            String signature,
            boolean chunked) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) uri(port, path).toURL().openConnection();
        connection.setConnectTimeout(3000);
        connection.setReadTimeout(3000);
        connection.setRequestMethod(method);
        if (signature != null) {
            connection.setRequestProperty("X-Chzzk-Signature", signature);
        }
        if (body != null) {
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json");
            if (chunked) {
                connection.setChunkedStreamingMode(8);
            }
            try (OutputStream output = connection.getOutputStream()) {
                output.write(body.getBytes(StandardCharsets.UTF_8));
            }
        }
        return response(connection);
    }

    private static Response response(HttpURLConnection connection) throws IOException {
        int statusCode = connection.getResponseCode();
        InputStream stream = statusCode >= 400 ? connection.getErrorStream() : connection.getInputStream();
        String body = stream == null ? "" : new String(stream.readAllBytes(), StandardCharsets.UTF_8);
        connection.disconnect();
        return new Response(statusCode, body);
    }

    private static String donationJson(String eventId, int amount) {
        return """
                {"eventId":"%s","amount":%d,"donatorNickname":"viewer","message":"hello","receivedAt":"2026-05-05T00:00:00Z"}"""
                .formatted(eventId, amount);
    }

    private static String signature(String body) {
        return "sha256=" + new HmacVerifier(SECRET).sign(body.getBytes(StandardCharsets.UTF_8));
    }

    private static URI uri(int port, String path) {
        return URI.create("http://127.0.0.1:" + port + path);
    }

    private record Response(int statusCode, String body) {
    }
}
