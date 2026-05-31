package com.rosaeng.sangdamso.efficiency;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.child;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.toJsonNode;

import com.rosaeng.sangdamso.common.BffException;
import com.rosaeng.sangdamso.lostark.LostarkApiErrorCode;
import com.rosaeng.sangdamso.lostark.LostarkApiException;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/api/efficiency/accessories")
public class AccessoryRecoveryController {

    private static final Set<String> SUPPORTED_ACCESSORY_TYPES = Set.of("목걸이", "귀걸이", "반지");

    private final AccessoryAuctionSearchService auctionSearchService;
    private final AccessoryRecoveryEstimateService recoveryEstimateService;

    public AccessoryRecoveryController(
        AccessoryAuctionSearchService auctionSearchService,
        AccessoryRecoveryEstimateService recoveryEstimateService
    ) {
        this.auctionSearchService = auctionSearchService;
        this.recoveryEstimateService = recoveryEstimateService;
    }

    @PostMapping("/recovery")
    public JsonNode recover(@RequestBody(required = false) JsonNode body) {
        JsonNode currentAccessory = child(body, "CurrentAccessory");
        JsonNode recommendation = child(body, "Recommendation");
        String type = text(currentAccessory, "Type", "type");

        if (
            !SUPPORTED_ACCESSORY_TYPES.contains(type)
                || positiveNumber(recommendation, "BuyPrice", "buyPrice") == null
                || positiveNumber(recommendation, "CombatPowerGainPercent", "combatPowerGainPercent") == null
        ) {
            throw invalidRecoveryRequest();
        }

        try {
            AccessoryAuctionSearchService.SearchResult searchResult = auctionSearchService.searchAccessoryCandidates(
                type,
                currentAccessory,
                -1,
                bool(body, "ForceRefresh", "forceRefresh"),
                false
            );
            JsonNode recoveryEstimate = recoveryEstimateService.build(
                currentAccessory,
                toJsonNode(searchResult.items()),
                recommendation
            );

            return toJsonNode(orderedMap(
                "UpdatedAt", searchResult.updatedAt(),
                "SearchSummary", orderedMap(
                    "Type", searchResult.type(),
                    "SearchOptions", searchResult.searchOptions(),
                    "CandidateCount", searchResult.items().size(),
                    "PagesFetched", searchResult.pagesFetched()
                ),
                "RecoveryEstimate", recoveryEstimate
            ));
        } catch (LostarkApiException exception) {
            if (exception.getCode() == LostarkApiErrorCode.AUTH_ERROR) {
                throw new BffException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "MISSING_API_KEY",
                    "공식 Lostark Open API 키가 필요해."
                );
            }

            throw new BffException(
                HttpStatus.BAD_GATEWAY,
                "LOSTARK_API_ERROR",
                "현재 악세 예상 회수가를 계산하지 못했어."
            );
        }
    }

    private BffException invalidRecoveryRequest() {
        return new BffException(
            HttpStatus.BAD_REQUEST,
            "INVALID_RECOVERY_REQUEST",
            "회수가 추정에 필요한 추천 결과가 없어."
        );
    }

    private String text(JsonNode node, String... keys) {
        if (node == null || node.isNull()) {
            return "";
        }

        for (String key : keys) {
            JsonNode value = child(node, key);

            if (value != null && !value.isNull() && !value.asString().isBlank()) {
                return value.asString();
            }
        }

        return "";
    }

    private boolean bool(JsonNode node, String... keys) {
        if (node == null || node.isNull()) {
            return false;
        }

        for (String key : keys) {
            JsonNode value = child(node, key);

            if (value == null || value.isNull()) {
                continue;
            }

            if (value.isBoolean()) {
                return value.asBoolean();
            }

            if ("true".equalsIgnoreCase(value.asString()) || "1".equals(value.asString())) {
                return true;
            }
        }

        return false;
    }

    private Double positiveNumber(JsonNode node, String... keys) {
        if (node == null || node.isNull()) {
            return null;
        }

        for (String key : keys) {
            JsonNode value = child(node, key);

            if (value == null || value.isNull()) {
                continue;
            }

            Double number = null;

            if (value.isNumber()) {
                number = value.asDouble();
            } else {
                try {
                    number = Double.parseDouble(value.asString().replace(",", "").trim());
                } catch (NumberFormatException exception) {
                    number = null;
                }
            }

            if (number != null && Double.isFinite(number) && number > 0) {
                return number;
            }
        }

        return null;
    }
}
