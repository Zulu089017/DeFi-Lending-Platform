/** @type {import('lint-staged').Config} */
export default {
  "*.{ts,tsx,js,jsx}": ["prettier --write", "eslint --fix --max-warnings 0"],
  "*.{json,md,yml,yaml}": ["prettier --write"],
  "*.rs": ["cargo fmt --"],
  "*.sol": ["prettier --write"],
};
