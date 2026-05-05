package dev.samsepiol.chzzk.donation;

import java.util.Set;
import java.util.function.Consumer;
import java.util.function.Supplier;

public final class DonationService {
    private final Set<String> seenEventIds;
    private final Supplier<TargetAvailability> targetAvailability;
    private final Consumer<DonationTier> effectRunner;
    private final Runnable persistSeenEvents;

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
        this.seenEventIds = seenEventIds;
        this.targetAvailability = targetAvailability;
        this.effectRunner = effectRunner;
        this.persistSeenEvents = persistSeenEvents;
    }

    public synchronized DonationResult handle(DonationEvent event) {
        if (!seenEventIds.add(event.eventId())) {
            return DonationResult.of(DonationStatus.DUPLICATE, "duplicate eventId");
        }
        persistSeenEvents.run();

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
            return DonationResult.of(DonationStatus.ACCEPTED, "accepted");
        } catch (RuntimeException exception) {
            return DonationResult.of(DonationStatus.EFFECT_FAILED, exception.getMessage());
        }
    }
}
