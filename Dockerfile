FROM node:22-bookworm-slim
WORKDIR /app
COPY --chown=node:node package.json server.mjs agent-map.mjs request-guard.mjs ./
COPY --chown=node:node public ./public
RUN mkdir /data && chown node:node /data
USER node
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8793 DATA_DIR=/data
EXPOSE 8793
VOLUME ["/data"]
CMD ["node", "server.mjs"]
