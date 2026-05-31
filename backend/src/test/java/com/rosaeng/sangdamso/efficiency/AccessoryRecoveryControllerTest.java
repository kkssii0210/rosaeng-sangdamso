package com.rosaeng.sangdamso.efficiency;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.rosaeng.sangdamso.common.GlobalExceptionHandler;
import com.rosaeng.sangdamso.lostark.LostarkApiErrorCode;
import com.rosaeng.sangdamso.lostark.LostarkApiException;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@WebMvcTest(AccessoryRecoveryController.class)
@Import({GlobalExceptionHandler.class, AccessoryRecoveryControllerTest.TestConfig.class})
class AccessoryRecoveryControllerTest {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private FakeAccessoryAuctionSearchService auctionSearchService;

    @BeforeEach
    void reset() {
        auctionSearchService.reset();
    }

    @Test
    void rejectsInvalidRecoveryRequest() throws Exception {
        mockMvc.perform(post("/api/efficiency/accessories/recovery")
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(orderedMap(
                    "CurrentAccessory", orderedMap("Type", "팔찌"),
                    "Recommendation", orderedMap("BuyPrice", 1000, "CombatPowerGainPercent", 1.2)
                ))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_RECOVERY_REQUEST"));
    }

    @Test
    void returnsRecoveryEstimate() throws Exception {
        mockMvc.perform(post("/api/efficiency/accessories/recovery")
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(validRequest(true))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.UpdatedAt").value("2026-05-31T00:00:00Z"))
            .andExpect(jsonPath("$.SearchSummary.Type").value("목걸이"))
            .andExpect(jsonPath("$.SearchSummary.CandidateCount").value(3))
            .andExpect(jsonPath("$.RecoveryEstimate.Status").value("ready"))
            .andExpect(jsonPath("$.RecoveryEstimate.Method").value("exact"))
            .andExpect(jsonPath("$.RecoveryEstimate.Facts.pricePolicy").value("exactMedianActiveAuction"))
            .andExpect(jsonPath("$.RecoveryEstimate.EstimatedGrossRecoveryGold").value(100000))
            .andExpect(jsonPath("$.RecoveryEstimate.EstimatedFeeGold").value(5000))
            .andExpect(jsonPath("$.RecoveryEstimate.EstimatedRecoveryGold").value(95000))
            .andExpect(jsonPath("$.RecoveryEstimate.FeeRate").value(0.05))
            .andExpect(jsonPath("$.RecoveryEstimate.TradeCountStatus").value("unknown"))
            .andExpect(jsonPath("$.RecoveryEstimate.Caveat").isNotEmpty())
            .andExpect(jsonPath("$.RecoveryEstimate.CaveatCode").value(nullValue()));

        assertThat(auctionSearchService.type).isEqualTo("목걸이");
        assertThat(auctionSearchService.forceRefresh).isTrue();
        assertThat(auctionSearchService.eligibleOnly).isFalse();
    }

    @Test
    void mapsMissingApiKey() throws Exception {
        auctionSearchService.exception = new LostarkApiException(
            LostarkApiErrorCode.AUTH_ERROR,
            null,
            "Missing authorization."
        );

        mockMvc.perform(post("/api/efficiency/accessories/recovery")
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(validRequest(false))))
            .andExpect(status().isInternalServerError())
            .andExpect(jsonPath("$.code").value("MISSING_API_KEY"));
    }

    @Test
    void mapsLostarkAuctionFailure() throws Exception {
        auctionSearchService.exception = new LostarkApiException(
            LostarkApiErrorCode.UPSTREAM_ERROR,
            502,
            "Lostark failed."
        );

        mockMvc.perform(post("/api/efficiency/accessories/recovery")
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(validRequest(false))))
            .andExpect(status().isBadGateway())
            .andExpect(jsonPath("$.code").value("LOSTARK_API_ERROR"));
    }

    private static Object validRequest(boolean forceRefresh) {
        return orderedMap(
            "CurrentAccessory", orderedMap(
                "Type", "목걸이",
                "Name", "고대 목걸이",
                "Quality", 91,
                "DetailSections", List.of(
                    orderedMap("title", "기본 효과", "lines", List.of("힘 +12000")),
                    orderedMap("title", "연마 효과", "lines", List.of("추가 피해 +1.50%")),
                    orderedMap("title", "아크 패시브 포인트 효과", "lines", List.of("깨달음 +13"))
                )
            ),
            "Recommendation", orderedMap("BuyPrice", 160000, "CombatPowerGainPercent", 1.5),
            "ForceRefresh", forceRefresh
        );
    }

    private static String toJson(Object value) throws Exception {
        return OBJECT_MAPPER.writeValueAsString(value);
    }

    private static JsonNode toJsonNode(Object value) {
        return OBJECT_MAPPER.convertValue(value, JsonNode.class);
    }

    @TestConfiguration
    static class TestConfig {

        @Bean
        FakeAccessoryAuctionSearchService accessoryAuctionSearchService() {
            return new FakeAccessoryAuctionSearchService();
        }

        @Bean
        AccessoryRecoveryEstimateService accessoryRecoveryEstimateService() {
            return new AccessoryRecoveryEstimateService(new AccessoryNormalizer());
        }
    }

    static class FakeAccessoryAuctionSearchService extends AccessoryAuctionSearchService {

        private RuntimeException exception;
        private String type;
        private boolean forceRefresh;
        private boolean eligibleOnly = true;

        FakeAccessoryAuctionSearchService() {
            super(null, null);
        }

        @Override
        public SearchResult searchAccessoryCandidates(
            String type,
            JsonNode currentAccessory,
            int equipmentIndex,
            boolean forceRefresh,
            boolean eligibleOnly
        ) {
            this.type = type;
            this.forceRefresh = forceRefresh;
            this.eligibleOnly = eligibleOnly;

            if (exception != null) {
                throw exception;
            }

            return new SearchResult(
                type,
                List.of(
                    matchingCandidate(90000),
                    matchingCandidate(100000),
                    matchingCandidate(110000)
                ),
                List.of("추가 피해 1.50% 이상"),
                3,
                "2026-05-31T00:00:00Z"
            );
        }

        void reset() {
            exception = null;
            type = "";
            forceRefresh = false;
            eligibleOnly = true;
        }

        private JsonNode matchingCandidate(int buyPrice) {
            return toJsonNode(orderedMap(
                "Type", "목걸이",
                "Name", "고대 목걸이",
                "Quality", 91,
                "MainStatValue", 12000,
                "EnlightenmentPoint", 13,
                "BuyPrice", buyPrice,
                "DetailSections", List.of(
                    orderedMap("title", "연마 효과", "lines", List.of("추가 피해 +1.50%"))
                )
            ));
        }
    }
}
