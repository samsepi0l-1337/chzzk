package dev.samsepiol.chzzk.listener;

import dev.samsepiol.chzzk.display.SidebarService;
import dev.samsepiol.chzzk.effect.DonationEffectExecutor;
import dev.samsepiol.chzzk.state.DeathCountService;
import dev.samsepiol.chzzk.state.TargetService;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.PlayerDeathEvent;

public final class TargetDeathListener implements Listener {
    private final TargetService targetService;
    private final DeathCountService deathCountService;
    private final SidebarService sidebarService;
    private final DonationEffectExecutor effectExecutor;

    public TargetDeathListener(
            TargetService targetService,
            DeathCountService deathCountService,
            SidebarService sidebarService,
            DonationEffectExecutor effectExecutor) {
        this.targetService = targetService;
        this.deathCountService = deathCountService;
        this.sidebarService = sidebarService;
        this.effectExecutor = effectExecutor;
    }

    @EventHandler
    public void onPlayerDeath(PlayerDeathEvent event) {
        if (!targetService.isTarget(event.getEntity().getUniqueId())) {
            return;
        }
        deathCountService.increment();
        if (effectExecutor.consumePluginKill(event.getEntity().getUniqueId())) {
            event.setKeepInventory(false);
        }
        sidebarService.update();
    }
}
