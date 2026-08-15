# Deploy

## Docker (qualquer host)

```bash
cp .env.example .env   # preencha com suas chaves
docker compose up -d --build
```

O `docker-compose.yml` já cria um volume nomeado (`interview-lab-data`)
montado em `/app/data`, então os dados sobrevivem a rebuilds/restarts do
container.

## Railway (ou outro PaaS baseado em container)

1. Crie um novo projeto no Railway e conecte este repositório — ele
   detecta o `Dockerfile` automaticamente.
2. Em **Variables**, copie todas as chaves do `.env.example` preenchidas
   com valores reais.
3. **Importante:** adicione um **Volume** montado em `/app/data`. Sem
   isso, cada novo deploy apaga usuários, sessões e o banco de perguntas
   acumulado (mesmo problema que qualquer app com estado em arquivo
   local — ver `docs/ARCHITECTURE.md`).
4. Depois do primeiro deploy, pegue a URL pública gerada pelo Railway e
   configure como Callback URL do webhook na Meta (`docs/WHATSAPP-SETUP.md`).
5. Teste: `GET https://SEU_APP.up.railway.app/health` deve responder
   `{"ok": true, ...}`.

## Checklist pós-deploy

- [ ] `WHATSAPP_ACCESS_TOKEN` é um token **permanente** (System User), não
      o temporário de 24h do modo de teste
- [ ] Webhook verificado com sucesso na Meta (`Verify and save` sem erro)
- [ ] `WHATSAPP_APP_SECRET` configurado (ativa validação de assinatura)
- [ ] Volume persistente montado em `/app/data`
- [ ] `ANTHROPIC_API_KEY` válida e com limite de gasto configurado
- [ ] Mandar uma mensagem de teste pro número e confirmar que o
      InterviewLab responde
