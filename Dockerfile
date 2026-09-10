# syntax=docker/dockerfile:1
# Imagem do transporte HTTP (mcp.atray.app). O uso stdio (Claude Desktop/Code) continua
# sendo o pacote npm @atray/mcp - não precisa de container.
FROM node:24-alpine

WORKDIR /app

# Cache do npm preservado entre builds frios (mesmo motivo do hooks).
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

COPY src ./src

ARG GIT_SHA=unknown
ARG BUILD_AT=unknown
ENV GIT_SHA=$GIT_SHA BUILD_AT=$BUILD_AT

ENV NODE_ENV=production
EXPOSE 3002

# T-616: roda como usuário não-root. Dá para fazer aqui e não na api/hooks porque este
# container não escreve em disco nem monta volume - só fala HTTP com a api. O usuário `node`
# já vem na imagem oficial; os arquivos de /app ficam de root, e o processo só os lê.
USER node

CMD ["node", "src/http.js"]
