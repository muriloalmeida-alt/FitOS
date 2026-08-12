# Brasileirão 2026 — Simulador

Simulador do Campeonato Brasileiro Série A 2026: tabela, jogos,
estatísticas e simulação de rodadas, com dados ao vivo opcionais via
[API-Sports](https://www.api-football.com/).

## Estrutura

```
public/                → front-end (servido pelo backend)
server/                → backend Node (proxy + cache da API-Sports)
  ├── .env.example     → modelo das variáveis de ambiente
  └── server.js
deploy/                → arquivos de deploy (systemd, nginx)
Dockerfile / docker-compose.yml → deploy via Docker + Caddy (HTTPS automático)
README-INSTALACAO.md   → guia completo de instalação/deploy
README-API-SPORTS.md   → detalhes da integração com a API-Sports
README-LOGIN.md        → cadastro/login obrigatório, planos e sessão (LEIA — tem um passo obrigatório no Railway)
README-PAGAMENTOS.md   → pagamento por cartão/PIX via Mercado Pago
```

> ⚠️ O site agora exige login pra qualquer acesso (cadastro + escolha
> de plano + pagamento quando aplicável). Isso guarda dados de conta
> num arquivo local que **precisa de um Volume no Railway** pra não se
> perder a cada deploy — detalhes em `README-LOGIN.md`.

## Rodando local

Requisito único: **Node.js 18+**. Sem dependências externas — o backend
usa apenas módulos nativos do Node.

```bash
cd server
cp .env.example .env
# edite .env e cole sua API_SPORTS_KEY (opcional — sem ela, roda em modo de exemplo)
node server.js
```

Abra `http://localhost:8787`.

Veja `README-INSTALACAO.md` para o passo a passo completo de deploy
(VPS + systemd + Nginx, Docker, ou PaaS).
