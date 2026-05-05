package dev.samsepiol.chzzk.effect;

import java.util.List;
import org.bukkit.Material;
import org.bukkit.entity.EntityType;
import org.bukkit.potion.PotionEffectType;

public final class RandomPools {
    private RandomPools() {
    }

    public static List<PotionEffectType> buffs() {
        return List.of(PotionEffectType.SPEED, PotionEffectType.STRENGTH, PotionEffectType.REGENERATION);
    }

    public static List<Material> items() {
        return List.of(Material.DIAMOND, Material.GOLDEN_APPLE, Material.COOKED_BEEF);
    }

    public static List<EntityType> mobs() {
        return List.of(EntityType.PIG, EntityType.COW, EntityType.SHEEP);
    }

    public static List<EntityType> combatMobs() {
        return List.of(EntityType.ZOMBIE, EntityType.SKELETON, EntityType.CREEPER);
    }
}
