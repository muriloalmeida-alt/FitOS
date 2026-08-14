# Logos das casas de apostas parceiras

Logos usados na tira de parceiros (card de odds, `matchOddsStripHTML` em
`public/js/app.js`) no lugar do nome em texto — ver `affiliateChipHTML()`
em `app.js` e a configuração de cada operadora em `public/js/affiliates.js`.

## Como adicionar

Salve o arquivo em `public/img/partners/<id>.png`, usando o mesmo `id` da
lista em `affiliates.js`:

| id         | operadora |
|------------|-----------|
| `bet365`   | bet365 |
| `betano`   | Betano |
| `kto`      | KTO |
| `superbet` | Superbet |

Nenhuma mudança de código é necessária — o app tenta carregar
`img/partners/<id>.png` sozinho; se o arquivo não existir (ainda não foi
adicionado, ou o `onerror` disparar por qualquer outro motivo), o chip
cai automaticamente pro nome em texto (comportamento de antes) — nunca
fica com o ícone de imagem quebrada do navegador.

**Recomendado:** PNG com fundo transparente, altura mínima de ~80px
(o app redimensiona pra ~18px de altura dentro do chip, então não
precisa ser grande — só nítido nesse tamanho final).

## Onde conseguir o arquivo

**Não** baixe/print da home do site — use o material de marca oficial
disponibilizado no painel do programa de afiliados de cada operadora
(normalmente numa seção tipo "media kit" / "brand assets" / "materiais
de divulgação"), depois que sua inscrição for aprovada. É o único jeito
de garantir que o arquivo está com a licença de uso certa. Enquanto não
tiver o arquivo de nenhuma operadora, o site funciona normal com os
nomes em texto — não é bloqueante pra publicar os links diretos.
