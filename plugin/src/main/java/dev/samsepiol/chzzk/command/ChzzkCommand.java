package dev.samsepiol.chzzk.command;

import dev.samsepiol.chzzk.donation.DonationEvent;
import dev.samsepiol.chzzk.donation.DonationService;
import dev.samsepiol.chzzk.display.SidebarService;
import dev.samsepiol.chzzk.state.DeathCountService;
import dev.samsepiol.chzzk.state.TargetService;
import java.time.Instant;
import java.util.List;
import java.util.OptionalInt;
import java.util.UUID;
import java.util.function.Consumer;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabExecutor;

public final class ChzzkCommand implements TabExecutor {
    private final TargetService targetService;
    private final SidebarService sidebarService;
    private final DeathCountService deathCountService;
    private final DonationService donationService;
    private final Runnable reload;

    public ChzzkCommand(
            TargetService targetService,
            SidebarService sidebarService,
            DeathCountService deathCountService,
            DonationService donationService,
            Runnable reload) {
        this.targetService = targetService;
        this.sidebarService = sidebarService;
        this.deathCountService = deathCountService;
        this.donationService = donationService;
        this.reload = reload;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (args.length == 0) {
            sender.sendMessage("/chzzk <target|sidebar|deaths|simulate|reload>");
            return true;
        }
        switch (args[0]) {
            case "target" -> handleTarget(sender, args);
            case "sidebar" -> handleSidebar(sender, args);
            case "deaths" -> handleDeaths(sender, args);
            case "simulate" -> handleSimulate(sender, args);
            case "reload" -> {
                reload.run();
                sender.sendMessage("CHZZK config reloaded.");
            }
            default -> sender.sendMessage("Unknown subcommand.");
        }
        return true;
    }

    @Override
    public List<String> onTabComplete(CommandSender sender, Command command, String alias, String[] args) {
        if (args.length == 1) {
            return List.of("target", "sidebar", "deaths", "simulate", "reload");
        }
        if (args.length == 2 && "target".equals(args[0])) {
            return List.of("set", "clear", "status");
        }
        if (args.length == 2 && "sidebar".equals(args[0])) {
            return List.of("on", "off");
        }
        if (args.length == 2 && "deaths".equals(args[0])) {
            return List.of("reset");
        }
        return List.of();
    }

    private void handleTarget(CommandSender sender, String[] args) {
        if (args.length >= 3 && "set".equals(args[1])) {
            replaceTarget(args[2], sidebarService::clear, targetService::set, sidebarService::update);
            sender.sendMessage("Target set: " + args[2]);
            return;
        }
        if (args.length >= 2 && "clear".equals(args[1])) {
            sidebarService.clear();
            targetService.clear();
            sender.sendMessage("Target cleared.");
            return;
        }
        sender.sendMessage(targetService.status());
    }

    private void handleSidebar(CommandSender sender, String[] args) {
        if (args.length < 2) {
            sender.sendMessage("/chzzk sidebar <on|off>");
            return;
        }
        boolean enabled = "on".equals(args[1]);
        sidebarService.setEnabled(enabled);
        sender.sendMessage("Sidebar " + (enabled ? "enabled." : "disabled."));
    }

    private void handleDeaths(CommandSender sender, String[] args) {
        if (args.length >= 2 && "reset".equals(args[1])) {
            deathCountService.reset();
            sidebarService.update();
            sender.sendMessage("Deaths reset.");
            return;
        }
        sender.sendMessage("Deaths: " + deathCountService.count());
    }

    private void handleSimulate(CommandSender sender, String[] args) {
        if (args.length < 2) {
            sender.sendMessage("/chzzk simulate <amount>");
            return;
        }
        OptionalInt amount = parseSimulationAmount(args[1]);
        if (amount.isEmpty()) {
            sender.sendMessage("/chzzk simulate <amount>");
            return;
        }
        var result = donationService.handle(new DonationEvent(
                "simulate-" + UUID.randomUUID(),
                amount.getAsInt(),
                sender.getName(),
                "manual simulation",
                Instant.now()));
        sidebarService.update();
        sender.sendMessage("Simulation result: " + result.status());
    }

    static OptionalInt parseSimulationAmount(String value) {
        try {
            return OptionalInt.of(Integer.parseInt(value));
        } catch (NumberFormatException exception) {
            return OptionalInt.empty();
        }
    }

    static void replaceTarget(
            String target,
            Runnable clearCurrentSidebar,
            Consumer<String> setTarget,
            Runnable updateSidebar) {
        clearCurrentSidebar.run();
        setTarget.accept(target);
        updateSidebar.run();
    }
}
