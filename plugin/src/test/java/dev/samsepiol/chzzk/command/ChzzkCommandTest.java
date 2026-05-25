package dev.samsepiol.chzzk.command;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.bukkit.command.CommandSender;

final class ChzzkCommandTest {
    @Test
    void parsesNumericSimulationAmount() {
        assertEquals(1000, ChzzkCommand.parseSimulationAmount("1000").orElseThrow());
    }

    @Test
    void rejectsNonNumericSimulationAmount() {
        assertTrue(ChzzkCommand.parseSimulationAmount("abc").isEmpty());
    }

    @Test
    void parsesOnlyExplicitSidebarModes() {
        assertEquals(Optional.of(true), ChzzkCommand.parseSidebarEnabled("on"));
        assertEquals(Optional.of(false), ChzzkCommand.parseSidebarEnabled("off"));
        assertTrue(ChzzkCommand.parseSidebarEnabled("maybe").isEmpty());
    }

    @Test
    void targetSetClearsCurrentSidebarBeforeChangingTarget() {
        List<String> calls = new ArrayList<>();

        ChzzkCommand.replaceTarget(
                "newTarget",
                () -> calls.add("clear"),
                target -> calls.add("set:" + target),
                () -> calls.add("update"));

        assertEquals(List.of("clear", "set:newTarget", "update"), calls);
    }

    @Test
    void authSubcommandDoesNotRequireAdminPermission() {
        FakeSender sender = new FakeSender("Viewer", false);
        ChzzkCommand command = new ChzzkCommand(
                null,
                null,
                null,
                null,
                () -> {
                    throw new AssertionError("reload must not run");
                },
                "http://43.203.108.176:8080/chzzk/oauth/login?secret=secret");

        command.onCommand(sender.asCommandSender(), null, "chzzk", new String[] {"auth"});

        assertEquals(List.of(
                "CHZZK streamer auth URL:",
                "http://43.203.108.176:8080/chzzk/oauth/login?secret=secret"), sender.messages());
    }

    @Test
    void adminSubcommandsRequireAdminPermissionInCommandCode() {
        FakeSender sender = new FakeSender("Viewer", false);
        ChzzkCommand command = new ChzzkCommand(
                null,
                null,
                null,
                null,
                () -> {
                    throw new AssertionError("reload must not run");
                },
                "http://43.203.108.176:8080/chzzk/oauth/login?secret=secret");

        command.onCommand(sender.asCommandSender(), null, "chzzk", new String[] {"reload"});

        assertEquals(List.of("You do not have permission to use this command."), sender.messages());
    }

    @Test
    void authSubcommandReportsMissingConfiguration() {
        FakeSender sender = new FakeSender("Viewer", false);
        ChzzkCommand command = new ChzzkCommand(
                null,
                null,
                null,
                null,
                () -> {
                    throw new AssertionError("reload must not run");
                },
                "");

        command.onCommand(sender.asCommandSender(), null, "chzzk", new String[] {"auth"});

        assertEquals(List.of("CHZZK auth URL is not configured."), sender.messages());
    }

    private record FakeSender(String name, boolean admin, List<String> messages) {
        FakeSender(String name, boolean admin) {
            this(name, admin, new ArrayList<>());
        }

        CommandSender asCommandSender() {
            return (CommandSender) Proxy.newProxyInstance(
                    CommandSender.class.getClassLoader(),
                    new Class<?>[] {CommandSender.class},
                    (proxy, method, args) -> switch (method.getName()) {
                        case "sendMessage" -> {
                            messages.add((String) args[0]);
                            yield null;
                        }
                        case "hasPermission" -> admin;
                        case "getName" -> name;
                        case "isPermissionSet" -> admin;
                        case "isOp" -> admin;
                        default -> defaultValue(method.getReturnType());
                    });
        }

        private static Object defaultValue(Class<?> returnType) {
            if (!returnType.isPrimitive()) {
                return null;
            }
            if (returnType == boolean.class) {
                return false;
            }
            if (returnType == void.class) {
                return null;
            }
            if (returnType == char.class) {
                return '\0';
            }
            return 0;
        }
    }
}
