FROM node:24-bookworm-slim
WORKDIR /app
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node web ./web
COPY --chown=node:node config ./config
COPY --chown=node:node outputs/evaluation.json ./outputs/evaluation.json
COPY --chown=node:node data/processed/firesense-reconciled.sqlite ./data/processed/firesense-reconciled.sqlite
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8000
USER node
EXPOSE 8000
CMD ["node", "src/server.js"]
