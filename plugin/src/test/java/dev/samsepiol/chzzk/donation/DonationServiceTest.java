package dev.samsepiol.chzzk.donation;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import org.junit.jupiter.api.Test;

final class DonationServiceTest {
    @Test
    void runsKnownTierOnceAndRejectsDuplicateEventId() {
        List<DonationTier> ran = new ArrayList<>();
        DonationService service = new DonationService(
                new HashSet<>(),
                () -> TargetAvailability.AVAILABLE,
                ran::add);

        DonationEvent event = event("evt-1", 1000);

        assertEquals(DonationStatus.ACCEPTED, service.handle(event).status());
        assertEquals(DonationStatus.DUPLICATE, service.handle(event).status());
        assertEquals(List.of(DonationTier.RANDOM_BUFF), ran);
    }

    @Test
    void ignoresUnknownAmountsWithoutRunningEffects() {
        List<DonationTier> ran = new ArrayList<>();
        DonationService service = new DonationService(
                new HashSet<>(),
                () -> TargetAvailability.AVAILABLE,
                ran::add);

        assertEquals(DonationStatus.UNKNOWN_AMOUNT, service.handle(event("evt-2", 5500)).status());
        assertEquals(List.of(), ran);
    }

    @Test
    void reportsMissingAndOfflineTargets() {
        DonationService missing = new DonationService(
                new HashSet<>(),
                () -> TargetAvailability.MISSING,
                tier -> {});
        DonationService offline = new DonationService(
                new HashSet<>(),
                () -> TargetAvailability.OFFLINE,
                tier -> {});

        assertEquals(DonationStatus.NO_TARGET, missing.handle(event("evt-3", 1000)).status());
        assertEquals(DonationStatus.TARGET_OFFLINE, offline.handle(event("evt-4", 1000)).status());
    }

    private static DonationEvent event(String id, int amount) {
        return new DonationEvent(id, amount, "donator", "message", Instant.parse("2026-05-05T00:00:00Z"));
    }
}
