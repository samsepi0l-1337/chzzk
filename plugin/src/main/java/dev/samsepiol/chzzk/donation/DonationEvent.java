package dev.samsepiol.chzzk.donation;

import java.time.Instant;

public record DonationEvent(
        String eventId,
        int amount,
        String donatorNickname,
        String message,
        Instant receivedAt) {
}
