package dev.samsepiol.chzzk.effect;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Random;
import org.bukkit.Material;
import org.bukkit.entity.EntityType;
import org.junit.jupiter.api.Test;

final class DonationEffectExecutorTest {
    @Test
    void pickCombatMobCanRollWither() {
        assertEquals(EntityType.WITHER, DonationEffectExecutor.pickCombatMob(new FixedRandom(0)));
    }

    @Test
    void pickCombatMobFallsBackToCombatPool() {
        assertEquals(EntityType.SPIDER, DonationEffectExecutor.pickCombatMob(new FixedRandom(1, 3)));
    }

    @Test
    void pickRandomBlockCoordinateUsesInclusiveRange() {
        assertEquals(10, DonationEffectExecutor.pickRandomBlockCoordinate(10, 10, new FixedRandom(0)));
        assertEquals(12, DonationEffectExecutor.pickRandomBlockCoordinate(10, 15, new FixedRandom(2)));
    }

    @Test
    void validTeleportPlacementAllowsCaveFloorWaterAndLava() {
        assertTrue(DonationEffectExecutor.isValidPlayerTeleportPlacement(
                Material.AIR, Material.STONE, Material.AIR));
        assertTrue(DonationEffectExecutor.isValidPlayerTeleportPlacement(
                Material.WATER, Material.WATER, Material.AIR));
        assertTrue(DonationEffectExecutor.isValidPlayerTeleportPlacement(
                Material.LAVA, Material.LAVA, Material.AIR));
        assertTrue(DonationEffectExecutor.isValidPlayerTeleportPlacement(
                Material.AIR, Material.LAVA, Material.AIR));
    }

    @Test
    void validTeleportPlacementRejectsFloatingAndBuried() {
        assertFalse(DonationEffectExecutor.isValidPlayerTeleportPlacement(
                Material.AIR, Material.AIR, Material.AIR));
        assertFalse(DonationEffectExecutor.isValidPlayerTeleportPlacement(
                Material.STONE, Material.STONE, Material.AIR));
        assertFalse(DonationEffectExecutor.isValidPlayerTeleportPlacement(
                Material.AIR, Material.STONE, Material.STONE));
    }

    private static final class FixedRandom extends Random {
        private final Deque<Integer> values;
        private final Deque<Double> doubleValues;

        private FixedRandom(int... values) {
            this.values = new ArrayDeque<>(values.length);
            this.doubleValues = new ArrayDeque<>();
            for (int value : values) {
                this.values.addLast(value);
            }
        }

        private FixedRandom(double... values) {
            this.values = new ArrayDeque<>();
            this.doubleValues = new ArrayDeque<>(values.length);
            for (double value : values) {
                this.doubleValues.addLast(value);
            }
        }

        @Override
        public int nextInt(int bound) {
            if (values.isEmpty()) {
                throw new IllegalStateException("No more fixed random values");
            }
            int value = values.removeFirst();
            if (value < 0 || value >= bound) {
                throw new IllegalStateException("Fixed random value " + value + " is outside bound " + bound);
            }
            return value;
        }

        @Override
        public double nextDouble() {
            if (doubleValues.isEmpty()) {
                throw new IllegalStateException("No more fixed random double values");
            }
            double value = doubleValues.removeFirst();
            assertTrue(value >= 0.0 && value < 1.0);
            return value;
        }
    }
}
