package dev.samsepiol.chzzk.effect;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Random;
import org.bukkit.Location;
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
    void pickRandomBlockColumnUsesCurrentXzWithinThousandBlocks() {
        Location current = new Location(null, 250.5, 64.0, -80.5);

        DonationEffectExecutor.BlockColumn minimum =
                DonationEffectExecutor.pickRandomBlockColumn(current, new FixedRandom(0, 0));
        DonationEffectExecutor.BlockColumn maximum =
                DonationEffectExecutor.pickRandomBlockColumn(current, new FixedRandom(2000, 2000));

        assertEquals(new DonationEffectExecutor.BlockColumn(-750, -1081), minimum);
        assertEquals(new DonationEffectExecutor.BlockColumn(1250, 919), maximum);
    }

    @Test
    void validTeleportPlacementAllowsOnlyOpenSkySurface() {
        assertTrue(DonationEffectExecutor.isValidPlayerTeleportPlacement(
                Material.AIR, Material.STONE, Material.AIR, true));
    }

    @Test
    void validTeleportPlacementRejectsWaterLavaFloatingBuriedAndUnderground() {
        assertFalse(DonationEffectExecutor.isValidPlayerTeleportPlacement(
                Material.WATER, Material.STONE, Material.AIR, true));
        assertFalse(DonationEffectExecutor.isValidPlayerTeleportPlacement(
                Material.LAVA, Material.STONE, Material.AIR, true));
        assertFalse(DonationEffectExecutor.isValidPlayerTeleportPlacement(
                Material.AIR, Material.AIR, Material.AIR, true));
        assertFalse(DonationEffectExecutor.isValidPlayerTeleportPlacement(
                Material.STONE, Material.STONE, Material.AIR, true));
        assertFalse(DonationEffectExecutor.isValidPlayerTeleportPlacement(
                Material.AIR, Material.STONE, Material.STONE, true));
        assertFalse(DonationEffectExecutor.isValidPlayerTeleportPlacement(
                Material.AIR, Material.STONE, Material.AIR, false));
    }

    @Test
    void immediateTntCountUsesFiveToSevenSpawns() {
        assertEquals(5, DonationEffectExecutor.pickTntSpawnCount(new FixedRandom(0)));
        assertEquals(6, DonationEffectExecutor.pickTntSpawnCount(new FixedRandom(1)));
        assertEquals(7, DonationEffectExecutor.pickTntSpawnCount(new FixedRandom(2)));
    }

    @Test
    void pickTntSpawnLocationStaysWithinThreeBlockRadius() {
        Location target = new Location(null, 10.0, 64.0, -20.0);
        Random random = new Random(7);

        for (int index = 0; index < 20; index += 1) {
            Location tnt = DonationEffectExecutor.pickTntSpawnLocation(target, random);
            double dx = tnt.getX() - target.getX();
            double dy = tnt.getY() - target.getY();
            double dz = tnt.getZ() - target.getZ();
            assertTrue(dx * dx + dy * dy + dz * dz <= 9.0, "offset outside 3-block radius");
        }
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
