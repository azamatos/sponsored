# The pipeline: Node runs the TypeScript sources directly (type stripping), so there's no build step. Debian slim,
# not Alpine: DuckDB ships prebuilt binaries for glibc only.
FROM node:22-slim
# DuckDB reads Common Crawl over HTTPS with the system's CA certificates (Node brings its own)
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/pipeline/package.json apps/pipeline/
RUN pnpm install --frozen-lockfile --prod --filter @sponsored/pipeline
COPY apps/pipeline apps/pipeline
WORKDIR /app/apps/pipeline
USER node
ENTRYPOINT ["node", "src/cli.ts"]
