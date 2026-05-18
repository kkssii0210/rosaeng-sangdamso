# Spring Boot BFF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a Java Spring Boot backend in `backend/` and implement the first Lostark character lookup BFF endpoint.

**Architecture:** Keep Next.js as the frontend and add Spring Boot as a separate backend process. The first backend endpoint is `GET /api/characters/{name}`. Existing Next.js API routes remain untouched during this phase.

**Tech Stack:** WSL2 Ubuntu 24.04, OpenJDK 21 LTS, Spring Boot 4.0.6, Maven Wrapper, Spring MVC, Spring `RestClient`, Jackson, JUnit 5, Spring Boot Test.

---

## File Structure

- Create: `backend/`
  - Spring Boot Maven project generated from Spring Initializr.
- Create/Modify: `backend/pom.xml`
  - Dependencies: web, validation, actuator, test.
- Create/Modify: `backend/src/main/resources/application.yml`
  - `server.port`, Lostark config defaults.
- Modify: `backend/src/main/java/com/rosaeng/sangdamso/RosaengSangdamsoBackendApplication.java`
  - Application entry point and configuration properties scan.
- Create: `backend/src/main/java/com/rosaeng/sangdamso/common/ApiErrorResponse.java`
  - Shared error response DTO.
- Create: `backend/src/main/java/com/rosaeng/sangdamso/common/GlobalExceptionHandler.java`
  - Maps domain exceptions to BFF response JSON.
- Create: `backend/src/main/java/com/rosaeng/sangdamso/common/BffException.java`
  - Carries HTTP status, route code, and user-facing message.
- Create: `backend/src/main/java/com/rosaeng/sangdamso/lostark/LostarkApiErrorCode.java`
  - Internal Lostark client error codes.
- Create: `backend/src/main/java/com/rosaeng/sangdamso/lostark/LostarkApiException.java`
  - Internal Lostark client exception.
- Create: `backend/src/main/java/com/rosaeng/sangdamso/lostark/LostarkProperties.java`
  - Spring config binding and authorization normalization.
- Create: `backend/src/main/java/com/rosaeng/sangdamso/lostark/LostarkApiClient.java`
  - Lostark GET requests, retry, and error handling.
- Create: `backend/src/main/java/com/rosaeng/sangdamso/lostark/LostarkClientConfig.java`
  - Spring beans for `RestClient` and `LostarkApiClient`.
- Create: `backend/src/main/java/com/rosaeng/sangdamso/character/CharacterResponse.java`
  - Top-level DTO compatible with the current frontend keys.
- Create: `backend/src/main/java/com/rosaeng/sangdamso/character/CharacterService.java`
  - Orchestrates Lostark armory calls and maps missing profile to character-not-found.
- Create: `backend/src/main/java/com/rosaeng/sangdamso/character/CharacterController.java`
  - `GET /api/characters/{name}` endpoint.
- Create: `backend/src/test/java/com/rosaeng/sangdamso/lostark/LostarkPropertiesTest.java`
  - Authorization normalization tests.
- Create: `backend/src/test/java/com/rosaeng/sangdamso/lostark/LostarkApiClientTest.java`
  - Retry and error mapping tests using a fake executor.
- Create: `backend/src/test/java/com/rosaeng/sangdamso/character/CharacterServiceTest.java`
  - DTO assembly and optional armory `NOT_FOUND` behavior tests.
- Create: `backend/src/test/java/com/rosaeng/sangdamso/character/CharacterControllerTest.java`
  - BFF HTTP error contract tests.
- Modify: `README.md`
  - Add backend run/test commands.
- Modify: `.env.example`
  - Keep `LOSTARK_API_KEY`; add note that Spring Boot reads the same key.

## Important Scope Rule

Do not delete or rewrite existing Next.js API routes in this plan. Do not wire the Next.js frontend to Spring Boot yet. This phase creates and verifies the Java backend independently.

---

### Task 1: Install JDK 21 and Generate Spring Boot Project

**Files:**
- Create: `backend/`

- [ ] **Step 1: Install OpenJDK 21**

Run:

```bash
sudo apt-get update
sudo apt-get install -y openjdk-21-jdk unzip curl
java -version
javac -version
```

Expected:

```text
java version output reports version 21.x or openjdk version 21.x
javac version output reports javac 21.x
```

- [ ] **Step 2: Generate the Spring Boot project**

Run from the repository root:

```bash
curl -fsSL "https://start.spring.io/starter.zip?type=maven-project&language=java&bootVersion=4.0.6&baseDir=backend&groupId=com.rosaeng&artifactId=sangdamso-backend&name=rosaeng-sangdamso-backend&description=Rosaeng%20Sangdamso%20Spring%20Boot%20BFF&packageName=com.rosaeng.sangdamso&packaging=jar&javaVersion=21&dependencies=web,validation,actuator" -o /tmp/rosaeng-spring-boot.zip
unzip -q /tmp/rosaeng-spring-boot.zip -d .
```

Expected:

```text
backend/pom.xml exists
backend/mvnw exists
backend/src/main/java/com/rosaeng/sangdamso/RosaengSangdamsoBackendApplication.java exists
```

