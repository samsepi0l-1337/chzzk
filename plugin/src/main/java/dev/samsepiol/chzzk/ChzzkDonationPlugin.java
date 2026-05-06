package dev.samsepiol.chzzk;

import dev.samsepiol.chzzk.command.ChzzkCommand;
import dev.samsepiol.chzzk.display.SidebarService;
import dev.samsepiol.chzzk.donation.DonationService;
import dev.samsepiol.chzzk.donation.DonationTier;
import dev.samsepiol.chzzk.donation.TargetAvailability;
import dev.samsepiol.chzzk.effect.DonationEffectExecutor;
import dev.samsepiol.chzzk.listener.TargetDeathListener;
import dev.samsepiol.chzzk.listener.TargetJoinListener;
import dev.samsepiol.chzzk.state.DeathCountService;
import dev.samsepiol.chzzk.state.PluginStateStore;
import dev.samsepiol.chzzk.state.TargetService;
import dev.samsepiol.chzzk.webhook.DonationWebhookServer;
import dev.samsepiol.chzzk.webhook.HmacVerifier;
import java.nio.file.Path;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicBoolean;
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
                this::syncAvailability,
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
        var deathListener = new TargetDeathListener(
                targetService,
                deathCountService,
                sidebarService,
                effectExecutor);
        Bukkit.getPluginManager().registerEvents(deathListener, this);
        Bukkit.getPluginManager().registerEvents(new TargetJoinListener(targetService, sidebarService), this);
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
            AtomicBoolean effectEnabled = new AtomicBoolean(true);
            Future<Void> scheduledEffect = Bukkit.getScheduler().callSyncMethod(this, () -> {
                if (effectEnabled.get()) {
                    executor.accept(tier);
                    sidebarService.update();
                }
                return null;
            });
            awaitScheduledBukkitCall(
                    scheduledEffect,
                    effectEnabled,
                    5,
                    TimeUnit.SECONDS,
                    "running donation effect");
        };
    }

    private TargetAvailability syncAvailability() {
        if (Bukkit.isPrimaryThread()) {
            return targetService.availability();
        }
        AtomicBoolean availabilityEnabled = new AtomicBoolean(true);
        Future<TargetAvailability> scheduledAvailability =
                Bukkit.getScheduler().callSyncMethod(this, () ->
                        availabilityEnabled.get() ? targetService.availability() : TargetAvailability.OFFLINE);
        return awaitScheduledBukkitCall(
                scheduledAvailability,
                availabilityEnabled,
                5,
                TimeUnit.SECONDS,
                "checking target availability");
    }

    static <T> T awaitScheduledBukkitCall(
            Future<T> scheduledCall,
            AtomicBoolean callEnabled,
            long timeout,
            TimeUnit unit,
            String actionName) {
        try {
            return scheduledCall.get(timeout, unit);
        } catch (InterruptedException exception) {
            callEnabled.set(false);
            scheduledCall.cancel(false);
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while " + actionName, exception);
        } catch (TimeoutException exception) {
            callEnabled.set(false);
            scheduledCall.cancel(false);
            throw new IllegalStateException("Unable to finish " + actionName, exception);
        } catch (ExecutionException exception) {
            throw new IllegalStateException("Unable to finish " + actionName, exception);
        }
    }
}
