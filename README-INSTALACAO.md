# Instalação em servidor — Brasileirão 2026 Simulador

Guia completo pra colocar o site no ar: da máquina local até um
servidor de verdade, com as chaves de API configuradas.

```
brasileirao-2026-simulador/
├── public/                      → front-end (servido pelo backend)
├── server/                      → backend Node (proxy + cache da API-Sports)
│   ├── .env.example             → modelo das variáveis de ambiente
│   └── server.js
├── deploy/
│   ├── brasileirao.service      → systemd (opção A)
│   └── nginx.conf.example       → reverse proxy + HTTPS (opção A/B)
├── Dockerfile                   → opção B (Docker)
├── docker-compose.yml           → opção B (Docker, 1 comando)
├── README-API-SPORTS.md         → detalhes da integração com a API-Sports
└── README-INSTALACAO.md         → este arquivo
```

Requisito único: **Node.js 18 ou superior** no servidor. Não há
`npm install` — o backend usa só módulos nativos do Node.

---

## 1. Rodando local (checagem antes de subir pra produção)

```bash
cd server
cp .env.example .env
# abra o .env e cole sua API_SPORTS_KEY (veja seção 3)
node server.js
```

Abra `http://localhost:8787`. Se aparecer "● Dados de exemplo" no
topo, o site está funcionando mas sem a chave configurada ainda. Se
aparecer "● Ao vivo · API-Sports 2026", a integração está ativa.

---

## 2. Escolha como hospedar

Três caminhos, do mais simples ao mais "produção":

| Opção | Quando usar |
|---|---|
| **A. VPS + systemd + Nginx** | Você tem (ou vai alugar) um servidor Linux próprio — controle total, mais barato a longo prazo |
| **B. Docker** | Você já usa Docker ou quer portabilidade entre serviços de cloud |
| **C. PaaS (Railway / Render / Fly.io)** | Você quer o caminho mais rápido, sem mexer em servidor |

### Opção A — VPS Linux (Ubuntu/Debian) com systemd + Nginx

```bash
# No servidor:
sudo apt update && sudo apt install -y nodejs npm git nginx certbot python3-certbot-nginx

# Envie o projeto pro servidor (git clone, scp, rsync — o que preferir)
sudo mkdir -p /var/www/brasileirao-2026-simulador
# ... copie os arquivos do projeto pra lá ...

cd /var/www/brasileirao-2026-simulador/server
cp .env.example .env
nano .env    # cole sua API_SPORTS_KEY

# Serviço que mantém o site rodando e reinicia sozinho:
sudo cp ../deploy/brasileirao.service /etc/systemd/system/brasileirao.service
# edite User= e WorkingDirectory= no arquivo se o caminho for diferente
sudo systemctl daemon-reload
sudo systemctl enable --now brasileirao
sudo systemctl status brasileirao   # deve mostrar "active (running)"

# Reverse proxy (expõe na porta 80/443 em vez da 8787 crua):
sudo cp ../deploy/nginx.conf.example /etc/nginx/sites-available/brasileirao
sudo nano /etc/nginx/sites-available/brasileirao   # troque "seudominio.com.br"
sudo ln -s /etc/nginx/sites-available/brasileirao /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# HTTPS grátis (Let's Encrypt) — já aponte o DNS do domínio pro IP do servidor antes:
sudo certbot --nginx -d seudominio.com.br -d www.seudominio.com.br
```

Pra atualizar depois de uma mudança no código:
```bash
cd /var/www/brasileirao-2026-simulador
git pull    # ou reenvie os arquivos atualizados
sudo systemctl restart brasileirao
```

### Opção B — Docker

```bash
cp server/.env.example server/.env
nano server/.env    # cole sua API_SPORTS_KEY

docker compose up -d --build
```

