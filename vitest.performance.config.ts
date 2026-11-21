import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["src/performance/**/*.perf.ts"],
    fileParallelism: false,
    testTimeout: 180000,
  },
});
