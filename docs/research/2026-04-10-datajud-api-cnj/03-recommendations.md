# DATAJUD API — KYC Recommendations for v3-partner

**Date:** 2026-04-10

---

## Decision Summary

| Use Case | DataJud Public API | Commercial API (Judit/Escavador) |
|----------|--------------------|----------------------------------|
| Look up specific process by number | YES — works well | Overkill |
| CPF/CNPJ reverse lookup | NO — not supported | YES |
| Screen all processes for a person | NO | YES |
| Statistical/bulk research | YES | Expensive |
| Real-time KYC webhook | NO | YES |
| Production KYC with SLA | NO | YES |

---

## Recommendation for v3-partner KYC Module

### Hybrid Strategy (recommended)

**Tier 1 — Commercial API for active KYC checks**
Use Judit or Escavador for CPF/CNPJ-based litigation screening in the KYC flow. These APIs query all 90+ tribunals and return structured party data with CPF/CNPJ resolution that the public DataJud API cannot provide.

**Tier 2 — DataJud public API for process detail enrichment**
Once a CNJ process number is known (from Tier 1 or from the customer), use DataJud to pull full process metadata, movements timeline, and subject classification at no cost.

### Implementation Priorities (for @dev)

1. Create a `datajud.service.ts` that wraps the raw `fetch()` calls with TypeScript types
2. Store the API key in environment variables — fetch the live key from the wiki on startup or cache it with a TTL since CNJ can rotate it
3. Map tribunal codes from CNJ process numbers automatically (parse digits 15-16 of the 20-digit number for TJ/TRF code)
4. For CPF/CNPJ KYC: evaluate Judit API — they have a Node.js-compatible REST API with Bearer token auth

### Environment Variable Needed

```
DATAJUD_API_KEY=cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==
```

Note: this key is PUBLIC and shared by all users of the API. It is not a secret but should be externalized anyway so it can be updated when CNJ rotates it.

---

## Rate Limit Guidance

- No official documented rate limit in the public documentation
- Community reports describe it as "baixo volume padrão" (low default volume)
- Implement exponential backoff with retry on HTTP 429
- Do not hammer the API — DataJud is a government resource with no SLA

---

## Next Steps

- **@pm**: Evaluate Judit API pricing for the KYC CPF/CNPJ lookup feature
- **@dev**: Implement `datajud.service.ts` using the raw fetch pattern from `02-research-report.md` Section 8.2
- **@dev**: Install and evaluate `busca-processos-judiciais` npm package as a starting wrapper
- **@dev**: Add process number parser to auto-detect the correct tribunal alias from a 20-digit CNJ number
