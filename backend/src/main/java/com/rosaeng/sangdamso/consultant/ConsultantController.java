package com.rosaeng.sangdamso.consultant;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.child;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.isObject;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;
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
    private final SgguPromptBuilder promptBuilder;
    private final LocalLlmClient localLlmClient;

    public ConsultantController(
        SgguContextBuilder contextBuilder,
        SgguPromptBuilder promptBuilder,
        LocalLlmClient localLlmClient
    ) {
        this.contextBuilder = contextBuilder;
        this.promptBuilder = promptBuilder;
        this.localLlmClient = localLlmClient;
    }

    @PostMapping("/sggu")
    public JsonNode consult(@RequestBody(required = false) JsonNode body) {
        JsonNode requestBody = body == null ? toJsonNode(Map.of()) : body;
        String message = contextBuilder.sanitizeMessage(text(requestBody, "message"));

        if (message.isEmpty()) {
            throw new BffException(HttpStatus.BAD_REQUEST, "INVALID_MESSAGE", "상담할 내용을 입력해줘.");
        }

        JsonNode context = contextNode(requestBody);

        if (text(child(context, "profile"), "characterName").trim().isEmpty()) {
            throw new BffException(HttpStatus.BAD_REQUEST, "INVALID_ARMORY", "캐릭터를 먼저 조회해줘.");
        }

        List<Map<String, String>> conversation = contextBuilder.normalizeConversation(child(requestBody, "conversation"));
        List<Map<String, String>> messages = promptBuilder.build(message, conversation, context);

        try {
            LocalLlmClient.Completion completion = localLlmClient.createChatCompletion(messages);
            return toJsonNode(orderedMap(
                "Answer", completion.text(),
                "Provider", completion.provider(),
                "Model", completion.model(),
                "Usage", completion.usage()
            ));
        } catch (LocalLlmClient.LocalLlmException exception) {
            if ("LOCAL_LLM_UNAVAILABLE".equals(exception.code())) {
                throw new BffException(HttpStatus.SERVICE_UNAVAILABLE, exception.code(), exception.getMessage());
            }

            throw new BffException(
                HttpStatus.BAD_GATEWAY,
                "LOCAL_LLM_ERROR",
                "슥구 로컬 LLM 상담 응답을 만들지 못했어."
            );
        }
    }

    private JsonNode contextNode(JsonNode requestBody) {
        JsonNode providedContext = child(requestBody, "context");

        if (isObject(providedContext)) {
            return providedContext;
        }

        return toJsonNode(contextBuilder.build(child(requestBody, "armory"), child(requestBody, "specUpRecommendation")));
    }
}
