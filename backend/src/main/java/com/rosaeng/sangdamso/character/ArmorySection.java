package com.rosaeng.sangdamso.character;

public enum ArmorySection {
    EQUIPMENT("equipment"),
    AVATARS("avatars"),
    ARK_PASSIVE("arkpassive"),
    ARK_GRID("arkgrid"),
    CARDS("cards"),
    SKILLS("combat-skills"),
    ENGRAVINGS("engravings"),
    GEMS("gems");

    private final String pathSegment;

    ArmorySection(String pathSegment) {
        this.pathSegment = pathSegment;
    }

    public String path(String basePath) {
        return basePath + "/" + pathSegment;
    }
}
