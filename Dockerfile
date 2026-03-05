FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci --workspaces
RUN npm run build --workspace=client

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/server ./server
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json .

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/data/pm.db

EXPOSE 3000
VOLUME ["/data"]
CMD ["node", "server/index.js"]
