/* ===================================================================
   DATA.JS — Dados de exemplo do Brasileirão 2026
   -------------------------------------------------------------------
   Este arquivo concentra TODOS os dados "mockados" do protótipo.
   Para ligar o site a dados reais, basta substituir:
     - TEAMS        -> times, força de ataque/defesa e cores
     - (opcional)   -> trocar o gerador de tabela/rodadas por uma
                        chamada fetch() para sua API de resultados
   O motor de simulação (engine.js) não precisa mudar.
=================================================================== */

// RNG determinístico (mulberry32) — garante que o "primeiro turno"
// gerado seja sempre o mesmo a cada carregamento da página.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Amostra de distribuição de Poisson (número de gols de um time)
function poissonSample(lambda, rng) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= rng(); } while (p > L);
  return k - 1;
}

/* 20 clubes de exemplo — nomes reais do futebol brasileiro, mas
   força de ataque/defesa e posição na tabela são FICTÍCIAS,
   usadas apenas quando não há integração com a API-Sports ativa.
   Em modo "ao vivo" (ver js/liveData.js), este array é substituído
   pelos times e força real calculados a partir da tabela atual. */
// venue = estádio-sede real de cada clube (dado público estável — não
// é estatística fictícia, só contexto de local do jogo).
//
// AJUSTE (pedido do usuário: "Esse esquema das cores é muito
// importante pois envolve a paixão dos torcedores") — c1/c2 sempre
// existiram (degradê de 2 cores no escudo/hero/card "Clube Favorito"/
// disco do "jogo de botão", ver teamGradientStops em app.js), mas
// clube TRICOLOR de verdade (São Paulo, Bahia, Grêmio, Fortaleza,
// Bragantino) precisava forçar 1 das 3 cores reais de fora pra caber
// no degradê de 2 pontas. c3 (opcional -- só esses 5 têm) faz o
// degradê ganhar a 3ª cor de verdade em vez de descartar uma; ordem
// de c1/c2/c3 bate com a ordem de prioridade que o usuário deu pra
// cada um (ex.: Bahia é "azul primeiro", Fortaleza é "vermelho
// primeiro" -- mesmas 2 cores principais, ordem diferente, times
// diferentes).
const DEMO_TEAMS = [
  { id: "fla", name: "Flamengo",             short: "FLA", uf: "RJ", c1: "#E30613", c2: "#1A1A1A", atk: 1.85, def: 0.78, venue: { name: "Maracanã", city: "Rio de Janeiro" } },
  { id: "pal", name: "Palmeiras",             short: "PAL", uf: "SP", c1: "#0B6E33", c2: "#F5F5F5", atk: 1.80, def: 0.75, venue: { name: "Allianz Parque", city: "São Paulo" } },
  { id: "bot", name: "Botafogo",              short: "BOT", uf: "RJ", c1: "#1A1A1A", c2: "#FFFFFF", atk: 1.72, def: 0.82, venue: { name: "Nilton Santos", city: "Rio de Janeiro" } },
  { id: "for", name: "Fortaleza",             short: "FOR", uf: "CE", c1: "#DC2626", c2: "#FFFFFF", c3: "#1E3A8A", atk: 1.55, def: 0.92, venue: { name: "Arena Castelão", city: "Fortaleza" } },
  { id: "int", name: "Internacional",         short: "INT", uf: "RS", c1: "#C8102E", c2: "#FFFFFF", atk: 1.60, def: 0.90, venue: { name: "Beira-Rio", city: "Porto Alegre" } },
  { id: "sao", name: "São Paulo",             short: "SAO", uf: "SP", c1: "#C8102E", c2: "#FFFFFF", c3: "#1A1A1A", atk: 1.58, def: 0.88, venue: { name: "Morumbis", city: "São Paulo" } },
  { id: "cor", name: "Corinthians",           short: "COR", uf: "SP", c1: "#1A1A1A", c2: "#FFFFFF", atk: 1.50, def: 0.95, venue: { name: "Neo Química Arena", city: "São Paulo" } },
  { id: "gre", name: "Grêmio",                short: "GRE", uf: "RS", c1: "#1E90CE", c2: "#FFFFFF", c3: "#1A1A1A", atk: 1.48, def: 0.97, venue: { name: "Arena do Grêmio", city: "Porto Alegre" } },
  // AJUSTE (pedido do usuário: "Athletico e Flamengo devem ter as
  // mesmas cores. Baseie-se no Flamengo") -- c1 alinhado com o
  // vermelho exato do Flamengo (#E30613, antes era #C8102E -- um
  // vermelho parecido mas não igual).
  //
  // BUG CORRIGIDO (pedido do usuário: "O vermelho do Athletico está
  // ruim" -- dessa vez em modo AO VIVO, não no hero): o card de Clube
  // Favorito apareceu VERDE pro Athletico com dado real. Causa: em
  // modo ao vivo, realTeamColor() (ver liveData.js) casa o time pelo
  // NOME que vem do fornecedor de dado (t.name, sem tradução nenhuma
  // -- ver mapTeam em adapter.js), e a API-Sports manda esse clube
  // como "Athletico PR" (nome curto, com espaço, sem "Paranaense"),
  // não "Athletico Paranaense" como aqui. Sem bater o nome, caía pro
  // hash antigo (colorForId) -- daí a cor errada (verde, sem relação
  // nenhuma com o clube). `aliases` guarda variações de nome já
  // confirmadas vindas de fornecedor de dado real, pra realTeamColor()
  // também considerar (ver liveData.js) -- só entrou aqui a que já foi
  // reportada/confirmada; se outro clube aparecer com cor errada em
  // modo ao vivo, é o mesmo bug -- descobre o nome real (log do
  // navegador ou rede) e soma um alias novo aqui.
  { id: "cap", name: "Athletico Paranaense",  short: "CAP", uf: "PR", aliases: ["Athletico PR", "Athletico-PR"], c1: "#E30613", c2: "#1A1A1A", atk: 1.52, def: 0.94, venue: { name: "Ligga Arena", city: "Curitiba" } },
  { id: "cru", name: "Cruzeiro",              short: "CRU", uf: "MG", c1: "#003399", c2: "#FFFFFF", atk: 1.46, def: 0.98, venue: { name: "Mineirão", city: "Belo Horizonte" } },
  { id: "cam", name: "Atlético-MG",           short: "CAM", uf: "MG", c1: "#1A1A1A", c2: "#FFFFFF", atk: 1.51, def: 0.99, venue: { name: "Arena MRV", city: "Belo Horizonte" } },
  { id: "bah", name: "Bahia",                 short: "BAH", uf: "BA", c1: "#1E3A8A", c2: "#FFFFFF", c3: "#DC2626", atk: 1.44, def: 1.02, venue: { name: "Arena Fonte Nova", city: "Salvador" } },
  // "Vasco" sozinho (sem "da Gama") é um apelido comum o bastante em
  // fornecedor de dado real pra valer a pena já cobrir de antemão.
  { id: "vas", name: "Vasco da Gama",         short: "VAS", uf: "RJ", aliases: ["Vasco"], c1: "#1A1A1A", c2: "#FFFFFF", atk: 1.40, def: 1.05, venue: { name: "São Januário", city: "Rio de Janeiro" } },
  { id: "flu", name: "Fluminense",            short: "FLU", uf: "RJ", c1: "#8A2432", c2: "#1E7A3D", atk: 1.38, def: 1.08, venue: { name: "Maracanã", city: "Rio de Janeiro" } },
  { id: "san", name: "Santos",                short: "SAN", uf: "SP", c1: "#1A1A1A", c2: "#FFFFFF", atk: 1.35, def: 1.10, venue: { name: "Vila Belmiro", city: "Santos" } },
  // Bragantino mudou de nome oficial pra "Red Bull Bragantino" --
  // fornecedor de dado real tende a usar o nome oficial ou "RB
  // Bragantino", não o apelido curto que o app usa aqui.
  { id: "bra", name: "Bragantino",            short: "BRA", uf: "SP", aliases: ["Red Bull Bragantino", "RB Bragantino"], c1: "#DC2626", c2: "#FFC93C", c3: "#1A1A1A", atk: 1.33, def: 1.12, venue: { name: "Nabi Abi Chedid", city: "Bragança Paulista" } },
  { id: "vit", name: "Vitória",               short: "VIT", uf: "BA", c1: "#DC2626", c2: "#1A1A1A", atk: 1.20, def: 1.22, venue: { name: "Barradão", city: "Salvador" } },
  { id: "juv", name: "Juventude",             short: "JUV", uf: "RS", c1: "#1E7A3D", c2: "#FFFFFF", atk: 1.15, def: 1.28, venue: { name: "Alfredo Jaconi", city: "Caxias do Sul" } },
  { id: "mir", name: "Mirassol",              short: "MIR", uf: "SP", c1: "#FFC93C", c2: "#1E7A3D", atk: 1.10, def: 1.30, venue: { name: "Campos Maia", city: "Mirassol" } },
  // BUG CORRIGIDO (pedido do usuário: cor de time é identidade, não é
  // detalhe -- "envolve a paixão dos torcedores"): estava azul/dourado
  // (#1E3A8A/#FFC93C), sem nenhuma relação com o apelido do clube
  // ("Dourado") nem com a cor de verdade (verde/dourado). Corrigido
  // pra bater com a entrada já certa de Cuiabá em DEMO_TEAMS_SERIE_B
  // logo abaixo (mesmo clube, competição diferente -- tinha ficado
  // inconsistente entre as 2 listas).
  { id: "cui", name: "Cuiabá",                short: "CUI", uf: "MT", c1: "#00A650", c2: "#FFC72C", atk: 1.08, def: 1.32, venue: { name: "Arena Pantanal", city: "Cuiabá" } },
];