- [ ] **Step 3: Run generated project tests**

Run:

```bash
cd backend
./mvnw test
```

Expected: PASS with the generated Spring context test.

- [ ] **Step 4: Commit generated backend skeleton**

Run:

```bash
git add backend
git commit -m "feat: scaffold spring boot backend"
```

Expected: one commit containing only the generated `backend/` project.

---

### Task 2: Backend Configuration and Common Error Types

**Files:**
- Modify: `backend/src/main/java/com/rosaeng/sangdamso/RosaengSangdamsoBackendApplication.java`
- Create: `backend/src/main/resources/application.yml`
- Create: `backend/src/main/java/com/rosaeng/sangdamso/common/ApiErrorResponse.java`
- Create: `backend/src/main/java/com/rosaeng/sangdamso/common/BffException.java`
- Create: `backend/src/main/java/com/rosaeng/sangdamso/common/GlobalExceptionHandler.java`
- Create: `backend/src/main/java/com/rosaeng/sangdamso/lostark/LostarkProperties.java`
- Create: `backend/src/test/java/com/rosaeng/sangdamso/lostark/LostarkPropertiesTest.java`

- [ ] **Step 1: Write authorization normalization tests**

Create `backend/src/test/java/com/rosaeng/sangdamso/lostark/LostarkPropertiesTest.java`:

```java
package com.rosaeng.sangdamso.lostark;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class LostarkPropertiesTest {

    @Test
    void returnsEmptyAuthorizationWhenBothKeysAreBlank() {
        LostarkProperties properties = new LostarkProperties("", "   ", "https://example.com", 5, 1);

        assertThat(properties.authorization()).isEmpty();
    }

    @Test
    void prefersPrimaryApiKeyOverFallback() {
        LostarkProperties properties = new LostarkProperties("primary-token", "fallback-token", "https://example.com", 5, 1);

        assertThat(properties.authorization()).contains("bearer primary-token");
    }

    @Test
    void preservesExistingBearerPrefix() {
        LostarkProperties properties = new LostarkProperties("Bearer existing-token", "", "https://example.com", 5, 1);

        assertThat(properties.authorization()).contains("Bearer existing-token");
    }

    @Test
    void prefixesRawFallbackToken() {
        LostarkProperties properties = new LostarkProperties("", " raw-token ", "https://example.com", 5, 1);

        assertThat(properties.authorization()).contains("bearer raw-token");
    }
}
```

- [ ] **Step 2: Run the new test and verify it fails**

Run:

```bash
cd backend
./mvnw -Dtest=LostarkPropertiesTest test
```

Expected: FAIL because `LostarkProperties` does not exist yet.

- [ ] **Step 3: Enable configuration properties scanning**

Replace `backend/src/main/java/com/rosaeng/sangdamso/RosaengSangdamsoBackendApplication.java` with:

```java
package com.rosaeng.sangdamso;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class RosaengSangdamsoBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(RosaengSangdamsoBackendApplication.class, args);
    }
}
```

- [ ] **Step 4: Add Spring configuration defaults**

Create `backend/src/main/resources/application.yml`:

```yaml
server:
  port: 8080

lostark:
  base-url: https://developer-lostark.game.onstove.com
  timeout-seconds: 5
  retry-count: 1
```

- [ ] **Step 5: Add common error response record**

Create `backend/src/main/java/com/rosaeng/sangdamso/common/ApiErrorResponse.java`:

```java
package com.rosaeng.sangdamso.common;

public record ApiErrorResponse(String code, String message) {
}
```

- [ ] **Step 6: Add BFF exception**

Create `backend/src/main/java/com/rosaeng/sangdamso/common/BffException.java`:

```java
package com.rosaeng.sangdamso.common;

import org.springframework.http.HttpStatus;

public class BffException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    private final String userMessage;

    public BffException(HttpStatus status, String code, String userMessage) {
        super(userMessage);
        this.status = status;
        this.code = code;
        this.userMessage = userMessage;
    }

    public HttpStatus status() {
        return status;
    }

    public String code() {
        return code;
    }

    public String userMessage() {
        return userMessage;
    }
}
```

- [ ] **Step 7: Add global exception handler**

Create `backend/src/main/java/com/rosaeng/sangdamso/common/GlobalExceptionHandler.java`:

```java
package com.rosaeng.sangdamso.common;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BffException.class)
    public ResponseEntity<ApiErrorResponse> handleBffException(BffException exception) {
        return ResponseEntity
            .status(exception.status())
            .body(new ApiErrorResponse(exception.code(), exception.userMessage()));
    }
}
```

- [ ] **Step 8: Add Lostark properties**

Create `backend/src/main/java/com/rosaeng/sangdamso/lostark/LostarkProperties.java`:

