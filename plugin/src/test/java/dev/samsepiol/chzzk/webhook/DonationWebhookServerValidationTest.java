package dev.samsepiol.chzzk.webhook;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.sun.net.httpserver.HttpExchange;
import dev.samsepiol.chzzk.donation.DonationService;
import dev.samsepiol.chzzk.donation.DonationTier;
import dev.samsepiol.chzzk.donation.TargetAvailability;
import java.io.IOException;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.logging.Logger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

final class DonationWebhookServerValidationTest {
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
    void rejectsBlankEventIdsAndNonPositiveAmountsBeforeHandling() throws Exception {
        List<DonationTier> effects = new ArrayList<>();
        int port = startServer(effects, 1024);
        String blankEventId = donationJson("   ", 1000);
        String negativeAmount = donationJsonWithAmountLiteral("evt-negative", "-1000");
        String numericEventId = """
                {"eventId":123,"amount":1000,"donatorNickname":"viewer","message":"hello","receivedAt":"2026-05-05T00:00:00Z"}""";
        String missingReceivedAt = """
                {"eventId":"evt-missing-received-at","amount":1000,"donatorNickname":"viewer","message":"hello"}""";
        String nullReceivedAt = """
                {"eventId":"evt-null-received-at","amount":1000,"donatorNickname":"viewer","message":"hello","receivedAt":null}""";
        String objectReceivedAt = """
                {"eventId":"evt-object-received-at","amount":1000,"donatorNickname":"viewer","message":"hello","receivedAt":{}}""";

        assertEquals(400, DonationWebhookServerTest.post(port, blankEventId, signature(blankEventId)).statusCode());
        assertEquals(400, DonationWebhookServerTest.post(port, negativeAmount, signature(negativeAmount)).statusCode());
        assertEquals(400, DonationWebhookServerTest.post(port, numericEventId, signature(numericEventId)).statusCode());
        assertEquals(400, DonationWebhookServerTest.post(
                port,
                missingReceivedAt,
                signature(missingReceivedAt)).statusCode());
        assertEquals(400, DonationWebhookServerTest.post(port, nullReceivedAt, signature(nullReceivedAt)).statusCode());
        assertEquals(400, DonationWebhookServerTest.post(
                port,
                objectReceivedAt,
                signature(objectReceivedAt)).statusCode());
        assertEquals(List.of(), effects);
    }

    @Test
    void rejectsMalformedContentLengthBeforeHandling() throws Exception {
        List<DonationTier> effects = new ArrayList<>();
        int port = startServer(effects, 1024);
        String body = donationJson("evt-bad-length", 1000);

        Response response = rawPostWithContentLength(port, body, "not-a-number");

        assertEquals(400, response.statusCode());
        assertEquals(List.of(), effects);
    }

    @Test
    void rejectsMalformedContentLengthAtHandlerBoundary() throws Exception {
        DonationService service = new DonationService(
                new HashSet<>(),
                () -> TargetAvailability.AVAILABLE,
                tier -> {});
        server = newServer(service, 0, 1024);
        FakeHttpExchange malformed = FakeHttpExchange.post(PATH, donationJson("evt-direct-bad-length", 1000), this::signature);
        malformed.getRequestHeaders().set("Content-Length", "not-a-number");

        invokeHandleDonation(server, malformed);

        assertEquals(400, malformed.statusCode());
        assertEquals("{\"status\":\"bad_request\"}", malformed.responseBody());

        FakeHttpExchange negative = FakeHttpExchange.post(PATH, donationJson("evt-direct-negative-length", 1000), this::signature);
        negative.getRequestHeaders().set("Content-Length", "-1");

        invokeHandleDonation(server, negative);

        assertEquals(400, negative.statusCode());
        assertEquals("{\"status\":\"bad_request\"}", negative.responseBody());
    }

    private int startServer(List<DonationTier> effects, int maxBodyBytes) {
        DonationService service = new DonationService(
                new HashSet<>(),
                () -> TargetAvailability.AVAILABLE,
                effects::add);
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

    private Response rawPostWithContentLength(int port, String body, String contentLength) throws IOException {
        try (Socket socket = new Socket("127.0.0.1", port)) {
            socket.setSoTimeout(3000);
            String request = """
                    POST %s HTTP/1.1\r
                    Host: 127.0.0.1:%d\r
                    Content-Type: application/json\r
                    X-Chzzk-Signature: %s\r
                    Content-Length: %s\r
                    Connection: close\r
                    \r
                    %s""".formatted(PATH, port, signature(body), contentLength, body);
            socket.getOutputStream().write(request.getBytes(StandardCharsets.UTF_8));
            socket.getOutputStream().flush();
            String rawResponse = new String(socket.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            String[] parts = rawResponse.split("\r\n\r\n", 2);
            String statusLine = parts[0].split("\r\n", 2)[0];
            int statusCode = Integer.parseInt(statusLine.split(" ")[1]);
            String responseBody = parts.length == 2 ? parts[1] : "";
            return new Response(statusCode, responseBody);
        }
    }

    private static void invokeHandleDonation(DonationWebhookServer server, HttpExchange exchange) throws Exception {
        var method = DonationWebhookServer.class.getDeclaredMethod("handleDonation", HttpExchange.class);
        method.setAccessible(true);
        method.invoke(server, exchange);
    }

    private static String donationJson(String eventId, int amount) {
        return donationJsonWithAmountLiteral(eventId, String.valueOf(amount));
    }

    private static String donationJsonWithAmountLiteral(String eventId, String amount) {
        return """
                {"eventId":"%s","amount":%s,"donatorNickname":"viewer","message":"hello","receivedAt":"2026-05-05T00:00:00Z"}"""
                .formatted(eventId, amount);
    }

    private String signature(String body) {
        return "sha256=" + new HmacVerifier(SECRET).sign(body.getBytes(StandardCharsets.UTF_8));
    }

    private record Response(int statusCode, String body) {
    }
}
