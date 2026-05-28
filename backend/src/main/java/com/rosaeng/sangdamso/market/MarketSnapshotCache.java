package com.rosaeng.sangdamso.market;

import java.time.Instant;
import java.util.Map;

public class MarketSnapshotCache {

    private Map<String, Object> value;
    private Instant expiresAt = Instant.EPOCH;

    public Map<String, Object> value() {
        return value;
    }

    public Instant expiresAt() {
        return expiresAt;
    }

    public boolean isFresh(Instant now) {
        return value != null && expiresAt.isAfter(now);
    }

    public void put(Map<String, Object> value, Instant expiresAt) {
        this.value = value;
        this.expiresAt = expiresAt;
    }
}