/* 20 clubes de exemplo da Premier League (Inglaterra) — nomes reais,
   estádios reais (dado público estável). Força de ataque/defesa é
   FICTÍCIA, só pra alimentar o motor de simulação em modo exemplo —
   ver mesmo aviso em DEMO_TEAMS acima. Plano Pro/Enterprise (ver
   server/src/competitions.js) — "em breve" até a API-Sports real
   estar ativada; até lá, esse é o dado que aparece no modo exemplo. */
const DEMO_TEAMS_PREMIER_LEAGUE = [
  { id: "mci", name: "Manchester City",       short: "MCI", c1: "#6CABDD", c2: "#1C2C5B", atk: 1.82, def: 0.80, venue: { name: "Etihad Stadium", city: "Manchester" } },
  { id: "ars", name: "Arsenal",               short: "ARS", c1: "#EF0107", c2: "#FFFFFF", atk: 1.78, def: 0.76, venue: { name: "Emirates Stadium", city: "Londres" } },
  { id: "liv", name: "Liverpool",             short: "LIV", c1: "#C8102E", c2: "#F6EB61", atk: 1.80, def: 0.79, venue: { name: "Anfield", city: "Liverpool" } },
  { id: "che", name: "Chelsea",               short: "CHE", c1: "#034694", c2: "#FFFFFF", atk: 1.60, def: 0.92, venue: { name: "Stamford Bridge", city: "Londres" } },
  { id: "mun", name: "Manchester United",     short: "MUN", c1: "#DA291C", c2: "#FBE122", atk: 1.55, def: 0.95, venue: { name: "Old Trafford", city: "Manchester" } },
  { id: "tot", name: "Tottenham Hotspur",     short: "TOT", c1: "#132257", c2: "#FFFFFF", atk: 1.58, def: 1.00, venue: { name: "Tottenham Hotspur Stadium", city: "Londres" } },
  { id: "new", name: "Newcastle United",      short: "NEW", c1: "#241F20", c2: "#FFFFFF", atk: 1.52, def: 0.93, venue: { name: "St James' Park", city: "Newcastle" } },
  { id: "avl", name: "Aston Villa",           short: "AVL", c1: "#670E36", c2: "#95BFE5", atk: 1.50, def: 0.97, venue: { name: "Villa Park", city: "Birmingham" } },
  { id: "bha", name: "Brighton & Hove Albion",short: "BHA", c1: "#0057B8", c2: "#FFCD00", atk: 1.40, def: 1.03, venue: { name: "Amex Stadium", city: "Brighton" } },
  { id: "whu", name: "West Ham United",       short: "WHU", c1: "#7A263A", c2: "#1BB1E7", atk: 1.35, def: 1.08, venue: { name: "London Stadium", city: "Londres" } },
  { id: "cry", name: "Crystal Palace",        short: "CRY", c1: "#1B458F", c2: "#C4122E", atk: 1.32, def: 1.05, venue: { name: "Selhurst Park", city: "Londres" } },
  { id: "ful", name: "Fulham",                short: "FUL", c1: "#000000", c2: "#FFFFFF", atk: 1.30, def: 1.10, venue: { name: "Craven Cottage", city: "Londres" } },
  { id: "bre", name: "Brentford",             short: "BRE", c1: "#E30613", c2: "#FFFFFF", atk: 1.34, def: 1.12, venue: { name: "Gtech Community Stadium", city: "Londres" } },
  { id: "wol", name: "Wolverhampton",         short: "WOL", c1: "#FDB913", c2: "#231F20", atk: 1.28, def: 1.15, venue: { name: "Molineux Stadium", city: "Wolverhampton" } },
  { id: "eve", name: "Everton",               short: "EVE", c1: "#003399", c2: "#FFFFFF", atk: 1.18, def: 1.10, venue: { name: "Goodison Park", city: "Liverpool" } },
  { id: "nfo", name: "Nottingham Forest",     short: "NFO", c1: "#DD0000", c2: "#FFFFFF", atk: 1.25, def: 1.06, venue: { name: "City Ground", city: "Nottingham" } },
  { id: "bou", name: "Bournemouth",           short: "BOU", c1: "#DA291C", c2: "#000000", atk: 1.22, def: 1.14, venue: { name: "Vitality Stadium", city: "Bournemouth" } },
  { id: "lei", name: "Leicester City",        short: "LEI", c1: "#003090", c2: "#FDBE11", atk: 1.10, def: 1.28, venue: { name: "King Power Stadium", city: "Leicester" } },
  { id: "ips", name: "Ipswich Town",          short: "IPS", c1: "#0044A9", c2: "#FFFFFF", atk: 1.08, def: 1.30, venue: { name: "Portman Road", city: "Ipswich" } },
  { id: "sou", name: "Southampton",           short: "SOU", c1: "#D71920", c2: "#FFFFFF", atk: 1.05, def: 1.33, venue: { name: "St Mary's Stadium", city: "Southampton" } },
];

