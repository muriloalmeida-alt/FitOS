const { chromium } = require("playwright-core");

async function newCareer(page, base, email) {
  await page.goto(base + "/", { waitUntil: "load" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "UI2 Test", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "load" });
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(200);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.click("#btnClaimDailyLogin", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("fonts.googleapis") && !m.text().includes("fundingchoices")) console.log("CONSOLE ERROR:", m.text()); });

  const base = "http://localhost:8787";
  await newCareer(page, base, `ui2-${Date.now()}@teste.com`);

  // 1) Botão auto-escalar agora é ícone (sem texto), na mesma linha do
  // toggle "incluir base" (Bloco 2 M3 — o esquema tático virou chip row
  // acima, ver #formationChipRow; auto-escalar/toggle moraram pro
  // bloco leve .m3-lineup-tools, ver renderFormationChips/carreira.html).
  await page.click(".m3-nav-item[data-panel='escalacao']");
  await page.waitForTimeout(300);
  const btnInfo = await page.evaluate(() => {
    const btn = document.getElementById("btnAutoLineup");
    const toggle = document.getElementById("autoLineupIncludeBase").closest("label");
    const btnRect = btn.getBoundingClientRect();
    const toggleRect = toggle.getBoundingClientRect();
    return {
      text: btn.textContent.trim(),
      hasSvgIcon: !!btn.querySelector("svg"),
      hasIconClass: btn.classList.contains("mt-btn-swap"),
      insideLineupTools: !!btn.closest(".m3-lineup-tools") && !!toggle.closest(".m3-lineup-tools"),
      sameRow: Math.abs(btnRect.top - toggleRect.top) < 40,
    };
  });
  console.log("1) Botão é só ícone (sem texto, com SVG):", btnInfo.text === "" && btnInfo.hasSvgIcon, "| classe mt-btn-swap:", btnInfo.hasIconClass, "| mesma linha do toggle, dentro de .m3-lineup-tools:", btnInfo.insideLineupTools && btnInfo.sameRow);

  // 2) Toggle "incluir base" existe, discreto, e desligado por padrão.
  // AJUSTE (redesign, Tela 6) — fonte do texto agora mora no <span
  // class="txt"> dentro do label (mockup), não mais no label direto.
  const toggleInfo = await page.evaluate(() => {
    const cb = document.getElementById("autoLineupIncludeBase");
    const txt = cb.closest("label").querySelector(".txt");
    return { exists: !!cb, checkedByDefault: cb.checked, fontSize: getComputedStyle(txt).fontSize };
  });
  console.log("2) Toggle 'incluir base' existe:", toggleInfo.exists, "| desligado por padrão:", !toggleInfo.checkedByDefault, "| discreto (fonte pequena):", parseFloat(toggleInfo.fontSize) <= 13);

  // 3) Com o toggle OFF, escalar automaticamente não deve escalar
  // ninguém da base (verifica sorteando um squad on-the-fly com
  // muitos jogadores base de overall alto forçado, senão o teste não
  // prova nada -- mais simples: confere que NENHUM titular pós-auto
  // tem origin "base" quando o toggle está desmarcado).
  await page.click("#btnAutoLineup");
  await page.waitForTimeout(200);
  const noBaseStarters = await page.evaluate(() => CAREER.lineup.starters.every((id) => {
    const p = CAREER.squad.find((x) => x.id === id);
    return !p || p.origin !== "base";
  }));
  console.log("3) Toggle OFF -- nenhum titular escalado é da base:", noBaseStarters);

  // 4) Com o toggle ON, e um squad hipotético onde só existem
  // jogadores de base "ok", a escalação automática DEVE aceitar base
  // (senão ninguém preenche a vaga) -- testa direto via autoLineup().
  const withBaseAllowed = await page.evaluate(() => {
    const onlyBase = CAREER.squad.filter((p) => p.origin === "base").slice(0, 11);
    if (onlyBase.length < 11) return "elenco de base insuficiente pra esse teste";
    const result = autoLineup(onlyBase, CAREER.lineup.formation, true);
    return result.starters.filter(Boolean).length;
  });
  console.log("4) autoLineup(includeBase=true) com só jogadores de base preenche titulares:", withBaseAllowed);
  const withBaseBlocked = await page.evaluate(() => {
    const onlyBase = CAREER.squad.filter((p) => p.origin === "base").slice(0, 11);
    if (onlyBase.length < 11) return "elenco de base insuficiente pra esse teste";
    const result = autoLineup(onlyBase, CAREER.lineup.formation, false);
    return result.starters.filter(Boolean).length;
  });
  console.log("5) autoLineup(includeBase=false) com só jogadores de base NÃO preenche nada:", withBaseBlocked === 0);

  // 6) Modais "grandes" viram tela cheia (classe + ocupam quase todo o viewport).
  await page.click(`.mt-pos-slot[data-index="0"]`);
  await page.waitForSelector("#pickerOverlay.open");
  await page.waitForTimeout(200);
  const pickerFull = await page.evaluate(() => {
    const modal = document.querySelector("#pickerOverlay .ct-modal");
    const rect = modal.getBoundingClientRect();
    return { hasClass: document.getElementById("pickerOverlay").classList.contains("ct-modal-fullscreen"), w: rect.width, h: rect.height, vw: window.innerWidth, vh: window.innerHeight };
  });
  console.log("6) pickerOverlay tem classe fullscreen:", pickerFull.hasClass, "| ocupa (quase) toda a largura:", pickerFull.w >= pickerFull.vw - 2, "| ocupa (quase) toda a altura:", pickerFull.h >= pickerFull.vh - 2);
  await page.click("#pickerClose");
  await page.waitForTimeout(200);

  // 7) Modal curta (anúncio de venda) não é FULLSCREEN (classe
  // ct-modal-fullscreen) -- desde "Todas as modais que não são tela
  // cheia devem estar alinhadas ao rodapé" (pré-existente, sem relação
  // com o checklist de UX desta etapa), toda modal não-fullscreen virou
  // bottom sheet de largura cheia, então já não faz sentido esperar
  // "bem mais estreito que o viewport" -- só confere que não ganhou a
  // classe fullscreen (essa sim é a distinção que separa os 2 tipos de
  // modal). "Vender" agora abre o sheet de anúncio (data-list), não
  // mais o confirmModal() genérico (data-sell não existe mais, ver
  // test_colocar_a_venda.js).
  await page.click(".m3-nav-item[data-panel='mercado']");
  await page.waitForTimeout(300);
  const listBtn = await page.$("[data-list]");
  await listBtn.click();
  await page.waitForSelector("#listOverlay.open");
  await page.waitForTimeout(200);
  const confirmSmall = await page.evaluate(() => {
    const modal = document.querySelector("#listOverlay .ct-modal");
    const rect = modal.getBoundingClientRect();
    return { hasFullClass: document.getElementById("listOverlay").classList.contains("ct-modal-fullscreen"), w: rect.width, vw: window.innerWidth };
  });
  console.log("7) listOverlay (anúncio de venda) NÃO é fullscreen (é bottom sheet de largura cheia):", !confirmSmall.hasFullClass, JSON.stringify(confirmSmall));
  await page.click("#listClose");
  await page.waitForTimeout(200);

  // 8) X do liveMatchOverlay resolve a partida na hora (mesmo efeito
  // de "Pular pro fim") em vez de deixar tudo pra trás quebrado.
  await page.click(".m3-nav-item[data-panel='central']");
  await page.waitForTimeout(300);
  await page.click("#btnSimulate");
  await page.waitForSelector("#preMatchOverlay.open", { timeout: 5000 });
  await page.click("#btnPreMatchGo");
  await page.waitForSelector("#liveMatchOverlay.open", { timeout: 5000 });
  const liveHasClose = await page.evaluate(() => !!document.getElementById("liveMatchClose"));
  await page.click("#liveMatchClose");
  await page.waitForSelector("#matchDetailOverlay.open", { timeout: 5000 });
  console.log("8) liveMatchOverlay tem X:", liveHasClose, "| clicar no X termina a partida e mostra o resultado:", true);
  await page.click("#btnMatchDetailContinue");
  await page.waitForTimeout(300);
  // Coletiva de imprensa pode aparecer aqui antes de Notícias (mesmo
  // clique defensivo já usado em outros testes desta sessão).
  if (await page.evaluate(() => document.getElementById("pressOverlay").classList.contains("open"))) {
    await page.click("#pressOptions [data-press]");
    await page.waitForTimeout(300);
  }
  await page.waitForSelector("#newsOverlay.open", { timeout: 5000 });
  await page.click("#btnNewsContinue");
  await page.waitForTimeout(300);
  if (await page.evaluate(() => document.getElementById("roundResultsOverlay").classList.contains("open"))) {
    await page.click("#btnRoundResultsContinue");
    await page.waitForTimeout(300);
  }

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
