import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: { VITALIS_STORE_FILE: "memory" },
    setupFiles: ["tests/setup.ts"],
  },
});
