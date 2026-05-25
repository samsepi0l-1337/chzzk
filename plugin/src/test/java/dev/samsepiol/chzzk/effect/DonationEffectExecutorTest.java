package dev.samsepiol.chzzk.effect;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Random;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.Sound;
import org.bukkit.World;
import org.bukkit.entity.EntityType;
import org.bukkit.entity.Player;
import org.bukkit.entity.TNTPrimed;
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
    void immediateTntCountUsesWeightedThreeToFiveSpawns() {
        assertEquals(3, DonationEffectExecutor.pickTntSpawnCount(new FixedRandom(0)));
        assertEquals(3, DonationEffectExecutor.pickTntSpawnCount(new FixedRandom(89)));
        assertEquals(4, DonationEffectExecutor.pickTntSpawnCount(new FixedRandom(90)));
        assertEquals(4, DonationEffectExecutor.pickTntSpawnCount(new FixedRandom(98)));
        assertEquals(5, DonationEffectExecutor.pickTntSpawnCount(new FixedRandom(99)));
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

    @Test
    void spawnedTntUsesTwoSecondFuse() throws ReflectiveOperationException {
        List<Integer> fuseTicks = new ArrayList<>();
        World world = worldRecordingTntFuse(fuseTicks, new ArrayList<>());
        Player target = playerAt(world, new Location(world, 10.0, 64.0, -20.0));
        DonationEffectExecutor executor = new DonationEffectExecutor(null, new FirstZeroThenCenterRandom());

        Method spawnTnt = DonationEffectExecutor.class.getDeclaredMethod("spawnTnt", Player.class);
        spawnTnt.setAccessible(true);
        invoke(spawnTnt, executor, target);

        assertEquals(List.of(40, 40, 40), fuseTicks);
    }

    @Test
    void spawnedTntPlaysPrimedSound() throws ReflectiveOperationException {
        List<Sound> worldSounds = new ArrayList<>();
        List<Sound> playerSounds = new ArrayList<>();
        World world = worldRecordingTntFuse(new ArrayList<>(), worldSounds);
        Player target = playerAt(world, new Location(world, 10.0, 64.0, -20.0), playerSounds);
        DonationEffectExecutor executor = new DonationEffectExecutor(null, new FirstZeroThenCenterRandom());

        Method spawnTnt = DonationEffectExecutor.class.getDeclaredMethod("spawnTnt", Player.class);
        spawnTnt.setAccessible(true);
        invoke(spawnTnt, executor, target);

        assertEquals(List.of(Sound.ENTITY_TNT_PRIMED), worldSounds);
        assertEquals(List.of(Sound.ENTITY_TNT_PRIMED), playerSounds);
    }

    private static void invoke(Method method, Object target, Object... arguments) throws ReflectiveOperationException {
        invokeReturning(method, target, arguments);
    }

    private static Object invokeReturning(Method method, Object target, Object... arguments)
            throws ReflectiveOperationException {
        try {
            return method.invoke(target, arguments);
        } catch (InvocationTargetException exception) {
            Throwable cause = exception.getCause();
            if (cause instanceof RuntimeException runtimeException) {
                throw runtimeException;
            }
            if (cause instanceof Error error) {
                throw error;
            }
            throw exception;
        }
    }

    private static World worldRecordingTntFuse(List<Integer> fuseTicks, List<Sound> sounds) {
        return proxy(World.class, (proxy, method, arguments) -> {
            if ("spawn".equals(method.getName())
                    && arguments != null
                    && arguments.length == 2
                    && arguments[1] == TNTPrimed.class) {
                return tntRecordingFuse(fuseTicks);
            }
            if ("playSound".equals(method.getName())
                    && arguments != null
                    && arguments.length == 4
                    && arguments[1] instanceof Sound sound) {
                sounds.add(sound);
                return null;
            }
            return defaultValue(method.getReturnType());
        });
    }

    private static TNTPrimed tntRecordingFuse(List<Integer> fuseTicks) {
        return proxy(TNTPrimed.class, (proxy, method, arguments) -> {
            if ("setFuseTicks".equals(method.getName())) {
                fuseTicks.add((Integer) arguments[0]);
                return null;
            }
            return defaultValue(method.getReturnType());
        });
    }

    private static Player playerAt(World world, Location location) {
        return playerAt(world, location, new ArrayList<>());
    }

    private static Player playerAt(World world, Location location, List<Sound> sounds) {
        return proxy(Player.class, (proxy, method, arguments) -> switch (method.getName()) {
            case "getWorld" -> world;
            case "getLocation" -> location.clone();
            case "playSound" -> {
                if (arguments != null && arguments.length == 4 && arguments[1] instanceof Sound sound) {
                    sounds.add(sound);
                }
                yield null;
            }
            default -> defaultValue(method.getReturnType());
        });
    }

    @SuppressWarnings("unchecked")
    private static <T> T proxy(Class<T> type, ThrowingInvocationHandler handler) {
        return (T) Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[] {type}, (proxy, method, arguments) -> {
            if (method.getDeclaringClass() == Object.class) {
                return switch (method.getName()) {
                    case "toString" -> type.getSimpleName() + " proxy";
                    case "hashCode" -> System.identityHashCode(proxy);
                    case "equals" -> proxy == arguments[0];
                    default -> defaultValue(method.getReturnType());
                };
            }
            return handler.invoke(proxy, method, arguments);
        });
    }

    private static Object defaultValue(Class<?> type) {
        if (type == boolean.class) {
            return false;
        }
        if (type == byte.class) {
            return (byte) 0;
        }
        if (type == short.class) {
            return (short) 0;
        }
        if (type == int.class) {
            return 0;
        }
        if (type == long.class) {
            return 0L;
        }
        if (type == float.class) {
            return 0.0F;
        }
        if (type == double.class) {
            return 0.0;
        }
        if (type == char.class) {
            return '\0';
        }
        return null;
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

    private static final class FirstZeroThenCenterRandom extends Random {
        private boolean first = true;

        @Override
        public int nextInt(int bound) {
            if (first) {
                first = false;
                assertEquals(100, bound);
                return 0;
            }
            assertEquals(7, bound);
            return 3;
        }
    }

    @FunctionalInterface
    private interface ThrowingInvocationHandler {
        Object invoke(Object proxy, Method method, Object[] arguments) throws Throwable;
    }
}
