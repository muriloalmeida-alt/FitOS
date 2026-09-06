// Verifica que os 11 clubes da Série B com escudo real (DEMO_TEAMS_SERIE_B)
// mostram a imagem de verdade (crestImg -> t.logo) e os outros 9 continuam
// no monograma de sigla (fallback).
const { chromium } = require("playwright-core");

const COM_ESCUDO = ["Goiás", "Avaí", "Criciúma", "Vila Nova", "Cuiabá", "Atlético Goianiense", "CRB", "Novorizontino", "Operário-PR", "Botafogo-SP", "Athletic Club"];
const SEM_ESCUDO = ["Athletico Paranaense", "Coritiba", "Chapecoense", "Remo", "América Mineiro", "Amazonas", "Paysandu", "Volta Redonda", "Ferroviária"];

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `serieb-escudos${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Serie B Escudos", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.click('.mt-competition-card[data-competition="serie_b"]');
  await page.waitForTimeout(300);

  // 1) Escolha do clube: os 11 têm <img> de verdade dentro do escudo,
  // os outros 9 têm o monograma (span.ct-crest-mono).
  const result = await page.evaluate(({ comEscudo, semEscudo }) => {
    function statusFor(name) {
      const cards = [...document.querySelectorAll(".m3-club-row")];
      const card = cards.find((c) => c.textContent.includes(name));
      if (!card) return "não achado";
      const hasImg = !!card.querySelector(".ct-crest img");
      const hasMono = !!card.querySelector(".ct-crest .ct-crest-mono");
      return hasImg ? "imagem" : hasMono ? "monograma" : "nenhum";
    }
    const withCrest = comEscudo.map((n) => ({ name: n, status: statusFor(n) }));
    const without = semEscudo.map((n) => ({ name: n, status: statusFor(n) }));
    return { withCrest, without };
  }, { comEscudo: COM_ESCUDO, semEscudo: SEM_ESCUDO });

  const allWithImage = result.withCrest.every((r) => r.status === "imagem");
  const allWithMono = result.without.every((r) => r.status === "monograma");
  console.log("1) Os 11 clubes com escudo real mostram <img>:", allWithImage, JSON.stringify(result.withCrest.filter(r => r.status !== "imagem")));
  console.log("2) Os 9 clubes restantes continuam no monograma:", allWithMono, JSON.stringify(result.without.filter(r => r.status !== "monograma")));

  // 2) Abre um clube com escudo real e confere na Central também.
  await page.evaluate(() => {
    const cards = [...document.querySelectorAll(".m3-club-row")];
    const goias = cards.find((c) => c.textContent.includes("Goiás"));
    goias.click();
  });
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.waitForTimeout(1500);
  const centralHasImg = await page.evaluate(() => {
    const nextMatch = document.querySelector(".m3-hero-match");
    return nextMatch ? !!nextMatch.querySelector("img") : null;
  });
  console.log("3) Escudo real também aparece no card 'Próximo jogo' da Central:", centralHasImg);

  await page.screenshot({ path: "screens/serieb-01-escolha-clube.png" });

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