```java
package com.rosaeng.sangdamso.lostark;

import java.util.Optional;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "lostark")
public record LostarkProperties(
    String apiKey,
    String openApiKey,
    String baseUrl,
    int timeoutSeconds,
    int retryCount
) {

    public LostarkProperties {
        baseUrl = (baseUrl == null || baseUrl.isBlank()) ? "https://developer-lostark.game.onstove.com" : baseUrl;
        timeoutSeconds = timeoutSeconds <= 0 ? 5 : timeoutSeconds;
        retryCount = retryCount < 0 ? 1 : retryCount;
    }

    public Optional<String> authorization() {
        String token = hasText(apiKey) ? apiKey : openApiKey;

        if (!hasText(token)) {
            return Optional.empty();
        }

        String normalizedToken = token.trim();

        if (normalizedToken.toLowerCase().startsWith("bearer ")) {
            return Optional.of(normalizedToken);
        }

        return Optional.of("bearer " + normalizedToken);
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
```

- [ ] **Step 9: Run configuration tests**

Run:

```bash
cd backend
./mvnw -Dtest=LostarkPropertiesTest test
```

Expected: PASS.

- [ ] **Step 10: Commit common backend config**

Run:

```bash
git add backend/src/main/java/com/rosaeng/sangdamso backend/src/main/resources/application.yml backend/src/test/java/com/rosaeng/sangdamso/lostark/LostarkPropertiesTest.java
git commit -m "feat: add spring backend configuration"
```

Expected: one commit with configuration, common error types, properties, and tests.

---

### Task 3: Lostark API Client

**Files:**
- Create: `backend/src/main/java/com/rosaeng/sangdamso/lostark/LostarkApiErrorCode.java`
- Create: `backend/src/main/java/com/rosaeng/sangdamso/lostark/LostarkApiException.java`
- Create: `backend/src/main/java/com/rosaeng/sangdamso/lostark/LostarkApiClient.java`
- Create: `backend/src/main/java/com/rosaeng/sangdamso/lostark/LostarkClientConfig.java`
- Create: `backend/src/test/java/com/rosaeng/sangdamso/lostark/LostarkApiClientTest.java`

- [ ] **Step 1: Write Lostark client tests**

Create `backend/src/test/java/com/rosaeng/sangdamso/lostark/LostarkApiClientTest.java`:

```java
package com.rosaeng.sangdamso.lostark;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class LostarkApiClientTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void notFoundDoesNotRetry() {
        AtomicInteger calls = new AtomicInteger();
        LostarkApiClient client = clientWithExecutor((method, path, authorization) -> {
            calls.incrementAndGet();
            throw new LostarkApiException(LostarkApiErrorCode.NOT_FOUND, 404, "missing");
        });

        assertThatThrownBy(() -> client.get("/missing"))
            .isInstanceOf(LostarkApiException.class)
            .extracting("code")
            .isEqualTo(LostarkApiErrorCode.NOT_FOUND);
        assertThat(calls).hasValue(1);
    }

    @Test
    void upstreamErrorRetriesOnceAndCanSucceed() throws Exception {
        AtomicInteger calls = new AtomicInteger();
        JsonNode success = objectMapper.createObjectNode().put("ok", true);
        LostarkApiClient client = clientWithExecutor((method, path, authorization) -> {
            if (calls.incrementAndGet() == 1) {
                throw new LostarkApiException(LostarkApiErrorCode.UPSTREAM_ERROR, 500, "temporary");
            }

            return success;
        });

        JsonNode result = client.get("/unstable");

        assertThat(result.get("ok").asBoolean()).isTrue();
        assertThat(calls).hasValue(2);
    }

    @Test
    void rateLimitRetriesOnceAndCanSucceed() throws Exception {
        AtomicInteger calls = new AtomicInteger();
        JsonNode success = objectMapper.createObjectNode().put("ok", true);
        LostarkApiClient client = clientWithExecutor((method, path, authorization) -> {
            if (calls.incrementAndGet() == 1) {
                throw new LostarkApiException(LostarkApiErrorCode.RATE_LIMITED, 429, "rate limited");
            }

            return success;
        });

        JsonNode result = client.get("/rate-limited");

        assertThat(result.get("ok").asBoolean()).isTrue();
        assertThat(calls).hasValue(2);
    }

    @Test
    void timeoutRetriesAndThenThrowsTimeout() {
        AtomicInteger calls = new AtomicInteger();
        LostarkApiClient client = clientWithExecutor((method, path, authorization) -> {
            calls.incrementAndGet();
            throw new LostarkApiException(LostarkApiErrorCode.TIMEOUT, null, "timeout");
        });

        assertThatThrownBy(() -> client.get("/slow"))
            .isInstanceOf(LostarkApiException.class)
            .extracting("code")
            .isEqualTo(LostarkApiErrorCode.TIMEOUT);
        assertThat(calls).hasValue(2);
    }

    @Test
    void networkFailureRetriesAndThenThrowsNetworkError() {
        AtomicInteger calls = new AtomicInteger();
        LostarkApiClient client = clientWithExecutor((method, path, authorization) -> {
            calls.incrementAndGet();
            throw new LostarkApiException(LostarkApiErrorCode.NETWORK_ERROR, null, "network");
        });

        assertThatThrownBy(() -> client.get("/network"))
            .isInstanceOf(LostarkApiException.class)
            .extracting("code")
            .isEqualTo(LostarkApiErrorCode.NETWORK_ERROR);
        assertThat(calls).hasValue(2);
    }

    private LostarkApiClient clientWithExecutor(LostarkApiClient.RequestExecutor executor) {
        LostarkProperties properties = new LostarkProperties("token", "", "https://example.com", 5, 1);
        return new LostarkApiClient(properties, executor);
    }
}
```

