package dev.samsepiol.chzzk.donation;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
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

    @Test
    void retriesFailedEffectsBeforeRememberingEventId() {
        AtomicInteger saves = new AtomicInteger();
        AtomicInteger attempts = new AtomicInteger();
        DonationService service = new DonationService(
                new HashSet<>(),
                () -> TargetAvailability.AVAILABLE,
                tier -> {
                    if (attempts.incrementAndGet() == 1) {
                        throw new IllegalStateException("boom");
                    }
                },
                saves::incrementAndGet);

        DonationEvent event = event("evt-5", 1000);
        DonationResult result = service.handle(event);

        assertEquals(DonationStatus.EFFECT_FAILED, result.status());
        assertEquals("boom", result.message());
        assertEquals(0, saves.get());

        assertEquals(DonationStatus.ACCEPTED, service.handle(event).status());
        assertEquals(DonationStatus.DUPLICATE, service.handle(event).status());
        assertEquals(1, saves.get());
        assertEquals(2, attempts.get());
    }

    @Test
    void boundsRememberedEventIdsBeforePersisting() {
        Set<String> seen = new LinkedHashSet<>();
        AtomicInteger saves = new AtomicInteger();
        DonationService service = new DonationService(
                seen,
                () -> TargetAvailability.AVAILABLE,
                tier -> {},
                saves::incrementAndGet,
                2);

        assertEquals(DonationStatus.ACCEPTED, service.handle(event("evt-6", 1000)).status());
        assertEquals(DonationStatus.ACCEPTED, service.handle(event("evt-7", 2000)).status());
        assertEquals(DonationStatus.ACCEPTED, service.handle(event("evt-8", 3000)).status());

        assertEquals(List.of("evt-7", "evt-8"), new ArrayList<>(seen));
        assertEquals(3, saves.get());
    }

    private static DonationEvent event(String id, int amount) {
        return new DonationEvent(id, amount, "donator", "message", Instant.parse("2026-05-05T00:00:00Z"));
    }
}
