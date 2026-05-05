FROM node:22-alpine AS build

WORKDIR /app/bridge
COPY bridge/package.json ./
RUN npm install
COPY bridge/tsconfig.json bridge/vitest.config.ts ./
COPY bridge/src ./src
RUN npm run build

FROM node:22-alpine

WORKDIR /app/bridge
ENV NODE_ENV=production
ENV CHZZK_TOKEN_STORE=/data/.chzzk-tokens.json

COPY bridge/package.json ./
RUN npm install --omit=dev
COPY --from=build /app/bridge/dist ./dist

CMD ["node", "dist/index.js"]
