package dev.samsepiol.chzzk.donation;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

final class DonationResultTest {
    @Test
    void createsStatusMessagePairs() {
        DonationResult result = DonationResult.of(DonationStatus.ACCEPTED, "accepted");

        assertEquals(DonationStatus.ACCEPTED, result.status());
        assertEquals("accepted", result.message());
    }
}
