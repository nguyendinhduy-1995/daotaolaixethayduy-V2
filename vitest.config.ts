import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.spec.ts"],
        exclude: ["tests/e2e/**"],
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            reportsDirectory: "coverage",
            include: ["src/lib/**/*.ts", "src/app/api/**/*.ts"],
            exclude: ["**/*.d.ts", "**/*.test.ts", "**/*.spec.ts"],
            thresholds: {
                lines: 50,
                functions: 50,
                branches: 40,
                statements: 50,
            },
        },
        setupFiles: ["./tests/unit/setup.ts"],
        testTimeout: 10000,
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
});
