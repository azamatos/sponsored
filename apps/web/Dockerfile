# The site: Nuxt builds a self-contained Node server into .output; the runtime image holds only that.
FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
# The package's postinstall (nuxt prepare) needs the sources; the build below prepares anyway.
RUN pnpm install --frozen-lockfile --filter web --ignore-scripts
COPY apps/web apps/web
# Fonts are downloaded here and served from the site (no request to Google from a visitor's browser).
RUN pnpm --filter web exec nuxt build

FROM node:22-slim
WORKDIR /app
COPY --from=build /app/apps/web/.output ./.output
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
