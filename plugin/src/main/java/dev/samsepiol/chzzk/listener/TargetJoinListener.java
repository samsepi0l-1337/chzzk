package dev.samsepiol.chzzk.listener;

import dev.samsepiol.chzzk.display.SidebarService;
import dev.samsepiol.chzzk.state.TargetService;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;

public final class TargetJoinListener implements Listener {
    private final TargetService targetService;
    private final SidebarService sidebarService;

    public TargetJoinListener(TargetService targetService, SidebarService sidebarService) {
        this.targetService = targetService;
        this.sidebarService = sidebarService;
    }

    @EventHandler
    public void onPlayerJoin(PlayerJoinEvent event) {
        refreshTargetSidebarOnJoin(
                event.getPlayer().getUniqueId(),
                () -> targetService.onlineTarget().map(Player::getUniqueId),
                sidebarService::update);
    }

    static void refreshTargetSidebarOnJoin(
            UUID joinedPlayerId,
            Supplier<Optional<UUID>> onlineTargetId,
            Runnable updateSidebar) {
        if (onlineTargetId.get().filter(joinedPlayerId::equals).isPresent()) {
            updateSidebar.run();
        }
    }
}
