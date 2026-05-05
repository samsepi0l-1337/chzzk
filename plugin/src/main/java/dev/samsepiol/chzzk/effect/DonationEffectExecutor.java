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
    private final TargetService targetService;
    private final Set<UUID> pluginKills = ConcurrentHashMap.newKeySet();
    private final Random random = new Random();

    public DonationEffectExecutor(TargetService targetService) {
        this.targetService = targetService;
    }

    @Override
    public void accept(DonationTier tier) {
        Player target = targetService.onlineTarget()
                .orElseThrow(() -> new IllegalStateException("target is offline"));
        switch (tier) {
            case RANDOM_BUFF -> applyRandomBuff(target);
            case RANDOM_ITEM -> giveRandomItem(target);
            case RANDOM_MOB -> spawn(target, pick(RandomPools.mobs()));
            case COMBAT_MOB -> spawn(target, pick(RandomPools.combatMobs()));
            case THREE_COMBAT_MOBS -> repeat(3, () -> spawn(target, pick(RandomPools.combatMobs())));
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

    private void spawnTnt(Player target) {
        target.getWorld().spawn(target.getLocation(), TNTPrimed.class);
    }

    private void teleportRandomly(Player target) {
        Location current = target.getLocation();
        int offsetX = random.nextInt(129) - 64;
        int offsetZ = random.nextInt(129) - 64;
        Location destination = current.clone().add(offsetX, 0, offsetZ);
        destination.setY(current.getWorld().getHighestBlockYAt(destination) + 1);
        target.teleport(destination);
    }

    private void kill(Player target) {
        pluginKills.add(target.getUniqueId());
        target.setHealth(0.0);
    }

    private <T> T pick(java.util.List<T> values) {
        return values.get(random.nextInt(values.size()));
    }

    private static void repeat(int count, Runnable action) {
        for (int index = 0; index < count; index += 1) {
            action.run();
        }
    }
}
