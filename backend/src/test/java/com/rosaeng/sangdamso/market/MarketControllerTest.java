package com.rosaeng.sangdamso.market;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.rosaeng.sangdamso.common.BffException;
import com.rosaeng.sangdamso.common.GlobalExceptionHandler;
import com.rosaeng.sangdamso.lostark.LostarkProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@WebMvcTest(MarketController.class)
@Import({GlobalExceptionHandler.class, MarketControllerTest.TestConfig.class})
class MarketControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private FakeMarketSnapshotService marketSnapshotService;

    @BeforeEach
    void resetService() {
        marketSnapshotService.reset();
    }

    @Test
    void returnsMarketSnapshot() throws Exception {
        mockMvc.perform(get("/api/market/snapshot"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.updatedAt").value("2026-05-29T00:00:00Z"))
            .andExpect(jsonPath("$.cached").value(false));

        org.assertj.core.api.Assertions.assertThat(marketSnapshotService.forceRefresh).isFalse();
    }

    @Test
    void passesRefreshQuery() throws Exception {
        mockMvc.perform(get("/api/market/snapshot?refresh=1"))
            .andExpect(status().isOk());

        org.assertj.core.api.Assertions.assertThat(marketSnapshotService.forceRefresh).isTrue();
    }

    @Test
    void mapsMarketErrors() throws Exception {
        marketSnapshotService.exception = new BffException(HttpStatus.BAD_GATEWAY, "LOSTARK_API_ERROR", "시장 응답 실패");

        mockMvc.perform(get("/api/market/snapshot"))
            .andExpect(status().isBadGateway())
            .andExpect(jsonPath("$.code").value("LOSTARK_API_ERROR"))
            .andExpect(jsonPath("$.message").value("시장 응답 실패"));
    }

    @TestConfiguration
    static class TestConfig {

        @Bean
        FakeMarketSnapshotService marketSnapshotService() {
            return new FakeMarketSnapshotService();
        }
    }

    static class FakeMarketSnapshotService extends MarketSnapshotService {

        private final ObjectMapper objectMapper = new ObjectMapper();
        private boolean forceRefresh;
        private BffException exception;

        FakeMarketSnapshotService() {
            super(new LostarkProperties("token", "", "https://example.com", 5, 0), null);
        }

        @Override
        public JsonNode getSnapshot(boolean forceRefresh) {
            this.forceRefresh = forceRefresh;

            if (exception != null) {
                throw exception;
            }

            return objectMapper.createObjectNode()
                .put("updatedAt", "2026-05-29T00:00:00Z")
                .put("cached", false);
        }

        void reset() {
            forceRefresh = false;
            exception = null;
        }
    }
}
