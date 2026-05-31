package com.rosaeng.sangdamso.efficiency;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.arrayItems;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.child;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.toJsonNode;

import com.rosaeng.sangdamso.lostark.LostarkApiClient;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

@Service
public class AccessoryAuctionSearchService {

    static final int MIN_PAGES_PER_TYPE = 3;
    static final int MAX_PAGES_PER_TYPE = 4;
    static final int TARGET_CANDIDATES_PER_TYPE = 24;
    static final int MAX_CANDIDATES_PER_TYPE = 40;
    private static final long CACHE_TTL_MS = 5 * 60 * 1000L;

    private final LostarkApiClient lostarkApiClient;
    private final AccessoryNormalizer normalizer;
    private final Map<SearchCacheKey, CachedSearchResult> cache = new ConcurrentHashMap<>();

    public AccessoryAuctionSearchService(LostarkApiClient lostarkApiClient, AccessoryNormalizer normalizer) {
        this.lostarkApiClient = lostarkApiClient;
        this.normalizer = normalizer;
    }

    public SearchResult searchAccessoryCandidates(String type, JsonNode currentAccessory, int equipmentIndex, boolean forceRefresh) {
        return searchAccessoryCandidates(type, currentAccessory, equipmentIndex, forceRefresh, true);
    }

    public SearchResult searchAccessoryCandidates(
        String type,
        JsonNode currentAccessory,
        int equipmentIndex,
        boolean forceRefresh,
        boolean eligibleOnly
    ) {
        int categoryCode = categoryCode(type);
        List<AccessoryNormalizer.SearchOption> options = normalizer.buildRefinementSearchOptions(currentAccessory);
        SearchCacheKey cacheKey = new SearchCacheKey(type, equipmentIndex, eligibleOnly, List.copyOf(options));
        long now = System.currentTimeMillis();

        if (!forceRefresh) {
            CachedSearchResult cached = cache.get(cacheKey);

            if (cached != null && cached.isFresh(now)) {
                return cached.result();
            }
        }

        Map<String, JsonNode> candidatesByKey = new LinkedHashMap<>();
        int pagesFetched = 0;
        int rawItemsSeen = 0;
        int totalCount = 0;
        String updatedAt = Instant.now().toString();

        if (categoryCode == 0) {
            SearchResult result = new SearchResult(type, List.of(), List.of(), 0, updatedAt);
            cache.put(cacheKey, new CachedSearchResult(result, now + CACHE_TTL_MS));
            return result;
        }

        for (int pageNo = 1; pageNo <= MAX_PAGES_PER_TYPE; pageNo++) {
            JsonNode raw = lostarkApiClient.post("/auctions/items", toJsonNode(requestBody(categoryCode, pageNo, options)));
            pagesFetched++;
            totalCount = Math.max(totalCount, intValue(raw, "TotalCount"));
            List<JsonNode> rawItems = arrayItems(child(raw, "Items"));
            rawItemsSeen += rawItems.size();

            for (JsonNode rawItem : rawItems) {
                JsonNode candidate = normalizer.normalizeAuctionAccessoryItem(rawItem, type);

                if (eligibleOnly && !normalizer.isEligibleAccessoryCandidate(candidate).eligible()) {
                    continue;
                }

                JsonNode targetCandidate = withTargetEquipmentIndex(candidate, equipmentIndex);
                String key = equipmentIndex
                    + "|" + normalizer.fingerprint(candidate)
                    + "|price:" + text(candidate, "BuyPrice")
                    + "|end:" + text(candidate, "EndDate");
                candidatesByKey.putIfAbsent(key, targetCandidate);
            }

            boolean passedMinimum = pageNo >= MIN_PAGES_PER_TYPE;
            boolean reachedLastPage = rawItems.isEmpty() || rawItemsSeen >= totalCount;
            boolean reachedTarget = candidatesByKey.size() >= TARGET_CANDIDATES_PER_TYPE;
            boolean reachedLimit = candidatesByKey.size() >= MAX_CANDIDATES_PER_TYPE;

            if (passedMinimum && (reachedLastPage || reachedTarget || reachedLimit)) {
                break;
            }
        }

        SearchResult result = new SearchResult(
            type,
            candidatesByKey.values().stream().limit(MAX_CANDIDATES_PER_TYPE).toList(),
            options.stream().map(AccessoryNormalizer.SearchOption::label).toList(),
            pagesFetched,
            updatedAt
        );
        cache.put(cacheKey, new CachedSearchResult(result, now + CACHE_TTL_MS));
        return result;
    }

    private Map<String, Object> requestBody(
        int categoryCode,
        int pageNo,
        List<AccessoryNormalizer.SearchOption> options
    ) {
        Map<String, Object> request = new LinkedHashMap<>(orderedMap(
            "CategoryCode", categoryCode,
            "ItemTier", 4,
            "ItemGrade", "고대",
            "PageNo", pageNo,
            "Sort", "BUY_PRICE",
            "SortCondition", "ASC"
        ));

        if (!options.isEmpty()) {
            request.put("EtcOptions", options.stream().map(AccessoryNormalizer.SearchOption::requestMap).toList());
        }

        return request;
    }

    private JsonNode withTargetEquipmentIndex(JsonNode candidate, int equipmentIndex) {
        Map<String, Object> values = new LinkedHashMap<>();

        for (String propertyName : candidate.propertyNames()) {
            values.put(propertyName, candidate.get(propertyName));
        }

        values.put("TargetEquipmentIndex", equipmentIndex);
        return toJsonNode(values);
    }

    private int categoryCode(String type) {
        return switch (type) {
            case "목걸이" -> 200010;
            case "귀걸이" -> 200020;
            case "반지" -> 200030;
            default -> 0;
        };
    }

    private int intValue(JsonNode node, String field) {
        JsonNode value = child(node, field);

        return value == null || !value.isNumber() ? 0 : value.asInt();
    }

    private String text(JsonNode node, String field) {
        JsonNode value = child(node, field);

        return value == null || value.isNull() ? "" : value.asString();
    }

    public record SearchResult(String type, List<JsonNode> items, List<String> searchOptions, int pagesFetched, String updatedAt) {
    }

    private record SearchCacheKey(
        String type,
        int equipmentIndex,
        boolean eligibleOnly,
        List<AccessoryNormalizer.SearchOption> options
    ) {
    }

    private record CachedSearchResult(SearchResult result, long expiresAtEpochMs) {

        boolean isFresh(long nowEpochMs) {
            return expiresAtEpochMs > nowEpochMs;
        }
    }
}
