package com.rosaeng.sangdamso.market;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;

import java.util.List;
import java.util.Map;

public final class MarketSnapshotQueries {

    public static final long CACHE_TTL_MS = 5 * 60 * 1000L;

    private MarketSnapshotQueries() {
    }

    public static List<MarketQueryGroup> groups() {
        return List.of(
            new MarketQueryGroup(
                "honing-materials",
                "강화 재료",
                "T4 재련 재료 최저가",
                "market",
                "/markets/items",
                20,
                10,
                false,
                List.of(
                    marketRequest(50010, "재련 재료", "운명의 파괴석 결정"),
                    marketRequest(50010, "재련 재료", "운명의 수호석 결정"),
                    marketRequest(50010, "재련 재료", "위대한 운명의 돌파석"),
                    marketRequest(50010, "재련 재료", "상급 아비도스 융화 재료"),
                    marketRequest(50010, "재련 재료", "운명의 파편")
                )
            ),
            new MarketQueryGroup(
                "honing-supports",
                "재련 보조 재료",
                "T4 숨결/야금술/재봉술 최저가",
                "market",
                "/markets/items",
                10,
                10,
                false,
                List.of(
                    marketRequest(50020, "재련 보조 재료", "용암의 숨결"),
                    marketRequest(50020, "재련 보조 재료", "빙하의 숨결")
                )
            ),
            new MarketQueryGroup(
                "legendary-avatars",
                "전설 아바타",
                "부위별 전설 아바타 최저가",
                "market",
                "/markets/items",
                12,
                3,
                false,
                List.of(
                    gradeRequest(20005, "무기", "전설"),
                    gradeRequest(20010, "머리", "전설"),
                    gradeRequest(20050, "상의", "전설"),
                    gradeRequest(20060, "하의", "전설")
                )
            ),
            new MarketQueryGroup(
                "accessories",
                "악세사리",
                "T4 고대 악세 매물",
                "auction",
                "/auctions/items",
                12,
                3,
                false,
                List.of(
                    auctionRequest(200010, "목걸이"),
                    auctionRequest(200020, "귀걸이"),
                    auctionRequest(200030, "반지"),
                    auctionRequest(200040, "팔찌")
                )
            ),
            new MarketQueryGroup(
                "gems",
                "보석",
                "T4 주요 레벨별 즉시 구매가",
                "auction",
                "/auctions/items",
                12,
                3,
                true,
                List.of(
                    gemRequest(7),
                    gemRequest(8),
                    gemRequest(9),
                    gemRequest(10)
                )
            )
        );
    }

    private static Map<String, Object> marketRequest(int categoryCode, String categoryName, String itemName) {
        return orderedMap(
            "CategoryCode", categoryCode,
            "CategoryName", categoryName,
            "ItemTier", 4,
            "ItemName", itemName,
            "PageNo", 1
        );
    }

    private static Map<String, Object> gradeRequest(int categoryCode, String categoryName, String itemGrade) {
        return orderedMap(
            "CategoryCode", categoryCode,
            "CategoryName", categoryName,
            "ItemGrade", itemGrade,
            "PageNo", 1
        );
    }

    private static Map<String, Object> auctionRequest(int categoryCode, String categoryName) {
        return orderedMap(
            "CategoryCode", categoryCode,
            "CategoryName", categoryName,
            "ItemTier", 4,
            "ItemGrade", "고대",
            "PageNo", 1,
            "Sort", "BUY_PRICE",
            "SortCondition", "ASC"
        );
    }

    private static Map<String, Object> gemRequest(int level) {
        return orderedMap(
            "CategoryCode", 210000,
            "CategoryName", level + "레벨",
            "ItemTier", 4,
            "ItemName", level + "레벨",
            "PageNo", 1,
            "Sort", "BUY_PRICE",
            "SortCondition", "ASC"
        );
    }

    public record MarketQueryGroup(
        String id,
        String label,
        String description,
        String sourceType,
        String endpoint,
        int itemLimit,
        int itemsPerRequest,
        boolean preserveRequestOrder,
        List<Map<String, Object>> requests
    ) {
    }
}
