// Avaliação Técnica V3 do imóvel em garantia (17/10/2026, pedido do Hamilton).
//
// A estrutura segue os parâmetros que os avaliadores usam nos laudos de referência
// (Eagle Consult — rural, NBR 14653-3; Engebanc — urbano, NBR 14653-2): identificação,
// situação registral, quadro de áreas, características, cadastros rurais, GEO, ambiental,
// pesquisa de mercado, valores (mercado × liquidez/garantia) e parecer. A diferença é que
// aqui quem monta é a V3, a partir dos documentos da proposta:
//   urbano → matrícula, IPTU, fotos e internet (comparáveis + região);
//   rural  → matrícula, GEO/memorial SIGEF (com as coordenadas da área), CCIR, ITR, CAR e fotos.
// Fica gravada em metadata.imoveis[i].avaliacao_tecnica (só o servidor grava; ver
// protegerMetadata em lib/credit-proposal-meta.ts).

export type ZonaImovel = "URBANO" | "RURAL";
export type NivelAlerta = "CRITICO" | "ATENCAO" | "INFO";
export type Confianca = "ALTA" | "MEDIA" | "BAIXA";
export type PadraoNivel = "BAIXO" | "MEDIO" | "ALTO";

export type TipoDocumentoImovel =
  | "MATRICULA" | "ESCRITURA" | "IPTU" | "CND_IPTU" | "FOTO"
  | "CCIR" | "ITR" | "CAR" | "GEO_MEMORIAL" | "GEO_MAPA" | "GEO_KML" | "CAFIR" | "CND_ITR"
  | "LAUDO" | "PLANTA" | "HABITE_SE" | "OUTRO" | "NAO_RELACIONADO";

export const TIPO_DOC_LABEL: Record<TipoDocumentoImovel, string> = {
  MATRICULA: "Matrícula", ESCRITURA: "Escritura", IPTU: "IPTU", CND_IPTU: "CND de IPTU", FOTO: "Foto",
  CCIR: "CCIR", ITR: "ITR", CAR: "CAR", GEO_MEMORIAL: "Memorial GEO/SIGEF", GEO_MAPA: "Mapa/Planta GEO",
  GEO_KML: "KML/KMZ", CAFIR: "CAFIR", CND_ITR: "CND do ITR", LAUDO: "Laudo de avaliação", PLANTA: "Planta",
  HABITE_SE: "Habite-se", OUTRO: "Outro", NAO_RELACIONADO: "Não é do imóvel",
};

export interface ArquivoLido {
  doc_id: string;
  file_name: string;
  storage_path: string;
  tipo: TipoDocumentoImovel;
  /** Resumo de 1 linha do que o arquivo mostra (ex.: "Certidão de inteiro teor emitida em 02/10/2026"). */
  resumo?: string | null;
}

export interface Onus {
  tipo: string;               // hipoteca, alienação fiduciária, penhora, indisponibilidade, usufruto, servidão…
  registro?: string | null;   // R-5, AV-7…
  descricao?: string | null;
  favorecido?: string | null;
  ativo: boolean;             // false = cancelado/baixado na própria matrícula
}

export interface Identificacao {
  matricula?: string | null;
  cartorio?: string | null;
  comarca?: string | null;
  data_certidao?: string | null;    // ISO (yyyy-mm-dd) da emissão da certidão da matrícula
  proprietarios?: string[];
  inscricao_municipal?: string | null; // IPTU / cadastro imobiliário
  lote_quadra?: string | null;
  endereco?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
  denominacao?: string | null;      // nome da fazenda/sítio/condomínio
}

export interface Registro {
  onus: Onus[];
  construcao_averbada?: string | null;  // texto da averbação (ex.: "casa de tijolos", "AV-3 300 m²")
  cadeia_dominial?: string | null;      // última transmissão (compra e venda em 2019…)
  observacoes?: string | null;
}

