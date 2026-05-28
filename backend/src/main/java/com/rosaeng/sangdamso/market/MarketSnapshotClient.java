package com.rosaeng.sangdamso.market;

import org.springframework.http.HttpMethod;
import tools.jackson.databind.JsonNode;

public interface MarketSnapshotClient {

    JsonNode post(HttpMethod method, String path, String authorization, JsonNode body);
}
