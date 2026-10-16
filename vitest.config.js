import { defineConfig } from "vitest/config";

// Las pruebas corren SIN mocks: el front llama como si fuera al back real,
// pero un adaptador (tests/helpers/contract.js) lo compara contra el Swagger.
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.js"],
    env: { VITE_USE_MOCKS: "false", VITE_API_BASE_URL: "http://localhost:8080" },
  },
});
