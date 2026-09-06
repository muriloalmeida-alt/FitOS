// Testa Bloco 7/8/9 pendentes: Configurações, Editar perfil, Central de
// notificações, Histórico de compras, Central de ajuda, Sistema (splash/erro).
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `perfilcfg${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Murilo Melo", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(300);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.waitForTimeout(700);
  // fecha modal de login diário se abrir
  try { await page.click("#btnClaimDailyLogin", { timeout: 1500 }); await page.waitForTimeout(200); } catch {}

  async function openSettings() {
    await page.click("#btnBottomMenu");
    await page.waitForTimeout(150);
    await page.click("#btnOpenSettings");
    await page.waitForTimeout(200);
  }

  // 1) Configurações abre com perfil/jogo/notificações/conta
  await openSettings();
  const cfg = await page.evaluate(() => ({
    open: document.getElementById("settingsOverlay").classList.contains("open"),
    name: document.querySelector(".mt-settings-name")?.textContent,
    club: document.getElementById("settingsRowClub")?.textContent.includes("Athletico") || document.getElementById("settingsRowClub")?.textContent.length > 0,
    toggles: document.querySelectorAll("#settingsBody [data-toggle-key]").length,
    editRow: !!document.getElementById("settingsRowEditProfile"),
    purchaseRow: !!document.getElementById("settingsRowPurchaseHistory"),
    helpRow: !!document.getElementById("settingsRowHelp"),
  }));
  console.log("1) Configurações abre com perfil+3 toggles+linhas de conta:", cfg.open && cfg.name === "Murilo Melo" && cfg.toggles === 3 && cfg.editRow && cfg.purchaseRow && cfg.helpRow, JSON.stringify(cfg));

  // 2) Toggle de notificação persiste
  const before = await page.evaluate(() => CAREER.notificationSettings.loja);
  await page.click('#settingsBody [data-toggle-key="loja"]');
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => CAREER.notificationSettings.loja);
  console.log("2) Toggle 'loja' inverte de verdade:", after === !before, { before, after });

  // 3) Editar perfil: nome editável, e-mail mascarado, nível = reputação
  await page.click("#settingsRowEditProfile");
  await page.waitForTimeout(150);
  const editState = await page.evaluate(() => ({
    open: document.getElementById("editProfileOverlay").classList.contains("open"),
    nameVal: document.getElementById("editProfileNameInput").value,
    email: document.getElementById("editProfileEmail").textContent,
    level: document.getElementById("editProfileLevel").textContent,
    avatar: document.getElementById("editProfileAvatar").textContent,
  }));
  console.log("3) Editar perfil abre com nome/e-mail mascarado/nível:", editState.open && editState.nameVal === "Murilo Melo" && editState.email.includes("•") && /\d+/.test(editState.level) && editState.avatar === "MM", JSON.stringify(editState));

  await page.fill("#editProfileNameInput", "Murilo Editado");
  await page.click("#btnSaveProfileName");
  await page.waitForTimeout(400);
  const afterSave = await page.evaluate(() => ({ meName: ME.name, closed: !document.getElementById("editProfileOverlay").classList.contains("open") }));
  console.log("4) Salvar nome persiste no servidor (ME.name) e fecha:", afterSave.meName === "Murilo Editado" && afterSave.closed, JSON.stringify(afterSave));
  // confirma persistência real via reload
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  const afterReload = await page.evaluate(() => ME && ME.name);
  console.log("5) Nome sobrevive a reload (endpoint gravou no servidor):", afterReload === "Murilo Editado", afterReload);

  // 6) Central de ajuda: FAQ abre/fecha
  await openSettings();
  await page.click("#settingsRowHelp");
  await page.waitForTimeout(150);
  const helpOpen = await page.evaluate(() => document.getElementById("helpCenterOverlay").classList.contains("open"));
  await page.click("#helpCenterOverlay .mt-faq-row:nth-child(4)"); // 2ª pergunta (search+title são filhos 1-2, faq rows a partir daí)
  await page.waitForTimeout(100);
  const faqToggled = await page.evaluate(() => {
    const rows = document.querySelectorAll("#helpCenterOverlay .mt-faq-row");
    return Array.from(rows).some((r) => r.classList.contains("open") && r !== rows[0]);
  });
  console.log("6) Central de ajuda abre e FAQ expande ao clicar:", helpOpen, "faq extra aberto:", faqToggled);
  await page.click("#helpCenterClose");
  await page.waitForTimeout(100);

  // 7) Histórico de compras: vazio no início (nenhuma recompensa usada ainda além do que já coletamos)
  await page.click("#settingsRowPurchaseHistory");
  await page.waitForTimeout(150);
  const purchaseState = await page.evaluate(() => ({
    open: document.getElementById("purchaseHistoryOverlay").classList.contains("open"),
    hasContent: document.getElementById("purchaseHistoryBody").children.length > 0,
  }));
  console.log("7) Histórico de compras abre (com ou sem entradas):", purchaseState.open, JSON.stringify(purchaseState));
  await page.click("#purchaseHistoryClose");

  // 8) Central de notificações: sino abre bottom sheet
  await page.click("#settingsBell");
  await page.waitForTimeout(150);
  const notifOpen = await page.evaluate(() => document.getElementById("notificationsSheetOverlay").classList.contains("open"));
  console.log("8) Central de notificações abre pelo sino:", notifOpen);
  await page.click("#notificationsSheetClose");
  await page.click("#settingsClose");

  // 9) Forçar uma notificação real (proposta recusada) e conferir que aparece no feed
  await page.evaluate(() => {
    pushNotification("proposta", "Fortaleza recusou sua proposta por G. Ramos.");
    persistCareer();
  });
  await openSettings();
  await page.click("#settingsBell");
  await page.waitForTimeout(150);
  const notifText = await page.evaluate(() => document.getElementById("notificationsSheetBody").textContent);
  console.log("9) Notificação forçada aparece no feed:", notifText.includes("Fortaleza recusou"), notifText.slice(0, 80));

  // 10) Sistema — splash tem crest de marca
  const hasCrest = await page.evaluate(() => !!document.querySelector(".mt-splash-crest"));
  console.log("10) Splash (#screenLoading) tem crest de marca no HTML:", hasCrest);

  await browser.close();
})();
