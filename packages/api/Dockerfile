FROM node:22-slim AS base

ENV PUPPETEER_SKIP_DOWNLOAD=true
WORKDIR /app

FROM base AS deps

COPY package*.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/api/package.json packages/api/package.json
RUN npm ci

FROM deps AS build

COPY packages/shared packages/shared
COPY packages/api packages/api
RUN npm run build --workspace @cleanops/shared \
  && npm run build --workspace @cleanops/api \
  && npm prune --omit=dev

FROM node:22-slim AS runtime

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true
WORKDIR /app

COPY package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/api/package.json ./packages/api/package.json
COPY --from=build /app/packages/api/dist ./packages/api/dist
COPY db/migrations ./db/migrations

EXPOSE 3001

CMD ["node", "packages/api/dist/index.js"]