/* 20 clubes de exemplo da La Liga (Espanha) — mesmo modelo/aviso
   acima. */
const DEMO_TEAMS_LA_LIGA = [
  { id: "rma", name: "Real Madrid",       short: "RMA", c1: "#FFFFFF", c2: "#FEBE10", atk: 1.88, def: 0.74, venue: { name: "Santiago Bernabéu", city: "Madrid" } },
  { id: "fcb", name: "Barcelona",         short: "FCB", c1: "#A50044", c2: "#004D98", atk: 1.86, def: 0.77, venue: { name: "Spotify Camp Nou", city: "Barcelona" } },
  { id: "atm", name: "Atlético de Madrid",short: "ATM", c1: "#CB3524", c2: "#272E61", atk: 1.62, def: 0.85, venue: { name: "Cívitas Metropolitano", city: "Madrid" } },
  { id: "ath", name: "Athletic Bilbao",   short: "ATH", c1: "#EE2523", c2: "#FFFFFF", atk: 1.50, def: 0.96, venue: { name: "San Mamés", city: "Bilbao" } },
  { id: "rso", name: "Real Sociedad",     short: "RSO", c1: "#0067B1", c2: "#FFFFFF", atk: 1.42, def: 1.00, venue: { name: "Reale Arena", city: "San Sebastián" } },
  { id: "bet", name: "Real Betis",        short: "BET", c1: "#00954C", c2: "#FFFFFF", atk: 1.40, def: 1.02, venue: { name: "Benito Villamarín", city: "Sevilha" } },
  { id: "vil", name: "Villarreal",        short: "VIL", c1: "#FFE667", c2: "#005187", atk: 1.44, def: 1.05, venue: { name: "Estadio de la Cerámica", city: "Villarreal" } },
  { id: "val", name: "Valencia",          short: "VAL", c1: "#FF8000", c2: "#000000", atk: 1.30, def: 1.10, venue: { name: "Mestalla", city: "Valência" } },
  { id: "sev", name: "Sevilla",           short: "SEV", c1: "#D00027", c2: "#FFFFFF", atk: 1.28, def: 1.14, venue: { name: "Ramón Sánchez-Pizjuán", city: "Sevilha" } },
  { id: "gir", name: "Girona",            short: "GIR", c1: "#CB1731", c2: "#FFFFFF", atk: 1.35, def: 1.08, venue: { name: "Montilivi", city: "Girona" } },
  { id: "cel", name: "Celta de Vigo",     short: "CEL", c1: "#8AC3EE", c2: "#FFFFFF", atk: 1.26, def: 1.16, venue: { name: "Balaídos", city: "Vigo" } },
  { id: "osa", name: "Osasuna",           short: "OSA", c1: "#D2122E", c2: "#001A4B", atk: 1.20, def: 1.12, venue: { name: "El Sadar", city: "Pamplona" } },
  { id: "ray", name: "Rayo Vallecano",    short: "RAY", c1: "#E52620", c2: "#FFFFFF", atk: 1.18, def: 1.15, venue: { name: "Vallecas", city: "Madrid" } },
  { id: "get", name: "Getafe",            short: "GET", c1: "#005CA9", c2: "#FFFFFF", atk: 1.05, def: 1.10, venue: { name: "Coliseum", city: "Getafe" } },
  { id: "mal", name: "Mallorca",          short: "MAL", c1: "#C00000", c2: "#000000", atk: 1.12, def: 1.20, venue: { name: "Son Moix", city: "Palma" } },
  { id: "alv", name: "Alavés",            short: "ALV", c1: "#0047AB", c2: "#FFFFFF", atk: 1.08, def: 1.22, venue: { name: "Mendizorrotza", city: "Vitoria-Gasteiz" } },
  { id: "lpa", name: "Las Palmas",        short: "LPA", c1: "#FFE100", c2: "#0056A8", atk: 1.10, def: 1.26, venue: { name: "Estadio de Gran Canaria", city: "Las Palmas" } },
  { id: "esp", name: "Espanyol",          short: "ESP", c1: "#0080C8", c2: "#FFFFFF", atk: 1.06, def: 1.28, venue: { name: "RCDE Stadium", city: "Barcelona" } },
  { id: "leg", name: "Leganés",           short: "LEG", c1: "#00284D", c2: "#FFFFFF", atk: 1.02, def: 1.30, venue: { name: "Butarque", city: "Leganés" } },
  { id: "vll", name: "Real Valladolid",   short: "VLL", c1: "#663399", c2: "#FFFFFF", atk: 1.00, def: 1.33, venue: { name: "José Zorrilla", city: "Valladolid" } },
];

