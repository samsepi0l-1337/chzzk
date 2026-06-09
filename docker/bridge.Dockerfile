FROM node:22-alpine

WORKDIR /app/bridge
ENV NODE_ENV=production
ENV CHZZK_TOKEN_STORE=/data/.chzzk-tokens.json

COPY bridge/package.json bridge/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY bridge/dist ./dist

RUN mkdir -p /data
VOLUME ["/data"]

CMD ["node", "dist/index.js"]
