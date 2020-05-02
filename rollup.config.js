import typescript from "@rollup/plugin-typescript";
import packageInfo from "./package.json";

export default {
  input: "src/subscription-link.ts",
  output: [
    {
      file: packageInfo.main,
      format: "cjs",
    },
    {
      file: packageInfo.module,
      format: "es",
    },
    {
      file: packageInfo.browser,
      format: "iife",
      name: "ApolloLighthouseSubscriptionLink",
      globals: {
        "apollo-link": "ApolloLink",
      },
    },
  ],
  external: ["apollo-link"],
  plugins: [typescript()],
};
