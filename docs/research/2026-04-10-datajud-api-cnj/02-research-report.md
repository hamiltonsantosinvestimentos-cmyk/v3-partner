# DATAJUD API — Complete Technical Research Report

**Date:** 2026-04-10
**Sources:** CNJ Official Wiki, SEEU/PJe Dev Manual, GitHub repositories, community articles

---

## 1. What is DataJud?

The **DataJud** (Base Nacional de Dados do Poder Judiciário) is Brazil's national judiciary database, operated by the **CNJ — Conselho Nacional de Justiça**. Established by CNJ Resolution 331/2020 and governed by Portaria 119/2021 and Portaria 160/2020, it centralizes metadata from judicial processes across all Brazilian courts.

The **Public API** exposes an **Elasticsearch-powered** REST endpoint allowing open access to case metadata (capas processuais) and movements (movimentações) across all instances of the Brazilian judiciary.

---

## 2. Base URL & Endpoint Pattern

```
https://api-publica.datajud.cnj.jus.br/{tribunal_alias}/_search
```

- Method: **POST**
- Content-Type: `application/json`
- Each tribunal has its own index alias

### Examples

| Court | Endpoint |
|-------|----------|
| TRF1 (Federal, Region 1) | `https://api-publica.datajud.cnj.jus.br/api_publica_trf1/_search` |
| TJSP (São Paulo State) | `https://api-publica.datajud.cnj.jus.br/api_publica_tjsp/_search` |
| TJRJ (Rio de Janeiro State) | `https://api-publica.datajud.cnj.jus.br/api_publica_tjrj/_search` |
| TST (Superior Labor) | `https://api-publica.datajud.cnj.jus.br/api_publica_tst/_search` |
| STJ (Superior Justice) | `https://api-publica.datajud.cnj.jus.br/api_publica_stj/_search` |

---

## 3. Complete Tribunal Alias List

### Superior Courts
```
api_publica_tst    (Tribunal Superior do Trabalho)
api_publica_tse    (Tribunal Superior Eleitoral)
api_publica_stj    (Superior Tribunal de Justiça)
api_publica_stm    (Superior Tribunal Militar)
```

### Federal Justice (TRF — 6 regions)
```
api_publica_trf1  api_publica_trf2  api_publica_trf3
api_publica_trf4  api_publica_trf5  api_publica_trf6
```

### State Justice (TJ — 27 courts, one per state + DF)
```
api_publica_tjac  api_publica_tjal  api_publica_tjam  api_publica_tjap
api_publica_tjba  api_publica_tjce  api_publica_tjdft api_publica_tjes
api_publica_tjgo  api_publica_tjma  api_publica_tjmg  api_publica_tjms
api_publica_tjmt  api_publica_tjpa  api_publica_tjpb  api_publica_tjpe
api_publica_tjpi  api_publica_tjpr  api_publica_tjrj  api_publica_tjrn
api_publica_tjro  api_publica_tjrr  api_publica_tjrs  api_publica_tjsc
api_publica_tjse  api_publica_tjsp  api_publica_tjto
```

### Labor Justice (TRT — 24 regions)
```
api_publica_trt1  through  api_publica_trt24
```

### Electoral Justice (TRE — 27 regions)
```
api_publica_tre-ac  through  api_publica_tre-to
```

### Military Justice (State)
```
api_publica_tjmmg  api_publica_tjmrs  api_publica_tjmsp
```

**Total: 90+ tribunal endpoints** covering the entire Brazilian judiciary.

---

## 4. Authentication

### Type: Public API Key (shared, no registration required)

The API uses a **single shared public key** published and maintained by CNJ/DPJ on their wiki. No individual registration or OAuth flow is required.

**Current API Key (as of 2025, subject to change):**
```
cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==
```

**Header format:**
```http
Authorization: APIKey cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==
Content-Type: application/json
```

> WARNING: CNJ can rotate this key at any time without notice. Always fetch from:
> https://datajud-wiki.cnj.jus.br/api-publica/acesso/

---

## 5. Request Format — Elasticsearch DSL (POST body)

The API accepts standard **Elasticsearch Query DSL** in the POST body.

### 5.1 Query by Process Number (most common)

Process numbers follow CNJ format: `NNNNNNN-DD.AAAA.J.TR.OOOO` (stored unformatted, 20 digits).

```json
{
  "query": {
    "match": {
      "numeroProcesso": "00008323520184013202"
    }
  }
}
```

**curl example:**
```bash
curl -X POST "https://api-publica.datajud.cnj.jus.br/api_publica_trf1/_search" \
  -H "Authorization: APIKey cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==" \
  -H "Content-Type: application/json" \
  -d '{
    "query": {
      "match": {
        "numeroProcesso": "00008323520184013202"
      }
    }
  }'
```

