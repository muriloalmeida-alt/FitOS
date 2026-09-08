# Brasões locais (fallback offline)

Brasões dos clubes salvos localmente em SVG, usados:

1. Como brasão do **modo de exemplo** (sem depender de nenhuma API).
2. Como **fallback** no modo ao vivo, quando a URL de logo da API-Sports
   falha ao carregar (API fora do ar, sem chave configurada, rate limit,
   time sem logo cadastrado etc.) — ver `localCrestFor()` /
   `crestFallbackHandler()` em `public/js/app.js`.

Se nenhuma das duas fontes funcionar, o app cai para um badge com as
iniciais do time (sempre funciona, não depende de arquivo nenhum).

## Cobertura

19 dos 20 clubes da Série A 2026 têm brasão local. Falta apenas o
**Mirassol** (`mir`) — não achei uma fonte redistribuível pra ele; ele usa
o fallback de iniciais.

| id  | clube               | fonte |
|-----|----------------------|-------|
| fla | Flamengo             | react-brasileirao-logos |
| pal | Palmeiras            | react-brasileirao-logos |
| bot | Botafogo             | react-brasileirao-logos |
| for | Fortaleza            | react-brasileirao-logos |
| int | Internacional        | react-brasileirao-logos |
| sao | São Paulo            | react-brasileirao-logos |
| cor | Corinthians          | react-brasileirao-logos |
| cap | Athletico Paranaense | react-brasileirao-logos |
| cam | Atlético-MG          | react-brasileirao-logos |
| flu | Fluminense           | react-brasileirao-logos |
| san | Santos               | react-brasileirao-logos |
| bra | Bragantino           | react-brasileirao-logos |
| juv | Juventude            | react-brasileirao-logos |
| cui | Cuiabá               | react-brasileirao-logos |
| gre | Grêmio               | escudos-times-brasil-svg |
| cru | Cruzeiro             | escudos-times-brasil-svg |
| bah | Bahia                | escudos-times-brasil-svg |
| vas | Vasco da Gama        | escudos-times-brasil-svg |
| vit | Vitória              | escudos-times-brasil-svg |
| mir | Mirassol             | _(sem fonte — usa iniciais)_ |

## Fontes

- **react-brasileirao-logos** — pacote npm de código aberto com brasões em
  SVG dos times do Brasileirão, publicado especificamente para reuso por
  desenvolvedores. https://www.npmjs.com/package/react-brasileirao-logos
  (renderizado para SVG estático a partir dos componentes React e
  otimizado com SVGO).
- **hugomiura/escudos-times-brasil-svg** — repositório público no GitHub
  com brasões dos times das Séries A e B em SVG.
  https://github.com/hugomiura/escudos-times-brasil-svg

Os arquivos aqui são só os brasões oficiais dos clubes (identificação),
usados do mesmo jeito que a API-Sports já usa (`media.api-sports.io`) —
para exibição informativa num app de estatísticas, sem fins comerciais.
Se algum clube pedir a remoção do próprio brasão, é só apagar o arquivo
correspondente — o app cai automaticamente pro fallback de iniciais.

## Adicionando o Mirassol (ou substituindo algum outro)

Salve um SVG (ou PNG) em `public/img/teams/<id>.svg`, usando o mesmo `id`
da tabela em `public/js/data.js` (`DEMO_TEAMS`). Nenhuma outra mudança de
código é necessária — `localCrestFor()` detecta o arquivo automaticamente
pelo id (modo de exemplo) ou pelo nome do time (modo ao vivo).

## Escudos da Série B (Modo Técnico)

11 dos 20 clubes de `DEMO_TEAMS_SERIE_B` (`public/js/data.js`) têm brasão
real, salvo aqui como `<id>_b.png` (sufixo `_b` só pra deixar claro que é
um escudo da Série B, mesmo já não havendo colisão de `id` com a Série A) —
diferente do restante da pasta, esses NÃO são detectados automaticamente
por `localCrestFor()`/`crestFallbackHandler()` (esse par é só do site
principal, `app.js`); em vez disso, cada entrada de `DEMO_TEAMS_SERIE_B`
que tem escudo aponta pro arquivo direto no campo `logo`, lido por
`crestImg()` em `public/js/carreira.js` (Modo Técnico).

| id  | clube                | arquivo         |
|-----|------------------------|-----------------|
| goi | Goiás                  | `goi_b.png` |
| ava | Avaí                   | `ava_b.png` |
| cri | Criciúma               | `cri_b.png` |
| vno | Vila Nova              | `vno_b.png` |
| cub | Cuiabá                 | `cub_b.png` |
| acg | Atlético Goianiense    | `acg_b.png` |
| crb | CRB                    | `crb_b.png` |
| nvz | Novorizontino          | `nvz_b.png` |
| ope | Operário-PR            | `ope_b.png` |
| bsp | Botafogo-SP            | `bsp_b.png` |
| atc | Athletic Club          | `atc_b.png` |

Os outros 9 clubes de `DEMO_TEAMS_SERIE_B` (Athletico Paranaense, Coritiba,
Chapecoense, Remo, América Mineiro, Amazonas, Paysandu, Volta Redonda,
Ferroviária) ficaram sem escudo real — o documento fornecido pelo usuário
(`BRDataSerieBClubes.docx`, fonte: football-logos.cc) trazia escudo de 19
clubes da Série B 2026, mas só esses 11 batem com o elenco fictício daqui
(que é da Série B 2025); por decisão do usuário, o elenco não foi trocado
pra bater com o documento — só os que já coincidem ganharam escudo real.
Esses 9 continuam caindo pro fallback de monograma (sigla) que
`crestImg()` já usa quando não há `logo`.