- [ ] **Step 2: Run Lostark client tests and verify they fail**

Run:

```bash
cd backend
./mvnw -Dtest=LostarkApiClientTest test
```

Expected: FAIL because the client classes do not exist yet.

- [ ] **Step 3: Add Lostark API error code enum**

Create `backend/src/main/java/com/rosaeng/sangdamso/lostark/LostarkApiErrorCode.java`:

```java
package com.rosaeng.sangdamso.lostark;

public enum LostarkApiErrorCode {
    BAD_REQUEST,
    AUTH_ERROR,
    NOT_FOUND,
    RATE_LIMITED,
    UPSTREAM_ERROR,
    TIMEOUT,
    NETWORK_ERROR
}
```

- [ ] **Step 4: Add Lostark API exception**

Create `backend/src/main/java/com/rosaeng/sangdamso/lostark/LostarkApiException.java`:

```java
package com.rosaeng.sangdamso.lostark;

public class LostarkApiException extends RuntimeException {

    private final LostarkApiErrorCode code;
    private final Integer status;

    public LostarkApiException(LostarkApiErrorCode code, Integer status, String message) {
        super(message);
        this.code = code;
        this.status = status;
    }

    public LostarkApiException(LostarkApiErrorCode code, Integer status, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
        this.status = status;
    }

    public LostarkApiErrorCode getCode() {
        return code;
    }

    public Integer getStatus() {
        return status;
    }
}
```

- [ ] **Step 5: Add Lostark API client**

Create `backend/src/main/java/com/rosaeng/sangdamso/lostark/LostarkApiClient.java`:

```java
package com.rosaeng.sangdamso.lostark;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Optional;
import org.springframework.http.HttpMethod;

public class LostarkApiClient {

    private final LostarkProperties properties;
    private final RequestExecutor requestExecutor;

    public LostarkApiClient(LostarkProperties properties, RequestExecutor requestExecutor) {
        this.properties = properties;
        this.requestExecutor = requestExecutor;
    }

    public JsonNode get(String path) {
        Optional<String> authorization = properties.authorization();

        if (authorization.isEmpty()) {
            throw new LostarkApiException(LostarkApiErrorCode.AUTH_ERROR, null, "Missing Lostark API authorization.");
        }

        LostarkApiException lastException = null;

        for (int attempt = 0; attempt <= properties.retryCount(); attempt++) {
            try {
                return requestExecutor.execute(HttpMethod.GET, path, authorization.get());
            } catch (LostarkApiException exception) {
                lastException = exception;

                if (attempt >= properties.retryCount() || !isRetryable(exception.getCode())) {
                    throw exception;
                }
            }
        }

        throw lastException;
    }

    private boolean isRetryable(LostarkApiErrorCode code) {
        return code == LostarkApiErrorCode.RATE_LIMITED
            || code == LostarkApiErrorCode.UPSTREAM_ERROR
            || code == LostarkApiErrorCode.TIMEOUT
            || code == LostarkApiErrorCode.NETWORK_ERROR;
    }

    @FunctionalInterface
    public interface RequestExecutor {
        JsonNode execute(HttpMethod method, String path, String authorization);
    }
}
```

- [ ] **Step 6: Add RestClient configuration**

Create `backend/src/main/java/com/rosaeng/sangdamso/lostark/LostarkClientConfig.java`:

