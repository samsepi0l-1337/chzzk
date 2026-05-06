package dev.samsepiol.chzzk;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.concurrent.FutureTask;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

final class ChzzkDonationPluginTest {
    @Test
    void disablesQueuedDonationEffectAfterSyncTimeout() {
        AtomicBoolean effectEnabled = new AtomicBoolean(true);
        AtomicInteger effects = new AtomicInteger();
        FutureTask<Void> queuedEffect = new FutureTask<>(() -> {
            if (effectEnabled.get()) {
                effects.incrementAndGet();
            }
            return null;
        });

        assertThrows(IllegalStateException.class, () ->
                ChzzkDonationPlugin.awaitScheduledDonationEffect(
                        queuedEffect,
                        effectEnabled,
                        10,
                        TimeUnit.MILLISECONDS));
        queuedEffect.run();

        assertEquals(0, effects.get());
    }
}
