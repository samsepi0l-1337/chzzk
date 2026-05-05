package dev.samsepiol.chzzk.state;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.ArrayList;
import org.junit.jupiter.api.Test;

final class DeathCountServiceTest {
    @Test
    void incrementsResetsAndPublishesChanges() {
        ArrayList<Integer> saved = new ArrayList<>();
        DeathCountService service = new DeathCountService(2, saved::add);

        assertEquals(3, service.increment());
        service.reset();

        assertEquals(0, service.count());
        assertEquals(java.util.List.of(3, 0), saved);
    }
}
