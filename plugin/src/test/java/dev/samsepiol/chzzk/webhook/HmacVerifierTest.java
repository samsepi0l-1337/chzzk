package dev.samsepiol.chzzk.webhook;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

final class HmacVerifierTest {
    @Test
    void verifiesSha256HeaderAgainstRawBody() {
        HmacVerifier verifier = new HmacVerifier("secret");
        byte[] body = "{\"eventId\":\"a\"}".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        String header = "sha256=" + verifier.sign(body);

        assertTrue(verifier.verify(body, header));
        assertFalse(verifier.verify(body, "sha256=bad"));
        assertFalse(verifier.verify(body, "bad"));
        assertFalse(verifier.verify(body, null));
    }

    @Test
    void reportsSigningFailures() {
        HmacVerifier verifier = new HmacVerifier(null);
        byte[] body = "{}".getBytes(java.nio.charset.StandardCharsets.UTF_8);

        assertThrows(IllegalStateException.class, () -> verifier.sign(body));
    }
}
