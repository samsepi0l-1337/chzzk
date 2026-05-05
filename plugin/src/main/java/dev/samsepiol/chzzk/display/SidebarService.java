package dev.samsepiol.chzzk.display;

import dev.samsepiol.chzzk.state.DeathCountService;
import dev.samsepiol.chzzk.state.PluginStateStore;
import dev.samsepiol.chzzk.state.TargetService;
import java.util.List;
import org.bukkit.Bukkit;
import org.bukkit.ChatColor;
import org.bukkit.entity.Player;
import org.bukkit.scoreboard.DisplaySlot;
import org.bukkit.scoreboard.Objective;
import org.bukkit.scoreboard.Scoreboard;
import org.bukkit.scoreboard.ScoreboardManager;

public final class SidebarService {
    private final PluginStateStore store;
    private final TargetService targetService;
    private final DeathCountService deathCountService;

    public SidebarService(
            PluginStateStore store,
            TargetService targetService,
            DeathCountService deathCountService) {
        this.store = store;
        this.targetService = targetService;
        this.deathCountService = deathCountService;
    }

    public void setEnabled(boolean enabled) {
        store.setSidebarEnabled(enabled);
        if (enabled) {
            update();
        } else {
            clear();
        }
    }

    public void update() {
        if (!store.sidebarEnabled()) {
            return;
        }
        targetService.onlineTarget().ifPresent(this::render);
    }

    public void clear() {
        ScoreboardManager manager = Bukkit.getScoreboardManager();
        targetService.onlineTarget().ifPresent(player -> player.setScoreboard(manager.getMainScoreboard()));
    }

    private void render(Player player) {
        ScoreboardManager manager = Bukkit.getScoreboardManager();
        Scoreboard board = manager.getNewScoreboard();
        Objective objective = board.registerNewObjective("chzzk", "dummy", "CHZZK 후원");
        objective.setDisplaySlot(DisplaySlot.SIDEBAR);

        List<String> lines = SidebarLines.build(deathCountService.count());
        int score = lines.size();
        for (String line : lines) {
            objective.getScore(uniqueLine(line, score)).setScore(score);
            score -= 1;
        }
        player.setScoreboard(board);
    }

    private static String uniqueLine(String line, int score) {
        return line + ChatColor.values()[score % ChatColor.values().length];
    }
}
