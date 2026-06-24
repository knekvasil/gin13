FROM node:26-bookworm-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
COPY shared/package.json shared/
RUN npm ci
COPY . .
RUN npx prisma generate --schema server/prisma/schema.prisma
RUN npm run build -w server
RUN npm run build -w client

FROM node:26-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules node_modules/
COPY --from=builder /app/server/dist server/dist/
COPY --from=builder /app/client/dist client/dist/
COPY --from=builder /app/shared/package.json shared/
COPY --from=builder /app/shared/src shared/src/
ENV NODE_ENV=production
EXPOSE 2567
CMD ["npx", "tsx", "server/dist/src/index.js"]
