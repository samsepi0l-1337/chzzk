package dev.samsepiol.chzzk.donation;

public record DonationResult(DonationStatus status, String message) {
    public static DonationResult of(DonationStatus status, String message) {
        return new DonationResult(status, message);
    }
}
