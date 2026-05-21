package dev.samsepiol.chzzk.effect;

import dev.samsepiol.chzzk.donation.DonationTier;
import dev.samsepiol.chzzk.state.TargetService;
import java.util.Random;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.World;
import org.bukkit.entity.EntityType;
import org.bukkit.entity.Player;
import org.bukkit.entity.TNTPrimed;
import org.bukkit.inventory.ItemStack;
import org.bukkit.potion.PotionEffect;

public final class DonationEffectExecutor implements Consumer<DonationTier> {
    private static final int MAX_TELEPORT_PLACEMENT_ATTEMPTS = 32;
    private static final int RANDOM_TELEPORT_HORIZONTAL_RANGE = 1000;
    static final int TNT_SPAWN_RADIUS = 3;
    static final int TNT_MIN_SPAWNS = 5;
    static final int TNT_MAX_SPAWNS = 7;
    private static final int TNT_LOCATION_ATTEMPTS = 16;
    private final TargetService targetService;
    private final Set<UUID> pluginKills = ConcurrentHashMap.newKeySet();
    private final Random random;

    public DonationEffectExecutor(TargetService targetService) {
        this(targetService, new Random());
    }

    DonationEffectExecutor(TargetService targetService, Random random) {
        this.targetService = targetService;
        this.random = random;
    }

    @Override
    public void accept(DonationTier tier) {
        Player target = targetService.onlineTarget()
                .orElseThrow(() -> new IllegalStateException("target is offline"));
        switch (tier) {
            case RANDOM_BUFF -> applyRandomBuff(target);
            case RANDOM_ITEM -> giveRandomItem(target);
            case RANDOM_MOB -> spawn(target, pick(RandomPools.mobs()));
            case COMBAT_MOB -> spawn(target, pickCombatMob());
            case THREE_COMBAT_MOBS -> repeat(3, () -> spawn(target, pickCombatMob()));
            case TNT -> spawnTnt(target);
            case RANDOM_TELEPORT -> teleportRandomly(target);
            case KILL_TARGET -> kill(target);
        }
    }

    public boolean consumePluginKill(UUID uuid) {
        return pluginKills.remove(uuid);
    }

    private void applyRandomBuff(Player target) {
        target.addPotionEffect(new PotionEffect(pick(RandomPools.buffs()), 20 * 30, 0));
    }

    private void giveRandomItem(Player target) {
        Material material = pick(RandomPools.items());
        target.getInventory().addItem(new ItemStack(material, 1));
    }

    private void spawn(Player target, EntityType type) {
        World world = target.getWorld();
        world.spawnEntity(target.getLocation(), type);
    }

    private EntityType pickCombatMob() {
        return pickCombatMob(random);
    }

    static EntityType pickCombatMob(Random random) {
        if (random.nextInt(100) == 0) {
            return EntityType.WITHER;
        }
        return pick(RandomPools.combatMobs(), random);
    }

    private void spawnTnt(Player target) {
        int count = pickTntSpawnCount(random);
        for (int index = 0; index < count; index += 1) {
            target.getWorld().spawn(pickTntSpawnLocation(target.getLocation(), random), TNTPrimed.class);
        }
    }

    static int pickTntSpawnCount(Random random) {
        return TNT_MIN_SPAWNS + random.nextInt(TNT_MAX_SPAWNS - TNT_MIN_SPAWNS + 1);
    }

    static Location pickTntSpawnLocation(Location targetLocation, Random random) {
        for (int attempt = 0; attempt < TNT_LOCATION_ATTEMPTS; attempt += 1) {
            int offsetX = pickTntOffset(random);
            int offsetY = pickTntOffset(random);
            int offsetZ = pickTntOffset(random);
            if (offsetX * offsetX + offsetY * offsetY + offsetZ * offsetZ <= TNT_SPAWN_RADIUS * TNT_SPAWN_RADIUS) {
                return targetLocation.clone().add(offsetX, offsetY, offsetZ);
            }
        }
        return targetLocation.clone();
    }

