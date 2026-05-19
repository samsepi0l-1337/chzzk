package dev.samsepiol.chzzk.effect;

import java.util.List;
import org.bukkit.Material;
import org.bukkit.entity.EntityType;
import org.bukkit.potion.PotionEffectType;

public final class RandomPools {
    private RandomPools() {
    }

    // 버프 후보
    public static List<PotionEffectType> buffs() {
        return List.of(
                PotionEffectType.SPEED,
                PotionEffectType.RESISTANCE,
                PotionEffectType.REGENERATION,
                PotionEffectType.MINING_FATIGUE,
                PotionEffectType.NAUSEA,
                PotionEffectType.BLINDNESS);
    }

    // 아이템 후보
    public static List<Material> items() {
        return List.of(
                Material.CHORUS_FRUIT,
                Material.GOLDEN_APPLE,
                Material.COOKED_BEEF,
                Material.ROTTEN_FLESH,
                Material.POISONOUS_POTATO,
                Material.DRIED_KELP);
    }

    // 일반 몹 후보
    public static List<EntityType> mobs() {
        return List.of(
                EntityType.PIG,
                EntityType.COW,
                EntityType.SHEEP,
                EntityType.ZOMBIE,
                EntityType.SKELETON,
                EntityType.CREEPER);
    }

    // 전투 몹 후보
    public static List<EntityType> combatMobs() {
        return List.of(
                EntityType.ZOMBIE,
                EntityType.SKELETON,
                EntityType.CREEPER,
                EntityType.SPIDER,
                EntityType.WITCH,
                EntityType.GHAST);
    }
}
