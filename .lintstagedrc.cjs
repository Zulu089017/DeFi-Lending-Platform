/** @type {import('lint-staged').Config} */
module.exports = {
  // Frontend TS/TSX: full ESLint + Prettier (next/core-web-vitals handles TS
  // parsing). Frontend JS is prettier-only: the root .eslintrc.json has
  // `ignorePatterns: ["*.js"]`, so passing config files like next.config.js /
  // postcss.config.js to `eslint --max-warnings 0` makes it FAIL on the
  // "File ignored" warning.
  "frontend/**/*.{ts,tsx}": ["prettier --write", "eslint --fix --max-warnings 0"],
  "frontend/**/*.{js,jsx}": ["prettier --write"],
  // Non-frontend TS: prettier only (root .eslintrc.json lacks TS parser)
  "api/**/*.ts": ["prettier --write"],
  "bridge/**/*.ts": ["prettier --write"],
  "relayer/**/*.ts": ["prettier --write"],
  "indexer/**/*.ts": ["prettier --write"],
  "sdk/**/*.ts": ["prettier --write"],
  // Config files
  "*.{json,md,yml,yaml}": ["prettier --write"],
  // Rust — the cargo workspace lives in `stellar-contracts/`, but lint-staged
  // runs from the repo root. Use --manifest-path (plus --all so the
  // workspace packages are formatted) instead of a bare `cargo fmt --`, which
  // failed with "could not find Cargo.toml" in the repo root.
  "*.rs": () => ["cargo fmt --manifest-path stellar-contracts/Cargo.toml --all"],
  // Solidity
  "*.sol": ["prettier --write"],
};
