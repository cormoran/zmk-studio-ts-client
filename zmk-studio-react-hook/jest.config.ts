import type { JestConfigWithTsJest } from "ts-jest";

const config: JestConfigWithTsJest = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  testMatch: ["**/test/**/*.spec.ts", "**/test/**/*.spec.tsx"],
  collectCoverageFrom: ["<rootDir>/src/**/*.ts", "!<rootDir>/src/index.ts"],
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@zmkfirmware/zmk-studio-ts-client$": "<rootDir>/../lib/index.js",
    "^@zmkfirmware/zmk-studio-ts-client/(.*)$": "<rootDir>/../lib/$1.js",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        diagnostics: false,
        isolatedModules: true,
        tsconfig: {
          jsx: "react",
        },
      },
    ],
  },
};

export default config;