```java
package com.rosaeng.sangdamso.lostark;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.SocketTimeoutException;
import java.time.Duration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

@Configuration
public class LostarkClientConfig {

    @Bean
    RestClient lostarkRestClient(LostarkProperties properties) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(properties.timeoutSeconds()));
        requestFactory.setReadTimeout(Duration.ofSeconds(properties.timeoutSeconds()));

        return RestClient.builder()
            .baseUrl(properties.baseUrl())
            .requestFactory(requestFactory)
            .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
            .build();
    }

    @Bean
    LostarkApiClient lostarkApiClient(LostarkProperties properties, RestClient lostarkRestClient, ObjectMapper objectMapper) {
        return new LostarkApiClient(properties, (method, path, authorization) -> execute(lostarkRestClient, objectMapper, method, path, authorization));
    }

    private JsonNode execute(RestClient restClient, ObjectMapper objectMapper, HttpMethod method, String path, String authorization) {
        try {
            return restClient
                .method(method)
                .uri(path)
                .header(HttpHeaders.AUTHORIZATION, authorization)
                .exchange((request, response) -> {
                    String responseBody = new String(response.getBody().readAllBytes());

                    if (response.getStatusCode().is2xxSuccessful()) {
                        return objectMapper.readTree(responseBody);
                    }

                    throw new LostarkApiException(
                        codeForStatus(response.getStatusCode().value()),
                        response.getStatusCode().value(),
                        "Lostark Open API " + response.getStatusCode().value() + ": " + responseBody
                    );
                });
        } catch (LostarkApiException exception) {
            throw exception;
        } catch (ResourceAccessException exception) {
            throw new LostarkApiException(errorCodeForResourceAccess(exception), null, "Lostark Open API request failed.", exception);
        } catch (IOException exception) {
            throw new LostarkApiException(LostarkApiErrorCode.NETWORK_ERROR, null, "Failed to read Lostark Open API response.", exception);
        }
    }

    private LostarkApiErrorCode codeForStatus(int status) {
        if (status == 400) {
            return LostarkApiErrorCode.BAD_REQUEST;
        }

        if (status == 401 || status == 403) {
            return LostarkApiErrorCode.AUTH_ERROR;
        }

        if (status == 404) {
            return LostarkApiErrorCode.NOT_FOUND;
        }

        if (status == 429) {
            return LostarkApiErrorCode.RATE_LIMITED;
        }

        return LostarkApiErrorCode.UPSTREAM_ERROR;
    }

    private LostarkApiErrorCode errorCodeForResourceAccess(ResourceAccessException exception) {
        Throwable cause = exception.getCause();

        while (cause != null) {
            if (cause instanceof SocketTimeoutException) {
                return LostarkApiErrorCode.TIMEOUT;
            }

            cause = cause.getCause();
        }

        return LostarkApiErrorCode.NETWORK_ERROR;
    }
}
```

- [ ] **Step 7: Run Lostark client tests**

Run:

```bash
cd backend
./mvnw -Dtest=LostarkApiClientTest,LostarkPropertiesTest test
```

Expected: PASS.

- [ ] **Step 8: Commit Lostark API client**

Run:

```bash
git add backend/src/main/java/com/rosaeng/sangdamso/lostark backend/src/test/java/com/rosaeng/sangdamso/lostark
git commit -m "feat: add spring lostark api client"
```

Expected: one commit with Lostark client code and tests.

---

### Task 4: Character Service and DTO

**Files:**
- Create: `backend/src/main/java/com/rosaeng/sangdamso/character/CharacterResponse.java`
- Create: `backend/src/main/java/com/rosaeng/sangdamso/character/CharacterService.java`
- Create: `backend/src/test/java/com/rosaeng/sangdamso/character/CharacterServiceTest.java`

- [ ] **Step 1: Write CharacterService tests**

Create `backend/src/test/java/com/rosaeng/sangdamso/character/CharacterServiceTest.java`:

```java
package com.rosaeng.sangdamso.character;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rosaeng.sangdamso.common.BffException;
import com.rosaeng.sangdamso.lostark.LostarkApiClient;
import com.rosaeng.sangdamso.lostark.LostarkApiErrorCode;
import com.rosaeng.sangdamso.lostark.LostarkApiException;
import com.rosaeng.sangdamso.lostark.LostarkProperties;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

class CharacterServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void returnsTopLevelFrontendKeys() throws Exception {
        Map<String, JsonNode> responses = new HashMap<>();
        responses.put("/armories/characters/%EB%B6%90%EB%B2%84/profiles", objectMapper.readTree("{\"CharacterName\":\"붐버\"}"));
        responses.put("/armories/characters/%EB%B6%90%EB%B2%84/equipment", objectMapper.readTree("[]"));
        responses.put("/armories/characters/%EB%B6%90%EB%B2%84/avatars", objectMapper.readTree("[]"));
        responses.put("/armories/characters/%EB%B6%90%EB%B2%84/arkpassive", objectMapper.readTree("{}"));
        responses.put("/armories/characters/%EB%B6%90%EB%B2%84/arkgrid", objectMapper.readTree("{}"));
        responses.put("/armories/characters/%EB%B6%90%EB%B2%84/cards", objectMapper.readTree("{}"));
        responses.put("/armories/characters/%EB%B6%90%EB%B2%84/combat-skills", objectMapper.readTree("[]"));
        responses.put("/armories/characters/%EB%B6%90%EB%B2%84/engravings", objectMapper.readTree("{}"));
        responses.put("/armories/characters/%EB%B6%90%EB%B2%84/gems", objectMapper.readTree("{}"));

        CharacterService service = new CharacterService(clientForResponses(responses));

        CharacterResponse response = service.findCharacter("붐버");

        assertThat(response.profile().get("CharacterName").asText()).isEqualTo("붐버");
        assertThat(response.equipment().isArray()).isTrue();
        assertThat(response.avatars().isArray()).isTrue();
        assertThat(response.arkPassive().isObject()).isTrue();
        assertThat(response.arkGrid().isObject()).isTrue();
        assertThat(response.cards().isObject()).isTrue();
        assertThat(response.skills().isArray()).isTrue();
        assertThat(response.engravings().isObject()).isTrue();
        assertThat(response.gems().isObject()).isTrue();
        assertThat(response.paradiseOrb()).isNull();
        assertThat(response.classIdentityEffects()).isNull();
        assertThat(response.criticalStats()).isNull();
        assertThat(response.combatPowerAnalysis()).isNull();
        assertThat(response.upgradeEfficiency()).isNull();
    }

    @Test
    void profileNotFoundMapsToCharacterNotFound() {
        CharacterService service = new CharacterService(clientThrowing(LostarkApiErrorCode.NOT_FOUND));

        assertThatThrownBy(() -> service.findCharacter("missing"))
            .isInstanceOf(BffException.class)
            .extracting("code")
            .isEqualTo("CHARACTER_NOT_FOUND");
    }

    @Test
    void optionalArmoryNotFoundDoesNotFailLookup() throws Exception {
        CharacterService service = new CharacterService(clientForOptionalNotFound());

        CharacterResponse response = service.findCharacter("test");

        assertThat(response.profile().get("CharacterName").asText()).isEqualTo("test");
        assertThat(response.equipment()).isNull();
    }

    @Test
    void upstreamFailureMapsToLookupFailure() {
        CharacterService service = new CharacterService(clientThrowing(LostarkApiErrorCode.UPSTREAM_ERROR));

        assertThatThrownBy(() -> service.findCharacter("test"))
            .isInstanceOf(BffException.class)
            .extracting("code")
            .isEqualTo("LOSTARK_API_ERROR");
    }

    private LostarkApiClient clientForResponses(Map<String, JsonNode> responses) {
        return new LostarkApiClient(new LostarkProperties("token", "", "https://example.com", 5, 1), (method, path, authorization) -> responses.get(path));
    }

    private LostarkApiClient clientThrowing(LostarkApiErrorCode code) {
        return new LostarkApiClient(new LostarkProperties("token", "", "https://example.com", 5, 1), (method, path, authorization) -> {
            throw new LostarkApiException(code, code == LostarkApiErrorCode.NOT_FOUND ? 404 : 500, code.name());
        });
    }

    private LostarkApiClient clientForOptionalNotFound() throws Exception {
        JsonNode profile = objectMapper.readTree("{\"CharacterName\":\"test\"}");
        return new LostarkApiClient(new LostarkProperties("token", "", "https://example.com", 5, 1), (method, path, authorization) -> {
            if (path.endsWith("/profiles")) {
                return profile;
            }

            throw new LostarkApiException(LostarkApiErrorCode.NOT_FOUND, 404, "missing");
        });
    }
}
```