export interface QuadroAreas {
  // Urbano (m²)
  terreno_matricula_m2?: number | null;
  terreno_iptu_m2?: number | null;
  construida_matricula_m2?: number | null;
  construida_iptu_m2?: number | null;
  construida_estimada_m2?: number | null;   // pelas fotos / anúncio / laudo
  /** Apartamento/sala em condomínio: área privativa (é a que os anúncios usam). */
  privativa_m2?: number | null;
  // Rural (ha)
  matricula_ha?: number | null;
  ccir_ha?: number | null;
  itr_ha?: number | null;
  car_ha?: number | null;
  geo_declarada_ha?: number | null;          // área escrita no memorial SIGEF
  geo_calculada_ha?: number | null;          // calculada pela V3 a partir dos vértices
}

export interface AcabamentoItem { ambiente: string; descricao: string }

export interface CaracteristicasUrbano {
  tipo?: string | null;              // casa, apartamento, sala comercial, galpão, terreno…
  padrao?: PadraoNivel | null;
  padrao_descricao?: string | null;
  idade_aparente_anos?: number | null;
  conservacao?: string | null;       // novo, regular, reparos simples, reparos importantes…
  pavimentos?: number | null;
  dormitorios?: number | null;
  suites?: number | null;
  vagas?: number | null;
  compartimentos?: string[];
  acabamentos?: AcabamentoItem[];
  estrutura?: string | null;
  cobertura?: string | null;
  esquadrias?: string | null;
  lazer?: string[];
  topografia?: string | null;
  formato_terreno?: string | null;
  testada_m?: number | null;
  zoneamento?: string | null;
  situacao?: string | null;          // isolado, condomínio, esquina…
  ocupacao?: string | null;          // ocupado pelo proprietário, locado, desocupado
  infraestrutura?: string[];         // água, esgoto, energia, pavimentação, iluminação, coleta…
  vizinhanca?: string | null;        // predominância e padrão do entorno
  servicos_proximos?: string[];
  riscos?: string[];                 // alagamento, encosta, ruído, área de risco…
  iptu?: {
    exercicio?: number | null;
    valor_venal_terreno?: number | null;
    valor_venal_construcao?: number | null;
    valor_venal_total?: number | null;
    valor_iptu_anual?: number | null;
    debitos?: string | null;
  };
}

export interface Edificacao {
  nome: string;
  area_m2?: number | null;
  idade_aparente_anos?: number | null;
  conservacao?: string | null;
  averbada?: boolean | null;
  descricao?: string | null;
}

export interface CaracteristicasRural {
  denominacao?: string | null;
  codigo_incra?: string | null;      // código do imóvel no SNCR
  ccir?: { numero?: string | null; exercicio?: string | null; situacao?: string | null; area_ha?: number | null; modulos_fiscais?: number | null; fracao_minima_ha?: number | null; classificacao?: string | null };
  itr?: { nirf?: string | null; exercicio?: number | null; area_ha?: number | null; vtn_declarado?: number | null; situacao?: string | null };
  car?: { codigo?: string | null; situacao?: string | null; area_ha?: number | null; reserva_legal_ha?: number | null; app_ha?: number | null; vegetacao_nativa_ha?: number | null; area_consolidada_ha?: number | null };
  geo?: {
    certificado?: boolean | null;
    codigo_parcela?: string | null;
    data_certificacao?: string | null;
    averbado_na_matricula?: boolean | null;
    responsavel_tecnico?: string | null;
    datum?: string | null;
    perimetro_m?: number | null;
  };
  modulo_fiscal_ha?: number | null;
  porte?: string | null;               // minifúndio, pequena, média, grande propriedade
  bioma?: string | null;
  reserva_legal_exigida_pct?: number | null;
  aptidao?: string | null;             // agricultura, pecuária, dupla aptidão…
  uso_solo?: string[];
  recursos_hidricos?: string[];
  cercas?: string | null;
  acesso?: string | null;
  servidao_passagem?: string | null;
  edificacoes?: Edificacao[];
}

