package dev.samsepiol.chzzk.listener;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

final class TargetJoinListenerTest {
    @Test
    void refreshesSidebarWhenJoinedPlayerIsTarget() {
        UUID targetId = UUID.randomUUID();
        List<String> calls = new ArrayList<>();

        TargetJoinListener.refreshTargetSidebarOnJoin(
                targetId,
                () -> Optional.of(targetId),
                () -> calls.add("update"));

        assertEquals(List.of("update"), calls);
    }

    @Test
    void skipsSidebarRefreshWhenJoinedPlayerIsNotTarget() {
        UUID targetId = UUID.randomUUID();
        List<String> calls = new ArrayList<>();

        TargetJoinListener.refreshTargetSidebarOnJoin(
                UUID.randomUUID(),
                () -> Optional.of(targetId),
                () -> calls.add("update"));

        assertEquals(List.of(), calls);
    }
}