- [ ] **Step 2: Run service tests and verify they fail**

Run:

```bash
cd backend
./mvnw -Dtest=CharacterServiceTest test
```

Expected: FAIL because `CharacterService` and `CharacterResponse` do not exist yet.

- [ ] **Step 3: Add CharacterResponse**

Create `backend/src/main/java/com/rosaeng/sangdamso/character/CharacterResponse.java`:

```java
package com.rosaeng.sangdamso.character;

import com.fasterxml.jackson.databind.JsonNode;

public record CharacterResponse(
    JsonNode profile,
    JsonNode equipment,
    Object paradiseOrb,
    JsonNode avatars,
    JsonNode arkPassive,
    JsonNode arkGrid,
    JsonNode cards,
    JsonNode skills,
    JsonNode engravings,
    JsonNode gems,
    Object classIdentityEffects,
    Object criticalStats,
    Object combatPowerAnalysis,
    Object upgradeEfficiency
) {
}
```

- [ ] **Step 4: Add CharacterService**

Create `backend/src/main/java/com/rosaeng/sangdamso/character/CharacterService.java`:

```java
package com.rosaeng.sangdamso.character;

import com.fasterxml.jackson.databind.JsonNode;
import com.rosaeng.sangdamso.common.BffException;
import com.rosaeng.sangdamso.lostark.LostarkApiClient;
import com.rosaeng.sangdamso.lostark.LostarkApiErrorCode;
import com.rosaeng.sangdamso.lostark.LostarkApiException;
import java.nio.charset.StandardCharsets;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriUtils;

@Service
public class CharacterService {

    private final LostarkApiClient lostarkApiClient;

    public CharacterService(LostarkApiClient lostarkApiClient) {
        this.lostarkApiClient = lostarkApiClient;
    }

    public CharacterResponse findCharacter(String characterName) {
        String encodedName = UriUtils.encodePathSegment(characterName, StandardCharsets.UTF_8);

        JsonNode profile = fetchRequiredProfile("/armories/characters/" + encodedName + "/profiles");

        return new CharacterResponse(
            profile,
            fetchOptional("/armories/characters/" + encodedName + "/equipment"),
            null,
            fetchOptional("/armories/characters/" + encodedName + "/avatars"),
            fetchOptional("/armories/characters/" + encodedName + "/arkpassive"),
            fetchOptional("/armories/characters/" + encodedName + "/arkgrid"),
            fetchOptional("/armories/characters/" + encodedName + "/cards"),
            fetchOptional("/armories/characters/" + encodedName + "/combat-skills"),
            fetchOptional("/armories/characters/" + encodedName + "/engravings"),
            fetchOptional("/armories/characters/" + encodedName + "/gems"),
            null,
            null,
            null,
            null
        );
    }

    private JsonNode fetchRequiredProfile(String path) {
        try {
            return lostarkApiClient.get(path);
        } catch (LostarkApiException exception) {
            if (exception.getCode() == LostarkApiErrorCode.NOT_FOUND) {
                throw new BffException(HttpStatus.NOT_FOUND, "CHARACTER_NOT_FOUND", "없는 캐릭터입니다.");
            }

            throw lookupFailure();
        }
    }

    private JsonNode fetchOptional(String path) {
        try {
            return lostarkApiClient.get(path);
        } catch (LostarkApiException exception) {
            if (exception.getCode() == LostarkApiErrorCode.NOT_FOUND) {
                return null;
            }

            throw lookupFailure();
        }
    }

    private BffException lookupFailure() {
        return new BffException(HttpStatus.BAD_GATEWAY, "LOSTARK_API_ERROR", "지금은 캐릭터 정보를 불러오지 못했어요. 잠시 후 다시 조회해줘.");
    }
}
```