export interface VerticeGeo { id?: string | null; lat: number; lon: number }

export interface Poligonal {
  vertices: VerticeGeo[];
  fonte: string;                 // nome do arquivo de onde vieram
  area_ha: number;
  perimetro_m: number;
  centroide: { lat: number; lon: number };
  /** Município onde cai o centroide (geocodificação reversa) — confere com o declarado. */
  municipio_centroide?: string | null;
  uf_centroide?: string | null;
}

export interface Comparavel {
  titulo: string;
  valor: number;
  area: number;                  // m² (urbano) ou ha (rural)
  preco_unitario: number;        // R$/m² ou R$/ha (bruto do anúncio)
  fonte_nome?: string | null;
  fonte_url?: string | null;
  observacao?: string | null;
}

export interface PesquisaMercadoTecnica {
  unidade: "m2" | "ha";
  comparaveis: Comparavel[];
  resumo_regiao?: string | null;
  confianca: Confianca;
  observacoes?: string | null;
}

export interface LaudoExterno {
  empresa?: string | null;
  numero?: string | null;
  responsavel_tecnico?: string | null;
  data_base?: string | null;      // ISO
  valor_mercado?: number | null;
  valor_garantia?: number | null;
  grau_fundamentacao?: string | null;
  grau_precisao?: string | null;
  parecer?: string | null;
}

export interface Valores {
  unidade: "m2" | "ha";
  area_considerada: number | null;
  area_criterio: string;
  preco_unitario_min: number | null;
  preco_unitario_medio: number | null;
  preco_unitario_max: number | null;
  preco_unitario_aplicado: number | null;
  criterio: string;
  fator_oferta: number;            // desconto de anúncio → negócio (0,90, como nos laudos)
  /** Saneamento da amostra (±30% da média, como nos laudos): true = comparável aceito. */
  saneados: boolean[];
  amostra_total: number;
  amostra_saneada: number;
  valor_mercado: number | null;
  fator_liquidez: number;          // deságio p/ garantia (urbano 0,80 · rural 0,70)
  valor_liquidez: number | null;
  intervalo_inferior: number | null;
  intervalo_superior: number | null;
  // Referências oficiais
  valor_venal_iptu?: number | null;
  vtn_itr?: number | null;
  laudo_mercado?: number | null;
  laudo_garantia?: number | null;
}

export interface Alerta { nivel: NivelAlerta; categoria: string; titulo: string; detalhe?: string | null }

export interface FatorRating { categoria: string; pontos: number; max: number }

export interface RatingGarantia {
  nota: "A" | "B" | "C" | "D" | "E";
  pontos: number;                // 0–100
  fatores: FatorRating[];
}

export interface Parecer {
  resumo: string;
  pontos_fortes: string[];
  ressalvas: string[];
  recomendacoes: string[];
  aceite: "ACEITAR" | "ACEITAR_COM_RESSALVAS" | "NAO_RECOMENDADO";
}

export interface AvaliacaoTecnica {
  versao: 1;
  zona: ZonaImovel;
  gerado_em: string;
  gerado_por?: string | null;
  arquivos: ArquivoLido[];
  documentos_faltantes: string[];
  identificacao: Identificacao;
  registro: Registro;
  areas: QuadroAreas;
  urbano?: CaracteristicasUrbano | null;
  rural?: CaracteristicasRural | null;
  poligonal?: Poligonal | null;
  localizacao?: { lat: number; lon: number; fonte: string } | null;
  mercado?: PesquisaMercadoTecnica | null;
  laudo_externo?: LaudoExterno | null;
  ambiental?: string | null;
  valores: Valores;
  alertas: Alerta[];
  rating: RatingGarantia;
  parecer: Parecer;
  /** Valor solicitado na proposta no momento da avaliação (para o LTV). */
  valor_solicitado?: number | null;
}
