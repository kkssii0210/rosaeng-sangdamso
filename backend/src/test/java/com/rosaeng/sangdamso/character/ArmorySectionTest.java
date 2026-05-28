package com.rosaeng.sangdamso.character;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ArmorySectionTest {

    @Test
    void buildsArmorySectionPathsFromBasePath() {
        String basePath = "/armories/characters/%EB%8F%84%ED%99%94%EA%B0%80";

        assertThat(ArmorySection.EQUIPMENT.path(basePath)).isEqualTo(basePath + "/equipment");
        assertThat(ArmorySection.SKILLS.path(basePath)).isEqualTo(basePath + "/combat-skills");
    }
}
