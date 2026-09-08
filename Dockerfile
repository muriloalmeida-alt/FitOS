# Imagem do servidor. AJUSTE (notificações push, ver
# server/src/push.js): o backend deixou de ser 100% "Node puro" — ganhou
# sua 1ª dependência externa de verdade ("web-push", pra Web Push/VAPID)
# — então este Dockerfile agora RODA "npm ci" no build (antes não
# rodava nada, só copiava os arquivos). Copia só o package*.json antes
# do resto do código de propósito: o Docker só reroda o "npm ci" (passo
# mais lento) quando uma dependência de verdade muda, não a cada commit
# de código — reaproveita a camada de cache no build seguinte.
FROM node:20-alpine

WORKDIR /app

COPY server/package.json server/package-lock.json ./server/
WORKDIR /app/server
RUN npm ci --omit=dev

WORKDIR /app

# Copia o resto do backend e o frontend (ver .dockerignore — nunca
# inclui node_modules do HOST, só o que o "npm ci" acima instalou
# dentro da própria imagem).
COPY server/ ./server/
COPY public/ ./public/

WORKDIR /app/server

# Porta padrão da aplicação (pode ser sobrescrita por env PORT)
EXPOSE 8787

# As variáveis de ambiente reais (API_SPORTS_KEY etc.) devem ser
# passadas na hora de rodar o container (-e ou --env-file), nunca
# copiadas para dentro da imagem.
CMD ["node", "server.js"]
