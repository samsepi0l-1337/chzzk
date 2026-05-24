package dev.samsepiol.chzzk.effect;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Random;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.World;
import org.bukkit.block.Block;
import org.junit.jupiter.api.Test;

final class DonationEffectTeleportTest {
    @Test
    void teleportRangeUsesCurrentXzWithinThousandBlocks() {
        Location current = new Location(null, 100, 64, -100);

        assertTrue(DonationEffectExecutor.isWithinTeleportRange(current, 1100, -1100));
        assertFalse(DonationEffectExecutor.isWithinTeleportRange(current, 1101, -100));
        assertFalse(DonationEffectExecutor.isWithinTeleportRange(current, 100, -1101));
    }

    @Test
    void requestTeleportChunksUrgentlyLoadsDestinationAndNearbyChunks() {
        Deque<String> requestedChunks = new ArrayDeque<>();
        World world = worldRecordingRequestedChunks(requestedChunks);

        DonationEffectExecutor.requestTeleportChunks(world, 32, -1);

        assertEquals(121, requestedChunks.size());
        assertTrue(requestedChunks.contains("2,-1"));
        assertTrue(requestedChunks.contains("-3,-6"));
        assertTrue(requestedChunks.contains("7,4"));
    }

    @Test
    void prepareTeleportChunksPrioritizesCurrentPlayerArea() {
        Deque<String> requestedChunks = new ArrayDeque<>();
        World world = worldRecordingRequestedChunks(requestedChunks);
        Location current = new Location(world, 100.0, 64.0, -100.0);

        DonationEffectExecutor.preparePlayerAreaChunks(current);

        assertEquals(8, requestedChunks.size());
        assertTrue(requestedChunks.contains("6,-7"));
        assertTrue(requestedChunks.contains("5,-8"));
        assertTrue(requestedChunks.contains("6,-8"));
        assertFalse(requestedChunks.contains("-2,-15"));
    }

    @Test
    void randomTeleportLoadsSelectedDestinationChunkBeforeFindingSurface() throws ReflectiveOperationException {
        Deque<String> loadedChunks = new ArrayDeque<>();
        World world = worldWithLoadedSurfaceChunk(loadedChunks);
        Location current = new Location(world, 0.0, 64.0, 0.0);
        DonationEffectExecutor executor = new DonationEffectExecutor(null, new FixedRandom(1100, 1200));

        Method pickRandomTeleportDestination =
                DonationEffectExecutor.class.getDeclaredMethod("pickRandomTeleportDestination", Location.class);
        pickRandomTeleportDestination.setAccessible(true);
        Location destination = (Location) invokeReturning(pickRandomTeleportDestination, executor, current);

        assertEquals(100.5, destination.getX());
        assertEquals(64.0, destination.getY());
        assertEquals(200.5, destination.getZ());
        assertEquals("6,12", loadedChunks.removeFirst());
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

    private static World worldRecordingRequestedChunks(Deque<String> requestedChunks) {
        return proxy(World.class, (proxy, method, arguments) -> {
            if ("getChunkAtAsyncUrgently".equals(method.getName())
                    && arguments != null
                    && arguments.length == 2
                    && arguments[0] instanceof Integer chunkX
                    && arguments[1] instanceof Integer chunkZ) {
                requestedChunks.addLast(chunkX + "," + chunkZ);
                return java.util.concurrent.CompletableFuture.completedFuture(null);
            }
            return defaultValue(method.getReturnType());
        });
    }

    private static World worldWithLoadedSurfaceChunk(Deque<String> loadedChunks) {
        return proxy(World.class, (proxy, method, arguments) -> switch (method.getName()) {
            case "getChunkAt" -> {
                loadedChunks.addLast(arguments[0] + "," + arguments[1]);
                yield null;
            }
            case "getMaxHeight" -> 320;
            case "getHighestBlockYAt" -> 63;
            case "getBlockAt" -> blockAt((Integer) arguments[1]);
            default -> defaultValue(method.getReturnType());
        });
    }

    private static Block blockAt(int y) {
        Material material = y == 63 ? Material.STONE : Material.AIR;
        return proxy(Block.class, (proxy, method, arguments) -> switch (method.getName()) {
            case "isPassable" -> material == Material.AIR;
            case "isLiquid" -> false;
            case "getType" -> material;
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
        if (type == int.class) {
            return 0;
        }
        if (type == long.class) {
            return 0L;
        }
        if (type == double.class) {
            return 0.0;
        }
        return null;
    }

    private static final class FixedRandom extends Random {
        private final Deque<Integer> values = new ArrayDeque<>();

        private FixedRandom(int... values) {
            for (int value : values) {
                this.values.addLast(value);
            }
        }

        @Override
        public int nextInt(int bound) {
            int value = values.removeFirst();
            if (value < 0 || value >= bound) {
                throw new IllegalStateException("Fixed random value " + value + " is outside bound " + bound);
            }
            return value;
        }
    }

    @FunctionalInterface
    private interface ThrowingInvocationHandler {
        Object invoke(Object proxy, Method method, Object[] arguments) throws Throwable;
    }
}
