# Imagem mínima — o servidor não tem dependências externas (Node puro)
FROM node:20-alpine

WORKDIR /app

# Copia backend e frontend
COPY server/ ./server/
COPY public/ ./public/

WORKDIR /app/server

# Porta padrão da aplicação (pode ser sobrescrita por env PORT)
EXPOSE 8787

# As variáveis de ambiente reais (API_SPORTS_KEY etc.) devem ser
# passadas na hora de rodar o container (-e ou --env-file), nunca
# copiadas para dentro da imagem.
CMD ["node", "server.js"]
