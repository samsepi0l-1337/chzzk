package dev.samsepiol.chzzk.listener;

import dev.samsepiol.chzzk.effect.DonationEffectExecutor;
import dev.samsepiol.chzzk.state.TargetService;
import java.util.Random;
import org.bukkit.Location;
import org.bukkit.entity.Player;
import org.bukkit.entity.TNTPrimed;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.EntityExplodeEvent;

public final class DonationTntListener implements Listener {
    static final int FOLLOW_UP_RADIUS = 3;
    static final int FOLLOW_UP_COUNT = 5;
    private static final int FOLLOW_UP_LOCATION_ATTEMPTS = 16;

    private final TargetService targetService;
    private final DonationEffectExecutor effectExecutor;
    private final Random random;

    public DonationTntListener(TargetService targetService, DonationEffectExecutor effectExecutor) {
        this(targetService, effectExecutor, new Random());
    }

    DonationTntListener(
            TargetService targetService,
            DonationEffectExecutor effectExecutor,
            Random random) {
        this.targetService = targetService;
        this.effectExecutor = effectExecutor;
        this.random = random;
    }

    @EventHandler(ignoreCancelled = true)
    public void onEntityExplode(EntityExplodeEvent event) {
        if (!(event.getEntity() instanceof TNTPrimed tnt)) {
            return;
        }
        if (!effectExecutor.consumeDonationTnt(tnt.getUniqueId())) {
            return;
        }
        targetService.onlineTarget().ifPresent(this::spawnFollowUpTnt);
    }

    private void spawnFollowUpTnt(Player target) {
        for (int index = 0; index < FOLLOW_UP_COUNT; index += 1) {
            Location location = pickFollowUpLocation(target.getLocation(), random);
            target.getWorld().spawn(location, TNTPrimed.class);
        }
    }

    static Location pickFollowUpLocation(Location targetLocation, Random random) {
        for (int attempt = 0; attempt < FOLLOW_UP_LOCATION_ATTEMPTS; attempt += 1) {
            int offsetX = pickOffset(random);
            int offsetY = pickOffset(random);
            int offsetZ = pickOffset(random);
            if (offsetX * offsetX + offsetY * offsetY + offsetZ * offsetZ <= FOLLOW_UP_RADIUS * FOLLOW_UP_RADIUS) {
                return targetLocation.clone().add(offsetX, offsetY, offsetZ);
            }
        }
        return targetLocation.clone();
    }

    private static int pickOffset(Random random) {
        return random.nextInt(FOLLOW_UP_RADIUS * 2 + 1) - FOLLOW_UP_RADIUS;
    }
}