- [ ] **Step 5: Run service tests**

Run:

```bash
cd backend
./mvnw -Dtest=CharacterServiceTest test
```

Expected: PASS.

- [ ] **Step 6: Commit character service**

Run:

```bash
git add backend/src/main/java/com/rosaeng/sangdamso/character/CharacterResponse.java backend/src/main/java/com/rosaeng/sangdamso/character/CharacterService.java backend/src/test/java/com/rosaeng/sangdamso/character/CharacterServiceTest.java
git commit -m "feat: add spring character lookup service"
```

Expected: one commit with service, DTO, and service tests.

---

### Task 5: Character Controller

**Files:**
- Create: `backend/src/main/java/com/rosaeng/sangdamso/character/CharacterController.java`
- Create: `backend/src/test/java/com/rosaeng/sangdamso/character/CharacterControllerTest.java`

- [ ] **Step 1: Write controller tests**

Create `backend/src/test/java/com/rosaeng/sangdamso/character/CharacterControllerTest.java`:

```java
package com.rosaeng.sangdamso.character;

import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rosaeng.sangdamso.common.BffException;
import com.rosaeng.sangdamso.common.GlobalExceptionHandler;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(CharacterController.class)
@Import(GlobalExceptionHandler.class)
class CharacterControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CharacterService characterService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void emptyCharacterNameReturnsInvalidCharacterName() throws Exception {
        mockMvc.perform(get("/api/characters/%20"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_CHARACTER_NAME"))
            .andExpect(jsonPath("$.message").value("조회할 캐릭터명을 입력해줘."));
    }

    @Test
    void missingApiKeyReturnsMaskedConfigurationMessage() throws Exception {
        when(characterService.findCharacter(anyString()))
            .thenThrow(new BffException(HttpStatus.INTERNAL_SERVER_ERROR, "MISSING_API_KEY", "잠시 설정을 확인하고 있어요."));

        mockMvc.perform(get("/api/characters/test"))
            .andExpect(status().isInternalServerError())
            .andExpect(jsonPath("$.code").value("MISSING_API_KEY"))
            .andExpect(jsonPath("$.message").value("잠시 설정을 확인하고 있어요."));
    }

    @Test
    void missingCharacterReturnsCharacterNotFound() throws Exception {
        when(characterService.findCharacter(anyString()))
            .thenThrow(new BffException(HttpStatus.NOT_FOUND, "CHARACTER_NOT_FOUND", "없는 캐릭터입니다."));

        mockMvc.perform(get("/api/characters/missing"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("CHARACTER_NOT_FOUND"))
            .andExpect(jsonPath("$.message").value("없는 캐릭터입니다."));
    }

    @Test
    void upstreamFailureReturnsLostarkApiError() throws Exception {
        when(characterService.findCharacter(anyString()))
            .thenThrow(new BffException(HttpStatus.BAD_GATEWAY, "LOSTARK_API_ERROR", "지금은 캐릭터 정보를 불러오지 못했어요. 잠시 후 다시 조회해줘."));

        mockMvc.perform(get("/api/characters/test"))
            .andExpect(status().isBadGateway())
            .andExpect(jsonPath("$.code").value("LOSTARK_API_ERROR"))
            .andExpect(jsonPath("$.message").value("지금은 캐릭터 정보를 불러오지 못했어요. 잠시 후 다시 조회해줘."));
    }

    @Test
    void successfulResponseIncludesCalculationFieldsAsNull() throws Exception {
        CharacterResponse response = new CharacterResponse(
            objectMapper.readTree("{\"CharacterName\":\"test\"}"),
            objectMapper.readTree("[]"),
            null,
            objectMapper.readTree("[]"),
            objectMapper.readTree("{}"),
            objectMapper.readTree("{}"),
            objectMapper.readTree("{}"),
            objectMapper.readTree("[]"),
            objectMapper.readTree("{}"),
            objectMapper.readTree("{}"),
            null,
            null,
            null,
            null
        );
        when(characterService.findCharacter("test")).thenReturn(response);

        mockMvc.perform(get("/api/characters/test"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.profile.CharacterName").value("test"))
            .andExpect(jsonPath("$.equipment").isArray())
            .andExpect(jsonPath("$.paradiseOrb").value(nullValue()))
            .andExpect(jsonPath("$.classIdentityEffects").value(nullValue()))
            .andExpect(jsonPath("$.criticalStats").value(nullValue()))
            .andExpect(jsonPath("$.combatPowerAnalysis").value(nullValue()))
            .andExpect(jsonPath("$.upgradeEfficiency").value(nullValue()));
    }
}
```

