package com.rosaeng.sangdamso.efficiency;

import com.rosaeng.sangdamso.common.BffException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/api/efficiency/spec-up")
public class SpecUpEfficiencyController {

    private final SpecUpEfficiencyService service;

    public SpecUpEfficiencyController(SpecUpEfficiencyService service) {
        this.service = service;
    }

    @GetMapping("/{name}")
    public JsonNode findSpecUpEfficiency(
        @PathVariable String name,
        @RequestParam(name = "refresh", defaultValue = "0") String refresh
    ) {
        String trimmedName = name.trim();

        if (trimmedName.isEmpty()) {
            throw new BffException(HttpStatus.BAD_REQUEST, "INVALID_CHARACTER_NAME", "조회할 캐릭터명을 입력해줘.");
        }

        return service.findSpecUpEfficiency(trimmedName, "1".equals(refresh) || "true".equalsIgnoreCase(refresh));
    }
}