### 5.2 Query by Procedural Class + Judging Body

```json
{
  "query": {
    "bool": {
      "must": [
        { "match": { "classe.codigo": 1116 } },
        { "match": { "orgaoJulgador.codigo": 13597 } }
      ]
    }
  }
}
```

### 5.3 Query by CPF/CNPJ (Parties) — IMPORTANT LIMITATION

**The public API does NOT reliably support CPF/CNPJ search.**

The `partes` field structure (from SEEU/PJe data model) is:
```json
{
  "partes": [
    {
      "polo": "ATIVO",
      "sigilosa": false,
      "pessoa": {
        "nome": "NOME DA PARTE",
        "tipo": "FISICA",
        "documentos": [
          { "tipo": "CPF", "numero": "***masked***" }
        ]
      }
    }
  ]
}
```

However:
- **CPF/CNPJ are masked or absent** in the public API due to LGPD (Lei Geral de Proteção de Dados)
- **Party data coverage is inconsistent** — many courts do not populate `partes` in the Elasticsearch index
- **You cannot reverse-search** (give CPF, get processes) — only forward lookup (give process number, see if parties match) in limited cases
- The `partes` array may not appear in all tribunal responses

### 5.4 Pagination (search_after)

```json
{
  "query": {
    "bool": {
      "must": [
        { "match": { "classe.codigo": 1116 } }
      ]
    }
  },
  "sort": [{ "dataAjuizamento": "asc" }],
  "search_after": [1681366085550]
}
```

The `sort` field in the previous response provides the value for `search_after` in the next page request. Maximum 10,000 results per query.

---

## 6. Response Structure (Full Example)

```json
{
  "took": 6679,
  "timed_out": false,
  "_shards": {
    "total": 7,
    "successful": 7,
    "skipped": 0,
    "failed": 0
  },
  "hits": {
    "total": {
      "value": 1,
      "relation": "eq"
    },
    "max_score": 13.917725,
    "hits": [
      {
        "_index": "api_publica_trf1",
        "_type": "_doc",
        "_id": "TRF1_436_JE_16403_00008323520184013202",
        "_score": 13.917725,
        "_source": {
          "id": "TRF1_436_JE_16403_00008323520184013202",
          "numeroProcesso": "00008323520184013202",
          "tribunal": "TRF1",
          "grau": "JE",
          "nivelSigilo": 0,
          "dataAjuizamento": "2018-10-29T00:00:00.000Z",
          "dataHoraUltimaAtualizacao": "2023-07-21T19:10:08.483Z",
          "@timestamp": "2023-08-14T11:50:51.994Z",
          "classe": {
            "codigo": 436,
            "nome": "Procedimento do Juizado Especial Cível"
          },
          "sistema": {
            "codigo": 1,
            "nome": "Pje"
          },
          "formato": {
            "codigo": 1,
            "nome": "Eletrônico"
          },
          "orgaoJulgador": {
            "codigo": 16403,
            "nome": "JEF Adj - Tefé",
            "codigoMunicipioIBGE": 5128
          },
          "assuntos": [
            {
              "codigo": 6177,
              "nome": "Concessão"
            }
          ],
          "movimentos": [
            {
              "codigo": 26,
              "nome": "Distribuição",
              "dataHora": "2018-10-30T14:06:24.000Z",
              "complementosTabelados": [
                {
                  "codigo": 2,
                  "valor": 1,
                  "nome": "competência exclusiva",
                  "descricao": "tipo_de_distribuicao_redistribuicao"
                }
              ]
            },
            {
              "codigo": 14732,
              "nome": "Conversão de Autos Físicos em Eletrônicos",
              "dataHora": "2020-08-05T01:15:18.000Z"
            }
          ]
        }
      }
    ]
  }
}
```

### Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `numeroProcesso` | string | 20-digit CNJ process number (unformatted) |
| `tribunal` | string | Court acronym (e.g., "TRF1", "TJSP") |
| `grau` | string | Instance level: G1 (1st), G2 (2nd), JE (Special), JT (Labor), SU (Superior) |
| `nivelSigilo` | number | 0 = public, >0 = sealed/restricted |
| `dataAjuizamento` | ISO datetime | Filing date |
| `dataHoraUltimaAtualizacao` | ISO datetime | Last update |
| `@timestamp` | ISO datetime | Index timestamp |
| `classe.codigo` | number | TPU procedural class code |
| `classe.nome` | string | Procedural class name |
| `sistema.codigo` | number | Court system code |
| `sistema.nome` | string | System name (e.g., "Pje", "SAJ", "PROJUDI") |
| `formato.codigo` | number | Format code |
| `formato.nome` | string | "Eletrônico" or "Físico" |
| `orgaoJulgador.codigo` | number | Judging body code |
| `orgaoJulgador.nome` | string | Court/vara name |
| `orgaoJulgador.codigoMunicipioIBGE` | number | IBGE municipality code |
| `assuntos[]` | array | Case subjects (TPU table) |
| `assuntos[].codigo` | number | Subject code |
| `assuntos[].nome` | string | Subject description |
| `movimentos[]` | array | Case movements/events |
| `movimentos[].codigo` | number | Movement code (TPU) |
| `movimentos[].nome` | string | Movement description |
| `movimentos[].dataHora` | ISO datetime | Movement timestamp |
| `movimentos[].complementosTabelados[]` | array | Tabulated complements for the movement |