- [ ] **Step 2: Run controller tests and verify they fail**

Run:

```bash
cd backend
./mvnw -Dtest=CharacterControllerTest test
```

Expected: FAIL because `CharacterController` does not exist yet.

- [ ] **Step 3: Add CharacterController**

Create `backend/src/main/java/com/rosaeng/sangdamso/character/CharacterController.java`:

```java
package com.rosaeng.sangdamso.character;

import com.rosaeng.sangdamso.common.BffException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/characters")
public class CharacterController {

    private final CharacterService characterService;

    public CharacterController(CharacterService characterService) {
        this.characterService = characterService;
    }

    @GetMapping("/{name}")
    public CharacterResponse getCharacter(@PathVariable String name) {
        String characterName = name == null ? "" : name.trim();

        if (characterName.isEmpty()) {
            throw new BffException(HttpStatus.BAD_REQUEST, "INVALID_CHARACTER_NAME", "조회할 캐릭터명을 입력해줘.");
        }

        return characterService.findCharacter(characterName);
    }
}
```

- [ ] **Step 4: Teach CharacterService to map missing API key**

Modify `backend/src/main/java/com/rosaeng/sangdamso/character/CharacterService.java` so `fetchRequiredProfile` handles `AUTH_ERROR` with null status as missing configuration:

```java
    private JsonNode fetchRequiredProfile(String path) {
        try {
            return lostarkApiClient.get(path);
        } catch (LostarkApiException exception) {
            if (exception.getCode() == LostarkApiErrorCode.NOT_FOUND) {
                throw new BffException(HttpStatus.NOT_FOUND, "CHARACTER_NOT_FOUND", "없는 캐릭터입니다.");
            }

            if (exception.getCode() == LostarkApiErrorCode.AUTH_ERROR && exception.getStatus() == null) {
                throw new BffException(HttpStatus.INTERNAL_SERVER_ERROR, "MISSING_API_KEY", "잠시 설정을 확인하고 있어요.");
            }

            throw lookupFailure();
        }
    }
```

Keep the rest of the file unchanged.

- [ ] **Step 5: Run controller and service tests**

Run:

```bash
cd backend
./mvnw -Dtest=CharacterControllerTest,CharacterServiceTest test
```

Expected: PASS.

- [ ] **Step 6: Commit character controller**

Run:

```bash
git add backend/src/main/java/com/rosaeng/sangdamso/character backend/src/test/java/com/rosaeng/sangdamso/character
git commit -m "feat: expose spring character endpoint"
```

Expected: one commit with controller, service adjustment, and controller tests.

---

### Task 6: Documentation and Full Verification

**Files:**
- Modify: `README.md`
- Modify: `.env.example`

- [ ] **Step 1: Update `.env.example`**

Replace `.env.example` with:

```text
LOSTARK_API_KEY=your_lostark_open_api_jwt

# Spring Boot backend reads the same key through relaxed binding.
# LOSTARK_OPEN_API_KEY can also be used as a fallback.
```

- [ ] **Step 2: Update README backend commands**

Add this section to `README.md` after the existing development commands:

````md
## Spring Boot backend

The Java backend lives in `backend/` and currently exposes the first BFF endpoint:

```bash
cd backend
./mvnw test
./mvnw spring-boot:run
```

By default it runs on `http://localhost:8080`.

It reads `LOSTARK_API_KEY` first and falls back to `LOSTARK_OPEN_API_KEY`.
````

- [ ] **Step 3: Run all backend tests**

Run:

```bash
cd backend
./mvnw test
```

Expected: PASS.

- [ ] **Step 4: Run backend application smoke test**

Run:

```bash
cd backend
./mvnw spring-boot:run
```

Expected:

```text
Tomcat started on port 8080
Started RosaengSangdamsoBackendApplication
```

Stop the server with `Ctrl+C`.

- [ ] **Step 5: Run existing frontend tests**

Run:

```bash
npm test
```

Expected: PASS. The Java backend addition should not break existing JavaScript tests.

- [ ] **Step 6: Run frontend lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 7: Run frontend build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 8: Check whitespace and final status**

Run:

```bash
git diff --check
git status --short
```

Expected:

```text
git diff --check prints no errors
git status --short shows only intended backend/docs/env changes plus any pre-existing unrelated untracked plugin or skill directories
```

- [ ] **Step 9: Commit documentation and verification updates**

Run:

```bash
git add README.md .env.example
git commit -m "docs: add spring backend commands"
```

Expected: one commit with README and environment example updates.
