package dev.samsepiol.chzzk.effect;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Random;
import org.bukkit.entity.EntityType;
import org.junit.jupiter.api.Test;

final class DonationEffectExecutorTest {
    @Test
    void pickCombatMobCanRollWither() {
        assertEquals(EntityType.WITHER, DonationEffectExecutor.pickCombatMob(new FixedRandom(0)));
    }

    @Test
    void pickCombatMobFallsBackToCombatPool() {
        assertEquals(EntityType.EVOKER, DonationEffectExecutor.pickCombatMob(new FixedRandom(1, 3)));
    }

    private static final class FixedRandom extends Random {
        private final Deque<Integer> values;

        private FixedRandom(int... values) {
            this.values = new ArrayDeque<>(values.length);
            for (int value : values) {
                this.values.addLast(value);
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
    }
}
