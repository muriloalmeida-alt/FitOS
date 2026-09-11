// S4-B4-002 (issue #32) — teste e2e via UI real. A auditoria S4-B4-
// READINESS-001 classificou "Meus esquemas" como "100% legado", mas a
// inspeção real mostrou que as linhas da lista (.m3-scheme-*) e a casca
// dos modais (.mt-fullheader/.ct-modal-*/.mt-card) já estavam 100%
// --m3-*. O ÚNICO token legado de verdade encontrado nesta tela foi o
// campo de nome do sheet "Novo esquema" (#newSchemeNameInput), que
// usava .mt-friend-input "cru" (--mt-navy-900/--mt-navy-600/--mt-ivory-
// 50 fixos) por não estar dentro de um .mt-form-row — diferente de
// "Editar perfil", que usa o mesmo input já envolto em .mt-form-row e
// por isso já herdava --m3-on-surface. Este teste cobre a migração
// (agora envolvido em .mt-form-row, reaproveitando a regra que já
// existia, sem CSS novo) e confirma que salvar/aplicar/apagar esquema
// continua 100% preservado — nenhuma mudança de lógica, só de token
// visual, conforme o escopo.
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `s4b4002${Date.now()}@teste.com`;

  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Meus Esquemas M3", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
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
  await page.waitForTimeout(1000);
  await page.click("#btnClaimDailyLogin").catch(() => {});
  await page.waitForTimeout(200);

  // 1) Abre "Meus esquemas" pelo Menu -> estado vazio, casca (título/
  // subtítulo/fechar/card/botão) usando os componentes compartilhados,
  // já --m3-* de antes desta demanda (nenhuma mudança aqui).
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='tatica']");
  await page.click("#btnOpenSchemes");
  await page.waitForTimeout(300);
  const check1 = await page.evaluate(() => ({
    open: document.getElementById("schemesOverlay").classList.contains("open"),
    emptyMsg: document.getElementById("schemesList").textContent.includes("Nenhum esquema salvo"),
  }));
  console.log("1) 'Meus esquemas' abre vazio pelo Menu (casca já --m3-* de antes, sem mudança):", check1.open && check1.emptyMsg, JSON.stringify(check1));

  // 2) Abre o sheet "Novo esquema" e confere que o campo de nome
  // (#newSchemeNameInput) agora resolve pra --m3-on-surface (dentro de
  // .mt-form-row) em vez de --mt-ivory-50/--mt-navy-900 fixos.
  await page.click("#btnNewScheme");
  await page.waitForTimeout(200);
  const tokens = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const input = getComputedStyle(document.getElementById("newSchemeNameInput"));
    return {
      onSurface: root.getPropertyValue("--m3-on-surface").trim(),
      surfaceContainer: root.getPropertyValue("--m3-surface-container").trim(),
      inputColor: input.color,
      wrappedInFormRow: !!document.getElementById("newSchemeNameInput").closest(".mt-form-row"),
    };
  });
  const hexToRgb = (hex) => { const h = hex.replace("#", ""); const n = parseInt(h, 16); return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`; };
  const inputColorOk = tokens.inputColor === hexToRgb(tokens.onSurface);
  console.log("2) Campo 'Novo esquema' migrado (envolvido em .mt-form-row, cor resolve pra --m3-on-surface, não mais --mt-ivory-50):",
    tokens.wrappedInFormRow && inputColorOk, JSON.stringify({ ...tokens, inputColorOk }));

  // 3) Comportamento 100% preservado: salvar o esquema atual funciona
  // igual (aparece na lista, marcado ATIVO) — mesma regra de negócio de
  // antes da migração, nenhuma mudança de lógica.
  await page.click("#newSchemeClose");
  await page.waitForTimeout(150);
  await page.click("#schemesClose");
  await page.waitForTimeout(150);
  await page.click(".m3-nav-item[data-panel='escalacao']");
  await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector('#formationChipRow [data-formation="4-4-2"]').click());
  await page.click("#btnSaveLineup");
  await page.waitForTimeout(200);
  await page.click("#btnBottomMenu");
  await page.waitForTimeout(150);
  await page.click("#topbarMenu .mt-topbar-menu-item.group[data-submenu='tatica']");
  await page.click("#btnOpenSchemes");
  await page.waitForTimeout(200);
  await page.click("#btnNewScheme");
  await page.waitForTimeout(150);
  await page.fill("#newSchemeNameInput", "Padrão M3");
  await page.click("#btnConfirmNewScheme");
  await page.waitForTimeout(200);
  const check3 = await page.evaluate(() => {
    const row = document.querySelector('#schemesList .m3-scheme-row');
    return {
      name: row?.querySelector(".m3-scheme-name")?.textContent,
      isActive: row?.classList.contains("active"),
      total: CAREER.tacticalSchemes.length,
    };
  });
  console.log("3) Salvar esquema continua funcionando igual (aparece na lista, marcado ATIVO):",
    check3.name === "Padrão M3" && check3.isActive && check3.total === 1, JSON.stringify(check3));

  // 4) Apagar continua funcionando igual (some da lista, volta ao vazio).
  await page.click('#schemesList [data-delete]');
  await page.waitForTimeout(200);
  await page.click("#confirmOkBtn");
  await page.waitForTimeout(200);
  const check4 = await page.evaluate(() => ({
    emptyMsg: document.getElementById("schemesList").textContent.includes("Nenhum esquema salvo"),
    total: CAREER.tacticalSchemes.length,
  }));
  console.log("4) Apagar esquema continua funcionando igual (volta ao estado vazio):", check4.emptyMsg && check4.total === 0, JSON.stringify(check4));

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
