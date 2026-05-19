package dev.samsepiol.chzzk.display;

import dev.samsepiol.chzzk.donation.DonationTier;
import java.text.DecimalFormat;
import java.util.ArrayList;
import java.util.List;

public final class SidebarLines {
    private static final DecimalFormat AMOUNT_FORMAT = new DecimalFormat("#,###");

    private SidebarLines() {
    }

    public static List<String> build(int deaths, boolean showDonations, boolean showDeaths) {
        List<String> lines = new ArrayList<>();
        if (showDonations) {
            for (DonationTier tier : DonationTier.values()) {
                lines.add(AMOUNT_FORMAT.format(tier.amount()) + ": " + tier.label());
            }
        }
        if (showDeaths) {
            lines.add("Deaths: " + deaths);
        }
        return List.copyOf(lines);
    }
}
