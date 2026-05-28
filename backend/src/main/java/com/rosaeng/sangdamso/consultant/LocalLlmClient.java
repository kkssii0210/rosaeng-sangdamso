package com.rosaeng.sangdamso.consultant;

import java.util.List;
import java.util.Map;

public interface LocalLlmClient {

    Completion createChatCompletion(List<Map<String, String>> messages);

    record Completion(String text, String provider, String model, Map<String, Object> usage) {
    }

    class LocalLlmException extends RuntimeException {

        private final String code;

        public LocalLlmException(String code, String message) {
            super(message);
            this.code = code;
        }

        public LocalLlmException(String code, String message, Throwable cause) {
            super(message, cause);
            this.code = code;
        }

        public String code() {
            return code;
        }
    }
}
