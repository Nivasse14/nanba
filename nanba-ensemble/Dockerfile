FROM node:24.22.1-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY src ./src
COPY public ./public
COPY assets ./assets
COPY migrations ./migrations
COPY scripts ./scripts
COPY docs ./docs
COPY tsconfig.json ./
RUN npm run build && npm prune --omit=dev && mkdir -p /app/data && chown -R node:node /app/data
ENV HOST=0.0.0.0 PORT=3000
EXPOSE 3000
CMD ["sh", "scripts/start-container.sh"]
