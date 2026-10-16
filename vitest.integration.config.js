import { defineConfig } from "vitest/config";

// Prueba de integración: el front llama al back REAL (sin mocks).
//   API_BASE_URL  (por defecto http://localhost:8080)
//   MAILPIT_URL   (por defecto http://localhost:8025)  -> de ahí se leen los códigos OTP
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.itest.js"],
    setupFiles: ["tests/integration/setup.js"],
    testTimeout: 60000,
    hookTimeout: 60000,
    fileParallelism: false,
    env: {
      VITE_USE_MOCKS: "false",
      VITE_API_BASE_URL: process.env.API_BASE_URL || "http://localhost:8080",
    },
  },
});
