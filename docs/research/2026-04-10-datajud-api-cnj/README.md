# DATAJUD API — Research Index

**Date:** 2026-04-10
**Topic:** CNJ DataJud Public API — Integration for Brazilian KYC/Fintech

## TL;DR

DataJud is Brazil's national judicial database operated by the CNJ. Its public API exposes Elasticsearch endpoints for querying court case metadata across 90+ tribunals. Authentication uses a single **shared public API key** (no registration required). The API does **not natively support CPF/CNPJ lookup** — the `partes` field is either absent or masked in public responses due to LGPD/privacy rules. For production KYC use cases, a commercial API (Judit, etc.) is recommended over the raw DataJud API.

## Files

- `00-query-original.md` — Research question
- `01-deep-research-prompt.md` — Sub-queries used
- `02-research-report.md` — Complete technical findings
- `03-recommendations.md` — KYC recommendations and next steps
