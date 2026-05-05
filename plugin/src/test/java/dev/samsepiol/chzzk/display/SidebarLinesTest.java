package dev.samsepiol.chzzk.display;

import static org.junit.jupiter.api.Assertions.assertEquals;

import dev.samsepiol.chzzk.donation.DonationTier;
import org.junit.jupiter.api.Test;

final class SidebarLinesTest {
    @Test
    void includesEveryTierAndDeathCount() {
        var lines = SidebarLines.build(7);

        assertEquals(DonationTier.values().length + 1, lines.size());
        assertEquals("1,000: 랜덤 버프", lines.get(0));
        assertEquals("2,000: 랜덤 아이템", lines.get(1));
        assertEquals("3,000: 랜덤 몹", lines.get(2));
        assertEquals("5,000: 전투용 몹", lines.get(3));
        assertEquals("10,000: 전투용 몹 3마리", lines.get(4));
        assertEquals("30,000: TNT", lines.get(5));
        assertEquals("50,000: 랜덤 TP", lines.get(6));
        assertEquals("100,000: 즉사", lines.get(7));
        assertEquals("Deaths: 7", lines.get(8));
    }
}
