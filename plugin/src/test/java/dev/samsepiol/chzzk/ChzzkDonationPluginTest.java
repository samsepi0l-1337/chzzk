package dev.samsepiol.chzzk;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.concurrent.FutureTask;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

final class ChzzkDonationPluginTest {
    @Test
    void returnsScheduledBukkitCallValue() {
        AtomicBoolean callEnabled = new AtomicBoolean(true);
        FutureTask<String> queuedCall = new FutureTask<>(() -> {
            if (!callEnabled.get()) {
                return "disabled";
            }
            return "available";
        });
        queuedCall.run();

        String result = ChzzkDonationPlugin.awaitScheduledBukkitCall(
                queuedCall,
                callEnabled,
                10,
                TimeUnit.MILLISECONDS,
                "checking target availability");

        assertEquals("available", result);
    }

    @Test
    void disablesQueuedScheduledBukkitCallAfterTimeout() {
        AtomicBoolean callEnabled = new AtomicBoolean(true);
        AtomicInteger calls = new AtomicInteger();
        FutureTask<Void> queuedCall = new FutureTask<>(() -> {
            if (callEnabled.get()) {
                calls.incrementAndGet();
            }
            return null;
        });

        assertThrows(IllegalStateException.class, () ->
                ChzzkDonationPlugin.awaitScheduledBukkitCall(
                        queuedCall,
                        callEnabled,
                        10,
                        TimeUnit.MILLISECONDS,
                        "checking target availability"));
        queuedCall.run();

        assertEquals(0, calls.get());
    }

    @Test
    void preservesInterruptAndDisablesQueuedScheduledBukkitCall() {
        AtomicBoolean callEnabled = new AtomicBoolean(true);
        AtomicInteger calls = new AtomicInteger();
        FutureTask<Void> queuedCall = new FutureTask<>(() -> {
            if (callEnabled.get()) {
                calls.incrementAndGet();
            }
            return null;
        });

        Thread.currentThread().interrupt();
        try {
            assertThrows(IllegalStateException.class, () ->
                    ChzzkDonationPlugin.awaitScheduledBukkitCall(
                            queuedCall,
                            callEnabled,
                            1,
                            TimeUnit.SECONDS,
                            "checking target availability"));
            assertTrue(Thread.currentThread().isInterrupted());
            queuedCall.run();

            assertEquals(0, calls.get());
        } finally {
            Thread.interrupted();
        }
    }
}
