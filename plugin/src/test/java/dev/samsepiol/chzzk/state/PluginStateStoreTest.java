package dev.samsepiol.chzzk.state;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

final class PluginStateStoreTest {
    @TempDir
    private Path tempDir;

    @Test
    void createsDefaultStateWhenNoStateFileExists() {
        PluginStateStore store = new PluginStateStore(tempDir.resolve("state.json"));

        assertNull(store.targetUuid());
        assertNull(store.targetName());
        assertTrue(store.sidebarEnabled());
        assertEquals(0, store.deathCount());
        assertTrue(store.recentEventIds().isEmpty());
    }

    @Test
    void persistsTargetSidebarDeathsAndRecentEvents() {
        Path path = tempDir.resolve("state.json");
        PluginStateStore store = new PluginStateStore(path);

        store.setTarget("uuid", "player");
        store.setSidebarEnabled(false);
        store.setDeathCount(4);
        store.recentEventIds().add("evt-1");
        store.save();

        PluginStateStore reloaded = new PluginStateStore(path);
        assertEquals("uuid", reloaded.targetUuid());
        assertEquals("player", reloaded.targetName());
        assertFalse(reloaded.sidebarEnabled());
        assertEquals(4, reloaded.deathCount());
        assertEquals(java.util.Set.of("evt-1"), reloaded.recentEventIds());

        reloaded.clearTarget();
        PluginStateStore cleared = new PluginStateStore(path);
        assertNull(cleared.targetUuid());
        assertNull(cleared.targetName());
    }

    @Test
    void normalizesNullAndPartialStateFiles() throws IOException {
        Path nullState = tempDir.resolve("null-state.json");
        Files.writeString(nullState, "null");

        assertDoesNotThrow(() -> new PluginStateStore(nullState));
        assertTrue(new PluginStateStore(nullState).sidebarEnabled());

        Path partialState = tempDir.resolve("partial-state.json");
        Files.writeString(partialState, "{\"targetUuid\":\"uuid\",\"recentEventIds\":null}");

        PluginStateStore store = new PluginStateStore(partialState);
        assertEquals("uuid", store.targetUuid());
        assertTrue(store.sidebarEnabled());
        assertTrue(store.recentEventIds().isEmpty());
    }

    @Test
    void reportsLoadAndSaveFailures() throws IOException {
        Path directory = tempDir.resolve("directory-state");
        Files.createDirectory(directory);
        assertThrows(IllegalStateException.class, () -> new PluginStateStore(directory));

        Path parentFile = tempDir.resolve("parent-file");
        Files.writeString(parentFile, "");
        PluginStateStore store = new PluginStateStore(parentFile.resolve("state.json"));

        assertThrows(IllegalStateException.class, () -> store.setDeathCount(1));
    }
}
