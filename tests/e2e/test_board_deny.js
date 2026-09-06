const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    headless: true,
    args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  const base = "http://localhost:8787";
  const email = `boarddeny${Date.now()}@teste.com`;

  await page.goto(base + "/", { waitUntil: "load" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Board Deny", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
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

  // Força posição no meio da tabela (10º de 20) direto via API, testando
  // a negativa da diretoria sem precisar simular rodadas de verdade —
  // explicitamente usa CAREER.clubId (não a ordem de iteração, que não
  // bate com o id do clube do usuário).
  await page.evaluate(async () => {
    const r = await fetch("/api/career");
    const data = await r.json();
    const myId = data.career.clubId;
    const ids = Object.keys(data.career.standings);
    let i = 0;
    ids.forEach((id) => {
      if (id === myId) return; // seta o meu por último, garantido no meio
      data.career.standings[id].pts = (ids.length - i) * 3;
      i++;
    });
    data.career.standings[myId].pts = 27; // ~10º lugar de 20 (nem G4, nem Z4)
    await fetch("/api/career", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data.career) });
  });
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(800);

  const results = [];
  for (let i = 0; i < 5; i++) {
    const r = await page.evaluate(async () => {
      const resp = await fetch("/api/career");
      const data = await resp.json();
      data.career.lastBoardRequestRound = null; // reseta cooldown a cada tentativa
      await fetch("/api/career", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data.career) });
      return true;
    });
    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(500);
    await page.click(".m3-nav-item[data-panel='clube']"); await page.waitForTimeout(200); await page.click("#btnAskBoard");
    await page.waitForTimeout(300);
    const decision = await page.evaluate(async () => (await (await fetch("/api/career")).json()).career.boardDecision);
    results.push(decision.startsWith("✅") ? "aprovado" : "negado");
  }
  console.log("Posição forçada: 10º de 20 (meio de tabela) — resultados de 5 pedidos:", results.join(", "));
  const finalDecision = await page.evaluate(async () => (await (await fetch("/api/career")).json()).career.boardDecision);
  console.log("Última decisão:", finalDecision);
  await page.screenshot({ path: "board-3-negado.png" });

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
