package com.rosaeng.sangdamso.market;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.rosaeng.sangdamso.common.BffException;
import com.rosaeng.sangdamso.lostark.LostarkProperties;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class MarketSnapshotServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void mapsMissingApiKeyToBffException() {
        MarketSnapshotService service = service("", new FakeMarketClient());

        assertThatThrownBy(() -> service.getSnapshot(false))
            .isInstanceOfSatisfying(BffException.class, exception -> {
                assertThat(exception.status()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
                assertThat(exception.code()).isEqualTo("MISSING_API_KEY");
            });
    }

    @Test
    void cachesSnapshotUntilForceRefresh() {
        FakeMarketClient client = new FakeMarketClient();
        MarketSnapshotService service = service("token", client);

        JsonNode first = service.getSnapshot(false);
        JsonNode cached = service.getSnapshot(false);
        JsonNode refreshed = service.getSnapshot(true);

        assertThat(first.get("cached").asBoolean()).isFalse();
        assertThat(cached.get("cached").asBoolean()).isTrue();
        assertThat(refreshed.get("cached").asBoolean()).isFalse();
        assertThat(client.calls).hasSize(MarketSnapshotQueries.groups().stream().mapToInt(group -> group.requests().size()).sum() * 2);
        assertThat(first.get("groups").size()).isEqualTo(MarketSnapshotQueries.groups().size());
        assertThat(first.get("cacheExpiresAt").asString()).isEqualTo("2026-05-29T00:05:00Z");
    }

    @Test
    void includesGemMetadataFromAuctionOptions() {
        MarketSnapshotService service = service("token", new GemMarketClient());

        JsonNode snapshot = service.getSnapshot(false);
        JsonNode gemGroup = null;

        for (JsonNode group : snapshot.get("groups")) {
            if ("gems".equals(group.get("id").asString())) {
                gemGroup = group;
                break;
            }
        }

        JsonNode gem = gemGroup.get("items").get(0);

        assertThat(gem.get("gemLevel")).isNotNull();
        assertThat(gem.get("gemEffectType")).isNotNull();
        assertThat(gem.get("gemEffectValue")).isNotNull();
        assertThat(gem.get("gemLevel").asInt()).isEqualTo(7);
        assertThat(gem.get("gemEffectType").asString()).isEqualTo("damage");
        assertThat(gem.get("gemEffectValue").asDouble()).isEqualTo(24);
    }

    private MarketSnapshotService service(String apiKey, MarketSnapshotClient client) {
        return new MarketSnapshotService(
            new LostarkProperties(apiKey, "", "https://example.com", 5, 0),
            client,
            new MarketSnapshotCache(),
            Clock.fixed(Instant.parse("2026-05-29T00:00:00Z"), ZoneOffset.UTC)
        );
    }

    private class FakeMarketClient implements MarketSnapshotClient {

        private final List<String> calls = new ArrayList<>();

        @Override
        public JsonNode post(HttpMethod method, String path, String authorization, JsonNode body) {
            calls.add(path + ":" + body.get("CategoryCode").asInt());
            return objectMapper.createObjectNode()
                .put("TotalCount", 1)
                .set("Items", objectMapper.createArrayNode().add(objectMapper.createObjectNode()
                    .put("CurrentMinPrice", 100)
                    .put("Id", 1)
                    .put("Name", "샘플")
                    .put("Grade", "일반")
                    .put("Icon", "https://example.com/sample.png")
                    .put("BundleCount", 1)));
        }
    }

    private class GemMarketClient extends FakeMarketClient {

        @Override
        public JsonNode post(HttpMethod method, String path, String authorization, JsonNode body) {
            if (body.get("CategoryCode").asInt() != 210000) {
                return super.post(method, path, authorization, body);
            }

            return objectMapper.createObjectNode()
                .put("TotalCount", 1)
                .set("Items", objectMapper.createArrayNode().add(objectMapper.createObjectNode()
                    .put("Name", "7레벨 겁화의 보석")
                    .put("Grade", "고대")
                    .put("Icon", "https://example.com/gem.png")
                    .put("Tier", 4)
                    .set("AuctionInfo", objectMapper.createObjectNode().put("BuyPrice", 100000))
                    .set("Options", objectMapper.createArrayNode().add(objectMapper.createObjectNode()
                        .put("Type", "GEM_SKILL_DAMAGE")
                        .put("OptionName", "라이징 스피어")
                        .put("Value", 24)
                        .put("IsValuePercentage", true)
                        .put("ClassName", "창술사")))));
        }
    }
}