/* 20 clubes de exemplo da Série B 2025 (Brasil) — nomes reais,
   estádios reais (dado público estável). Força de ataque/defesa é
   FICTÍCIA, só pra alimentar o motor de simulação em modo exemplo —
   ver mesmo aviso em DEMO_TEAMS acima. Plano Pro/Enterprise (ver
   server/src/competitions.js) — "em breve" até o id da liga na
   Sportmonks ser configurado (SPORTMONKS_LEAGUE_ID_SERIE_B); até lá,
   esse é o dado que aparece no modo exemplo. Ids diferentes dos usados
   em DEMO_TEAMS (Série A) mesmo pros 2 clubes em comum (Cuiabá,
   Athletico Paranaense) — cada competição tem seu próprio "elenco" de
   ids, não compartilha com as outras. */
const DEMO_TEAMS_SERIE_B = [
  // AJUSTE: mesmo motivo da entrada de Athletico em DEMO_TEAMS (Série
  // A) -- ver comentário lá.
  { id: "atp", name: "Athletico Paranaense", short: "CAP", uf: "PR", aliases: ["Athletico PR", "Athletico-PR"], c1: "#E30613", c2: "#1A1A1A", atk: 1.55, def: 0.85, venue: { name: "Arena da Baixada", city: "Curitiba" } },
  { id: "cta", name: "Coritiba",             short: "CTA", uf: "PR", c1: "#0B6E33", c2: "#FFFFFF", atk: 1.50, def: 0.88, venue: { name: "Couto Pereira", city: "Curitiba" } },
  { id: "cha", name: "Chapecoense",          short: "CHA", uf: "SC", c1: "#1E7A3D", c2: "#FFFFFF", atk: 1.46, def: 0.90, venue: { name: "Arena Condá", city: "Chapecó" } },
  { id: "rem", name: "Remo",                 short: "REM", uf: "PA", c1: "#003DA5", c2: "#FFFFFF", atk: 1.44, def: 0.92, venue: { name: "Baenão", city: "Belém" } },
  { id: "goi", name: "Goiás",                short: "GOI", uf: "GO", c1: "#0B6E33", c2: "#FFFFFF", atk: 1.42, def: 0.94, venue: { name: "Hailé Pinheiro", city: "Goiânia" } },
  { id: "ava", name: "Avaí",                 short: "AVA", uf: "SC", c1: "#0057B8", c2: "#FFFFFF", atk: 1.38, def: 0.96, venue: { name: "Ressacada", city: "Florianópolis" } },
  { id: "cri", name: "Criciúma",             short: "CRI", uf: "SC", c1: "#1A1A1A", c2: "#FFFFFF", atk: 1.36, def: 0.98, venue: { name: "Heriberto Hülse", city: "Criciúma" } },
  { id: "vno", name: "Vila Nova",            short: "VNO", uf: "GO", c1: "#C8102E", c2: "#1A1A1A", atk: 1.34, def: 1.00, venue: { name: "Serra Dourada", city: "Goiânia" } },
  { id: "cub", name: "Cuiabá",               short: "CUI", uf: "MT", c1: "#00A650", c2: "#FFC72C", atk: 1.32, def: 1.02, venue: { name: "Arena Pantanal", city: "Cuiabá" } },
  { id: "acg", name: "Atlético Goianiense",  short: "ACG", uf: "GO", c1: "#C8102E", c2: "#1A1A1A", atk: 1.30, def: 1.04, venue: { name: "Antônio Accioly", city: "Goiânia" } },
  { id: "ame", name: "América Mineiro",      short: "AME", uf: "MG", c1: "#1E7A3D", c2: "#FFFFFF", atk: 1.28, def: 1.06, venue: { name: "Independência", city: "Belo Horizonte" } },
  { id: "crb", name: "CRB",                  short: "CRB", uf: "AL", c1: "#DC2626", c2: "#1A1A1A", atk: 1.26, def: 1.08, venue: { name: "Rei Pelé", city: "Maceió" } },
  { id: "nvz", name: "Novorizontino",        short: "NOV", uf: "SP", c1: "#DC2626", c2: "#1A1A1A", atk: 1.24, def: 1.10, venue: { name: "Jorge Ismael de Biasi", city: "Novo Horizonte" } },
  { id: "ope", name: "Operário-PR",          short: "OPE", uf: "PR", c1: "#1E7A3D", c2: "#FFFFFF", atk: 1.22, def: 1.12, venue: { name: "Germano Krüger", city: "Ponta Grossa" } },
  { id: "amz", name: "Amazonas",             short: "AMZ", uf: "AM", c1: "#1E3A8A", c2: "#DC2626", atk: 1.20, def: 1.14, venue: { name: "Arena da Amazônia", city: "Manaus" } },
  { id: "pay", name: "Paysandu",             short: "PAY", uf: "PA", c1: "#003DA5", c2: "#FFFFFF", atk: 1.18, def: 1.16, venue: { name: "Curuzu", city: "Belém" } },
  { id: "bsp", name: "Botafogo-SP",          short: "BSP", uf: "SP", c1: "#DC2626", c2: "#FFFFFF", atk: 1.16, def: 1.18, venue: { name: "Santa Cruz", city: "Ribeirão Preto" } },
  { id: "atc", name: "Athletic Club",        short: "ATH", uf: "MG", c1: "#1A1A1A", c2: "#FFFFFF", atk: 1.14, def: 1.20, venue: { name: "Antônio Guimarães de Almeida", city: "São João del-Rei" } },
  { id: "vre", name: "Volta Redonda",        short: "VOL", uf: "RJ", c1: "#FFC93C", c2: "#1A1A1A", atk: 1.12, def: 1.22, venue: { name: "Raulino de Oliveira", city: "Volta Redonda" } },
  { id: "frv", name: "Ferroviária",          short: "FER", uf: "SP", c1: "#DC2626", c2: "#FFFFFF", atk: 1.10, def: 1.24, venue: { name: "Fonte Luminosa", city: "Araraquara" } },
];

