// Verifica que os botões de ação principal das telas/modais tocados
// ficam FORA de .ct-modal-body (não rolam com o conteúdo) — moram em
// .ct-modal-footer, irmã fixa (flex-shrink:0) da .ct-modal-body.
const { chromium } = require("playwright-core");

function checkFooter(page, overlayId, btnId) {
  return page.evaluate(({ overlayId, btnId }) => {
    const overlay = document.getElementById(overlayId);
    const btn = document.getElementById(btnId);
    const footer = btn.closest(".ct-modal-footer");
    const body = btn.closest(".ct-modal-body");
    return {
      overlayOpen: overlay.classList.contains("open"),
      insideFooter: !!footer,
      insideBody: !!body,
      footerIsFlexShrink0: footer ? getComputedStyle(footer).flexShrink === "0" : false,
      btnVisible: btn.getBoundingClientRect().height > 0,
    };
  }, { overlayId, btnId });
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 700 } }); // baixo de propósito, pra forçar overflow
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `rodape${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Rodape Test", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(200);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.click("#btnClaimDailyLogin", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);

  // 1) Confirmar escalação — botões "Ir para o jogo"/"Ajustar escalação".
  await page.click(".m3-nav-item[data-panel='central']");
  await page.waitForTimeout(200);
  await page.click("#btnSimulate");
  await page.waitForSelector("#preMatchOverlay.open", { timeout: 5000 });
  const r1 = await checkFooter(page, "preMatchOverlay", "btnPreMatchGo");
  console.log("1) Confirmar escalação — 'Ir para o jogo' no rodapé fixo, fora do corpo rolável:", r1.insideFooter && !r1.insideBody && r1.footerIsFlexShrink0 && r1.btnVisible);
  await page.click("#btnPreMatchGo");

  // 2) Resultado do jogo — "Continuar".
  await page.waitForSelector("#liveMatchOverlay.open", { timeout: 5000 });
  await page.evaluate(() => skipLiveMatch());
  await page.waitForSelector("#matchDetailOverlay.open", { timeout: 5000 });
  const r2 = await checkFooter(page, "matchDetailOverlay", "btnMatchDetailContinue");
  console.log("2) Resultado do jogo — 'Continuar' no rodapé fixo:", r2.insideFooter && !r2.insideBody && r2.footerIsFlexShrink0 && r2.btnVisible);
  await page.click("#btnMatchDetailContinue");

  // 3) Notícias (pós-jogo) — "Continuar" visível e no rodapé.
  await page.waitForSelector("#newsOverlay.open", { timeout: 5000 });
  const r3 = await checkFooter(page, "newsOverlay", "btnNewsContinue");
  const footerHidden3 = await page.evaluate(() => document.getElementById("newsFooter").classList.contains("hidden"));
  console.log("3) Notícias (pós-jogo) — 'Continuar' no rodapé fixo e visível (footer não escondido):", r3.insideFooter && !r3.insideBody && !footerHidden3 && r3.btnVisible);
  await page.click("#btnNewsContinue");

  // 4) Resultados da rodada — "Ver tabela atualizada".
  await page.waitForSelector("#roundResultsOverlay.open", { timeout: 5000 });
  const r4 = await checkFooter(page, "roundResultsOverlay", "btnRoundResultsContinue");
  console.log("4) Resultados da rodada — 'Ver tabela atualizada' no rodapé fixo:", r4.insideFooter && !r4.insideBody && r4.footerIsFlexShrink0 && r4.btnVisible);
  await page.click("#btnRoundResultsContinue").catch(() => {});
  await page.click("#tabelaModalClose").catch(() => {});
  await page.waitForTimeout(150);

  // 5) Notícias aberta pelo menu (só consulta) — rodapé some por
  // inteiro (não sobra faixa vazia com borda).
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='imprensa']");
  await page.click("#btnOpenNews");
  await page.waitForSelector("#newsOverlay.open");
  await page.waitForTimeout(150);
  const footerHidden5 = await page.evaluate(() => {
    const footer = document.getElementById("newsFooter");
    return { hasHiddenClass: footer.classList.contains("hidden"), rendersNothing: footer.getBoundingClientRect().height === 0 };
  });
  console.log("5) Notícias (consulta pelo menu) — rodapé some por inteiro (sem faixa vazia):", footerHidden5.hasHiddenClass && footerHidden5.rendersNothing);
  await page.click("#newsClose");
  await page.waitForTimeout(150);

  // 6) Renovar contrato — "Propor" no rodapé.
  await page.click(".m3-nav-item[data-panel='elenco']");
  await page.waitForTimeout(200);
  const firstPlayerId = await page.evaluate(() => {
    const p = CAREER.squad.find((pl) => pl.origin === "principal");
    p.contractUntil = CAREER.seasonYear; // força fim de contrato pra abrir o botão de renovar
    return p.id;
  });
  await page.click(`[data-id="${firstPlayerId}"]`);
  await page.waitForSelector("#detailOverlay.open", { timeout: 5000 });
  await page.click('[data-act="renew"]').catch(() => {});
  const renewOpen = await page.evaluate(() => document.getElementById("renewOverlay").classList.contains("open"));
  if (renewOpen) {
    const r6 = await checkFooter(page, "renewOverlay", "btnRenewPropose");
    console.log("6) Renovar contrato — 'Propor' no rodapé fixo:", r6.insideFooter && !r6.insideBody && r6.footerIsFlexShrink0 && r6.btnVisible);
  } else {
    console.log("6) Renovar contrato — modal não abriu (jogador pode não ter opção de renovar nesse contexto), pulando.");
  }

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
