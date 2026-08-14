# Logos das casas de apostas parceiras

Logos usados na tira de parceiros (card de odds, `matchOddsStripHTML` em
`public/js/app.js`) no lugar do nome em texto — ver `affiliateChipHTML()`
em `app.js` e a configuração de cada operadora em `public/js/affiliates.js`.

## Status atual

| id         | operadora | arquivo |
|------------|-----------|---------|
| `bet365`   | bet365    | ✅ `bet365.png` |
| `betano`   | Betano    | ✅ `betano.png` |
| `kto`      | KTO       | ✅ `kto.png` |
| `superbet` | Superbet  | ✅ `superbet.png` |

Os 4 arquivos foram enviados direto pelo usuário no chat (nenhum tem
fundo transparente — cada um vem com a cor de fundo da própria marca:
preto no KTO, verde no bet365, laranja no Betano, branco no Superbet).
O CSS (`.affiliate-chip-logo` em `style.css`) já foi pensado pra isso:
cada logo fica dentro de um card branco neutro, então funciona bem com
qualquer cor de fundo que o arquivo trouxer — não precisa ser
transparente.

**Se algum dia quiser trocar por uma versão "oficial":** o ideal é usar
o material de marca do painel do programa de afiliados de cada
operadora (seção tipo "media kit" / "brand assets"), disponível depois
que a inscrição for aprovada — é o jeito mais seguro de garantir a
licença de uso certa. Não é bloqueante: o app já funciona normal com os
arquivos atuais.

## Como adicionar/trocar

Salve o arquivo em `public/img/partners/<id>.png` (mesmo `id` da tabela
acima, usado em `affiliates.js`) — nenhuma mudança de código é
necessária, o app carrega `img/partners/<id>.png` sozinho. Se o arquivo
não existir (ou o `onerror` disparar por qualquer motivo), o chip cai
pro nome em texto num pill colorido (a cor de cada marca já configurada
em `affiliates.js`) — nunca fica com o ícone de imagem quebrada do
navegador.