/* 20 clubes de exemplo da Série C 2025 (Brasil) — mesmo modelo/aviso
   acima. Plano Pro/Enterprise, "em breve" até
   SPORTMONKS_LEAGUE_ID_SERIE_C ser configurado. */
const DEMO_TEAMS_SERIE_C = [
  { id: "nau", name: "Náutico",         short: "NAU", uf: "PE", c1: "#DC2626", c2: "#FFFFFF", atk: 1.42, def: 0.90, venue: { name: "Aflitos", city: "Recife" } },
  { id: "csa", name: "CSA",             short: "CSA", uf: "AL", c1: "#003DA5", c2: "#FFFFFF", atk: 1.38, def: 0.93, venue: { name: "Rei Pelé", city: "Maceió" } },
  { id: "pon", name: "Ponte Preta",     short: "PON", uf: "SP", c1: "#1A1A1A", c2: "#FFFFFF", atk: 1.36, def: 0.95, venue: { name: "Moisés Lucarelli", city: "Campinas" } },
  { id: "gua", name: "Guarani",         short: "GUA", uf: "SP", c1: "#0B6E33", c2: "#003DA5", atk: 1.34, def: 0.97, venue: { name: "Brinco de Ouro da Princesa", city: "Campinas" } },
  { id: "fig", name: "Figueirense",     short: "FIG", uf: "SC", c1: "#1A1A1A", c2: "#FFFFFF", atk: 1.32, def: 0.99, venue: { name: "Orlando Scarpelli", city: "Florianópolis" } },
  { id: "abc", name: "ABC",             short: "ABC", uf: "RN", c1: "#C8102E", c2: "#1A1A1A", atk: 1.30, def: 1.01, venue: { name: "Frasqueirão", city: "Natal" } },
  { id: "itu", name: "Ituano",          short: "ITU", uf: "SP", c1: "#FFC93C", c2: "#DC2626", atk: 1.28, def: 1.03, venue: { name: "Novelli Júnior", city: "Itu" } },
  { id: "bru", name: "Brusque",         short: "BRU", uf: "SC", c1: "#DC2626", c2: "#1A1A1A", atk: 1.26, def: 1.05, venue: { name: "Augusto Bauer", city: "Brusque" } },
  { id: "tbe", name: "Tombense",        short: "TOM", uf: "MG", c1: "#00A99D", c2: "#FFFFFF", atk: 1.24, def: 1.07, venue: { name: "Soberanão", city: "Tombos" } },
  { id: "con", name: "Confiança",       short: "CON", uf: "SE", c1: "#DC2626", c2: "#1A1A1A", atk: 1.22, def: 1.09, venue: { name: "Batistão", city: "Aracaju" } },
  { id: "cax", name: "Caxias",          short: "CAX", uf: "RS", c1: "#8A2432", c2: "#1A1A1A", atk: 1.20, def: 1.11, venue: { name: "Centenário", city: "Caxias do Sul" } },
  { id: "lon", name: "Londrina",        short: "LON", uf: "PR", c1: "#DC2626", c2: "#1A1A1A", atk: 1.18, def: 1.13, venue: { name: "Estádio do Café", city: "Londrina" } },
  { id: "bpb", name: "Botafogo-PB",     short: "BPB", uf: "PB", c1: "#DC2626", c2: "#1A1A1A", atk: 1.16, def: 1.15, venue: { name: "Almeidão", city: "João Pessoa" } },
  { id: "flo", name: "Floresta",        short: "FLO", uf: "CE", c1: "#1E3A8A", c2: "#FFFFFF", atk: 1.14, def: 1.17, venue: { name: "Presidente Vargas", city: "Fortaleza" } },
  { id: "sbc", name: "São Bernardo",    short: "SBE", uf: "SP", c1: "#003DA5", c2: "#FFFFFF", atk: 1.12, def: 1.19, venue: { name: "1º de Maio", city: "São Bernardo do Campo" } },
  { id: "ypi", name: "Ypiranga",        short: "YPI", uf: "RS", c1: "#DC2626", c2: "#FFFFFF", atk: 1.10, def: 1.21, venue: { name: "Colosso do Butantã", city: "Erechim" } },
  { id: "ana", name: "Anápolis",        short: "ANA", uf: "GO", c1: "#DC2626", c2: "#FFFFFF", atk: 1.08, def: 1.23, venue: { name: "Jonas Duarte", city: "Anápolis" } },
  { id: "ret", name: "Retrô",           short: "RET", uf: "PE", c1: "#1A1A1A", c2: "#FFC93C", atk: 1.06, def: 1.25, venue: { name: "Arena de Pernambuco", city: "Camaragibe" } },
  { id: "ita", name: "Itabaiana",       short: "ITA", uf: "SE", c1: "#DC2626", c2: "#FFFFFF", atk: 1.04, def: 1.27, venue: { name: "Etelvino Mendonça", city: "Itabaiana" } },
  { id: "mga", name: "Maringá",         short: "MGA", uf: "PR", c1: "#003DA5", c2: "#FFFFFF", atk: 1.02, def: 1.29, venue: { name: "Willie Davids", city: "Maringá" } },
];

