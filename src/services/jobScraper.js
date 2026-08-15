// Busca o texto da vaga a partir do link colado pelo candidato.
//
// Limitação conhecida (MVP): isso é um GET simples + limpeza de HTML, sem
// renderizar JavaScript. Funciona bem para páginas de vaga server-rendered
// (LinkedIn, Gupy, muitos ATS); para páginas que montam o conteúdo via JS
// no client, o texto pode vir incompleto — nesse caso o fluxo de conversa
// pede pro candidato colar a descrição da vaga manualmente (ver
// conversation/handlers/jobIntake.js). Evoluir isso para renderização com
// um browser headless (Playwright) é o próximo passo natural quando o
// volume justificar o custo extra.

const MAX_CHARS = 12000;

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function fetchJobText(url) {
  let res;
  try {
    res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; InterviewLabBot/0.1; +https://interviewlab.example)',
      },
      redirect: 'follow',
    });
  } catch (err) {
    throw new Error(`Não consegui acessar esse link (${err.message}).`);
  }
  if (!res.ok) {
    throw new Error(`O link retornou status ${res.status} — confere se ele está público.`);
  }
  const html = await res.text();
  const text = stripHtml(html).slice(0, MAX_CHARS);
  if (text.length < 100) {
    throw new Error(
      'Consegui abrir o link, mas não achei texto suficiente da vaga nele (pode exigir login ou carregar via JavaScript).'
    );
  }
  return text;
}

module.exports = { fetchJobText };