    private static int pickTntOffset(Random random) {
        return random.nextInt(TNT_SPAWN_RADIUS * 2 + 1) - TNT_SPAWN_RADIUS;
    }

    private void teleportRandomly(Player target) {
        target.teleport(pickRandomTeleportDestination(target.getLocation()));
    }

    private Location pickRandomTeleportDestination(Location current) {
        World world = current.getWorld();
        int maxY = world.getMaxHeight() - 2;
        for (int attempt = 0; attempt < MAX_TELEPORT_PLACEMENT_ATTEMPTS; attempt += 1) {
            BlockColumn column = pickRandomBlockColumn(current, random);
            int feetY = world.getHighestBlockYAt(column.blockX(), column.blockZ()) + 1;
            if (feetY <= maxY && isValidPlayerTeleportPlacement(world, column.blockX(), feetY, column.blockZ())) {
                return new Location(world, column.blockX() + 0.5, feetY, column.blockZ() + 0.5);
            }
        }
        throw new IllegalStateException("Unable to find teleport placement");
    }

    static BlockColumn pickRandomBlockColumn(Location current, Random random) {
        int blockX = pickRandomBlockCoordinate(
                current.getBlockX() - RANDOM_TELEPORT_HORIZONTAL_RANGE,
                current.getBlockX() + RANDOM_TELEPORT_HORIZONTAL_RANGE,
                random);
        int blockZ = pickRandomBlockCoordinate(
                current.getBlockZ() - RANDOM_TELEPORT_HORIZONTAL_RANGE,
                current.getBlockZ() + RANDOM_TELEPORT_HORIZONTAL_RANGE,
                random);
        return new BlockColumn(blockX, blockZ);
    }

    static int pickRandomBlockCoordinate(int minInclusive, int maxInclusive, Random random) {
        if (maxInclusive <= minInclusive) {
            return minInclusive;
        }
        return minInclusive + random.nextInt(maxInclusive - minInclusive + 1);
    }

    static boolean isValidPlayerTeleportPlacement(World world, int blockX, int feetY, int blockZ) {
        var feet = world.getBlockAt(blockX, feetY, blockZ);
        var below = world.getBlockAt(blockX, feetY - 1, blockZ);
        var head = world.getBlockAt(blockX, feetY + 1, blockZ);
        if (!feet.isPassable() || !head.isPassable()) {
            return false;
        }
        if (feet.isLiquid() || head.isLiquid()) {
            return false;
        }
        return below.getType().isSolid();
    }

    static boolean isValidPlayerTeleportPlacement(
            Material feetBlock, Material belowBlock, Material headBlock, boolean openSky) {
        if (!openSky) {
            return false;
        }
        if (!isPassableForPlayerBody(feetBlock) || !isPassableForPlayerBody(headBlock)) {
            return false;
        }
        return isSupportBlockForPlayer(belowBlock);
    }

    private static boolean isPassableForPlayerBody(Material material) {
        return material == Material.AIR
                || material == Material.CAVE_AIR
                || material == Material.VOID_AIR;
    }

    private static boolean isSupportBlockForPlayer(Material material) {
        return !isPassableForPlayerBody(material) && material != Material.WATER && material != Material.LAVA;
    }

    private void kill(Player target) {
        pluginKills.add(target.getUniqueId());
        target.setHealth(0.0);
    }

    private <T> T pick(java.util.List<T> values) {
        return values.get(random.nextInt(values.size()));
    }

    private static <T> T pick(java.util.List<T> values, Random random) {
        return values.get(random.nextInt(values.size()));
    }

    private static void repeat(int count, Runnable action) {
        for (int index = 0; index < count; index += 1) {
            action.run();
        }
    }

    record BlockColumn(int blockX, int blockZ) {}
}
