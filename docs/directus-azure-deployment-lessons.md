# Deploying Directus to Azure — Lessons Learned

A field guide from actually deploying Directus (headless CMS) to Azure, covering two hosting
options (App Service and Container Apps), the real problems hit along the way, and how they
were solved. No secrets, keys, or credentials included — safe to share.

---

## 1. The two hosting options

| | Azure Container Apps | Azure App Service (Web App for Containers) |
|---|---|---|
| Underlying tech | Kubernetes-based (via KEDA) | Azure's own older container hosting layer |
| Scale-to-zero | Yes (native, free when idle) | No (always running on paid tiers) |
| Container sandboxing | More standard/complete Linux runtime | More restricted (`/proc` access limited) |
| Best for | Cost-sensitive, bursty traffic | Simpler mental model, predictable pricing |

**Both work for Directus** — but not with every Directus version (see below).

---

## 2. The big lesson: Directus's Docker image internals matter

Directus's official Docker image doesn't run the app directly — it launches it through
**PM2** (a Node.js process supervisor). PM2 needs to read `/proc/<pid>/...` continuously to
monitor its child process.

**What happened:** on App Service, with Directus `10.13.1`, PM2 would launch, then hang
forever — never actually starting the real server. No crash message, no error, just
silence until Azure's platform gave up and killed the container. This looked like every
possible infra problem (region, tier, timeout, network) but was actually specific to how
that image version's PM2 wrapper interacts with App Service's container sandbox.

**The fix:** upgrading to Directus `12.1.1` resolved it completely — newer Directus Docker
images changed how the process is supervised, sidestepping whatever the old image was
doing that broke on App Service.

**Lesson:** if a container hangs identically across every infra permutation you try
(region, size, timeout, network config), stop tuning infra — check if a **newer image
version** behaves differently. Infra-only troubleshooting has a ceiling; sometimes the fix
is upstream.

---

## 3. Azure's container warmup probe — a hidden gotcha

Azure App Service's *initial* startup check (separate from your configured health check
path) pings a **nonexistent path** (`/robots933456.txt`) and just needs *any* HTTP status
back — even a 404 counts as "alive." If your app doesn't reply to unknown routes at all
(hangs instead of quick-404ing), this specific probe fails silently and the platform
restarts the container in a loop forever.

**Lesson:** if a container seems to boot fine internally but Azure keeps killing it, check
this specific behavior — it's an Azure-specific quirk, not something obvious from your own
app's logs.

---

## 4. Key Vault: use RBAC, not legacy Access Policies

Two ways to grant an app permission to read secrets from Key Vault:
- **Access Policies** (older model) — proved unreliable in this deployment: correct policy
  configured, correct identity, correct permissions — and it still silently denied access
  for reasons that were never fully explained by Azure's error messages.
- **RBAC roles** (Microsoft's current recommendation) — same intent, different underlying
  mechanism, and it resolved cleanly on the first try.

**Lesson:** default to RBAC for Key Vault access grants. If access policies are
misbehaving with no clear error, migrating to RBAC is a legitimate fix, not just a
"try something else."

---

## 5. Storage configuration — variable names matter exactly

Directus needs **multiple** environment variables to actually use cloud blob storage
(Azure Blob, S3, etc.) — not just a key. Missing any of them means Directus silently falls
back to storing uploaded files inside the container's own temporary filesystem, which is
**wiped on every restart**.

Required for Azure specifically (conceptually — check current Directus docs for exact names):
- Which storage locations exist
- Which driver each location uses
- The container/bucket name
- The account/identity name
- The access key or credential

**Lesson:** double-check *all* required variables for a storage driver are present, not
just the "obvious" one (the key). An incomplete config doesn't error — it just silently
uses the wrong (ephemeral) storage instead, and you don't find out until files disappear.

---

## 6. Network security: locking down who can reach your database/storage

**Goal:** don't leave the database/storage open to "any Azure customer's resources" (a
common overly-broad default) — restrict it to just your own app.

**What actually works, in order of strength (and cost):**

1. **IP-based firewall rules** — allow only your app's specific outbound IP addresses.
   Free, works with any authentication method. Downside: those IPs *can* change (tier
   changes, region moves, resource recreation), so rules need to stay in sync.
2. **"Trust this specific resource" rules** — a stronger mechanism exists (resource-based
   trust) but **only works if your app authenticates via Managed Identity**. If your app
   uses a plain key/password to connect (common for many CMS/DB drivers), this mechanism
   won't recognize it at all — it'll get silently blocked, looking identical to a
   misconfiguration.
3. **VNet Service Endpoints** — free, and solves the "IPs drift" problem: instead of
   trusting IPs, you trust a specific virtual network subnet. More setup work, but stable
   long-term.
4. **Private Endpoints** — strongest option, small ongoing cost, removes the resource from
   the public internet entirely.

**Lesson:** "restrict to my app" isn't one universal switch — the right mechanism depends
on *how* your app authenticates to the target service. Check that before choosing an
approach.

---

## 7. Infrastructure as Code (Terraform) gotchas

- **Circular dependencies are real:** if Resource A needs Resource B to exist first (e.g.,
  needs its access key), Resource B's config can't also depend on Resource A's own output
  in the same pass — you'll get a dependency cycle error. Fix: read the needed value via a
  separate read-only lookup instead of the direct resource reference.
- **Some cloud values are "eventually consistent":** right after Terraform changes
  something (like a compute tier), a *dependent* value (like assigned IP addresses) might
  not be fully updated yet within that same apply. A second `apply` run picks up the
  correct value once the cloud platform has caught up internally. Not a bug — just how
  distributed systems work.
- **Never commit plan files** (`.tfplan` or similar) to git — they're local, disposable,
  can go stale instantly, and may contain resolved sensitive values.

---

## 8. General troubleshooting method that actually worked

When a container/app hangs with no clear error, systematically eliminate variables **one
at a time**, verifying after each:

1. Compute size/tier (rules out resource starvation)
2. Region/network latency
3. Startup timeout limits
4. Credentials/secrets resolution
5. Health check configuration
6. **The application image/version itself** — often overlooked, but can be the actual
   answer when everything infra-side checks out

Keep a live log open throughout (not just curl checks) — the actual container startup log
usually shows a much clearer signature (e.g., "gets this far every time, then silence")
than a bare HTTP status code ever will.

---

*Written after a real multi-hour debugging session. Every point here was hit for real, not
theoretical.*
