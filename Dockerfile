# Imagem do transporte HTTP (mcp.atray.app). O uso stdio (Claude Desktop/Code) continua
# sendo o pacote npm @atray/mcp - não precisa de container.
FROM node:24-alpine

RUN apk add --no-cache wget

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

ARG GIT_SHA=unknown
ARG BUILD_AT=unknown
ENV GIT_SHA=$GIT_SHA BUILD_AT=$BUILD_AT

ENV NODE_ENV=production
EXPOSE 3002

CMD ["node", "src/http.js"]
