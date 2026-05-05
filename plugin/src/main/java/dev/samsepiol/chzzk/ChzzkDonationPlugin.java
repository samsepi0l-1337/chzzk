package dev.samsepiol.chzzk;

import dev.samsepiol.chzzk.command.ChzzkCommand;
import dev.samsepiol.chzzk.display.SidebarService;
import dev.samsepiol.chzzk.donation.DonationService;
import dev.samsepiol.chzzk.donation.DonationTier;
import dev.samsepiol.chzzk.effect.DonationEffectExecutor;
import dev.samsepiol.chzzk.listener.TargetDeathListener;
import dev.samsepiol.chzzk.state.DeathCountService;
import dev.samsepiol.chzzk.state.PluginStateStore;
import dev.samsepiol.chzzk.state.TargetService;
import dev.samsepiol.chzzk.webhook.DonationWebhookServer;
import dev.samsepiol.chzzk.webhook.HmacVerifier;
import java.nio.file.Path;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.Consumer;
import org.bukkit.Bukkit;
import org.bukkit.command.PluginCommand;
import org.bukkit.event.HandlerList;
import org.bukkit.plugin.java.JavaPlugin;

public final class ChzzkDonationPlugin extends JavaPlugin {
    private PluginStateStore stateStore;
    private TargetService targetService;
    private DeathCountService deathCountService;
    private SidebarService sidebarService;
    private DonationEffectExecutor effectExecutor;
    private DonationWebhookServer webhookServer;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        startServices();
    }

    @Override
    public void onDisable() {
        if (webhookServer != null) {
            webhookServer.stop();
        }
    }

    public void reloadChzzk() {
        reloadConfig();
        if (webhookServer != null) {
            webhookServer.stop();
        }
        HandlerList.unregisterAll(this);
        startServices();
    }

    private void startServices() {
        stateStore = new PluginStateStore(Path.of(getDataFolder().getPath(), "state.json"));
        targetService = new TargetService(stateStore);
        deathCountService = new DeathCountService(stateStore.deathCount(), stateStore::setDeathCount);
        sidebarService = new SidebarService(stateStore, targetService, deathCountService);
        effectExecutor = new DonationEffectExecutor(targetService, getConfig().getInt("teleport.radius", 64));

        DonationService donationService = new DonationService(
                stateStore.recentEventIds(),
                targetService::availability,
                syncRunner(effectExecutor),
                stateStore::save);

        registerCommand(donationService);
        registerListener();
        startWebhook(donationService);
        sidebarService.update();
    }

    private void registerCommand(DonationService donationService) {
        PluginCommand command = getCommand("chzzk");
        if (command == null) {
            throw new IllegalStateException("plugin.yml did not register /chzzk");
        }
        ChzzkCommand executor = new ChzzkCommand(
                targetService,
                sidebarService,
                deathCountService,
                donationService,
                this::reloadChzzk);
        command.setExecutor(executor);
        command.setTabCompleter(executor);
    }

    private void registerListener() {
        var listener = new TargetDeathListener(
                targetService,
                deathCountService,
                sidebarService,
                effectExecutor);
        Bukkit.getPluginManager().registerEvents(listener, this);
    }

    private void startWebhook(DonationService donationService) {
        webhookServer = new DonationWebhookServer(
                donationService,
                new HmacVerifier(getConfig().getString("webhook.shared-secret", "change-me")),
                getLogger(),
                getConfig().getString("webhook.host", "127.0.0.1"),
                getConfig().getInt("webhook.port", 29371),
                getConfig().getString("webhook.path", "/chzzk/donations"));
        webhookServer.start();
    }

    private Consumer<DonationTier> syncRunner(DonationEffectExecutor executor) {
        return tier -> {
            if (Bukkit.isPrimaryThread()) {
                executor.accept(tier);
                return;
            }
            try {
                Bukkit.getScheduler().callSyncMethod(this, () -> {
                    executor.accept(tier);
                    sidebarService.update();
                    return null;
                }).get(5, TimeUnit.SECONDS);
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("Interrupted while running donation effect", exception);
            } catch (ExecutionException | TimeoutException exception) {
                throw new IllegalStateException("Unable to run donation effect", exception);
            }
        };
    }
}
