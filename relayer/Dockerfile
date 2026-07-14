FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && pnpm install --frozen-lockfile || npm install
COPY . .
RUN npx prisma generate && npx tsc
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
