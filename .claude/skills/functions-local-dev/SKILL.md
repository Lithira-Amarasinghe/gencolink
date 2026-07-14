---
name: functions-local-dev
description: Set up and run the Gencolink Azure Functions app (functions/) locally. Use when the user asks to "start functions", "run the contact-email function locally", or when functions/local.settings.json is missing.
disable-model-invocation: true
---

The `functions/` project (`send-contact-email`, Azure Functions, Node ≥18) needs local config before it can run — this is not committed to git.

1. Check whether `functions/local.settings.json` exists. If not, copy it from `functions/local.settings.json.example`.
2. Tell the user which values still need filling in: `AzureWebJobsStorage`, `ACS_ENDPOINT`, `ACS_SENDER_ADDRESS`, `CONTACT_RECIPIENT_EMAIL`. Never invent placeholder-looking real credentials — leave this to the user. Note: the function authenticates to ACS with Entra ID (`DefaultAzureCredential`), not a connection string — there is no ACS secret to set. `ACS_ENDPOINT` is just the resource's endpoint URL.
3. For email to actually send locally, the developer must be signed in with `az login` on an account that holds the **Communication and Email Service Owner** role on the ACS resource — `DefaultAzureCredential` uses that CLI session locally. (In Azure the Function App's managed identity has this role automatically.)
4. From `functions/`, run `npm start` (this runs `func start` — requires Azure Functions Core Tools installed). `npm run build` is a no-op for this project; there's no compile step.
4. Note that in production this function is triggered by a Directus Flow (webhook on the `contact_submissions` collection), not by anything in the `functions/` code — that wiring only exists in the Directus instance's config, so it won't show up locally unless the Directus Flow is also configured to call this local endpoint.
