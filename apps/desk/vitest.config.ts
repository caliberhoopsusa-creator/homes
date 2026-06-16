import { defineConfig } from "vitest/config";

// The desk's pure logic (dispo, match, buyers-import) is unit-tested here. UI
// components/route handlers are covered by `next build` + typecheck, not Vitest.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