/* Jogadores de exemplo (fictícios) — elenco de 24 por time (3
   goleiros, 8 zagueiros/laterais, 7 meias, 6 atacantes — composição
   parecida com um elenco de verdade), usados na sub-aba "Jogadores" de
   Estatísticas e no card Elenco da página do Time quando não há
   integração ao vivo com a API-Sports. Nomes são combinações
   aleatórias (com seed fixo, pra ficarem estáveis entre
   recarregamentos) de nomes comuns — NÃO representam atletas reais,
   só como a força de ataque/defesa dos times em DEMO_TEAMS acima. */
const DEMO_FIRST_NAMES = ["Gabriel", "Lucas", "Matheus", "Rafael", "Bruno", "Diego", "Thiago", "Felipe", "Vitor", "Gustavo", "Rodrigo", "Leonardo", "Danilo", "Wesley", "Everton", "Kaique", "Yuri", "Igor", "Renan", "Caio"];
const DEMO_LAST_NAMES = ["Souza", "Silva", "Oliveira", "Santos", "Pereira", "Costa", "Almeida", "Ribeiro", "Carvalho", "Gomes", "Martins", "Araújo", "Barbosa", "Rocha", "Dias", "Nascimento", "Moreira", "Cardoso", "Teixeira", "Lopes"];
// Composição do elenco fictício: 3 goleiros, 8 defensores, 7 meias, 6
// atacantes = 24 jogadores/time (o suficiente pra mostrar o botão
// "ver todos" do card Elenco, que só aparece acima de 8 jogadores).
const DEMO_SQUAD_COMPOSITION = [
  ...Array(3).fill("Goalkeeper"),
  ...Array(8).fill("Defender"),
  ...Array(7).fill("Midfielder"),
  ...Array(6).fill("Attacker"),
];

