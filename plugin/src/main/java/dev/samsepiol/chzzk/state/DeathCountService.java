package dev.samsepiol.chzzk.state;

import java.util.function.IntConsumer;

public final class DeathCountService {
    private int count;
    private final IntConsumer saveCount;

    public DeathCountService(int count, IntConsumer saveCount) {
        this.count = count;
        this.saveCount = saveCount;
    }

    public int count() {
        return count;
    }

    public int increment() {
        count += 1;
        saveCount.accept(count);
        return count;
    }

    public void reset() {
        count = 0;
        saveCount.accept(count);
    }
}
