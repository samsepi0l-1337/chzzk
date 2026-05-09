package dev.samsepiol.chzzk.state;

import dev.samsepiol.chzzk.donation.TargetAvailability;
import java.util.Optional;
import java.util.UUID;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;

public final class TargetService {
    private final PluginStateStore store;

    public TargetService(PluginStateStore store) {
        this.store = store;
    }

    public void set(String playerOrUuid) {
        UUID uuid = parseUuid(playerOrUuid);
        Player player = uuid == null ? Bukkit.getPlayerExact(playerOrUuid) : Bukkit.getPlayer(uuid);
        String name = player == null ? playerOrUuid : player.getName();
        store.setTarget(player == null && uuid == null ? null : uuidString(player, uuid), name);
    }

    public void clear() {
        store.clearTarget();
    }

    public String status() {
        if (store.targetUuid() == null && store.targetName() == null) {
            return "target not configured";
        }
        return store.targetName() + " (" + availability().name().toLowerCase() + ")";
    }

    public Optional<Player> onlineTarget() {
        if (store.targetUuid() != null) {
            Player byUuid = Bukkit.getPlayer(UUID.fromString(store.targetUuid()));
            if (byUuid != null) {
                return Optional.of(byUuid);
            }
        }
        if (store.targetName() == null) {
            return Optional.empty();
        }
        return Optional.ofNullable(Bukkit.getPlayerExact(store.targetName()));
    }

    public boolean isTarget(UUID uuid) {
        if (store.targetUuid() != null) {
            return UUID.fromString(store.targetUuid()).equals(uuid);
        }
        return onlineTarget().map(Player::getUniqueId).filter(uuid::equals).isPresent();
    }

    public TargetAvailability availability() {
        if (store.targetUuid() == null && store.targetName() == null) {
            return TargetAvailability.MISSING;
        }
        return onlineTarget().isPresent() ? TargetAvailability.AVAILABLE : TargetAvailability.OFFLINE;
    }

    private static UUID parseUuid(String value) {
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    private static String uuidString(Player player, UUID uuid) {
        UUID target = player == null ? uuid : player.getUniqueId();
        return target == null ? null : target.toString();
    }
}
