# Contexto de build: pasta `sistema` (docker compose com `context: .` apontando para aqui).
FROM node:22-bookworm-slim
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci
COPY scripts ./scripts
COPY src ./src
COPY public ./public
COPY next.config.ts tsconfig.json postcss.config.mjs tailwind.config.ts next-env.d.ts ./
COPY data ./data

ENV NEXT_TELEMETRY_DISABLED=1
ARG DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build?schema=public
ENV DATABASE_URL=${DATABASE_URL}
ARG AUTH_SECRET=build-time-secret-at-least-16-chars
ENV AUTH_SECRET=${AUTH_SECRET}

RUN npx prisma generate && npm run build

ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

EXPOSE 3001

CMD ["node", "scripts/docker-entry.cjs"]
