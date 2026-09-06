const { chromium } = require("playwright-core");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    headless: true,
    args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("fonts.googleapis") && !m.text().includes("fundingchoices")) console.log("CONSOLE ERROR:", m.text()); });

  const base = "http://localhost:8787";

  // 1) Acessa carreira.html SEM sessão -> deve mostrar a tela de login.
  await page.goto(base + "/carreira.html", { waitUntil: "load" });
  await page.waitForTimeout(500);
  const loginScreenVisible = await page.evaluate(() => !document.getElementById("screenLoginRequired").classList.contains("hidden"));
  console.log("1) Tela de login do Modo Técnico aparece sem sessão:", loginScreenVisible);

  const linkHref = await page.evaluate(() => document.querySelector('#screenLoginRequired a[href^="/"]').getAttribute("href"));
  console.log("   Link 'Cadastre-se' aponta pra:", linkHref);

  // 2) Clica no link "Cadastre-se no BR Data" -> deve navegar E abrir
  // a view de CADASTRO do gate (não a home "pura").
  await page.click('#screenLoginRequired a[href^="/"]');
  await page.waitForLoadState("load");
  await page.waitForTimeout(600);

  const urlAfter = page.url();
  console.log("2) URL depois do clique:", urlAfter);

  const gateVisible = await page.evaluate(() => document.getElementById("authGate").style.display);
  const signupVisible = await page.evaluate(() => document.getElementById("gateSignupView").style.display);
  const loginVisible = await page.evaluate(() => document.getElementById("gateLoginView").style.display);
  console.log("   Gate visível:", gateVisible, "| view cadastro:", signupVisible, "| view login:", loginVisible);
  console.log("3) Corrigido -- abre direto a tela de CADASTRO (não a home comum):", gateVisible === "flex" && signupVisible === "block");

  // 4) Confirma que o cadastro em si continua funcionando dali.
  await page.waitForSelector("#gatePlansGrid .plan-card", { timeout: 5000 });
  await page.click("#gatePlansGrid .plan-card");
  await page.waitForTimeout(200);
  await page.fill("#gateName", "Teste Link Cadastro");
  await page.fill("#gatePhone", "11988887777");
  const email = `linkfix${Date.now()}@teste.com`;
  await page.fill("#gateEmail", email);
  await page.fill("#gatePassword", "senha1234");
  await page.click("#gateSignupSubmit");
  await page.waitForTimeout(1200);
  const successMsg = await page.evaluate(() => document.getElementById("gateLoginNotice")?.textContent || "");
  console.log("4) Cadastro concluído com sucesso a partir desse fluxo:", successMsg.includes("Conta criada"));

  // 5) URL com ?signup=1 não fica "grudada" (limpa depois de processar).
  console.log("5) URL final sem o parâmetro signup pendurado:", !urlAfter.includes("signup=1") || page.url().indexOf("signup=1") === -1);
  console.log("   URL final:", page.url());

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
