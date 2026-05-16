package dev.samsepiol.chzzk.donation;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import org.junit.jupiter.api.Test;

final class DonationTierTest {
    @Test
    void mapsExactAmountsToConfiguredTiers() {
        Map<Integer, DonationTier> expected = Map.of(
                1000, DonationTier.RANDOM_BUFF,
                2000, DonationTier.RANDOM_ITEM,
                3000, DonationTier.RANDOM_MOB,
                5000, DonationTier.COMBAT_MOB,
                10000, DonationTier.THREE_COMBAT_MOBS,
                30000, DonationTier.TNT,
                50000, DonationTier.RANDOM_TELEPORT,
                100000, DonationTier.KILL_TARGET);

        expected.forEach((amount, tier) -> assertEquals(tier, DonationTier.findByAmount(amount).orElseThrow()));
    }

    @Test
    void ignoresAmountsNearConfiguredTiers() {
        int[] unknownAmounts = {
                999, 1001,
                1999, 2001,
                2999, 3001,
                4999, 5001,
                9999, 10001,
                29999, 30001,
                49999, 50001,
                99999, 100001
        };

        for (int amount : unknownAmounts) {
            assertTrue(DonationTier.findByAmount(amount).isEmpty(), "amount=" + amount);
        }
    }
}
