package com.example.userservice;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class UserServiceApplication {
  public static void main(String[] args) {
    // Fail fast if JWT_SECRET is not provided — application requires it for security
    String jwtSecret = System.getenv("JWT_SECRET");
    if (jwtSecret == null || jwtSecret.isBlank()) {
      System.err.println("ERROR: environment variable JWT_SECRET is required. Set JWT_SECRET before running the application.");
      System.err.println("Example (PowerShell): $env:JWT_SECRET = 'your_secret_here' ; mvn spring-boot:run");
      System.exit(1);
    }

    SpringApplication.run(UserServiceApplication.class, args);
  }
}


