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
    public CharacterResponse findCharacter(@PathVariable String name) {
        String trimmedName = name.trim();

        if (trimmedName.isEmpty()) {
            throw new BffException(
                HttpStatus.BAD_REQUEST,
                "INVALID_CHARACTER_NAME",
                "조회할 캐릭터명을 입력해줘."
            );
        }

        return characterService.findCharacter(trimmedName);
    }
}
