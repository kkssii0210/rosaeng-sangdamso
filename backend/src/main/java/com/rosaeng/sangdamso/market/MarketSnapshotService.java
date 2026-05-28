package com.rosaeng.sangdamso.market;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.arrayItems;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.child;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.toJsonNode;

import com.rosaeng.sangdamso.common.BffException;
import com.rosaeng.sangdamso.lostark.LostarkProperties;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

@Service
public class MarketSnapshotService {

    private final LostarkProperties properties;
    private final MarketSnapshotClient client;
    private final MarketSnapshotCache cache;
    private final Clock clock;

    public MarketSnapshotService(LostarkProperties properties, MarketSnapshotClient client) {
        this(properties, client, new MarketSnapshotCache(), Clock.systemUTC());
    }

    MarketSnapshotService(LostarkProperties properties, MarketSnapshotClient client, MarketSnapshotCache cache, Clock clock) {
        this.properties = properties;
        this.client = client;
        this.cache = cache;
        this.clock = clock;
    }

    public synchronized JsonNode getSnapshot(boolean forceRefresh) {
        String authorization = properties.authorization().orElseThrow(this::missingApiKey);
        Instant now = clock.instant();

        if (!forceRefresh && cache.isFresh(now)) {
            return toJsonNode(responseWithCache(cache.value(), true, cache.expiresAt()));
        }

        try {
            Map<String, Object> snapshot = fetchSnapshot(authorization, now);
            Instant expiresAt = now.plusMillis(MarketSnapshotQueries.CACHE_TTL_MS);
            cache.put(snapshot, expiresAt);
            return toJsonNode(responseWithCache(snapshot, false, expiresAt));
        } catch (RuntimeException exception) {
            if (exception instanceof BffException bffException) {
                throw bffException;
            }

            throw new BffException(
                HttpStatus.BAD_GATEWAY,
                "LOSTARK_API_ERROR",
                "공식 Lostark 거래소/경매장 API 응답이 불안정해. 잠시 후 다시 조회해줘."
            );
        }
    }

    private Map<String, Object> fetchSnapshot(String authorization, Instant now) {
        List<Map<String, Object>> groups = new ArrayList<>();

        for (MarketSnapshotQueries.MarketQueryGroup group : MarketSnapshotQueries.groups()) {
            List<ResponseWithRequest> responses = new ArrayList<>();

            for (Map<String, Object> request : group.requests()) {
                JsonNode response = client.post(HttpMethod.POST, group.endpoint(), authorization, toJsonNode(stripRequestMetadata(request)));
                responses.add(new ResponseWithRequest(request, response));
            }

            groups.add(normalizeGroup(group, responses));
        }

        return orderedMap(
            "updatedAt", now.toString(),
            "cacheTtlMs", MarketSnapshotQueries.CACHE_TTL_MS,
            "groups", groups
        );
    }

    private Map<String, Object> normalizeGroup(MarketSnapshotQueries.MarketQueryGroup group, List<ResponseWithRequest> responses) {
        List<Map<String, Object>> items = normalizeItems(group, responses);
        int totalCount = responses.stream().mapToInt(response -> intValue(child(response.response(), "TotalCount"))).sum();

        return orderedMap(
            "id", group.id(),
            "label", group.label(),
            "description", group.description(),
            "sourceType", group.sourceType(),
            "totalCount", totalCount,
            "itemCount", items.size(),
            "items", items
        );
    }

    private List<Map<String, Object>> normalizeItems(MarketSnapshotQueries.MarketQueryGroup group, List<ResponseWithRequest> responses) {
        List<Map<String, Object>> items = new ArrayList<>();

        for (ResponseWithRequest response : responses) {
            int limit = Math.max(1, group.itemsPerRequest());
            List<JsonNode> rawItems = arrayItems(child(response.response(), "Items"));

            for (int index = 0; index < Math.min(limit, rawItems.size()); index++) {
                JsonNode item = rawItems.get(index);
                items.add("auction".equals(group.sourceType())
                    ? normalizeAuctionItem(item, response.request())
                    : normalizeMarketItem(item, response.request()));
            }
        }

        if (!group.preserveRequestOrder()) {
            items.sort(Comparator.comparingInt(item -> {
                Number price = (Number) item.get("currentMinPrice");
                return price == null ? Integer.MAX_VALUE : price.intValue();
            }));
        }

        return items.stream().limit(group.itemLimit()).toList();
    }

