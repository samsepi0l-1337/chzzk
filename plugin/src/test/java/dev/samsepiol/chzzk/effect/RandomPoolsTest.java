package dev.samsepiol.chzzk.effect;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Constructor;
import java.lang.reflect.Modifier;
import java.util.HashSet;
import java.util.List;
import org.bukkit.Material;
import org.bukkit.entity.EntityType;
import org.junit.jupiter.api.Test;

final class RandomPoolsTest {
    @Test
    void exposesExpectedItems() {
        assertEquals(
                List.of(
                        Material.CHORUS_FRUIT,
                        Material.GOLDEN_APPLE,
                        Material.COOKED_BEEF,
                        Material.ROTTEN_FLESH,
                        Material.POISONOUS_POTATO,
                        Material.DRIED_KELP),
                RandomPools.items());
    }

    @Test
    void exposesExpectedMobs() {
        assertEquals(
                List.of(
                        EntityType.PIG,
                        EntityType.COW,
                        EntityType.SHEEP,
                        EntityType.ZOMBIE,
                        EntityType.SKELETON,
                        EntityType.CREEPER),
                RandomPools.mobs());
    }

    @Test
    void exposesExpectedCombatMobs() {
        assertEquals(
                List.of(
                        EntityType.ZOMBIE,
                        EntityType.SKELETON,
                        EntityType.CREEPER,
                        EntityType.SPIDER,
                        EntityType.WITCH,
                        EntityType.GHAST),
                RandomPools.combatMobs());
    }

    @Test
    void poolsAreUnmodifiable() {
        assertThrows(UnsupportedOperationException.class, () -> RandomPools.items().add(Material.DIAMOND));
        assertThrows(UnsupportedOperationException.class, () -> RandomPools.mobs().add(EntityType.PIG));
        assertThrows(UnsupportedOperationException.class, () -> RandomPools.combatMobs().add(EntityType.ZOMBIE));
    }

    @Test
    void poolsDoNotContainDuplicateEntries() {
        assertEquals(6, new HashSet<>(RandomPools.items()).size());
        assertEquals(6, new HashSet<>(RandomPools.mobs()).size());
        assertEquals(6, new HashSet<>(RandomPools.combatMobs()).size());
    }

    @Test
    void constructorIsPrivate() throws Exception {
        Constructor<RandomPools> constructor = RandomPools.class.getDeclaredConstructor();
        assertTrue(Modifier.isPrivate(constructor.getModifiers()));
    }
}
