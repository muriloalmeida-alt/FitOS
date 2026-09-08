// Verifica o manifest e as tags PWA da página do Modo Técnico
// (carreira.html) sem afetar o manifest/instalação do site principal.
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";

  // 1) carreira.html referencia o manifest PRÓPRIO, não o do site
  // principal, e as tags de ícone/nome batem com "BR Treinador".
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  const headInfo = await page.evaluate(() => {
    const manifestLink = document.querySelector('link[rel="manifest"]');
    return {
      manifestHref: manifestLink ? manifestLink.getAttribute("href") : null,
      appleTitle: document.querySelector('meta[name="apple-mobile-web-app-title"]')?.getAttribute("content"),
      appleTouchIcon: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute("href"),
      themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute("content"),
      mobileWebAppCapable: document.querySelector('meta[name="mobile-web-app-capable"]')?.getAttribute("content"),
      pageTitle: document.title,
    };
  });
  console.log("1) carreira.html referencia manifest-treinador.json (próprio, não o do site):", headInfo.manifestHref === "manifest-treinador.json");
  console.log("   apple-mobile-web-app-title = 'BR Treinador':", headInfo.appleTitle === "BR Treinador");
  console.log("   apple-touch-icon presente:", !!headInfo.appleTouchIcon);
  console.log("   theme-color definida:", !!headInfo.themeColor);
  console.log("   mobile-web-app-capable = yes:", headInfo.mobileWebAppCapable === "yes");
  console.log("   <title> da aba continua igual (não mexido):", headInfo.pageTitle === "Modo Técnico · BR Data");

  // 2) O manifest resolve de verdade (fetch real, o mesmo que o Chrome
  // faz pra montar a modal de instalação) com nome/ícones certos.
  const manifestUrl = new URL(headInfo.manifestHref, base + "/carreira.html").href;
  const manifestRes = await page.evaluate(async (url) => {
    const res = await fetch(url);
    return { ok: res.ok, contentType: res.headers.get("content-type"), body: await res.json() };
  }, manifestUrl);
  console.log("2) manifest-treinador.json responde 200:", manifestRes.ok);
  console.log("   name/short_name = 'BR Treinador':", manifestRes.body.name === "BR Treinador" && manifestRes.body.short_name === "BR Treinador");
  console.log("   start_url aponta pra carreira.html:", manifestRes.body.start_url.includes("carreira.html"));
  console.log("   tem ícone maskable de 512 (brasão em destaque, área de segurança do Android):", manifestRes.body.icons.some((i) => i.purpose === "maskable" && i.sizes === "512x512"));
  console.log("   tem ícone 'any' de 192 e 512:", manifestRes.body.icons.some((i) => i.purpose === "any" && i.sizes === "192x192") && manifestRes.body.icons.some((i) => i.purpose === "any" && i.sizes === "512x512"));

  // 3) Todos os ícones referenciados no manifest realmente existem
  // (200, não 404) -- um manifest com ícone quebrado não instala.
  const iconChecks = await page.evaluate(async (icons) => {
    const results = [];
    for (const icon of icons) {
      const res = await fetch(icon.src);
      results.push({ src: icon.src, ok: res.ok, status: res.status });
    }
    return results;
  }, manifestRes.body.icons);
  console.log("3) Todos os ícones do manifest existem (200):", iconChecks.every((r) => r.ok), JSON.stringify(iconChecks.filter((r) => !r.ok)));

  // 4) O manifest do site PRINCIPAL continua intacto (não foi
  // mexido/sobrescrito por engano).
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  const mainManifestHref = await page.evaluate(() => document.querySelector('link[rel="manifest"]')?.getAttribute("href"));
  const mainManifest = await page.evaluate(async () => (await (await fetch("/manifest.json")).json()));
  console.log("4) index.html continua referenciando manifest.json (não mudou):", mainManifestHref === "manifest.json");
  console.log("   manifest.json do site principal continua 'BR Data' (intacto):", mainManifest.name === "BR Data — Brasileirão 2026" && mainManifest.short_name === "BR Data");

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
