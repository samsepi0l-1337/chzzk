package dev.samsepiol.chzzk.webhook;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

public final class HmacVerifier {
    private final String sharedSecret;

    public HmacVerifier(String sharedSecret) {
        this.sharedSecret = sharedSecret;
    }

    public String sign(byte[] body) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(sharedSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return toHex(mac.doFinal(body));
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to sign webhook body", exception);
        }
    }

    public boolean verify(byte[] body, String header) {
        if (header == null || !header.startsWith("sha256=")) {
            return false;
        }
        byte[] expected = ("sha256=" + sign(body)).getBytes(StandardCharsets.UTF_8);
        byte[] actual = header.getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(expected, actual);
    }

    private static String toHex(byte[] bytes) {
        StringBuilder hex = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) {
            hex.append(String.format("%02x", value));
        }
        return hex.toString();
    }
}
