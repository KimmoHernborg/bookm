FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1
WORKDIR /app
ENV NODE_ENV=production \
	DATABASE_URL=/data/bookm.db \
	DATA_DIR=/data
COPY --from=build /app/.output ./.output
# Migrations run on startup and are read from ./drizzle relative to cwd.
COPY --from=build /app/drizzle ./drizzle
VOLUME /data
EXPOSE 3000
CMD ["bun", ".output/server/index.mjs"]
