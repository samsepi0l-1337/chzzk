package dev.samsepiol.chzzk.command;

import dev.samsepiol.chzzk.donation.DonationEvent;
import dev.samsepiol.chzzk.donation.DonationService;
import dev.samsepiol.chzzk.display.SidebarService;
import dev.samsepiol.chzzk.state.DeathCountService;
import dev.samsepiol.chzzk.state.TargetService;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.OptionalInt;
import java.util.UUID;
import java.util.function.Consumer;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.event.ClickEvent;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextDecoration;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabExecutor;

public final class ChzzkCommand implements TabExecutor {
    private static final String ADMIN_PERMISSION = "chzzkdonation.admin";

    private final TargetService targetService;
    private final SidebarService sidebarService;
    private final DeathCountService deathCountService;
    private final DonationService donationService;
    private final Runnable reload;
    private final String authUrl;

    public ChzzkCommand(
            TargetService targetService,
            SidebarService sidebarService,
            DeathCountService deathCountService,
            DonationService donationService,
            Runnable reload,
            String authUrl) {
        this.targetService = targetService;
        this.sidebarService = sidebarService;
        this.deathCountService = deathCountService;
        this.donationService = donationService;
        this.reload = reload;
        this.authUrl = authUrl == null ? "" : authUrl.trim();
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (args.length == 0) {
            sender.sendMessage("/chzzk <auth|target|sidebar|deaths|simulate|reload>");
            sender.sendMessage("/chzzk sidebar <on|off|donations|deaths> [on|off]");
            return true;
        }
        if ("auth".equals(args[0])) {
            handleAuth(sender);
            return true;
        }
        if (!sender.hasPermission(ADMIN_PERMISSION)) {
            sender.sendMessage("You do not have permission to use this command.");
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
            if (!sender.hasPermission(ADMIN_PERMISSION)) {
                return List.of("auth");
            }
            return List.of("auth", "target", "sidebar", "deaths", "simulate", "reload");
        }
        if (args.length == 2 && "target".equals(args[0])) {
            return List.of("set", "clear", "status");
        }
        if (args.length == 2 && "sidebar".equals(args[0])) {
            return List.of("on", "off", "donations", "deaths");
        }
        if (args.length == 3 && "sidebar".equals(args[0])
                && ("donations".equals(args[1]) || "deaths".equals(args[1]))) {
            return List.of("on", "off");
        }
        if (args.length == 2 && "deaths".equals(args[0])) {
            return List.of("reset");
        }
        return List.of();
    }

    private void handleAuth(CommandSender sender) {
        if (authUrl.isBlank()) {
            sender.sendMessage("CHZZK auth URL is not configured.");
            return;
        }
        sender.sendMessage(Component.text("인증하기")
                .color(NamedTextColor.AQUA)
                .decorate(TextDecoration.UNDERLINED)
                .clickEvent(ClickEvent.openUrl(authUrl)));
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
            sender.sendMessage("/chzzk sidebar <on|off|donations|deaths> [on|off]");
            return;
        }
        String section = args[1];
        if ("donations".equals(section) || "deaths".equals(section)) {
            handleSidebarSection(sender, section, args);
            return;
        }
        Optional<Boolean> enabled = parseSidebarEnabled(section);
        if (enabled.isEmpty()) {
            sender.sendMessage("/chzzk sidebar <on|off|donations|deaths> [on|off]");
            return;
        }
        sidebarService.setEnabled(enabled.get());
        sender.sendMessage("Sidebar " + (enabled.get() ? "enabled." : "disabled."));
    }

    private void handleSidebarSection(CommandSender sender, String section, String[] args) {
        if (args.length < 3) {
            sender.sendMessage("/chzzk sidebar " + section + " <on|off>");
            return;
        }
        Optional<Boolean> enabled = parseSidebarEnabled(args[2]);
        if (enabled.isEmpty()) {
            sender.sendMessage("/chzzk sidebar " + section + " <on|off>");
            return;
        }
        if ("donations".equals(section)) {
            sidebarService.setDonationsEnabled(enabled.get());
            sender.sendMessage("Sidebar donations " + (enabled.get() ? "enabled." : "disabled."));
            return;
        }
        sidebarService.setDeathsEnabled(enabled.get());
        sender.sendMessage("Sidebar deaths " + (enabled.get() ? "enabled." : "disabled."));
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

    static Optional<Boolean> parseSidebarEnabled(String value) {
        return switch (value) {
            case "on" -> Optional.of(true);
            case "off" -> Optional.of(false);
            default -> Optional.empty();
        };
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
