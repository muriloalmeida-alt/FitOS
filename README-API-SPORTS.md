# Integração com a API-Sports (api-football v3)

Este projeto agora tem duas partes:

```
brasileirao-2026-simulador/
├── public/          → front-end (o site em si — HTML/CSS/JS puro)
└── server/          → backend (proxy + cache da API-Sports)
```

O **front-end sozinho não fala com a API-Sports** — ele fala com o seu
próprio backend (`/api/...`), e é o backend que conversa com a
API-Sports usando sua chave secreta. Isso é proposital: a chave nunca
fica exposta no navegador do usuário, e o cache evita estourar sua
cota diária de requisições.

Se o backend não tiver uma chave configurada (ou a API-Sports falhar
por qualquer motivo), o site cai automaticamente no **modo de
exemplo** — os dados fictícios que você já viu na primeira versão.
Nada quebra.

---

## 1. Como rodar

```bash
cd server
cp .env.example .env
# edite o .env e cole sua API_SPORTS_KEY
node server.js
```

Abra `http://localhost:8787`. Não precisa de `npm install` — o
backend usa só módulos nativos do Node 18+ (fetch, http, fs). Se
preferir, `npm start` faz a mesma coisa.

## 2. Onde conseguir a chave

1. Crie uma conta em **dashboard.api-football.com** (ou api-sports.io)
2. O plano free libera **100 requisições/dia**, sem cartão de crédito
3. Copie a chave gerada no dashboard para `API_SPORTS_KEY` no `.env`

## 3. Confirme o ID da liga

O `.env.example` já vem com `LEAGUE_ID=71`, que é o valor mais citado
para o Brasileirão Série A nessa API — **mas confirme no seu plano**,
porque a cobertura de ligas varia. Com o servidor rodando:

```
GET http://localhost:8787/api/leagues/search?name=Brazil
```

Isso devolve todos os campeonatos brasileiros disponíveis pra sua
chave, com o `id` de cada um. Achou o Brasileirão Série A com um ID
diferente de 71? Só trocar `LEAGUE_ID` no `.env` e reiniciar.

## 4. Endpoints que o backend expõe

| Rota | O que faz | Cache |
|---|---|---|
| `GET /api/health` | status: tem chave? qual liga? cota restante | — |
| `GET /api/leagues/search?name=` | busca ligas por nome | 24h |
| `GET /api/teams?season=2026` | elenco de times da temporada | 12h |
| `GET /api/standings?season=2026` | tabela de classificação atual | 15min |
| `GET /api/fixtures?season=2026` | **todos** os jogos da temporada (passados e futuros) em 1 chamada | 15min |
| `GET /api/fixtures/:id/statistics?home=&away=` | posse, finalizações, escanteios, cartões de 1 jogo | 7 dias |
| `GET /api/fixtures/:id/events` | gols (minuto + jogador) de 1 jogo | 7 dias |
| `GET /api/fixtures/:id/odds` | odds 1X2 (casa/empate/fora) de 1 jogo ainda não realizado | 10min |

O front-end busca `teams` + `standings` + `fixtures` (3 chamadas) ao
carregar a página — isso já monta a temporada inteira. As
estatísticas e gols de cada partida (`statistics`/`events`) só são
buscadas **sob demanda**, quando você abre aquela rodada na aba
"Jogos" — evita gastar sua cota com jogos que ninguém olhou.

## 5. Como os dados são usados

- **Times**: nome, escudo (logo real) e sigla vêm direto da API.
- **Força de ataque/defesa** de cada time (usada no simulador Monte
  Carlo) é **calculada** a partir da tabela real — gols marcados e
  sofridos por jogo, normalizados pela média da liga. Não existe
  endpoint de "probabilidade de título" na API-Sports; isso continua
  sendo o motor de simulação que você já tinha (`engine.js`),
  agora alimentado com números reais.
- **Calendário**: todas as 38 rodadas vêm prontas da API (`/fixtures`
  sem filtro de rodada retorna a temporada inteira). Jogos com
  `status = FT/AET/PEN` entram como decididos; o resto fica disponível
  pra você simular na aba "Simulador".
- **Links de gols/melhores momentos**: a API-Sports **não fornece
  vídeos**. O site continua gerando um link de busca do YouTube com o
  placar e os times — é um link real e funcional, só não é um vídeo
  específico verificado.

## 6. Limites a ter em mente

- Plano free = 100 requisições/dia. Times + tabela + calendário = 3
  chamadas por carregamento "frio" (depois fica em cache). Cada
  partida que você abre em "Jogos" consome 2 chamadas (stats + gols)
  na primeira vez — depois fica em cache por 7 dias.
- Times/tabela/calendário são cacheados no servidor (memória) — reiniciar
  o processo limpa o cache.
- Deploy: como é Node puro sem dependências, roda em qualquer host que
  suporte Node 18+ (Railway, Render, Fly.io, VPS comum). Lembre de
  configurar `API_SPORTS_KEY` como variável de ambiente na plataforma,
  não como arquivo `.env` commitado.

## 7. Troubleshooting rápido

- **Site cai no modo de exemplo mesmo com chave configurada**: veja o
  console do servidor (`node server.js`) — ele loga o erro real da
  API-Sports (chave inválida, liga/temporada sem dados, cota
  estourada, etc).
- **`/api/fixtures` retorna vazio**: confira se `LEAGUE_ID` e a
  temporada (`season`) realmente têm dados nesse plano — nem todo
  plano free cobre todas as temporadas/ligas.
- **Cota estourada (429)**: espere o reset (00:00 UTC) ou aumente os
  valores de `TTL` em `server/server.js`.

---

## 8. Odds e monetização por afiliados

O card de cada jogo ainda não realizado ganhou um bloco "Odds & onde
apostar" com:

- **Odds 1X2** (casa/empate/fora) puxadas da API-Sports (`/odds`),
  quando a sua liga/plano tiver cobertura de odds — confirme isso no
  campo `coverage.odds` da liga (endpoint `/leagues`). Muitos planos
  free **não** incluem odds para todas as competições; se não vier
  nada, o card mostra "odds não disponíveis" e mesmo assim exibe os
  botões das casas de apostas.
- **Botões de afiliados** das principais casas autorizadas pela
  SPA/Ministério da Fazenda: bet365, Betano, KTO, Superbet,
  Betnacional e Sportingbet.

### Como ativar de verdade (isso eu não posso fazer por você)

Edite **`public/js/affiliates.js`**: cada operadora tem um campo
`url: "#"` — troque pelo **seu link de afiliado real**, obtido no
painel de parceiros de cada uma, depois que sua inscrição no
programa for aprovada. Enquanto estiver `"#"`, o botão some destacado
como desabilitado. Isso não é algo que eu (Claude) consigo gerar por
você — é um cadastro que você faz diretamente com cada operadora.

### Obrigações legais/publicitárias (Brasil)

Isso já está implementado no card, mas é importante você não remover
ao customizar:

- Aviso de **conteúdo publicitário** visível.
- Aviso de **proibido para menores de 18 anos** e **jogue com
  responsabilidade / aposta não é investimento**.
- Link para a **Plataforma Centralizada de Autoexclusão** do governo
  federal (`gov.br/autoexclusaoapostas`).
- Só promova operadoras com **autorização ativa da SPA/MF** — a lista
  de autorizadas muda com frequência, então revise periodicamente
  antes de publicar (busque "lista de bets autorizadas" no site do
  Ministério da Fazenda ou consulte o SIGAP).

Se o seu site tiver tráfego relevante, vale também revisar as regras
de publicidade de apostas do CONAR antes de publicar em produção.

