package dev.samsepiol.chzzk.command;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

final class ChzzkCommandTest {
    @Test
    void parsesNumericSimulationAmount() {
        assertEquals(1000, ChzzkCommand.parseSimulationAmount("1000").orElseThrow());
    }

    @Test
    void rejectsNonNumericSimulationAmount() {
        assertTrue(ChzzkCommand.parseSimulationAmount("abc").isEmpty());
    }

    @Test
    void parsesOnlyExplicitSidebarModes() {
        assertEquals(Optional.of(true), ChzzkCommand.parseSidebarEnabled("on"));
        assertEquals(Optional.of(false), ChzzkCommand.parseSidebarEnabled("off"));
        assertTrue(ChzzkCommand.parseSidebarEnabled("maybe").isEmpty());
    }

    @Test
    void targetSetClearsCurrentSidebarBeforeChangingTarget() {
        List<String> calls = new ArrayList<>();

        ChzzkCommand.replaceTarget(
                "newTarget",
                () -> calls.add("clear"),
                target -> calls.add("set:" + target),
                () -> calls.add("update"));

        assertEquals(List.of("clear", "set:newTarget", "update"), calls);
    }
}