function buildDemoPlayers(teams) {
  const rng = mulberry32(20260101); // seed fixo -> mesmo elenco fictício a cada carregamento
  const players = [];
  let idSeq = 1;
  teams.forEach(team => {
    DEMO_SQUAD_COMPOSITION.forEach(position => {
      const first = DEMO_FIRST_NAMES[Math.floor(rng() * DEMO_FIRST_NAMES.length)];
      const last = DEMO_LAST_NAMES[Math.floor(rng() * DEMO_LAST_NAMES.length)];
      const isGK = position === "Goalkeeper";
      const isAttacker = position === "Attacker";
      players.push({
        id: idSeq++,
        name: `${first} ${last}`,
        photo: null,
        teamId: team.id,
        position,
        games: 12 + Math.floor(rng() * 8), // 12-19 jogos, coerente com o ponto da temporada mostrado no modo de exemplo
        goals: isGK ? 0 : Math.round(rng() * (isAttacker ? 22 : 8)),
        assists: isGK ? 0 : Math.round(rng() * (isAttacker ? 10 : 12)),
        yellow: Math.round(rng() * 9) + 1,
        red: rng() < 0.12 ? 1 : 0,
        rating: +(6.2 + rng() * 2.3).toFixed(2),
      });
    });
  });
  return players;
}
const DEMO_PLAYERS = buildDemoPlayers(DEMO_TEAMS);
const DEMO_PLAYERS_PREMIER_LEAGUE = buildDemoPlayers(DEMO_TEAMS_PREMIER_LEAGUE);
const DEMO_PLAYERS_LA_LIGA = buildDemoPlayers(DEMO_TEAMS_LA_LIGA);
const DEMO_PLAYERS_SERIE_B = buildDemoPlayers(DEMO_TEAMS_SERIE_B);
const DEMO_PLAYERS_SERIE_C = buildDemoPlayers(DEMO_TEAMS_SERIE_C);

// Registro central dos dados de exemplo por campeonato — mesma chave
// "id" usada em server/src/competitions.js, pra app.js poder trocar de
// campeonato sem precisar saber o nome de cada array específico.
//
// Copa do Brasil NÃO está aqui de propósito: o motor de
// simulação/Tabela desse app assume pontos corridos com um turno único
// entre um grupo fixo de times (ver engine.js) — bate certinho com
// Série A/B/C, Premier League e La Liga, mas NÃO com o formato real
// dela (mata-mata direto, sem tabela de pontos corridos nenhuma).
// Forçar nesse molde geraria uma "Tabela"/simulação que não corresponde
// a como a competição realmente funciona — por isso ela aparece no
// menu (ver app.js) mas permanece "em breve" mesmo em modo exemplo,
// até o app ganhar uma tela própria pra mata-mata (fora do escopo
// desta integração). (Série D também tinha esse mesmo problema — 64
// times em 8 grupos + mata-mata — mas foi desligada de propósito por
// enquanto, nem entra no registro do backend, ver
// server/src/competitions.js.)
const DEMO_DATA_BY_COMPETITION = {
  brasileirao:    { teams: DEMO_TEAMS,               players: DEMO_PLAYERS },
  serie_b:        { teams: DEMO_TEAMS_SERIE_B,        players: DEMO_PLAYERS_SERIE_B },
  serie_c:        { teams: DEMO_TEAMS_SERIE_C,        players: DEMO_PLAYERS_SERIE_C },
  premier_league: { teams: DEMO_TEAMS_PREMIER_LEAGUE, players: DEMO_PLAYERS_PREMIER_LEAGUE },
  la_liga:        { teams: DEMO_TEAMS_LA_LIGA,        players: DEMO_PLAYERS_LA_LIGA },
};

/* Escalação e substituições fictícias — usadas no card de jogo
   expandido (aba Jogos) quando não há integração ao vivo. Geradas
   por partida com seed determinístico (mesma rodada/mesmo confronto
   sempre dá a mesma escalação fictícia, sem precisar guardar nada).
   Nomes são fictícios, igual DEMO_PLAYERS acima — não representam
   atletas reais. */
