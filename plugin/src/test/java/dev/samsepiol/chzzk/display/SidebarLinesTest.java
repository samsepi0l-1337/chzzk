package dev.samsepiol.chzzk.display;

import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

final class SidebarLinesTest {
    @Test
    void includesEveryTierAndDeathCount() {
        var lines = SidebarLines.build(7);

        assertTrue(lines.contains("1,000: 랜덤 버프"));
        assertTrue(lines.contains("100,000: 즉사"));
        assertTrue(lines.contains("Deaths: 7"));
    }
}
