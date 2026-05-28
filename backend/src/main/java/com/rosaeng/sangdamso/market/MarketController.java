package com.rosaeng.sangdamso.market;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/api/market")
public class MarketController {

    private final MarketSnapshotService marketSnapshotService;

    public MarketController(MarketSnapshotService marketSnapshotService) {
        this.marketSnapshotService = marketSnapshotService;
    }

    @GetMapping("/snapshot")
    public JsonNode snapshot(@RequestParam(name = "refresh", defaultValue = "0") String refresh) {
        return marketSnapshotService.getSnapshot("1".equals(refresh) || "true".equalsIgnoreCase(refresh));
    }
}
