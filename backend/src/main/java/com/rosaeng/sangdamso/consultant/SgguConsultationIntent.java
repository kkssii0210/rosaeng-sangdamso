package com.rosaeng.sangdamso.consultant;

public enum SgguConsultationIntent {
    GROWTH_PRIORITY("growth-priority"),
    CHARACTER_REVIEW("character-review"),
    COMPARISON("comparison"),
    INVESTMENT_RISK("investment-risk"),
    DATA_LIMITED("data-limited"),
    OFF_TOPIC("off-topic");

    private final String wireValue;

    SgguConsultationIntent(String wireValue) {
        this.wireValue = wireValue;
    }

    public String wireValue() {
        return wireValue;
    }
}
