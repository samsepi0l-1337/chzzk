package dev.samsepiol.chzzk.donation;

import java.util.Iterator;
import java.util.Set;
import java.util.function.Consumer;
import java.util.function.Supplier;

public final class DonationService {
    private static final int DEFAULT_MAX_SEEN_EVENT_IDS = 1024;

    private final Set<String> seenEventIds;
    private final Supplier<TargetAvailability> targetAvailability;
    private final Consumer<DonationTier> effectRunner;
    private final Runnable persistSeenEvents;
    private final int maxSeenEventIds;

    public DonationService(
            Set<String> seenEventIds,
            Supplier<TargetAvailability> targetAvailability,
            Consumer<DonationTier> effectRunner) {
        this(seenEventIds, targetAvailability, effectRunner, () -> {});
    }

    public DonationService(
            Set<String> seenEventIds,
            Supplier<TargetAvailability> targetAvailability,
            Consumer<DonationTier> effectRunner,
            Runnable persistSeenEvents) {
        this(seenEventIds, targetAvailability, effectRunner, persistSeenEvents, DEFAULT_MAX_SEEN_EVENT_IDS);
    }

    public DonationService(
            Set<String> seenEventIds,
            Supplier<TargetAvailability> targetAvailability,
            Consumer<DonationTier> effectRunner,
            Runnable persistSeenEvents,
            int maxSeenEventIds) {
        this.seenEventIds = seenEventIds;
        this.targetAvailability = targetAvailability;
        this.effectRunner = effectRunner;
        this.persistSeenEvents = persistSeenEvents;
        this.maxSeenEventIds = Math.max(1, maxSeenEventIds);
    }

    public synchronized DonationResult handle(DonationEvent event) {
        if (seenEventIds.contains(event.eventId())) {
            return DonationResult.of(DonationStatus.DUPLICATE, "duplicate eventId");
        }

        DonationTier tier = DonationTier.findByAmount(event.amount()).orElse(null);
        if (tier == null) {
            return DonationResult.of(DonationStatus.UNKNOWN_AMOUNT, "unknown amount");
        }

        TargetAvailability availability = targetAvailability.get();
        if (availability == TargetAvailability.MISSING) {
            return DonationResult.of(DonationStatus.NO_TARGET, "target is not configured");
        }
        if (availability == TargetAvailability.OFFLINE) {
            return DonationResult.of(DonationStatus.TARGET_OFFLINE, "target is offline");
        }

        try {
            effectRunner.accept(tier);
            remember(event.eventId());
            return DonationResult.of(DonationStatus.ACCEPTED, "accepted");
        } catch (RuntimeException exception) {
            return DonationResult.of(DonationStatus.EFFECT_FAILED, exception.getMessage());
        }
    }

    private void remember(String eventId) {
        seenEventIds.add(eventId);
        Iterator<String> iterator = seenEventIds.iterator();
        while (seenEventIds.size() > maxSeenEventIds) {
            iterator.next();
            iterator.remove();
        }
        persistSeenEvents.run();
    }
}
