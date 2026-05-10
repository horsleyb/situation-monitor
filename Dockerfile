# Multi-stage build for Situation Monitor SvelteKit application (adapter-node)

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_FINNHUB_API_KEY
ARG VITE_FRED_API_KEY
ENV VITE_FINNHUB_API_KEY=${VITE_FINNHUB_API_KEY}
ENV VITE_FRED_API_KEY=${VITE_FRED_API_KEY}

RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["node", "build/index.js"]