**Note:** `partes` (parties) field is NOT consistently present in the public Elasticsearch index. When present, CPF/CNPJ within it are typically masked per LGPD.

---

## 7. Process Number Format

CNJ unified number format: `NNNNNNN-DD.AAAA.J.TR.OOOO`

- `NNNNNNN` — 7-digit sequential number
- `DD` — 2-digit check digits
- `AAAA` — 4-digit year
- `J` — 1-digit justice segment (1=STF, 4=Federal, 5=Labor, 6=Electoral, 8=State)
- `TR` — 2-digit tribunal code
- `OOOO` — 4-digit origin unit (vara/comarca)

**In the API**: stored without formatting as 20 digits, e.g., `00008323520184013202`

---

## 8. Node.js / TypeScript Integration

### 8.1 npm Library: `busca-processos-judiciais`

The only known dedicated Node.js/TypeScript library for DataJud (as of 2026):

```bash
npm install busca-processos-judiciais
```

**TypeScript usage:**
```typescript
import { BuscaProcesso, tribunais } from 'busca-processos-judiciais';

const DATAJUD_API_KEY = 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';

// Search by process number
const busca = new BuscaProcesso('TRF1', DATAJUD_API_KEY);
const result = await busca.getCleanResult('00008323520184013202');

// Returns typed Processo object:
// result.numeroProcesso    — string
// result.classeProcessual  — string
// result.tribunal          — string
// result.dataAjuizamento   — Date
// result.movimentos        — Movimentos[]
// result.orgaoJulgador     — string
// result.assuntos          — Assuntos[]
// result.grau              — string
// result.ultimaAtualizacao — Date
```

**Response type definitions from the library:**
```typescript
class Processo {
  readonly numeroProcesso: string;
  readonly classeProcessual: string;
  readonly codigoClasseProcessual: number;
  readonly sistemaProcessual: string;
  readonly formatoProcesso: string;
  readonly tribunal: string;
  readonly ultimaAtualizacao: Date;
  readonly grau: string;
  readonly dataAjuizamento: Date;
  readonly movimentos: Movimentos[];
  readonly orgaoJulgador: string;
  readonly codigoMunicipio: number;
  readonly assuntos: Assuntos[];
}

type Movimentos = {
  nome: string;
  dataHora: Date;
  complemento: string | null;
};

type Assuntos = {
  codigo: number;
  nome: string;
};
```

**Pagination / class+court query:**
```typescript
const results = await busca.getProceduralClassAndJudgingBodyWithPagination(
  1116,    // classe.codigo (Execução Fiscal)
  13597,   // orgaoJulgador.codigo
  100,     // page size
  [1681366085550]  // search_after value from previous response sort field
);
```

**Available court constants:**
```typescript
import { siglasTribunais } from 'busca-processos-judiciais';
// Maps court siglas to full names and API aliases
```

### 8.2 Raw fetch() Implementation (TypeScript, no library)

```typescript
const DATAJUD_BASE = 'https://api-publica.datajud.cnj.jus.br';
const DATAJUD_KEY = process.env.DATAJUD_API_KEY!;

interface DatajudHit {
  _index: string;
  _id: string;
  _score: number;
  _source: {
    id: string;
    numeroProcesso: string;
    tribunal: string;
    grau: string;
    nivelSigilo: number;
    dataAjuizamento: string;
    dataHoraUltimaAtualizacao: string;
    classe: { codigo: number; nome: string };
    sistema: { codigo: number; nome: string };
    formato: { codigo: number; nome: string };
    orgaoJulgador: { codigo: number; nome: string; codigoMunicipioIBGE: number };
    assuntos: Array<{ codigo: number; nome: string }>;
    movimentos: Array<{
      codigo: number;
      nome: string;
      dataHora: string;
      complementosTabelados?: Array<{
        codigo: number;
        valor: number;
        nome: string;
        descricao: string;
      }>;
    }>;
  };
}

interface DatajudResponse {
  took: number;
  timed_out: boolean;
  hits: {
    total: { value: number; relation: string };
    hits: DatajudHit[];
  };
}

async function queryByProcessNumber(
  tribunal: string,
  processNumber: string
): Promise<DatajudResponse> {
  const url = `${DATAJUD_BASE}/api_publica_${tribunal.toLowerCase()}/_search`;

  const body = {
    query: {
      match: { numeroProcesso: processNumber }
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `APIKey ${DATAJUD_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`DataJud error ${response.status}: ${await response.text()}`);
  }

  return response.json() as Promise<DatajudResponse>;
}

