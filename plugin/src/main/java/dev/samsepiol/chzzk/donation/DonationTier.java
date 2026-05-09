package dev.samsepiol.chzzk.donation;

import java.util.Arrays;
import java.util.Optional;

public enum DonationTier {
    RANDOM_BUFF(1000, "랜덤 버프"),
    RANDOM_ITEM(2000, "랜덤 아이템"),
    RANDOM_MOB(3000, "랜덤 몹"),
    COMBAT_MOB(5000, "전투용 몹"),
    THREE_COMBAT_MOBS(10000, "전투용 몹 3마리"),
    TNT(30000, "TNT"),
    RANDOM_TELEPORT(50000, "랜덤 TP"),
    KILL_TARGET(100000, "즉사");

    private final int amount;
    private final String label;

    DonationTier(int amount, String label) {
        this.amount = amount;
        this.label = label;
    }

    public int amount() {
        return amount;
    }

    public String label() {
        return label;
    }

    public static Optional<DonationTier> findByAmount(int amount) {
        return Arrays.stream(values()).filter(tier -> tier.amount == amount).findFirst();
    }
}
