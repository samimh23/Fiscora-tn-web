# Assistant chat improvements

The full assistant page and floating widget share the same source controls and
request guard. Financial answers remain read-only; this change does not post
entries, close periods, assign tasks, send messages, or modify accounting data.

## User-visible behaviour

- Follow-ups such as “And its remaining balance?” resolve a single preceding
  invoice/document from server-scoped history. Several possible sources trigger
  a clarification. Current payment facts are read again from business records.
- Document source buttons open an authenticated original preview and an excerpt
  of approved structured data. An exact page is selected only when OCR mapping
  identifies it; an unknown/multiple-page location is stated explicitly.
- Badges distinguish app help, approved-document retrieval, live accounting
  records and deterministic calculations.
- Failed questions remain in the composer and can be retried from their message.
  Retry reuses that question bubble. “Arrêter l’attente” aborts the browser wait,
  not necessarily an already-running server/model computation.
- New conversation, dossier/user changes and unmount invalidate old requests.
  Delayed responses cannot be appended to the newly selected conversation.
  History is user/organization/dossier scoped; new-conversation boundaries remain
  per-browser-session, not a new cross-device conversation-ID system.

New button/badge styles use a `chat-` daisyUI prefix under `.fiscora-chat-tools`.
Tailwind Preflight is not loaded; existing MUI components remain in place.

## Verification

```powershell
npm run test:session
npm run test:workflows
npm run test:e2e -- e2e/assistant-reliability.spec.ts e2e/assistant-live-finance.spec.ts --project=desktop --project=mobile
```

Browser tests mock authentication, API answers and documents locally. They do not
log in to production or establish deployed-model accuracy. The backend evaluation
runner additionally checks expected source IDs, response scope, exact numbers,
forbidden claims, inline citation validity and configured follow-up sequences.
