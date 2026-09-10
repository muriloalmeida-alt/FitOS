// Testa a migração parcial da tela Tática/Formação pro Design System
// --m3-* (S4-B2-003, issue #14). Cobre só o que foi de fato alterado
// nesta demanda (2 tokens legados que duplicavam papel semântico já
// coberto por --m3-*): a cor do badge "problema" no campinho e as
// cores do indicador de lesão. As 2 divergências registradas no
// relatório (tipografia Rajdhani, .mt-bench-row vs. PlayerCard) NÃO
// foram alteradas — aguardam decisão do PM — então não são testadas
// aqui como "migradas".
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  page.on("console", (msg) => { if (msg.type() === "error") console.log("CONSOLE ERROR:", msg.text()); });
  const base = "http://localhost:8787";
  const email = `s4b2003${Date.now()}@teste.com`;

  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "S4B2003 Teste", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(300);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.click("#btnOnboardSkip", { timeout: 2000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.click("#btnClaimDailyLogin", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(300);

  await page.click(".m3-nav-item[data-panel='escalacao']");
  await page.waitForTimeout(300);

  // 1) Força um titular a ficar "com problema" (contundido) e confirma
  // que o badge no campinho usa --m3-error (era --mt-crimson-400).
  const starterId = await page.evaluate(() => {
    const id = CAREER.lineup.starters.find(Boolean);
    const p = CAREER.squad.find((x) => x.id === id);
    p.status = "contundido";
    p.outUntilRound = (CAREER.currentRound || 1) + 2;
    renderPitch();
    return id;
  });
  const problemBadge = await page.evaluate((id) => {
    const slot = [...document.querySelectorAll(".mt-pos-slot")].find((el) => {
      const idx = Number(el.dataset.index);
      return CAREER.lineup.starters[idx] === id;
    });
    const badge = slot?.querySelector(".mt-pitch-badge");
    return badge ? getComputedStyle(badge).boxShadow : null;
  }, starterId);
  // --m3-error é #FF5449 = rgb(255, 84, 73) — aparece no box-shadow
  // (0 0 0 2px var(--m3-error), ...).
  console.log("1) Badge 'problema' no campinho usa --m3-error (não mais --mt-crimson-400):",
    !!problemBadge && problemBadge.includes("rgb(255, 84, 73)"), problemBadge);

  // 2) O mesmo jogador contundido mostra o indicador de lesão
  // (.mt-injury-flag) com --m3-secondary (era --mt-gold-400) — comparado
  // contra o valor REAL do token no momento (não um hex fixo): a
  // paleta --m3-secondary é dinâmica por clube (applyClubPalette() em
  // carreira.js), então o hex varia conforme o clube sorteado neste
  // teste — o que importa verificar é que o elemento segue a MESMA
  // variável, não um valor incidentalmente parecido.
  const injuryFlag = await page.evaluate((id) => {
    const slot = [...document.querySelectorAll(".mt-pos-slot")].find((el) => {
      const idx = Number(el.dataset.index);
      return CAREER.lineup.starters[idx] === id;
    });
    const flag = slot?.querySelector(".mt-injury-flag");
    // Elemento de referência isolado, com --m3-secondary aplicado
    // direto, pra converter a variável CSS em rgb() comparável (a
    // própria variável não é lida como cor computada diretamente).
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute; visibility:hidden; background:var(--m3-secondary);";
    document.body.appendChild(probe);
    const expected = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return { actual: flag ? getComputedStyle(flag).backgroundColor : null, expected };
  }, starterId);
  console.log("2) Indicador de lesão segue --m3-secondary (não mais --mt-gold-400 fixo):",
    !!injuryFlag.actual && injuryFlag.actual === injuryFlag.expected, JSON.stringify(injuryFlag));

  await page.screenshot({ path: "s4_b2_003_problem_badge.png" }).catch(() => {});

  // 3) Preservação funcional: escalação/formação/táticas continuam
  // funcionando normalmente (nenhuma mudança de comportamento, só CSS
  // de 2 seletores).
  const stillWorks = await page.evaluate(() => {
    const before = CAREER.lineup.formation;
    document.querySelector('.m3-filter-chip[data-formation="4-4-2"]')?.click();
    return { chipExists: !!document.querySelector('.m3-filter-chip[data-formation="4-4-2"]'), formationBefore: before, formationAfter: CAREER.lineup.formation };
  });
  console.log("3) Trocar formação continua funcionando (fluxo intacto):",
    stillWorks.chipExists && stillWorks.formationAfter === "4-4-2", JSON.stringify(stillWorks));

  await browser.close();
})();
