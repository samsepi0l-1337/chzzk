package dev.samsepiol.chzzk.listener;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Random;
import org.bukkit.Location;
import org.junit.jupiter.api.Test;

final class DonationTntListenerTest {
    @Test
    void followUpTntUsesThreeBlockRadiusAndFiveSpawns() {
        assertEquals(3, DonationTntListener.FOLLOW_UP_RADIUS);
        assertEquals(5, DonationTntListener.FOLLOW_UP_COUNT);
    }

    @Test
    void pickFollowUpLocationStaysWithinThreeBlockRadius() {
        Location target = new Location(null, 10.0, 64.0, -20.0);
        Random random = new Random(7);

        for (int index = 0; index < 20; index += 1) {
            Location followUp = DonationTntListener.pickFollowUpLocation(target, random);
            double dx = followUp.getX() - target.getX();
            double dy = followUp.getY() - target.getY();
            double dz = followUp.getZ() - target.getZ();
            assertTrue(dx * dx + dy * dy + dz * dz <= 9.0, "offset outside 3-block radius");
        }
    }
}
