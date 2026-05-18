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
