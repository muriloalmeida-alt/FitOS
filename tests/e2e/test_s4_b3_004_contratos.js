// Testa a tela "Contratos" (S4-B3-004, issue #20 — criada do zero por
// decisão do PM, depois de a demanda original ter sido bloqueada por
// essa tela não existir no app). Cobre: acesso pelo menu, ContractCard
// por jogador (exclui emprestados), ordenação por proximidade do
// vencimento, filtro Todos/Vencendo, nome clicável abrindo o Perfil, e
// as 2 ações reaproveitadas (Renovar/Dispensar) — nenhuma regra de
// contrato nova, só consumo do que já existe (computeContractFields/
// isContractExpiring/proposeRenewal/handlePlayerAction).
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  page.on("console", (msg) => { if (msg.type() === "error") console.log("CONSOLE ERROR:", msg.text()); });
  const base = "http://localhost:8787";
  const email = `s4b3004${Date.now()}@teste.com`;

  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "S4B3004 Teste", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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

  // Setup: força pelo menos 1 jogador com contrato vencendo (mesma
  // temporada) e confirma que há emprestados suficientes pro squad
  // (se houver) pra testar a exclusão.
  await page.evaluate(() => {
    const p = CAREER.squad.find((x) => x.origin !== "loan");
    p.contractUntil = CAREER.seasonYear;
  });

  // 1) Abrir "Contratos" pelo menu "☰ Equipe & Treinos".
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='equipe']");
  await page.click("#btnOpenContratos");
  await page.waitForTimeout(200);
  const opened = await page.evaluate(() => document.getElementById("contratosOverlay").classList.contains("open"));
  console.log("1) Menu 'Equipe & Treinos' → 'Contratos' abre a tela:", opened);

  // 2) Lista mostra ContractCard por jogador, exclui emprestados, e
  // vem ordenada por proximidade do vencimento (ascendente).
  const check2 = await page.evaluate(() => {
    const nonLoanCount = CAREER.squad.filter((p) => p.origin !== "loan").length;
    const cards = [...document.querySelectorAll("#contratosList .m3-op-card")];
    const years = cards.map((c) => {
      const detail = c.querySelector(".m3-op-detail")?.textContent || "";
      const m = detail.match(/até (\d+)/);
      return m ? Number(m[1]) : null;
    });
    const sorted = years.every((y, i) => i === 0 || years[i - 1] <= y);
    return { cardCount: cards.length, nonLoanCount, sorted, hasBadge: !!cards[0]?.querySelector(".mt-ovr-badge"), hasName: !!cards[0]?.querySelector(".m3-op-name") };
  });
  console.log("2) Lista mostra 1 ContractCard por jogador não-emprestado, ordenada por vencimento:",
    check2.cardCount === check2.nonLoanCount && check2.sorted && check2.hasBadge && check2.hasName, JSON.stringify(check2));

  // 3) Filtro "Vencendo" mostra só quem tem isContractExpiring true.
  await page.click('[data-contratosfilter="vencendo"]');
  await page.waitForTimeout(150);
  const check3 = await page.evaluate(() => {
    const expiringCount = CAREER.squad.filter((p) => isContractExpiring(p)).length;
    const cards = document.querySelectorAll("#contratosList .m3-op-card").length;
    const allHaveFimDeContrato = [...document.querySelectorAll("#contratosList .m3-op-card")].every((c) => c.textContent.includes("Fim de contrato"));
    return { expiringCount, cards, allHaveFimDeContrato };
  });
  console.log("3) Filtro 'Vencendo' mostra só contratos com isContractExpiring:",
    check3.cards === check3.expiringCount && check3.allHaveFimDeContrato && check3.cards > 0, JSON.stringify(check3));

  // 4) Nome do jogador é clicável e abre o Perfil (openDetail).
  await page.click("#contratosList .m3-op-info");
  await page.waitForTimeout(150);
  const profileOpen = await page.evaluate(() => document.getElementById("detailOverlay").classList.contains("open"));
  console.log("4) Nome do jogador no ContractCard abre o Perfil:", profileOpen);
  await page.evaluate(() => document.getElementById("detailOverlay").classList.remove("open"));

  // 5) Botão "Renovar" (só em quem está vencendo) abre o mesmo modal de
  // renovação do Perfil (openRenewModal/#renewOverlay).
  const hasRenewBtn = await page.evaluate(() => !!document.querySelector("#contratosList [data-contratorenew]"));
  await page.click("#contratosList [data-contratorenew]");
  await page.waitForTimeout(150);
  const renewOpen = await page.evaluate(() => document.getElementById("renewOverlay").classList.contains("open"));
  console.log("5) Botão 'Renovar' abre o mesmo modal de renovação do Perfil:", hasRenewBtn && renewOpen);
  await page.evaluate(() => { document.getElementById("renewOverlay").classList.remove("open"); RENEW_CTX = null; });

  // 6) Botão "Dispensar" reaproveita a mesma ação (release) do Perfil —
  // remove do elenco de verdade, some da lista.
  await page.click('[data-contratosfilter="todos"]');
  await page.waitForTimeout(150);
  const check6 = await page.evaluate(async () => {
    const squadBefore = CAREER.squad.length;
    const card = document.querySelector("#contratosList .m3-op-card[data-id]");
    const id = card.dataset.id;
    document.querySelector(`#contratosList [data-contratorelease="${id}"]`).click();
    await new Promise((r) => setTimeout(r, 50));
    return {
      squadReduced: CAREER.squad.length === squadBefore - 1,
      noLongerInSquad: !CAREER.squad.find((p) => p.id === id),
      cardGone: !document.querySelector(`#contratosList .m3-op-card[data-id="${id}"]`),
    };
  });
  console.log("6) Botão 'Dispensar' remove o jogador de verdade (mesma ação do Perfil) e some da lista:",
    check6.squadReduced && check6.noLongerInSquad && check6.cardGone, JSON.stringify(check6));

  // 7) Estado vazio: filtro "Vencendo" sem ninguém vencendo mostra a
  // mensagem, não uma lista em branco silenciosa.
  await page.click('[data-contratosfilter="vencendo"]');
  await page.waitForTimeout(100);
  const check7 = await page.evaluate(() => {
    CAREER.squad.forEach((p) => { if (p.origin !== "loan") p.contractUntil = CAREER.seasonYear + 3; });
    renderContratos();
    return { emptyVisible: !document.getElementById("contratosEmpty").classList.contains("hidden"), listEmpty: document.getElementById("contratosList").innerHTML.trim() === "" };
  });
  console.log("7) Estado vazio do filtro 'Vencendo' mostra a mensagem tratada:", check7.emptyVisible && check7.listEmpty, JSON.stringify(check7));

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
