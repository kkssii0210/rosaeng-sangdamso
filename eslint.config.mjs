import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      ".worktrees/**",
      "backend/**",
      "node_modules/**",
    ],
  },
  ...nextVitals,
];

export default eslintConfig;
