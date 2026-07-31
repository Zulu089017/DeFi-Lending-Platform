/** @type {import('lint-staged').Config} */
module.exports = {
  // Frontend: full ESLint + Prettier (next/core-web-vitals handles TS parsing)
  "frontend/**/*.{ts,tsx,js,jsx}": ["prettier --write", "eslint --fix --max-warnings 0"],
  // Non-frontend TS: prettier only (root .eslintrc.json lacks TS parser)
  "api/**/*.ts": ["prettier --write"],
  "bridge/**/*.ts": ["prettier --write"],
  "relayer/**/*.ts": ["prettier --write"],
  "indexer/**/*.ts": ["prettier --write"],
  "sdk/**/*.ts": ["prettier --write"],
  // Config files
  "*.{json,md,yml,yaml}": ["prettier --write"],
  // Rust
  "*.rs": ["cargo fmt --"],
  // Solidity
  "*.sol": ["prettier --write"],
};
