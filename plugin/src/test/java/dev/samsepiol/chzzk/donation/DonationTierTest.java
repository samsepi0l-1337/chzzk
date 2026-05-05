package dev.samsepiol.chzzk.donation;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

final class DonationTierTest {
    @Test
    void mapsOnlyExactAmounts() {
        assertEquals(DonationTier.RANDOM_BUFF, DonationTier.findByAmount(1000).orElseThrow());
        assertEquals(DonationTier.RANDOM_ITEM, DonationTier.findByAmount(2000).orElseThrow());
        assertEquals(DonationTier.KILL_TARGET, DonationTier.findByAmount(100000).orElseThrow());
        assertTrue(DonationTier.findByAmount(999).isEmpty());
        assertTrue(DonationTier.findByAmount(1001).isEmpty());
        assertTrue(DonationTier.findByAmount(5500).isEmpty());
    }
}
