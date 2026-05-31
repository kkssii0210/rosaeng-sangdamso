package com.rosaeng.sangdamso.consultant;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.child;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.isObject;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.text;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.toJsonNode;

import com.rosaeng.sangdamso.common.BffException;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/api/consult")
public class ConsultantController {

    private final SgguContextBuilder contextBuilder;
    private final SgguConsultationService consultationService;

    public ConsultantController(
        SgguContextBuilder contextBuilder,
        SgguConsultationService consultationService
    ) {
        this.contextBuilder = contextBuilder;
        this.consultationService = consultationService;
    }

    @PostMapping("/sggu")
    public JsonNode consult(@RequestBody(required = false) JsonNode body) {
        JsonNode requestBody = body == null ? toJsonNode(Map.of()) : body;
        String message = contextBuilder.sanitizeMessage(text(requestBody, "message"));
        SgguConsultationMode mode = SgguConsultationMode.from(text(requestBody, "mode"));

        if (message.isEmpty()) {
            throw new BffException(HttpStatus.BAD_REQUEST, "INVALID_MESSAGE", "상담할 내용을 입력해줘.");
        }

        JsonNode context = contextNode(requestBody);

        if (text(child(context, "profile"), "characterName").trim().isEmpty()) {
            throw new BffException(HttpStatus.BAD_REQUEST, "INVALID_ARMORY", "캐릭터를 먼저 조회해줘.");
        }

        List<Map<String, String>> conversation = contextBuilder.normalizeConversation(child(requestBody, "conversation"));
        SgguConsultationResponse response = consultationService.consult(mode, message, conversation, context);
        return toJsonNode(response.toResponseMap());
    }

    private JsonNode contextNode(JsonNode requestBody) {
        JsonNode providedContext = child(requestBody, "context");

        if (isObject(providedContext)) {
            return providedContext;
        }

        return toJsonNode(contextBuilder.build(child(requestBody, "armory"), child(requestBody, "specUpRecommendation")));
    }
}