const DEMO_FORMATIONS = ["4-3-3", "4-4-2", "4-2-3-1", "4-1-4-1", "3-5-2"];
const DEMO_FORMATION_SLOTS = {
  "4-3-3": ["G", "D", "D", "D", "D", "M", "M", "M", "F", "F", "F"],
  "4-4-2": ["G", "D", "D", "D", "D", "M", "M", "M", "M", "F", "F"],
  "4-2-3-1": ["G", "D", "D", "D", "D", "M", "M", "M", "M", "M", "F"],
  "4-1-4-1": ["G", "D", "D", "D", "D", "M", "M", "M", "M", "M", "F"],
  "3-5-2": ["G", "D", "D", "D", "M", "M", "M", "M", "M", "F", "F"],
};
function seededRngFromKey(key) {
  const seed = Array.from(String(key)).reduce((s, c) => (s + c.charCodeAt(0) * 31) | 0, 0);
  return mulberry32(seed);
}
function demoRandomName(rng) {
  const first = DEMO_FIRST_NAMES[Math.floor(rng() * DEMO_FIRST_NAMES.length)];
  const last = DEMO_LAST_NAMES[Math.floor(rng() * DEMO_LAST_NAMES.length)];
  return `${first} ${last}`;
}
function buildDemoLineupSide(seedKey) {
  const rng = seededRngFromKey(seedKey);
  const formation = DEMO_FORMATIONS[Math.floor(rng() * DEMO_FORMATIONS.length)];
  const slots = DEMO_FORMATION_SLOTS[formation];
  const usedNumbers = new Set([1]); // 1 fica reservado pro goleiro
  const nextNumber = (isGK) => {
    if (isGK) return 1;
    let n;
    do { n = 2 + Math.floor(rng() * 98); } while (usedNumbers.has(n));
    usedNumbers.add(n);
    return n;
  };
  const startXI = slots.map(pos => ({ name: demoRandomName(rng), number: nextNumber(pos === "G"), pos }));
  const substitutes = Array.from({ length: 7 }, (_, i) => ({ name: demoRandomName(rng), number: nextNumber(false), pos: ["G", "D", "M", "F"][i % 4] }));
  return { formation, coach: demoRandomName(rng), startXI, substitutes };
}
// Retorna { [homeId]: {...}, [awayId]: {...} } — mesmo formato do
// mapLineups() do backend, pra renderLineups() no app.js não precisar
// saber se está em modo demo ou ao vivo.
function buildDemoLineups(seedKey, homeId, awayId) {
  return {
    [homeId]: buildDemoLineupSide(`${seedKey}:home`),
    [awayId]: buildDemoLineupSide(`${seedKey}:away`),
  };
}
function buildDemoSubstitutions(seedKey, homeId, awayId, lineups) {
  const rng = seededRngFromKey(`${seedKey}:subs`);
  const events = [];
  [homeId, awayId].forEach(teamId => {
    const lineup = lineups[teamId];
    if (!lineup) return;
    const outfield = lineup.startXI.filter(p => p.pos !== "G");
    const bench = [...lineup.substitutes];
    const subCount = Math.min(2 + Math.floor(rng() * 2), outfield.length, bench.length);
    for (let i = 0; i < subCount; i++) {
      const outIdx = Math.floor(rng() * outfield.length);
      const inIdx = Math.floor(rng() * bench.length);
      const min = 46 + Math.floor(rng() * 44); // 46'-89'
      events.push({ team: teamId, min, out: outfield[outIdx].name, in: bench[inIdx].name });
      outfield.splice(outIdx, 1);
      bench.splice(inIdx, 1);
    }
  });
  return events.sort((a, b) => a.min - b.min);
}

/* Gera calendário de turno + returno (método do círculo) já "achatado"
   num objeto { 1: [...jogos], 2: [...], ..., 38: [...] }.
   Usado apenas no modo demo — no modo ao vivo o calendário real vem
   da API-Sports (ver js/liveData.js). */
function generateAllRounds(teamIds) {
  const teams = [...teamIds];
  if (teams.length % 2 !== 0) teams.push(null);
  const n = teams.length;
  const roundsPerLeg = n - 1;
  const half = n / 2;
  const turno = [];
  let arr = [...teams];
  for (let r = 0; r < roundsPerLeg; r++) {
    const roundMatches = [];
    for (let i = 0; i < half; i++) {
      const home = arr[i];
      const away = arr[n - 1 - i];
      if (home !== null && away !== null) {
        if (r % 2 === 0) roundMatches.push({ home, away });
        else roundMatches.push({ home: away, away: home });
      }
    }
    turno.push(roundMatches);
    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop());
    arr = [fixed, ...rest];
  }
  const returno = turno.map(round => round.map(m => ({ home: m.away, away: m.home })));

  const allRounds = {};
  turno.forEach((round, i) => allRounds[i + 1] = round);
  returno.forEach((round, i) => allRounds[roundsPerLeg + i + 1] = round);
  return allRounds; // { 1: [...], ..., 38: [...] }
}
