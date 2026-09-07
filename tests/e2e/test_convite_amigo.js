// Pedido do usuário (item 5 da lista de melhorias, "Vamos implementar
// todos na ordem abaixo"): "Convite de amigo por link — hoje o sistema
// de amigos (Ranking) só funciona com um código de 6 caracteres
// digitado manualmente. Um link de convite (Web Share API) reduziria
// fricção." Valida: botão "Compartilhar convite" (fallback de
// clipboard, já que o Chromium headless não implementa navigator.share
// nesta versão), captura do ?convite=CODE na URL antes do login, e o
// bug real encontrado no caminho (login pelo FORMULÁRIO nunca setava
// a global ME, quebrando showGameScreen() em silêncio pra quem já
// tinha carreira salva).
const { chromium } = require("playwright-core");

async function signupAndLogin(page, base, email, name) {
  await page.goto(base + "/", { waitUntil: "load" });
  await page.evaluate(async ({ email, name }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email, name });
}
async function newCareer(page, base) {
  await page.goto(base + "/carreira.html", { waitUntil: "load" });
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(200);
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
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    headless: true,
    args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"],
  });
  const base = "http://localhost:8787";

  // ---------- Conta A: dona do link de convite ----------
  const ctxA = await browser.newContext({ viewport: { width: 390, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
  const pageA = await ctxA.newPage();
  pageA.on("pageerror", (err) => console.log("PAGE ERROR (A):", err.message));
  const emailA = `convitea${Date.now()}@teste.com`;
  await signupAndLogin(pageA, base, emailA, "Convite A");
  await newCareer(pageA, base);
  await pageA.click("#btnBottomMenu");
  await pageA.waitForTimeout(150);
  await pageA.click('[data-submenu="progresso"]');
  await pageA.waitForTimeout(150);
  await pageA.click("#btnOpenRanking");
  await pageA.waitForTimeout(300);
  const codeA = await pageA.evaluate(() => ME.friendCode);
  console.log("0) Código de amigo da conta A existe:", !!codeA && codeA.length === 6, codeA);

  // 1) Botão "Compartilhar convite" existe e cai no fallback de
  // clipboard (Chromium headless não implementa navigator.share).
  const shareBtnExists = await pageA.$("#btnShareInvite");
  await pageA.click("#btnShareInvite");
  await pageA.waitForTimeout(200);
  const clipboardText = await pageA.evaluate(() => navigator.clipboard.readText()).catch(() => null);
  console.log("1) 'Compartilhar convite' existe e copia um link com o código pro clipboard:", !!shareBtnExists && !!clipboardText && clipboardText.includes(codeA) && clipboardText.includes("convite="), clipboardText);

  // 2) A própria dona clicando no próprio link não vira "amiga de si
  // mesma" (ignorado em silêncio).
  await pageA.goto(`${base}/carreira.html?convite=${codeA}`, { waitUntil: "load" });
  await pageA.waitForTimeout(800);
  const selfInvite = await pageA.evaluate(() => ({ friendsCount: (ME.friends || []).length, urlClean: !location.search.includes("convite") }));
  console.log("2) Clicar no PRÓPRIO link não adiciona a si mesma, e a URL fica limpa:", selfInvite.friendsCount === 0 && selfInvite.urlClean, JSON.stringify(selfInvite));

  // ---------- Conta B: visita o link de A SEM estar logada ----------
  const ctxB = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const pageB = await ctxB.newPage();
  pageB.on("pageerror", (err) => console.log("PAGE ERROR (B):", err.message));
  await pageB.goto(`${base}/carreira.html?convite=${codeA}`, { waitUntil: "load" });
  await pageB.waitForTimeout(300);
  const loginShown = await pageB.evaluate(() => !document.getElementById("screenLoginRequired").classList.contains("hidden"));
  const urlCleanedBeforeLogin = await pageB.evaluate(() => !location.search.includes("convite"));
  console.log("3) Visitante sem sessão vê a tela de login (convite fica guardado em sessionStorage), URL já limpa:", loginShown && urlCleanedBeforeLogin);

  // 4) Cadastro/login da conta B — pelo FLUXO NORMAL (fetch direto,
  // como o resto da suíte), depois reload pra passar pelo boot() com
  // o convite pendente em sessionStorage.
  const emailB = `conviteb${Date.now()}@teste.com`;
  await pageB.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Convite B", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email: emailB });
  await pageB.reload({ waitUntil: "load" });
  await pageB.waitForTimeout(1000);
  const bState = await pageB.evaluate(() => ({ friends: (ME && ME.friends) || [], onScreenPicker: !document.getElementById("screenCompetitionPicker").classList.contains("hidden") }));
  console.log("4) Depois de logar, o convite pendente vira amizade de verdade automaticamente:", bState.friends.length === 1, JSON.stringify(bState));

  // 5) Bidirecional: a conta A também ganha B como amiga.
  const friendsOfA = await pageA.evaluate(async () => (await (await fetch("/api/friends")).json()).friends);
  console.log("5) Amizade é bidirecional -- A também vê B na lista:", friendsOfA.length === 1 && friendsOfA[0].name === "Convite B", JSON.stringify(friendsOfA));

  // ---------- Bug real encontrado no caminho: login pelo FORMULÁRIO
  // visível (não pelo bypass de fetch) nunca setava ME, quebrando
  // showGameScreen() (ME.onboardingSeen) em silêncio pra quem já tinha
  // carreira salva. ----------
  await newCareer(pageB, base);
  await pageB.evaluate(async () => { await fetch("/api/auth/logout", { method: "POST" }); });
  await pageB.reload({ waitUntil: "load" });
  await pageB.waitForTimeout(300);
  await pageB.fill("#ctLoginEmail", emailB);
  await pageB.fill("#ctLoginPassword", "senha123");
  await pageB.click("#ctLoginForm button[type=submit]");
  await pageB.waitForTimeout(1500);
  const afterFormLogin = await pageB.evaluate(() => ({
    meSet: !!ME,
    gameVisible: !document.getElementById("screenGame").classList.contains("hidden"),
    loginErrorText: document.getElementById("ctLoginError").textContent,
  }));
  console.log("6) BUG CORRIGIDO: login pelo formulário seta ME e não quebra showGameScreen():",
    afterFormLogin.meSet && afterFormLogin.gameVisible && !afterFormLogin.loginErrorText, JSON.stringify(afterFormLogin));

  await browser.close();
  console.log("OK");
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
