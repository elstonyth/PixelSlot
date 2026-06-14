# Scaling / HA runbook

**Status:** deliberately deferred. Both apps and both managed DB clusters run
**single-instance / single-node** today — cheapest, fine for demo / low traffic,
**not** highly available. This file is the one-command path to HA when real
(paying) traffic arrives. No infra change is implied by this doc existing.

## Current footprint (baseline)

| Component | App / cluster | Size | Count |
| --- | --- | --- | --- |
| Backend API (`backend`) | `pokenic-backend` `9011b06c-…` | `basic-xs` | 1 |
| Backend worker (`worker`) | `pokenic-backend` | `basic-xxs` | 1 |
| Storefront (`storefront`) | `pokenic-storefront` `a3625ff4-…` | `basic-xxs` | 1 |
| Postgres | `pokenic-pg` `5dc93810-…` | `db-s-1vcpu-1gb` | 1 node |
| Valkey | `pokenic-valkey` `a542f931-…` | `db-s-1vcpu-1gb` | 1 node |

## When to pull the trigger

Add HA when **any** of: first paying customers; a deploy-time outage becomes
user-visible; or sustained CPU/MEM alerts (see the `alerts` block in the specs)
start firing. Until then, single-instance is the right cost choice.

## 1. Web redundancy (App Platform)

The backend is **already architected for horizontal scale** — server/worker split
with Redis-backed cache, event bus, workflow engine, locking, and sessions
(`medusa-config.ts`), so multiple `server` instances share state safely. The
storefront is stateless Next standalone. So HA is purely a count bump:

In `.do/backend.app.yaml` (the `backend` service) and `.do/storefront.app.yaml`:

```yaml
    instance_count: 2   # was 1
```

Then `pwsh scripts/do-apply.ps1 backend` / `… storefront`. App Platform load-
balances across instances and does rolling deploys, so 2× also removes the
single-instance deploy gap.

> **Autoscaling needs a tier upgrade.** Dynamic autoscaling (`autoscaling:` block
> with min/max + CPU target) is **not** available on `basic-*`. It requires
> `professional-*` instances. Static `instance_count: 2+` is the basic-tier HA
> path; only move to `professional-*` + `autoscaling` if traffic is spiky enough
> to justify it.

The `worker` can stay at 1 (queue draining tolerates a brief gap); bump it too
only if event/workflow throughput becomes the bottleneck.

## 2. Database failover (managed clusters)

Add a standby node so a primary failure fails over automatically:

```bash
doctl databases resize 5dc93810-cc8a-4172-aa94-6d08dd802094 \
  --size db-s-1vcpu-1gb --num-nodes 2   # Postgres standby
doctl databases resize a542f931-5b0f-4032-a613-53e3218f64a2 \
  --size db-s-1vcpu-1gb --num-nodes 2   # Valkey replica
```

`--num-nodes 2` = primary + standby (Postgres) / primary + replica (Valkey); DO
manages failover. The app connection string is unchanged (it already targets the
cluster endpoint). Resizing is online but can briefly blip connections — do it in
a maintenance window.

## Cost note

Each web `instance_count` increment and each added DB node is billed as another
unit (roughly doubles that line item at 2×). Scale the web tier and the DB tier
independently — they fail for different reasons (traffic vs node loss).
