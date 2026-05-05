package dev.samsepiol.chzzk.donation;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

final class DonationTierTest {
    @Test
    void mapsOnlyExactAmounts() {
        for (DonationTier tier : DonationTier.values()) {
            assertEquals(tier, DonationTier.findByAmount(tier.amount()).orElseThrow());
        }
        assertTrue(DonationTier.findByAmount(999).isEmpty());
        assertTrue(DonationTier.findByAmount(1001).isEmpty());
        assertTrue(DonationTier.findByAmount(5500).isEmpty());
    }
}