Isso builda a imagem e sobe **dois containers**: o app (porta interna
8787, não exposta diretamente) e um **Caddy** na frente cuidando de
HTTPS automático (Let's Encrypt) nas portas 80/443 — sem precisar
mexer em certbot manualmente.

**Antes de subir com domínio próprio:**
1. Aponte o registro DNS tipo A do seu domínio pro IP do servidor.
2. Edite o `Caddyfile` na raiz do projeto e troque `seudominio.com.br`
   pelo seu domínio real.
3. Suba: `docker compose up -d --build`

Acompanhe os logs pra confirmar que o certificado foi emitido:
```bash
docker compose logs -f caddy
```

**Testando sem domínio ainda** (só pelo IP do servidor, sem HTTPS):
comente o bloco do domínio no `Caddyfile` e descomente o bloco `:80`
que já vem pronto lá dentro, depois `docker compose up -d --build`.

**Testando 100% local** (sem Caddy, direto na porta 8787): descomente
as linhas `ports: - "8787:8787"` do serviço `brasileirao` no
`docker-compose.yml` e acesse `http://localhost:8787`.

Atualizar:
```bash
docker compose up -d --build
```

### Opção C — PaaS (Railway, Render, Fly.io etc.)

O passo a passo muda de plataforma pra plataforma, mas o padrão é:

1. Conecte o repositório Git do projeto.
2. Defina o **diretório raiz do serviço** como `server/` (é onde está
   o `package.json` e o `server.js`).
3. **Start command**: `node server.js`
4. **Build command**: nenhum necessário (sem dependências).
5. Configure as variáveis de ambiente no painel da plataforma (não em
   arquivo `.env` — isso é só para uso local): `API_SPORTS_KEY`,
   `LEAGUE_ID`, e deixe a plataforma injetar `PORT` automaticamente
   (a maioria já faz isso; o `server.js` já lê `process.env.PORT`).
6. A plataforma vai te dar uma URL pública com HTTPS pronto — sem
   precisar configurar Nginx/certbot manualmente.

---

## 3. Configurando as chaves de API

### 3.1 API-Sports (obrigatória para dados reais)

1. Crie conta em **dashboard.api-football.com** (plano free = 100
   requisições/dia, sem cartão).
2. Copie a chave gerada no dashboard.
3. No servidor, edite `server/.env` (local) **ou** configure a
   variável de ambiente equivalente no seu provedor de hospedagem:

```env
API_SPORTS_KEY=sua_chave_aqui
LEAGUE_ID=71
PORT=8787
```

4. Confirme se `LEAGUE_ID=71` é mesmo o Brasileirão Série A no seu
   plano — acesse `http://seu-servidor/api/leagues/search?name=Brazil`
   com o servidor já rodando e confira o `id` retornado. Se for
   diferente, ajuste `LEAGUE_ID` e reinicie o serviço.

Sem essa chave, o site funciona normalmente em **modo de exemplo**
(dados fictícios) — nada quebra, mas os dados não são reais.

### 3.2 Links de afiliados das casas de apostas (opcional)

Não é uma "chave de API" — é edição direta de arquivo. Abra
`public/js/affiliates.js` e troque cada `url: "#"` pelo seu link de
afiliado real (obtido no painel de parceiros de cada operadora, após
aprovação no programa dela). Veja a seção 8 do `README-API-SPORTS.md`
para as obrigações legais/publicitárias envolvidas.

Como esse arquivo é servido como estático, basta reiniciar o serviço
depois de editar (`systemctl restart brasileirao`, `docker compose up
-d --build`, ou o redeploy automático da sua PaaS) para as mudanças
valerem.

---

## 4. Segurança — checklist rápido

- [ ] `server/.env` **nunca** vai pro controle de versão (já está no
      `.gitignore`) — em produção, prefira variáveis de ambiente do
      próprio provedor em vez de subir o arquivo `.env` pro servidor.
- [ ] A chave da API-Sports só existe no backend — o navegador do
      usuário nunca a vê (confirme isso abrindo as Ferramentas do
      Desenvolvedor → aba Network → nenhuma chamada deve conter
      `x-apisports-key`; só chamadas para `/api/...` do seu próprio
      domínio devem aparecer).
- [ ] HTTPS ativo em produção (Let's Encrypt via certbot, ou HTTPS
      automático da sua PaaS).
- [ ] Se o tráfego crescer, considere um rate-limit na frente do
      Nginx (`limit_req`) pra proteger contra abuso que consuma sua
      cota da API-Sports.
- [ ] Revise periodicamente a lista de casas de apostas em
      `affiliates.js` — só mantenha operadoras com autorização ativa
      da SPA/Ministério da Fazenda.

---

## 5. Verificação pós-deploy

Depois de subir, confira estes 4 pontos:

1. `https://seudominio.com.br/` carrega o app (topo mostra "Rodada
   —/38" brevemente e depois preenche).
2. `https://seudominio.com.br/api/health` retorna
   `{"ok":true,"hasKey":true,...}` — se `hasKey` estiver `false`, a
   variável de ambiente não chegou até o processo Node.
3. Indicador no topo do app mostra **"● Ao vivo · API-Sports"** (não
   "● Dados de exemplo").
4. Abra um jogo já encerrado na aba "Jogos" — estatísticas e gols
   devem carregar (leva 1–2s na primeira vez, depois fica em cache).
