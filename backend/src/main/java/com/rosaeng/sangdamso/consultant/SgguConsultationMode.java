package com.rosaeng.sangdamso.consultant;

public enum SgguConsultationMode {
    MAIN_CHAT("main-chat"),
    EFFICIENCY_SUMMARY("efficiency-summary");

    private final String wireValue;

    SgguConsultationMode(String wireValue) {
        this.wireValue = wireValue;
    }

    public String wireValue() {
        return wireValue;
    }

    public static SgguConsultationMode from(String value) {
        String normalized = String.valueOf(value == null ? "" : value).trim();

        for (SgguConsultationMode mode : values()) {
            if (mode.wireValue.equals(normalized)) {
                return mode;
            }
        }

        return MAIN_CHAT;
    }
}
