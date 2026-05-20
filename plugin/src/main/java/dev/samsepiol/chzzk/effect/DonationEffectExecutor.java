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
import org.bukkit.WorldBorder;
import org.bukkit.entity.EntityType;
import org.bukkit.entity.Player;
import org.bukkit.entity.TNTPrimed;
import org.bukkit.inventory.ItemStack;
import org.bukkit.potion.PotionEffect;

public final class DonationEffectExecutor implements Consumer<DonationTier> {
    private static final int MAX_TELEPORT_PLACEMENT_ATTEMPTS = 32;
    private final TargetService targetService;
    private final Set<UUID> pluginKills = ConcurrentHashMap.newKeySet();
    private final Set<UUID> donationTnts = ConcurrentHashMap.newKeySet();
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

    public boolean consumeDonationTnt(UUID uuid) {
        return donationTnts.remove(uuid);
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
        TNTPrimed tnt = target.getWorld().spawn(target.getLocation(), TNTPrimed.class);
        donationTnts.add(tnt.getUniqueId());
    }

    private void teleportRandomly(Player target) {
        target.teleport(pickRandomTeleportDestination(target.getLocation()));
    }

    private Location pickRandomTeleportDestination(Location current) {
        World world = current.getWorld();
        int minY = world.getMinHeight() + 1;
        int maxY = world.getMaxHeight() - 2;
        WorldBorder border = world.getWorldBorder();
        for (int attempt = 0; attempt < MAX_TELEPORT_PLACEMENT_ATTEMPTS; attempt += 1) {
            BlockColumn column = pickRandomBlockColumn(border, random);
            java.util.List<Integer> validYList = new java.util.ArrayList<>();
            for (int y = minY; y <= maxY; y += 1) {
                if (isValidPlayerTeleportPlacement(world, column.blockX(), y, column.blockZ())) {
                    validYList.add(y);
                }
            }
            if (!validYList.isEmpty()) {
                int blockY = validYList.get(random.nextInt(validYList.size()));
                return new Location(world, column.blockX() + 0.5, blockY, column.blockZ() + 0.5);
            }
        }
        throw new IllegalStateException("Unable to find teleport placement");
    }

    static BlockColumn pickRandomBlockColumn(WorldBorder border, Random random) {
        Location center = border.getCenter();
        int half = Math.max(0, (int) Math.floor(border.getSize() / 2.0) - 1);
        int blockX = pickRandomBlockCoordinate(center.getBlockX() - half, center.getBlockX() + half, random);
        int blockZ = pickRandomBlockCoordinate(center.getBlockZ() - half, center.getBlockZ() + half, random);
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
        if (feet.isLiquid()) {
            return true;
        }
        return below.getType().isSolid();
    }

    static boolean isValidPlayerTeleportPlacement(Material feetBlock, Material belowBlock, Material headBlock) {
        if (!isPassableForPlayerBody(feetBlock) || !isPassableForPlayerBody(headBlock)) {
            return false;
        }
        return hasTeleportSupport(feetBlock, belowBlock);
    }

    private static boolean isPassableForPlayerBody(Material material) {
        return material == Material.AIR
                || material == Material.CAVE_AIR
                || material == Material.VOID_AIR
                || material == Material.WATER
                || material == Material.LAVA;
    }

    private static boolean hasTeleportSupport(Material feetBlock, Material belowBlock) {
        if (feetBlock == Material.WATER || feetBlock == Material.LAVA) {
            return true;
        }
        return isSupportBlock(belowBlock);
    }

    private static boolean isSupportBlock(Material belowBlock) {
        if (isPassableForPlayerBody(belowBlock) && belowBlock != Material.LAVA) {
            return false;
        }
        return belowBlock == Material.LAVA || !isPassableForPlayerBody(belowBlock);
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