// Query by procedural class + court (e.g., for bulk KYC risk screening)
async function queryByClassAndCourt(
  tribunal: string,
  classeCodigo: number,
  orgaoCodigo: number,
  searchAfter?: number[]
): Promise<DatajudResponse> {
  const url = `${DATAJUD_BASE}/api_publica_${tribunal.toLowerCase()}/_search`;

  const body: Record<string, unknown> = {
    query: {
      bool: {
        must: [
          { match: { 'classe.codigo': classeCodigo } },
          { match: { 'orgaoJulgador.codigo': orgaoCodigo } }
        ]
      }
    },
    sort: [{ dataAjuizamento: 'asc' }]
  };

  if (searchAfter) {
    body.search_after = searchAfter;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `APIKey ${DATAJUD_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  return response.json() as Promise<DatajudResponse>;
}
```

### 8.3 GitHub References

| Repository | Language | Notes |
|------------|----------|-------|
| [joaotextor/busca-processos-judiciais](https://github.com/joaotextor/busca-processos-judiciais) | TypeScript | Only dedicated TS library; search by process number and class/court |
| [DanielFillol/DataJUD_API_CALLER](https://github.com/DanielFillol/DataJUD_API_CALLER) | Go | Batch CSV processing of CNJ numbers |
| [leonardomv1981/consulta-processo-judicial-apicnj](https://github.com/leonardomv1981/consulta-processo-judicial-apicnj) | PHP + jQuery | Web UI for process lookup |
| [jespimentel/api_cnj](https://github.com/jespimentel/api_cnj) | Python (Jupyter) | Data analysis examples |

---

## 9. CPF/CNPJ Query — The Critical Limitation for KYC

### What the official API does NOT provide:

1. **No reverse CPF/CNPJ lookup** — You cannot query "show me all processes where CPF 123.456.789-00 is a party"
2. **LGPD compliance** — Personal identification data (CPF, full name) is masked or omitted in public responses per Lei 13.709/2018
3. **Inconsistent `partes` coverage** — Many tribunals do not populate the parties array in their Elasticsearch index; coverage varies widely per court
4. **nivelSigilo filter** — Processes with any confidentiality level are excluded entirely
5. **No OAB search** — Cannot search by lawyer registration number either
6. **Rate limits** — Described as "rigorous/low volume" with no formal SLA; no webhooks, requires polling
7. **Data lag** — Updates are 1–7 days behind actual court activity
8. **Max 10,000 results** per query even with pagination

### What IS available for risk screening (indirect approach):

- Query by **known process number** (if obtained from another source) to get case details
- Query by **tribunal + class + court** to build local indexes for statistical analysis
- Filter by `nivelSigilo: 0` to ensure only public processes
- Get `movimentos` (case timeline) to assess litigation stage

---

## 10. Commercial Alternatives for KYC

For production-grade KYC with CPF/CNPJ lookup, the community consensus is to use commercial APIs that aggregate and enrich DataJud data:

| Provider | Endpoint Style | CPF/CNPJ | OAB | Real-time | SLA |
|----------|---------------|-----------|-----|-----------|-----|
| **Judit** (judit.io) | REST Bearer token | Yes | Yes | Webhooks | Yes |
| **Escavador** | REST | Yes | Yes | Near real-time | Yes |
| **Data Lawyer** | REST | Yes | Yes | Polling | Yes |

**Judit Node.js example** (reference only, not DataJud):
```javascript
const response = await fetch('https://requests.prod.judit.io/requests', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${JUDIT_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    search_type: 'cpf_cnpj',
    search_key: '12345678901234',   // CPF or CNPJ
    response_type: 'lawsuits'
  })
});
```

---

## 11. Key Legal/Regulatory Context

- **CNJ Resolution 331/2020** — Establishes DataJud
- **Portaria CNJ 119/2021** — Governs public API
- **Portaria CNJ 160/2020** — Metadata criteria and privacy protections
- **LGPD (Lei 13.709/2018)** — Requires masking of CPF/personal data in public endpoints
- **Data covers:** All judicial branches EXCEPT processes marked sigilosos (nivelSigilo > 0)
