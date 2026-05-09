package dev.samsepiol.chzzk.state;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashSet;
import java.util.Set;

public final class PluginStateStore {
    private final Gson gson = new GsonBuilder().setPrettyPrinting().create();
    private final Path path;
    private StoredState state;

    public PluginStateStore(Path path) {
        this.path = path;
        this.state = loadState(path);
    }

    public String targetUuid() {
        return state.targetUuid;
    }

    public String targetName() {
        return state.targetName;
    }

    public boolean sidebarEnabled() {
        return state.sidebarEnabled;
    }

    public int deathCount() {
        return state.deathCount;
    }

    public Set<String> recentEventIds() {
        return state.recentEventIds;
    }

    public void setTarget(String uuid, String name) {
        state.targetUuid = uuid;
        state.targetName = name;
        save();
    }

    public void clearTarget() {
        state.targetUuid = null;
        state.targetName = null;
        save();
    }

    public void setSidebarEnabled(boolean enabled) {
        state.sidebarEnabled = enabled;
        save();
    }

    public void setDeathCount(int count) {
        state.deathCount = count;
        save();
    }

    public synchronized void save() {
        try {
            Files.createDirectories(path.getParent());
            Files.writeString(path, gson.toJson(state), StandardCharsets.UTF_8);
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to save plugin state", exception);
        }
    }

    private StoredState loadState(Path path) {
        if (!Files.exists(path)) {
            return new StoredState();
        }
        try {
            StoredState loaded = gson.fromJson(Files.readString(path, StandardCharsets.UTF_8), StoredState.class);
            return loaded == null ? new StoredState() : loaded.normalized();
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to load plugin state", exception);
        }
    }

    private static final class StoredState {
        private String targetUuid;
        private String targetName;
        private boolean sidebarEnabled = true;
        private int deathCount;
        private Set<String> recentEventIds = new LinkedHashSet<>();

        private StoredState normalized() {
            if (recentEventIds == null) {
                recentEventIds = new LinkedHashSet<>();
            }
            return this;
        }
    }
}
