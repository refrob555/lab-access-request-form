# Lab Access Request Form

Public browse/download home for the ATC Flex Labs / Lab Access request form.

**Deploy source of truth:** Cursor Origin repo `robert-fricke/lab-access-request-form` (Worker `mec-lab-access`).  
**Live student form:** [https://forms.trainlabhq.com/atcflexlabaccess](https://forms.trainlabhq.com/atcflexlabaccess)

This GitHub repository is a scrubbed public mirror for reading and downloading the code. It is **not** the deploy source of truth. Deployments to Cloudflare Workers / `forms.trainlabhq.com` are made from Origin, not from this mirror.

## What this app does

Students request time in a Rock Valley College program lab outside scheduled class. Submitting sends the student a receipt and emails the full request to the lab coordinator. The app is a [Cloudflare Worker](https://developers.cloudflare.com/workers/) with static assets under `public/`.

## Privacy scrub (this mirror)

Compared with the private Origin tip, this public copy replaces:

- Personal and school coordinator email addresses with placeholders (`coordinator@example.com`, `coordinator@example.edu`)
- Instructor notification addresses in `config/instructor-emails.json` with `{id}@example.edu`
- Cloudflare `account_id` and KV namespace `id` with `YOUR_*` placeholders
- Personal `workers.dev` hostnames with `YOUR_SUBDOMAIN` placeholders
- README deploy narrative so it documents **env var names only** (no real secrets)

No real `.env` / `.dev.vars`, API keys, Resend tokens, Gmail app passwords, or student PII are included. Test fixtures use fictional addresses and fake secret strings.

## Required secrets / env var names

Set these via `wrangler secret put` (or `.dev.vars` locally). **Do not commit values.**

| Name | Where | Purpose |
| --- | --- | --- |
| `EMAIL_MODE` | secret or `.dev.vars` | `mock`, `gmail_smtp`, or `resend` |
| `STAFF_EMAIL` | `wrangler.jsonc` vars or env | Coordinator inbox |
| `EMAIL_FROM` | secret | From header for outbound mail |
| `GMAIL_APP_PASSWORD` | secret | Gmail SMTP app password when `EMAIL_MODE=gmail_smtp` |
| `RESEND_API_KEY` | secret | Resend API key when `EMAIL_MODE=resend` |
| `RECEIPT_SECRET` | secret | Signs confirmation cookie and reply links |
| `MOCK_TOKEN` | `.dev.vars` only | Unlocks `/dev/outbox` in local mock mode |
| `PUBLIC_BASE_URL` | vars | Absolute origin+path used in email links |
| `BASE_PATH` | vars | URL prefix (live: `/atcflexlabaccess`) |

Bindings (names only): `ASSETS`, `DECISIONS` (KV), `DECISION_LOCK` (Durable Object).

Before deploy, replace placeholders in `wrangler.jsonc`:

- `account_id`: `YOUR_CLOUDFLARE_ACCOUNT_ID`
- KV `id`: `YOUR_KV_NAMESPACE_ID`
- `STAFF_EMAIL` / `PUBLIC_BASE_URL` as appropriate for your account

## Run locally

Requires Node.js 20+.

```bash
cp .dev.vars.example .dev.vars
npm install
npm start
```

Open http://127.0.0.1:43123 (with `BASE_PATH`, also under `/atcflexlabaccess`).

`.dev.vars` turns on mock mode. Nothing is emailed. Inspect payloads at `GET /dev/outbox` with header `Authorization: Bearer local-dev-only`.

```bash
npm test
npm run typecheck
```

## Edit classes and instructors

Edit `config/options.json`, then redeploy from **Origin** (`npm run deploy` there). Local `npm start` picks up the file on save.

- `classes` and `instructors` are `{ "id", "label" }` lists
- Instructor notification emails live in `config/instructor-emails.json` (placeholder domains in this mirror)
- `dayStart`, `dayEnd`, `slotMinutes`, `maxDurationMinutes`, `maxDaysAhead`, `timezone` control the date/time UI

## Class conflicts

A request is still accepted when the lab and time overlap a Fall 2026 ATC class. The form shows a warning; emails list the overlapping section. Rooms are fixed in `config/lab-rooms.json`.

## Reply links

Staff mail includes a respond link. Decisions are recorded only after confirmation (Durable Object claim). Results are stored in the `DECISIONS` KV namespace.

## License / use

Mirror for reference and local experimentation. Production deploy and secrets stay on Origin / your Cloudflare account.
