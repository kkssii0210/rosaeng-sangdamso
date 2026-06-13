package com.rosaeng.sangdamso.golden;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class GoldenFixtureTest {

    private static final List<String> FIXTURES = List.of(
        "golden/main-stats.json",
        "golden/damage-model.json",
        "golden/combat-power-analysis.json",
        "golden/upgrade-efficiency.json",
        "golden/spec-up-recommendation.json",
        "golden/accessory-efficiency.json",
        "golden/accessory-contribution.json",
        "golden/engraving-contribution.json",
        "golden/accessory-recovery-estimate.json"
    );

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void calculationGoldenFixturesExistAndContainInputAndExpectedPayloads() throws IOException {
        ClassLoader classLoader = getClass().getClassLoader();

        for (String fixture : FIXTURES) {
            try (InputStream inputStream = classLoader.getResourceAsStream(fixture)) {
                assertThat(inputStream)
                    .as("fixture %s should exist on the test classpath", fixture)
                    .isNotNull();

                JsonNode root = objectMapper.readTree(inputStream);

                assertThat(text(root, "name")).as("fixture %s should have a name", fixture).isNotBlank();
                assertThat(text(root, "source")).as("fixture %s should record its JS source", fixture).isNotBlank();
                assertThat(root.get("input")).as("fixture %s should contain input", fixture).isNotNull();
                assertThat(root.get("expected")).as("fixture %s should contain expected", fixture).isNotNull();
                assertThat(root.get("expected").isNull()).as("fixture %s expected should not be null", fixture).isFalse();
            }
        }
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? "" : value.asString();
    }
}
