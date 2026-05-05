package dev.samsepiol.chzzk.command;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

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
}