    private Map<String, Object> normalizeMarketItem(JsonNode item, Map<String, Object> request) {
        Integer currentMinPrice = number(item, "CurrentMinPrice");
        Integer yesterdayAveragePrice = number(item, "YDayAvgPrice");

        return orderedMap(
            "key", "market-" + defaultText(text(item, "Id"), text(item, "Name"), "item") + "-" + request.getOrDefault("CategoryCode", "category"),
            "sourceType", "market",
            "categoryName", request.getOrDefault("CategoryName", ""),
            "name", defaultText(text(item, "Name"), "이름 없음"),
            "grade", text(item, "Grade"),
            "icon", text(item, "Icon"),
            "currentMinPrice", currentMinPrice,
            "recentPrice", number(item, "RecentPrice"),
            "yesterdayAveragePrice", yesterdayAveragePrice,
            "priceDelta", priceDelta(currentMinPrice, yesterdayAveragePrice),
            "bundleCount", number(item, "BundleCount"),
            "tradeRemainCount", number(item, "TradeRemainCount"),
            "options", List.of()
        );
    }

    private Map<String, Object> normalizeAuctionItem(JsonNode item, Map<String, Object> request) {
        Integer buyPrice = firstNumber(child(item, "AuctionInfo"), "BuyPrice", "StartPrice", "BidStartPrice");

        return orderedMap(
            "key", "auction-" + defaultText(text(item, "Name"), "item") + "-" + request.getOrDefault("CategoryCode", "category") + "-" + (buyPrice == null ? 0 : buyPrice),
            "sourceType", "auction",
            "categoryName", request.getOrDefault("CategoryName", ""),
            "name", defaultText(text(item, "Name"), "이름 없음"),
            "grade", text(item, "Grade"),
            "icon", text(item, "Icon"),
            "currentMinPrice", buyPrice,
            "recentPrice", null,
            "yesterdayAveragePrice", null,
            "priceDelta", null,
            "bundleCount", 1,
            "tradeRemainCount", number(child(item, "AuctionInfo"), "TradeAllowCount"),
            "quality", number(item, "GradeQuality"),
            "tier", number(item, "Tier"),
            "itemLevel", number(item, "Level"),
            "endDate", text(child(item, "AuctionInfo"), "EndDate"),
            "options", List.of()
        );
    }

    private Map<String, Object> priceDelta(Integer currentPrice, Integer previousPrice) {
        if (currentPrice == null || previousPrice == null || previousPrice <= 0) {
            return null;
        }

        int amount = currentPrice - previousPrice;
        return orderedMap("amount", amount, "percent", (amount * 100.0) / previousPrice);
    }

    private Map<String, Object> responseWithCache(Map<String, Object> snapshot, boolean cached, Instant expiresAt) {
        Map<String, Object> response = new LinkedHashMap<>(snapshot);
        response.put("cached", cached);
        response.put("cacheExpiresAt", expiresAt.toString());
        return response;
    }

    private Map<String, Object> stripRequestMetadata(Map<String, Object> request) {
        Map<String, Object> body = new LinkedHashMap<>(request);
        body.remove("CategoryName");
        return body;
    }

    private BffException missingApiKey() {
        return new BffException(HttpStatus.INTERNAL_SERVER_ERROR, "MISSING_API_KEY", "공식 Lostark Open API 키가 필요해.");
    }

    private String text(JsonNode node, String field) {
        JsonNode value = child(node, field);
        return value == null || value.isNull() ? "" : value.asString();
    }

    private Integer number(JsonNode node, String field) {
        JsonNode value = child(node, field);
        return value == null || value.isNull() || !value.isNumber() ? null : value.asInt();
    }

    private Integer firstNumber(JsonNode node, String... fields) {
        for (String field : fields) {
            Integer value = number(node, field);
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    private int intValue(JsonNode node) {
        return node == null || node.isNull() || !node.isNumber() ? 0 : node.asInt();
    }

    private String defaultText(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private String defaultText(String value, String fallback, String secondFallback) {
        if (value != null && !value.isBlank()) {
            return value;
        }
        return fallback == null || fallback.isBlank() ? secondFallback : fallback;
    }

    private record ResponseWithRequest(Map<String, Object> request, JsonNode response) {
    }
}
