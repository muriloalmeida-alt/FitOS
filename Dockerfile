FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

ENV PORT=8787
EXPOSE 8787

# Dados locais (usuários, sessões, banco de perguntas) — monte um volume
# aqui em produção, senão tudo some a cada deploy/restart.
VOLUME ["/app/data"]

CMD ["node", "src/server.js"]
