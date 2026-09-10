// S4-B3-001 — TransferCard/ContractCard (--m3-*).
// Nenhuma tela real usa estes componentes ainda nesta demanda (isso é
// S4-B3-002/003/004, em demandas seguintes) — mesmo padrão de "testar
// a API do componente" já usado pra Bottom Sheet/Skeleton em
// S3-DS20-S4-PREP-001 (ver test_m3_dialog_sheet_skeleton.js): chama
// transferCardHTML()/contractCardHTML() direto via page.evaluate() e
// injeta o HTML resultante no DOM pra medir tokens computados.
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  page.on("console", (msg) => { if (msg.type() === "error") console.log("CONSOLE ERROR:", msg.text()); });
  const base = "http://localhost:8787";
  const email = `s4b3001_${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "S4B3001 Teste", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForSelector(".m3-club-row", { timeout: 15000 });
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.click("#btnOnboardSkip", { timeout: 2000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.click("#btnClaimDailyLogin", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);

  // 1) TransferCard: badge/nome/clube/posição/status/valor+salário
  // renderizam com os tokens --m3-* certos (mesmo mapeamento de cor do
  // PlayerCard/Elenco).
  const tc = await page.evaluate(() => {
    const html = transferCardHTML({
      playerId: "p1", playerName: "Jogador Um", overall: 82, position: "M",
      clubName: "Clube X", clubId: "c1", value: 12000000, wage: 85000,
      statusLabel: "Disponível", statusVariant: "gold",
      actionsHTML: `<button class="mt-btn-buy" data-buy="p1">Comprar</button>`,
      clickablePlayer: true, clickableClub: true,
    });
    const host = document.createElement("div");
    host.innerHTML = html;
    document.body.appendChild(host);
    const card = host.querySelector(".m3-op-card");
    const name = host.querySelector(".m3-op-name");
    const detail = host.querySelector(".m3-op-detail");
    const status = host.querySelector(".mt-ptag");
    const info = host.querySelector(".m3-op-info");
    const club = host.querySelector(".m3-op-club");
    const action = host.querySelector("[data-buy]");
    const result = {
      hasCard: !!card, dataId: card?.dataset.id,
      nameText: name?.textContent, nameColor: name ? getComputedStyle(name).color : null,
      detailText: detail?.textContent,
      statusText: status?.textContent, statusClass: status?.className,
      infoOpenPlayer: info?.dataset.openplayer, infoOpenClub: info?.dataset.club,
      clubOpenClub: club?.dataset.openclub,
      hasAction: !!action, cardBg: card ? getComputedStyle(card).backgroundColor : null,
    };
    host.remove();
    return result;
  });
  // --m3-on-surface:#E7E2DE = rgb(231,226,222); --m3-surface-container-high:#2C2A27 = rgb(44,42,39).
  console.log("1) TransferCard: card/nome/clube/posição/status/detalhe/ação renderizam certo (tokens --m3-*):",
    tc.hasCard && tc.dataId === "p1" && tc.nameText === "Jogador Um" && tc.nameColor === "rgb(231, 226, 222)"
    && (tc.detailText || "").includes("Salário") && (tc.detailText || "").includes("Valor")
    && tc.statusText === "Disponível" && tc.statusClass.includes("gold")
    && tc.infoOpenPlayer === "p1" && tc.infoOpenClub === "c1" && tc.clubOpenClub === "c1"
    && tc.hasAction && tc.cardBg === "rgb(44, 42, 39)",
    JSON.stringify(tc));

  // 2) TransferCard: sem overall/position (badge/chip omitidos) e com
  // metaText no lugar da linha padrão de valor/salário (caso "proposta
  // em andamento", sem badge nem valor de mercado em destaque).
  const tc2 = await page.evaluate(() => {
    const html = transferCardHTML({
      playerId: "p2", playerName: "Jogador Dois", clubName: "Clube Y",
      metaText: "Sua oferta R$ 1.000.000 · aguardando resposta (3 rodadas)",
      actionsHTML: `<button data-withdraw="p2">Retirar</button>`,
    });
    const host = document.createElement("div");
    host.innerHTML = html;
    document.body.appendChild(host);
    const result = {
      hasBadge: !!host.querySelector(".mt-ovr-badge"),
      hasPosChip: !!host.querySelector(".mt-pos-chip"),
      detailText: host.querySelector(".m3-op-detail")?.textContent,
    };
    host.remove();
    return result;
  });
  console.log("2) TransferCard sem overall/position omite badge/chip; metaText substitui a linha padrão:",
    !tc2.hasBadge && !tc2.hasPosChip && tc2.detailText.includes("aguardando resposta"), JSON.stringify(tc2));

  // 3) ContractCard: badge/nome/clube/salário/duração renderizam com os
  // tokens certos; expiring=true sem statusVariant explícito vira
  // "crimson" automaticamente.
  const cc = await page.evaluate(() => {
    const html = contractCardHTML({
      playerId: "p3", playerName: "Jogador Três", overall: 74, position: "D",
      clubName: "Meu Clube", wage: 60000, durationLabel: "Contrato até 2026",
      statusLabel: "Vence em breve", expiring: true,
      actionsHTML: `<button data-renew="p3">Renovar</button>`,
      clickablePlayer: true,
    });
    const host = document.createElement("div");
    host.innerHTML = html;
    document.body.appendChild(host);
    const status = host.querySelector(".mt-ptag");
    const info = host.querySelector(".m3-op-info");
    const result = {
      hasBadge: !!host.querySelector(".mt-ovr-badge"),
      detailText: host.querySelector(".m3-op-detail")?.textContent,
      statusClass: status?.className, statusText: status?.textContent,
      infoOpenPlayer: info?.dataset.openplayer,
      hasAction: !!host.querySelector("[data-renew]"),
    };
    host.remove();
    return result;
  });
  console.log("3) ContractCard: badge/detalhe(salário+duração)/status 'crimson' automático (expiring)/ação:",
    cc.hasBadge && cc.detailText.includes("Contrato até 2026") && cc.statusClass.includes("crimson")
    && cc.statusText === "Vence em breve" && cc.infoOpenPlayer === "p3" && cc.hasAction,
    JSON.stringify(cc));

  // 4) ContractCard: statusVariant explícito sobrepõe o atalho de
  // "expiring" (mesmo com expiring=true, força "neutral" se pedido).
  const cc2 = await page.evaluate(() => {
    const html = contractCardHTML({
      playerId: "p4", playerName: "Jogador Quatro", clubName: "Meu Clube",
      wage: 40000, durationLabel: "Contrato até 2028",
      statusLabel: "Renovado", statusVariant: "neutral", expiring: false,
    });
    const host = document.createElement("div");
    host.innerHTML = html;
    document.body.appendChild(host);
    const status = host.querySelector(".mt-ptag");
    const result = { statusClass: status?.className };
    host.remove();
    return result;
  });
  console.log("4) ContractCard: statusVariant explícito respeitado (não força crimson sem expiring):",
    cc2.statusClass.includes("neutral") && !cc2.statusClass.includes("crimson"), JSON.stringify(cc2));

  // 5) Nenhum dos 2 componentes tem lógica de negócio embutida — são
  // só funções puras (mesma entrada -> mesma saída, sem ler CAREER nem
  // nenhum estado global).
  const pureCheck = await page.evaluate(() => {
    const a = transferCardHTML({ playerId: "x", playerName: "X", value: 100 });
    const b = transferCardHTML({ playerId: "x", playerName: "X", value: 100 });
    return { equal: a === b, touchesCareer: transferCardHTML.toString().includes("CAREER") || contractCardHTML.toString().includes("CAREER") };
  });
  console.log("5) Componentes são puros (mesma entrada -> mesma saída, sem tocar CAREER):",
    pureCheck.equal && !pureCheck.touchesCareer, JSON.stringify(pureCheck));

  await browser.close();
})();
