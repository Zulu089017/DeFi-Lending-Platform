/** @type {import('lint-staged').Config} */
module.exports = {
  "*.{ts,tsx,js,jsx}": ["prettier --write", "eslint --fix --max-warnings 0"],
  "*.{json,md,yml,yaml}": ["prettier --write"],
  "*.rs": ["cargo fmt --"],
  "*.sol": ["prettier --write"],
};
