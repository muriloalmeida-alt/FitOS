#!/usr/bin/env node
// Runner paralelo pra suíte de regressão (pedido do usuário: "estamos
// desenvolvendo em minutos e testando em horas") — os ~108 scripts
// test_*.js sempre rodaram em série (for loop bash, 1 de cada vez),
// mesmo sendo processos 100% independentes (cada um cria sua própria
// conta/carreira, seu próprio browser headless) contra um servidor
// cujo estado por conta já vive num Map em memória (ver
// careerStore.js/debouncedPersist.js — sem race condition entre
// contas diferentes, e a escrita em disco é assíncrona e debounced há
// muito, então não serializa nada aqui). O gargalo real sempre foi
// rodar 1 processo Node+Chromium de cada vez esperando o anterior
// terminar — isso aqui roda N em paralelo (pool de workers) contra o
// MESMO servidor já de pé.
//
// Uso:
//   node run_parallel.js [glob] [--concurrency=N] [--timeout=MS]
// Exemplos:
//   node run_parallel.js                     # todos os test_*.js, concorrência 6
//   node run_parallel.js test_mercado         # só os que casam "test_mercado*"
//   node run_parallel.js --concurrency=10
//
// Pré-requisitos: ver README.md desta pasta (playwright-core +
// Chromium via PW_CHROMIUM_PATH, servidor local rodando).
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const DIR = __dirname;
const args = process.argv.slice(2);
const filterArg = args.find((a) => !a.startsWith("--"));
const concurrency = Number((args.find((a) => a.startsWith("--concurrency=")) || "").split("=")[1]) || 6;
const timeoutMs = Number((args.find((a) => a.startsWith("--timeout=")) || "").split("=")[1]) || 90000;

const allFiles = fs.readdirSync(DIR).filter((f) => f.startsWith("test_") && f.endsWith(".js"));
const files = (filterArg ? allFiles.filter((f) => f.includes(filterArg)) : allFiles).sort();

if (!files.length) {
  console.error("Nenhum arquivo test_*.js encontrado" + (filterArg ? ` casando "${filterArg}"` : "") + ".");
  process.exit(1);
}

console.log(`Rodando ${files.length} script(s) com concorrência ${concurrency} (timeout ${timeoutMs}ms cada)...\n`);

function runOne(file) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(process.execPath, [path.join(DIR, file)], { cwd: DIR });
    let out = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { out += d; });
    const killer = setTimeout(() => {
      child.kill("SIGKILL");
    }, timeoutMs);
    child.on("close", (code) => {
      clearTimeout(killer);
      resolve({ file, code, out, ms: Date.now() - startedAt });
    });
  });
}

async function main() {
  const t0 = Date.now();
  const queue = [...files];
  const results = [];
  let running = 0;
  let doneCount = 0;

  await new Promise((resolveAll) => {
    function pump() {
      if (!queue.length && running === 0) return resolveAll();
      while (running < concurrency && queue.length) {
        const file = queue.shift();
        running++;
        runOne(file).then((r) => {
          running--;
          doneCount++;
          results.push(r);
          const tag = r.code === 0 ? "PASS" : `FAIL(${r.code})`;
          process.stdout.write(`[${doneCount}/${files.length}] ${tag.padEnd(9)} ${r.file}  (${(r.ms / 1000).toFixed(1)}s)\n`);
          pump();
        });
      }
    }
    pump();
  });

  const totalMs = Date.now() - t0;
  const fails = results.filter((r) => r.code !== 0).sort((a, b) => a.file.localeCompare(b.file));
  const passCount = results.length - fails.length;

  console.log("\n" + "=".repeat(60));
  console.log(`Concluído em ${(totalMs / 1000).toFixed(1)}s (soma serial teria sido ~${(results.reduce((s, r) => s + r.ms, 0) / 1000).toFixed(1)}s)`);
  console.log(`${passCount}/${results.length} passaram, ${fails.length} falharam.`);
  if (fails.length) {
    console.log("\nFalhas:");
    fails.forEach((r) => {
      console.log(`\n=== FAIL(${r.code}): ${r.file} (${(r.ms / 1000).toFixed(1)}s) ===`);
      console.log(r.out.trim().split("\n").slice(-8).join("\n"));
    });
  }
  fs.writeFileSync(path.join(DIR, "_last_parallel_run.json"), JSON.stringify({ totalMs, results }, null, 2));
  process.exit(fails.length ? 1 : 0);
}

main();
