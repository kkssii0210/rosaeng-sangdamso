package com.rosaeng.sangdamso.consultant;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;

import java.util.Map;

public record SgguConsultationResponse(
    SgguConsultationMode mode,
    String source,
    String mood,
    String empathy,
    String diagnosis,
    String recommendation,
    String caution,
    String nextAction,
    String displayText
) {

    public Map<String, Object> toResponseMap() {
        return orderedMap(
            "Mode", mode.wireValue(),
            "Source", source,
            "Mood", mood,
            "Empathy", empathy,
            "Diagnosis", diagnosis,
            "Recommendation", recommendation,
            "Caution", caution,
            "NextAction", nextAction,
            "DisplayText", displayText
        );
    }
}
