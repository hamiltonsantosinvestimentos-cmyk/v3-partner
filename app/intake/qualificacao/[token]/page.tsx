"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { PhoneIntlInput } from "@/components/ui/phone-intl-input";
import { Loader2, AlertTriangle, CheckCircle2, Upload, ShieldCheck, X } from "lucide-react";
import {
  type PartyNature, type RepresentativeType, type CompanyLegalNature,
  PARTY_NATURE_LABELS, REPRESENTATIVE_TYPE_LABELS, REQUIRED_REPRESENTATIVE_TYPES,
} from "@/lib/legal-qualification";
import {
  ID_TYPES, INSTRUMENT_DOCUMENT_KIND, INSTRUMENT_DOCUMENT_LABELS, MARITAL_STATUS, NATIONALITIES, UF_LIST,
  countryOptions, fieldRequirement, isCpfWaived, isIsoCountryCode, isValidPassportNumber, sortPt,
  type QualificationFieldKey, type QualificationProfile,
} from "@/lib/qualification-schema";
import {
  maskCep, maskCnpj, maskCpf, normalizeSubmission, previewQualificationText,
  type FieldError, type PartyInput, type RepresentationInput, type SubmissionInput,
} from "@/lib/qualification-submit";
import { isValidCNPJ, isValidCPF } from "@/lib/validators/cpf-cnpj";
import { fetchCep } from "@/lib/viacep";

const INPUT_CLS = "w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-sm text-[#F5F1E8] mt-1 disabled:opacity-50";
const LABEL_CLS = "text-[11px] text-[#9BAFC5] uppercase";
const ERR_CLS = "text-[11px] text-red-400 mt-1";

const COUNTRY_OPTIONS = countryOptions();
const NATURE_OPTIONS = sortPt(Object.keys(PARTY_NATURE_LABELS) as PartyNature[], (n) => PARTY_NATURE_LABELS[n]);
const REPRESENTATIVE_TYPE_ORDER = sortPt(Object.keys(REPRESENTATIVE_TYPE_LABELS) as RepresentativeType[], (t) => REPRESENTATIVE_TYPE_LABELS[t]);

// ---------------------------------------------------------------------------
// Anexos (KYC e instrumento de representação)
// ---------------------------------------------------------------------------

type DocKind = "identificacao_foto" | "contrato_social" | "mandato" | "termo_inventariante";
const DOC_KIND_LABELS: Record<DocKind, string> = {
  identificacao_foto: "Documento de identificação com foto (RG, CNH ou passaporte)",
  contrato_social: "Contrato Social / Estatuto",
  mandato: INSTRUMENT_DOCUMENT_LABELS.mandato,
  termo_inventariante: INSTRUMENT_DOCUMENT_LABELS.termo_inventariante,
};
const REUSABLE_KINDS: DocKind[] = ["identificacao_foto", "contrato_social"];

interface DocSlotState {
  status: "idle" | "checking" | "valid_reuse" | "uploading" | "uploaded" | "error";
  documentId?: string;
  filename?: string;
  validUntil?: string;
  error?: string;
  /** Chave do documento ao qual o arquivo foi ancorado (CPF, CNPJ ou passaporte). */
  anchorKey?: string;
}

/** Documento ao qual o anexo é vinculado: CPF, CNPJ ou, para estrangeiro sem CPF, o passaporte. */
interface DocAnchor { key: string; documentNumber?: string; passportCountry?: string; passportNumber?: string }

const emptyDocSlot = (): DocSlotState => ({ status: "idle" });

type DocRef = { reuse: true } | { document_id: string } | null;
const toDocRef = (slot: DocSlotState): DocRef => {
  if (slot.status === "valid_reuse") return { reuse: true };
  if (slot.status === "uploaded" && slot.documentId) return { document_id: slot.documentId };
  return null;
};
const docReady = (slot: DocSlotState) => slot.status === "valid_reuse" || slot.status === "uploaded";

/** Widget de anexo. Ao documento mudar, checa se a V3 já tem um arquivo válido (< 12 meses) e, se tiver,
 *  esconde o upload. O instrumento de representação nunca é reaproveitado. */
function DocSlot({ token, kind, anchor, anchorHint, value, onChange, showError }: {
  token: string; kind: DocKind; anchor: DocAnchor | null; anchorHint: string;
  value: DocSlotState; onChange: (v: DocSlotState) => void; showError: boolean;
}) {
  useEffect(() => {
    if (!anchor) {
      if (value.status !== "idle" && value.status !== "uploading") onChange(emptyDocSlot());
      return;
    }
    // O documento digitado mudou depois do upload: o arquivo foi ancorado em outro CPF, CNPJ ou passaporte.
    if (value.anchorKey && value.anchorKey !== anchor.key && value.status !== "uploading") {
      if (value.documentId) fetch(`/api/cm/qualificacao/${token}/documents/${value.documentId}`, { method: "DELETE" }).catch(() => {});
      onChange(emptyDocSlot());
      return;
    }
    if (value.status === "uploaded" || value.status === "uploading" || value.status === "valid_reuse") return;
    if (!REUSABLE_KINDS.includes(kind)) return;

    onChange({ status: "checking", anchorKey: anchor.key });
    const controller = new AbortController();
    const q = anchor.passportNumber
      ? `passport_country=${encodeURIComponent(anchor.passportCountry ?? "")}&passport_number=${encodeURIComponent(anchor.passportNumber)}`
      : `document=${encodeURIComponent(anchor.documentNumber ?? "")}`;
    fetch(`/api/cm/kyc/check?token=${token}&${q}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (json.valid && json.document_kind === kind) onChange({ status: "valid_reuse", validUntil: json.valid_until, anchorKey: anchor.key });
        else onChange({ status: "idle", anchorKey: anchor.key });
      })
      .catch(() => onChange({ status: "idle", anchorKey: anchor.key }));
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor?.key, kind, token]);

  const upload = async (file: File) => {
    if (!anchor) return;
    onChange({ status: "uploading", anchorKey: anchor.key });
    const fd = new FormData();
    fd.append("file", file);
    fd.append("document_kind", kind);
    if (anchor.passportNumber) {
      fd.append("passport_country", anchor.passportCountry ?? "");
      fd.append("passport_number", anchor.passportNumber);
    } else {
      fd.append("document_number", anchor.documentNumber ?? "");
    }
    try {
      const res = await fetch(`/api/cm/qualificacao/${token}/documents`, { method: "POST", body: fd });
      const json = await res.json();
      if (res.ok) onChange({ status: "uploaded", documentId: json.document.id, filename: json.document.original_filename, anchorKey: anchor.key });
      else onChange({ status: "error", error: json.error ?? "Falha no upload", anchorKey: anchor.key });
    } catch {
      onChange({ status: "error", error: "Erro de conexão no upload", anchorKey: anchor.key });
    }
  };

  const remove = async () => {
    if (value.documentId) {
      await fetch(`/api/cm/qualificacao/${token}/documents/${value.documentId}`, { method: "DELETE" }).catch(() => {});
    }
    onChange({ status: "idle", anchorKey: anchor?.key });
  };

  const missing = showError && !docReady(value) && value.status !== "uploading" && value.status !== "checking";

  return (
    <div>
      <p className="text-[11px] text-[#E8C97A] font-bold uppercase pt-1 mb-1">{DOC_KIND_LABELS[kind]} *</p>

      {(value.status === "idle" || value.status === "error") && !anchor && (
        <div className="flex items-center gap-2 text-[12px] text-[#9BAFC5] bg-[#12112A] border border-dashed border-[#9BAFC5]/15 rounded px-3 py-3">
          <AlertTriangle size={14} className="text-[#C9A84C] shrink-0" />
          {anchorHint}
        </div>
      )}

      {value.status === "checking" && (
        <div className="flex items-center gap-2 text-[12px] text-[#9BAFC5] bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2">
          <Loader2 size={14} className="animate-spin" /> Verificando se já temos este documento...
        </div>
      )}

      {value.status === "valid_reuse" && (
        <div className="flex items-center gap-2 text-[12px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded px-3 py-2">
          <ShieldCheck size={14} />
          Documentação já validada e ativa na base da V³ Partners
          {value.validUntil ? ` (válida até ${new Date(value.validUntil).toLocaleDateString("pt-BR")})` : ""}.
        </div>
      )}

      {(value.status === "idle" || value.status === "error") && anchor && (
        <label className="flex items-center gap-2 text-[12px] text-[#9BAFC5] bg-[#12112A] border border-dashed border-[#9BAFC5]/25 rounded px-3 py-3 cursor-pointer hover:border-[#C9A84C]/50 transition">
          <Upload size={14} />
          Selecionar arquivo (JPG, PNG ou PDF, até 15MB)
          <input type="file" accept="image/jpeg,image/png,application/pdf" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
        </label>
      )}

      {value.status === "uploading" && (
        <div className="flex items-center gap-2 text-[12px] text-[#9BAFC5] bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2">
          <Loader2 size={14} className="animate-spin" /> Enviando arquivo...
        </div>
      )}

      {value.status === "uploaded" && (
        <div className="flex items-center justify-between gap-2 text-[12px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded px-3 py-2">
          <span className="flex items-center gap-2 truncate"><CheckCircle2 size={14} /> {value.filename}</span>
          <button type="button" onClick={remove} aria-label="Remover arquivo" className="text-[#9BAFC5] hover:text-red-400 shrink-0"><X size={14} /></button>
        </div>
      )}

      {value.status === "error" && <p className={ERR_CLS}>{value.error}</p>}
      {missing && <p className={ERR_CLS}>Anexo obrigatório.</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Estado do formulário
// ---------------------------------------------------------------------------

interface AddressForm {
  cep: string; rua: string; numero: string; complemento: string; bairro: string; cidade: string; estado: string;
  manual: boolean; lookup: "idle" | "loading" | "found" | "notfound"; lockRua: boolean; lockBairro: boolean;
}

interface PartyForm {
  /** Representante pessoa física: nome. Pessoa jurídica: razão social. A parte principal PF usa o nome do convite. */
  name: string;
  cpf: string; noCpf: boolean;
  cnpj: string; legalNature: CompanyLegalNature | "";
  nationalityCode: string; nationalityOther: string; profession: string; maritalCode: string; birthDate: string;
  idType: string; idNumber: string; idIssuer: string; idIssuerUf: string; idCountry: string;
  email: string; phone: string;
  addr: AddressForm;
}

interface PartyDocs { id: DocSlotState; social: DocSlotState; instrument: DocSlotState }

interface RepForm {
  type: RepresentativeType | "";
  nature: "PF" | "PJ";
  party: PartyForm;
  docs: PartyDocs;
}

const emptyAddress = (): AddressForm => ({
  cep: "", rua: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "",
  manual: false, lookup: "idle", lockRua: false, lockBairro: false,
});
const emptyParty = (): PartyForm => ({
  name: "", cpf: "", noCpf: false, cnpj: "", legalNature: "privado",
  nationalityCode: "br", nationalityOther: "", profession: "", maritalCode: "", birthDate: "",
  idType: "", idNumber: "", idIssuer: "", idIssuerUf: "", idCountry: "",
  email: "", phone: "", addr: emptyAddress(),
});
const emptyDocs = (): PartyDocs => ({ id: emptyDocSlot(), social: emptyDocSlot(), instrument: emptyDocSlot() });
const emptyRep = (): RepForm => ({ type: "", nature: "PF", party: emptyParty(), docs: emptyDocs() });

/** Mantém a cadeia consistente: um nível a mais só existe enquanto o anterior for pessoa jurídica. */
function normalizeChain(reps: RepForm[], first: boolean): RepForm[] {
  if (!first) return [];
  const out: RepForm[] = [];
  for (let i = 0; i < reps.length; i++) {
    out.push(reps[i]);
    if (reps[i].nature !== "PJ") break;
    if (i === reps.length - 1 && out.length < 5) out.push(emptyRep());
  }
  return out;
}

const profileOfRep = (nature: "PF" | "PJ"): QualificationProfile => (nature === "PJ" ? "REP_PJ" : "REP_PF");

/** Representante como enviado ao servidor: os campos da pessoa mais os anexos dele. */
type RepWithDocs = Omit<RepresentationInput, "representation"> & { documents: Record<string, DocRef>; representation: RepWithDocs | null };

function partyToInput(profile: QualificationProfile, f: PartyForm, includeName: boolean): PartyInput {
  const pj = profile === "PJ" || profile === "REP_PJ";
  const base: PartyInput = {
    cpf_cnpj: f.cpf, declared_no_cpf: f.noCpf,
    nationality_code: f.nationalityCode, nationality_other: f.nationalityOther,
    profession: f.profession, marital_status_code: f.maritalCode, birth_date: f.birthDate,
    id_type: f.idType, id_number: f.idNumber, id_issuer: f.idIssuer, id_issuer_uf: f.idIssuerUf, id_country: f.idCountry,
    email: f.email, phone: f.phone,
  };
  if (includeName && !pj) base.full_name = f.name;
  if (pj) {
    return {
      ...base,
      company_name: f.name, company_legal_nature: f.legalNature, company_cnpj: f.cnpj,
      company_cep: f.addr.cep, company_rua: f.addr.rua, company_numero: f.addr.numero, company_complemento: f.addr.complemento,
      company_bairro: f.addr.bairro, company_cidade: f.addr.cidade, company_estado: f.addr.estado, company_manual: f.addr.manual,
    };
  }
  return {
    ...base,
    endereco_cep: f.addr.cep, endereco_rua: f.addr.rua, endereco_numero: f.addr.numero, endereco_complemento: f.addr.complemento,
    endereco_bairro: f.addr.bairro, endereco_cidade: f.addr.cidade, endereco_estado: f.addr.estado, endereco_manual: f.addr.manual,
  };
}

function idAnchor(f: PartyForm): DocAnchor | null {
  if (isValidCPF(f.cpf)) return { key: "cpf:" + f.cpf.replace(/\D/g, ""), documentNumber: f.cpf };
  if (f.noCpf && f.idType === "passaporte" && isIsoCountryCode(f.idCountry) && isValidPassportNumber(f.idNumber)) {
    return { key: `pp:${f.idCountry}:${f.idNumber.replace(/[^0-9A-Za-z]/g, "").toUpperCase()}`, passportCountry: f.idCountry, passportNumber: f.idNumber };
  }
  return null;
}
const socialAnchor = (f: PartyForm): DocAnchor | null =>
  isValidCNPJ(f.cnpj) ? { key: "cnpj:" + f.cnpj.replace(/[^0-9A-Za-z]/g, "").toUpperCase(), documentNumber: f.cnpj } : null;

// ---------------------------------------------------------------------------
// Campos
// ---------------------------------------------------------------------------

function Err({ errors, path, field }: { errors: Record<string, string>; path: string; field: string }) {
  const m = errors[`${path}:${field}`];
  return m ? <p className={ERR_CLS} role="alert">{m}</p> : null;
}

function FieldLabel({ children, req }: { children: React.ReactNode; req: "obrigatorio" | "se_houver" }) {
  return (
    <label className={LABEL_CLS}>
      {children} {req === "obrigatorio" ? "*" : <span className="normal-case text-[#9BAFC5]/70">(se houver)</span>}
    </label>
  );
}

function AddressFields({ title, value, onPatch, errors, path }: {
  title: string; value: AddressForm; onPatch: (patch: Partial<AddressForm>) => void; errors: Record<string, string>; path: string;
}) {
  const seq = useRef(0);
  const ok = value.lookup === "found" || value.manual;

  const onCep = async (raw: string) => {
    const masked = maskCep(raw);
    const digits = masked.replace(/\D/g, "");
    const reset: Partial<AddressForm> = value.lookup === "found" ? { rua: "", bairro: "", cidade: "", estado: "", lockRua: false, lockBairro: false } : {};
    onPatch({ ...reset, cep: masked, manual: false, lookup: digits.length === 8 ? "loading" : "idle" });
    if (digits.length !== 8) return;
    const my = ++seq.current;
    const r = await fetchCep(masked);
    if (my !== seq.current) return;
    if (r) {
      onPatch({
        lookup: "found", rua: r.logradouro || "", bairro: r.bairro || "", cidade: r.localidade || "", estado: (r.uf || "").toUpperCase(),
        lockRua: !!r.logradouro, lockBairro: !!r.bairro,
      });
    } else {
      onPatch({ lookup: "notfound" });
    }
  };

  return (
    <div>
      <p className="text-[11px] text-[#E8C97A] font-bold uppercase pt-1 mb-1">{title} *</p>
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <input value={value.cep} onChange={(e) => onCep(e.target.value)} placeholder="CEP (00000-000)" maxLength={9} aria-label="CEP" className={INPUT_CLS.replace("mt-1", "")} />
          {value.lookup === "loading" && <p className="text-[11px] text-[#9BAFC5] mt-1 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Consultando o CEP...</p>}
          {value.lookup === "found" && <p className="text-[11px] text-emerald-400 mt-1">CEP confirmado em {value.cidade}/{value.estado}.</p>}
          {value.lookup === "notfound" && !value.manual && (
            <p className="text-[11px] text-red-400 mt-1">
              CEP não localizado. Confira o número ou{" "}
              <button type="button" onClick={() => onPatch({ manual: true })} className="underline text-[#E8C97A]">preencher o endereço manualmente</button>.
            </p>
          )}
          {value.manual && <p className="text-[11px] text-[#9BAFC5] mt-1">Endereço manual: a Mesa vai conferir.</p>}
        </div>
        <input value={value.numero} onChange={(e) => onPatch({ numero: e.target.value.toUpperCase() })} placeholder="Número ou S/N" aria-label="Número" className={INPUT_CLS.replace("mt-1", "")} />
        <input value={value.rua} onChange={(e) => onPatch({ rua: e.target.value })} disabled={!ok || value.lockRua} placeholder={ok ? "Logradouro" : "Preenchido pelo CEP"} aria-label="Logradouro" className={INPUT_CLS.replace("mt-1", "") + " col-span-3"} />
        <input value={value.complemento} onChange={(e) => onPatch({ complemento: e.target.value })} placeholder="Complemento (apto, sala, bloco, opcional)" aria-label="Complemento" className={INPUT_CLS.replace("mt-1", "") + " col-span-3"} />
        <input value={value.bairro} onChange={(e) => onPatch({ bairro: e.target.value })} disabled={!ok || value.lockBairro} placeholder={ok ? "Bairro" : "Preenchido pelo CEP"} aria-label="Bairro" className={INPUT_CLS.replace("mt-1", "")} />
        <input value={value.cidade} onChange={(e) => onPatch({ cidade: e.target.value })} disabled={!ok || value.lookup === "found"} placeholder={ok ? "Cidade" : "Preenchido pelo CEP"} aria-label="Cidade" className={INPUT_CLS.replace("mt-1", "")} />
        <select value={value.estado} onChange={(e) => onPatch({ estado: e.target.value })} disabled={!ok || value.lookup === "found"} aria-label="UF" className={INPUT_CLS.replace("mt-1", "")}>
          <option value="">UF</option>
          {UF_LIST.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>
      <Err errors={errors} path={path} field="address" />
    </div>
  );
}

function IdentityFields({ profile, value, update, errors, path }: {
  profile: QualificationProfile; value: PartyForm; update: (fn: (p: PartyForm) => PartyForm) => void; errors: Record<string, string>; path: string;
}) {
  const req = fieldRequirement("identity", profile) as "obrigatorio" | "se_houver";
  const t = value.idType;
  return (
    <div className="space-y-2">
      <div>
        <FieldLabel req={req}>Documento de identidade</FieldLabel>
        <select value={t} onChange={(e) => update((p) => ({ ...p, idType: e.target.value, idIssuer: "", idIssuerUf: "", idCountry: "" }))} className={INPUT_CLS}>
          <option value="">Selecione</option>
          {ID_TYPES.map((i) => <option key={i.code} value={i.code}>{i.label}</option>)}
        </select>
      </div>
      {t && (
        <div className="grid grid-cols-2 gap-2">
          <input value={value.idNumber} onChange={(e) => update((p) => ({ ...p, idNumber: e.target.value.toUpperCase() }))} placeholder="Número do documento" aria-label="Número do documento" className={INPUT_CLS.replace("mt-1", "")} />
          {t === "passaporte" ? (
            <select value={value.idCountry} onChange={(e) => update((p) => ({ ...p, idCountry: e.target.value }))} aria-label="País emissor" className={INPUT_CLS.replace("mt-1", "")}>
              <option value="">País emissor</option>
              {COUNTRY_OPTIONS.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          ) : t === "oab" ? (
            <select value={value.idIssuerUf} onChange={(e) => update((p) => ({ ...p, idIssuerUf: e.target.value }))} aria-label="Seccional (UF)" className={INPUT_CLS.replace("mt-1", "")}>
              <option value="">Seccional (UF)</option>
              {UF_LIST.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          ) : (
            <>
              <input value={value.idIssuer} onChange={(e) => update((p) => ({ ...p, idIssuer: e.target.value.toUpperCase() }))} placeholder="Órgão emissor (ex.: SSP)" aria-label="Órgão emissor" className={INPUT_CLS.replace("mt-1", "")} />
              <select value={value.idIssuerUf} onChange={(e) => update((p) => ({ ...p, idIssuerUf: e.target.value }))} aria-label="UF de emissão" className={INPUT_CLS.replace("mt-1", "")}>
                <option value="">UF de emissão</option>
                {UF_LIST.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </>
          )}
        </div>
      )}
      <Err errors={errors} path={path} field="identity" />
    </div>
  );
}

/** Todos os campos de uma pessoa (principal ou representante), conforme a matriz de obrigatoriedade. */
function PartyFields({ profile, value, update, errors, path, token, docs, onDocs, nameFromInvite, attempted, hideEmailHint }: {
  profile: QualificationProfile; value: PartyForm; update: (fn: (p: PartyForm) => PartyForm) => void;
  errors: Record<string, string>; path: string; token: string;
  docs: PartyDocs; onDocs: (fn: (d: PartyDocs) => PartyDocs) => void;
  nameFromInvite?: string | null; attempted: boolean; hideEmailHint?: boolean;
}) {
  const reqOf = (f: QualificationFieldKey) => fieldRequirement(f, profile);
  const show = (f: QualificationFieldKey) => reqOf(f) !== "nao_se_aplica";
  const pj = profile === "PJ" || profile === "REP_PJ";
  const set = <K extends keyof PartyForm>(k: K, v: PartyForm[K]) => update((p) => ({ ...p, [k]: v }));
  const waiverEligible = isCpfWaived({ profile, nationality_code: value.nationalityCode, id_type: value.idType, declared_no_cpf: true });

  const idDoc = show("doc_identificacao");
  const socialDoc = show("doc_contrato_social");
  const idA = idAnchor(value);
  const socA = socialAnchor(value);

  return (
    <div className="space-y-3">
      {(pj || path !== "principal") && show("name") && (
        <div>
          <FieldLabel req="obrigatorio">{pj ? "Razão social" : "Nome completo"}</FieldLabel>
          <input value={value.name} onChange={(e) => set("name", e.target.value)} className={INPUT_CLS} />
          <Err errors={errors} path={path} field="name" />
        </div>
      )}
      {!pj && path === "principal" && nameFromInvite && profile === "ESPOLIO" && (
        <p className="text-[11px] text-[#9BAFC5]">Nome do falecido, já cadastrado pela Mesa: {nameFromInvite}</p>
      )}

      {pj && show("legal_nature") && (
        <div>
          <FieldLabel req="obrigatorio">Natureza jurídica</FieldLabel>
          <select value={value.legalNature} onChange={(e) => set("legalNature", e.target.value as CompanyLegalNature)} className={INPUT_CLS}>
            <option value="privado">Direito Privado</option>
            <option value="publico">Direito Público</option>
            <option value="misto">Economia Mista</option>
          </select>
          <Err errors={errors} path={path} field="legal_nature" />
        </div>
      )}

      {show("cnpj") && (
        <div>
          <FieldLabel req="obrigatorio">CNPJ</FieldLabel>
          <input value={value.cnpj} onChange={(e) => set("cnpj", maskCnpj(e.target.value))} placeholder="00.000.000/0000-00" className={INPUT_CLS} />
          {isValidCNPJ(value.cnpj) && /[A-Z]/.test(value.cnpj.replace(/[^0-9A-Za-z]/g, "").slice(0, 12)) && (
            <p className="text-[11px] text-[#9BAFC5] mt-1">CNPJ alfanumérico reconhecido.</p>
          )}
          <Err errors={errors} path={path} field="cnpj" />
        </div>
      )}

      {show("cpf") && (
        <div>
          <FieldLabel req="obrigatorio">{profile === "ESPOLIO" ? "CPF do falecido" : "CPF"}</FieldLabel>
          <input value={value.cpf} onChange={(e) => set("cpf", maskCpf(e.target.value))} disabled={value.noCpf} placeholder="000.000.000-00" className={INPUT_CLS} />
          {waiverEligible && (
            <label className="flex items-center gap-2 mt-2 text-[12px] text-[#9BAFC5] cursor-pointer">
              <input type="checkbox" checked={value.noCpf} onChange={(e) => update((p) => ({ ...p, noCpf: e.target.checked, cpf: e.target.checked ? "" : p.cpf }))} className="accent-[#C9A84C]" />
              Não possuo CPF (identificação pelo passaporte)
            </label>
          )}
          <Err errors={errors} path={path} field="cpf" />
        </div>
      )}

      {show("nationality") && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <FieldLabel req={reqOf("nationality") as "obrigatorio" | "se_houver"}>Nacionalidade</FieldLabel>
            <select value={value.nationalityCode} onChange={(e) => update((p) => ({ ...p, nationalityCode: e.target.value, noCpf: e.target.value === "outra" ? p.noCpf : false }))} className={INPUT_CLS}>
              <option value="">Selecione</option>
              {NATIONALITIES.map((n) => <option key={n.code} value={n.code}>{n.label}</option>)}
            </select>
          </div>
          {value.nationalityCode === "outra" && (
            <div>
              <FieldLabel req="obrigatorio">Nacionalidade (informar)</FieldLabel>
              <input value={value.nationalityOther} onChange={(e) => set("nationalityOther", e.target.value)} placeholder="norte-americano(a)" className={INPUT_CLS} />
            </div>
          )}
          <div className="col-span-2"><Err errors={errors} path={path} field="nationality" /></div>
        </div>
      )}

      {show("identity") && <IdentityFields profile={profile} value={value} update={update} errors={errors} path={path} />}

      {(show("profession") || show("marital_status")) && (
        <div className="grid grid-cols-2 gap-2">
          {show("profession") && (
            <div>
              <FieldLabel req="obrigatorio">Profissão</FieldLabel>
              <input value={value.profession} onChange={(e) => set("profession", e.target.value)} className={INPUT_CLS} />
              <Err errors={errors} path={path} field="profession" />
            </div>
          )}
          {show("marital_status") && (
            <div>
              <FieldLabel req="obrigatorio">Estado civil</FieldLabel>
              <select value={value.maritalCode} onChange={(e) => set("maritalCode", e.target.value)} className={INPUT_CLS}>
                <option value="">Selecione</option>
                {MARITAL_STATUS.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}
              </select>
              <Err errors={errors} path={path} field="marital_status" />
            </div>
          )}
        </div>
      )}

      {show("birth_date") && (
        <div>
          <FieldLabel req="obrigatorio">Data de nascimento</FieldLabel>
          <input type="date" value={value.birthDate} onChange={(e) => set("birthDate", e.target.value)} className={INPUT_CLS} />
          <p className="text-[11px] text-[#9BAFC5] mt-1">Exigida para verificação de identidade, não aparece no texto do contrato.</p>
          <Err errors={errors} path={path} field="birth_date" />
        </div>
      )}

      {show("email") && (
        <div>
          <FieldLabel req={reqOf("email") as "obrigatorio" | "se_houver"}>{path === "principal" ? "E-mail" : "E-mail"}</FieldLabel>
          <input type="email" value={value.email} onChange={(e) => set("email", e.target.value)} className={INPUT_CLS} />
          {path === "principal" && !hideEmailHint && (
            <p className="text-[11px] text-[#9BAFC5] mt-1">Este endereço recebe o link de assinatura do documento. Confirme ou corrija antes de enviar. Se for alterado, a Mesa é avisada.</p>
          )}
          <Err errors={errors} path={path} field="email" />
        </div>
      )}

      {show("phone") && (
        <div>
          <FieldLabel req={reqOf("phone") as "obrigatorio" | "se_houver"}>Telefone (DDI + DDD; fora do Brasil, comece com + e o código do país)</FieldLabel>
          <PhoneIntlInput value={value.phone} onChange={(v) => set("phone", v)} className={INPUT_CLS} />
          <Err errors={errors} path={path} field="phone" />
        </div>
      )}

      {show("address") && (
        <AddressFields
          title={pj ? "Endereço da sede" : "Endereço residencial"}
          value={value.addr}
          onPatch={(patch) => update((p) => ({ ...p, addr: { ...p.addr, ...patch } }))}
          errors={errors} path={path}
        />
      )}

      {idDoc && (
        <DocSlot token={token} kind="identificacao_foto" anchor={idA}
          anchorHint="Preencha o CPF (ou o passaporte, se for estrangeiro sem CPF) acima antes de anexar este documento."
          value={docs.id} onChange={(v) => onDocs((d) => ({ ...d, id: v }))} showError={attempted} />
      )}
      {socialDoc && (
        <DocSlot token={token} kind="contrato_social" anchor={socA}
          anchorHint="Preencha o CNPJ acima antes de anexar este documento."
          value={docs.social} onChange={(v) => onDocs((d) => ({ ...d, social: v }))} showError={attempted} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

export default function QualificacaoIntakePage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<"loading" | "ready" | "locked" | "error" | "success">("loading");
  const [data, setData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldError[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [nature, setNature] = useState<PartyNature>("PF");
  const [principal, setPrincipal] = useState<PartyForm>(emptyParty());
  const [principalDocs, setPrincipalDocs] = useState<PartyDocs>(emptyDocs());
  const [reps, setReps] = useState<RepForm[]>([]);

  const [banco, setBanco] = useState("");
  const [agencia, setAgencia] = useState("");
  const [conta, setConta] = useState("");
  const [tipoConta, setTipoConta] = useState("corrente");
  const [pixKey, setPixKey] = useState("");
  // Sprint 1, Fase 4.2 (19/09/2026): mecanismo técnico de consentimento LGPD, com texto padrão até validação formal.
  const [lgpdAccepted, setLgpdAccepted] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/cm/qualificacao/${token}`)
      .then(async (res) => {
        const json = await res.json();
        if (res.status === 409) { setState("locked"); setErrorMsg(json.message); }
        else if (!res.ok) { setState("error"); setErrorMsg(json.error || "Link inválido"); }
        else {
          setData(json);
          setPrincipal((p) => ({ ...p, email: json.email ?? "" }));
          setState("ready");
        }
      })
      .catch(() => { setState("error"); setErrorMsg("Erro de conexão"); });
  }, [token]);

  const requiredRepTypes = REQUIRED_REPRESENTATIVE_TYPES[nature];
  const recebeRepasse = ["mandatario", "intermediario_finder_venda", "intermediario_finder_compra"].includes(data?.role_in_document);
  const isMinorNature = nature === "INCAPAZ_RELATIVO" || nature === "INCAPAZ_ABSOLUTO";
  const needsInstrument = nature === "PF_PROCURACAO" || nature === "ESPOLIO";

  const changeNature = (n: PartyNature) => {
    setNature(n);
    setAttempted(false);
    setServerErrors([]);
    setFormError("");
    setReps(REQUIRED_REPRESENTATIVE_TYPES[n] ? [emptyRep()] : []);
    setPrincipal((p) => ({ ...emptyParty(), email: p.email }));
    setPrincipalDocs(emptyDocs());
  };

  const updateRep = (i: number, fn: (r: RepForm) => RepForm) =>
    setReps((rs) => normalizeChain(rs.map((r, idx) => (idx === i ? fn(r) : r)), !!requiredRepTypes));

  const buildBody = (): SubmissionInput & { documents: Record<string, DocRef>; lgpd_accepted: boolean } => {
    const serializeRep = (i: number): RepWithDocs | null => {
      const r = reps[i];
      if (!r) return null;
      const profile = profileOfRep(r.nature);
      return {
        ...partyToInput(profile, r.party, true),
        representative_type: r.type || null,
        party_nature: r.nature,
        // Anexos do representante (identificação com foto se pessoa física, contrato social se jurídica).
        documents: { identificacao_foto: toDocRef(r.docs.id), contrato_social: toDocRef(r.docs.social) },
        representation: r.nature === "PJ" ? serializeRep(i + 1) : null,
      };
    };
    return {
      party_nature: nature,
      ...partyToInput(nature, principal, false),
      representation: requiredRepTypes ? serializeRep(0) : null,
      documents: { identificacao_foto: toDocRef(principalDocs.id), contrato_social: toDocRef(principalDocs.social), instrumento: toDocRef(principalDocs.instrument) },
      lgpd_accepted: lgpdAccepted,
    };
  };

  const validation = useMemo(
    () => normalizeSubmission(buildBody(), { inviteName: data?.full_name, inviteEmail: data?.email }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nature, principal, reps, data, lgpdAccepted, principalDocs],
  );

  const errors: Record<string, string> = {};
  if (attempted) {
    for (const e of [...validation.errors, ...serverErrors]) {
      const k = `${e.path}:${e.field}`;
      if (!errors[k]) errors[k] = e.message;
    }
  }

  /** Anexos obrigatórios que ainda faltam (a tela e o servidor aplicam a mesma regra). */
  const missingDocs = (): string[] => {
    const out: string[] = [];
    if (["PF", "PF_PROCURACAO", "INCAPAZ_RELATIVO"].includes(nature) && !docReady(principalDocs.id)) out.push(DOC_KIND_LABELS.identificacao_foto);
    if (nature === "PJ" && !docReady(principalDocs.social)) out.push(DOC_KIND_LABELS.contrato_social);
    if (needsInstrument && reps[0]?.type) {
      const k = INSTRUMENT_DOCUMENT_KIND[reps[0].type] as DocKind | null;
      if (k && !docReady(principalDocs.instrument)) out.push(DOC_KIND_LABELS[k]);
    }
    reps.forEach((r, i) => {
      if (r.nature === "PJ" ? !docReady(r.docs.social) : !docReady(r.docs.id)) {
        out.push(`Representante ${i + 1}: ${DOC_KIND_LABELS[r.nature === "PJ" ? "contrato_social" : "identificacao_foto"]}`);
      }
    });
    return out;
  };

  const startSubmit = () => {
    setFormError("");
    setServerErrors([]);
    setAttempted(true);
    const docs = missingDocs();
    if (!validation.ok || docs.length) {
      const first = validation.errors[0]?.message ?? `Anexo obrigatório: ${docs[0]}.`;
      setFormError(`Confira os campos destacados. ${first}`);
      return;
    }
    if (recebeRepasse && !pixKey.trim() && !banco.trim()) { setFormError("Informe ao menos dados bancários ou uma chave PIX"); return; }
    if (!lgpdAccepted) { setFormError("É necessário aceitar o termo de consentimento LGPD para continuar"); return; }
    setConfirmOpen(true);
  };

  const confirmSend = async () => {
    setSubmitting(true);
    try {
      const body = {
        ...buildBody(),
        dados_bancarios: banco.trim() ? { banco: banco.trim(), agencia: agencia.trim(), conta: conta.trim(), tipo_conta: tipoConta } : null,
        pix_key: pixKey.trim() || null,
      };
      const res = await fetch(`/api/cm/qualificacao/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (res.ok) { setConfirmOpen(false); setState("success"); }
      else {
        setConfirmOpen(false);
        setServerErrors(Array.isArray(json.errors) ? json.errors : []);
        setFormError(json.error ?? "Erro ao enviar qualificação");
      }
    } catch {
      setConfirmOpen(false);
      setFormError("Erro de conexão");
    } finally {
      setSubmitting(false);
    }
  };

  const previewText = confirmOpen ? previewQualificationText(validation) : null;

  return (
    <div className="min-h-screen bg-[#09081A]">
      <div className="border-b border-[#C9A84C]/20 bg-[#12112A]">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <img src="https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png" alt="V3 Partners" className="h-10" />
          <div>
            <p className="text-sm font-bold text-[#F5F1E8]">Qualificação de Partes</p>
            <p className="text-[11px] text-[#9BAFC5]">V3 Partners</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10">
        {state === "loading" && (
          <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <Loader2 className="w-8 h-8 animate-spin text-[#C9A84C] mb-4" />
            <p className="text-sm text-[#9BAFC5]">Carregando formulário</p>
          </div>
        )}

        {state === "error" && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
            <AlertTriangle className="w-12 h-12 text-red-400 mb-4" />
            <h2 className="text-xl font-bold text-[#F5F1E8] mb-2">Link inválido</h2>
            <p className="text-sm text-[#9BAFC5]">{errorMsg}</p>
            <p className="text-xs text-[#9BAFC5]/50 mt-6">Entre em contato: deal@v3partners.com.br</p>
          </div>
        )}

        {state === "locked" && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
            <div className="w-16 h-16 rounded-full bg-[#C9A84C]/10 flex items-center justify-center mb-6">
              <CheckCircle2 className="w-8 h-8 text-[#C9A84C]" />
            </div>
            <h2 className="text-xl font-bold text-[#F5F1E8] mb-2">Qualificação já enviada</h2>
            <p className="text-sm text-[#9BAFC5] max-w-md">{errorMsg}</p>
            <p className="text-xs text-[#9BAFC5]/50 mt-6">Entre em contato: deal@v3partners.com.br</p>
          </div>
        )}

        {state === "success" && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-[#F5F1E8] mb-2">Qualificação enviada</h2>
            <p className="text-sm text-[#9BAFC5] max-w-md">Seus dados foram recebidos. A V3 Partners prosseguirá com a geração do documento assim que todos os envolvidos concluírem esta etapa.</p>
          </div>
        )}

        {state === "ready" && data && (
          <div className="space-y-5">
            <div className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-4">
              <p className="text-[11px] text-[#E8C97A] font-bold uppercase mb-1">{data.document_type_label}{data.anonymous_id ? ` · ${data.anonymous_id}` : ""}</p>
              <p className="text-sm text-[#F5F1E8] font-semibold">{data.full_name}</p>
              <p className="text-[12px] text-[#9BAFC5]">{data.email}</p>
            </div>

            <p className="text-[12px] text-[#9BAFC5] leading-relaxed">
              Complete a qualificação civil abaixo. Os campos variam conforme a natureza da parte. Todos os marcados com * são obrigatórios.
            </p>

            <div className="space-y-3">
              <div>
                <label className={LABEL_CLS} htmlFor="natureza">Natureza da Parte *</label>
                <select id="natureza" value={nature} onChange={(e) => changeNature(e.target.value as PartyNature)} className={INPUT_CLS}>
                  {NATURE_OPTIONS.map((n) => <option key={n} value={n}>{PARTY_NATURE_LABELS[n]}</option>)}
                </select>
              </div>

              {isMinorNature && (
                <div className="flex items-start gap-2 text-[12px] text-[#E8C97A] bg-[#C9A84C]/10 border border-[#C9A84C]/30 rounded px-3 py-3" role="note">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>
                    A qualificação de menor passará a exigir a declaração de ciência do representante legal em uma etapa posterior.
                    Até lá, este formulário não registra essa ciência.
                  </span>
                </div>
              )}

              <div className="pt-2 border-t border-[#9BAFC5]/10">
                <PartyFields
                  profile={nature} value={principal} errors={errors} path="principal" token={token}
                  update={(fn) => setPrincipal(fn)} docs={principalDocs} onDocs={(fn) => setPrincipalDocs(fn)}
                  nameFromInvite={data.full_name} attempted={attempted}
                />
              </div>

              {requiredRepTypes && reps.map((rep, i) => {
                const allowed = i === 0 ? requiredRepTypes : (["administrador", "representante_legal"] as RepresentativeType[]);
                const profile = profileOfRep(rep.nature);
                const path = `representante.${i + 1}`;
                const instrKind = i === 0 && needsInstrument && rep.type ? (INSTRUMENT_DOCUMENT_KIND[rep.type] as DocKind | null) : null;
                const principalAnchor: DocAnchor | null = isValidCPF(principal.cpf) ? { key: "cpf:" + principal.cpf.replace(/\D/g, ""), documentNumber: principal.cpf } : null;
                return (
                  <div key={i} className={`pt-3 border-t border-[#9BAFC5]/10 space-y-3 ${i > 0 ? "pl-4 border-l-2 border-l-[#C9A84C]/20" : ""}`}>
                    <p className="text-[11px] text-[#E8C97A] font-bold uppercase">{i === 0 ? "Representante Legal" : "Quem representa esta empresa"}</p>
                    <div>
                      <label className={LABEL_CLS}>Representante é *</label>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {REPRESENTATIVE_TYPE_ORDER.filter((t) => allowed.includes(t)).map((t) => (
                          <button key={t} type="button" onClick={() => updateRep(i, (r) => ({ ...r, type: t }))}
                            className={`px-3 py-2 rounded text-sm font-semibold border transition ${rep.type === t ? "bg-[#C9A84C]/15 border-[#C9A84C] text-[#F5F1E8]" : "bg-[#12112A] border-[#9BAFC5]/15 text-[#9BAFC5]"}`}>
                            {REPRESENTATIVE_TYPE_LABELS[t]}
                          </button>
                        ))}
                      </div>
                      <Err errors={errors} path={path} field="representation" />
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Este representante é *</label>
                      <div className="flex gap-2 mt-1">
                        {(["PF", "PJ"] as const).map((n) => (
                          <button key={n} type="button" onClick={() => updateRep(i, (r) => ({ ...r, nature: n }))}
                            className={`flex-1 px-3 py-2 rounded text-sm font-semibold border transition ${rep.nature === n ? "bg-[#C9A84C]/15 border-[#C9A84C] text-[#F5F1E8]" : "bg-[#12112A] border-[#9BAFC5]/15 text-[#9BAFC5]"}`}>
                            {n === "PF" ? "Pessoa Física" : "Pessoa Jurídica"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <PartyFields
                      profile={profile} value={rep.party} errors={errors} path={path} token={token}
                      update={(fn) => updateRep(i, (r) => ({ ...r, party: fn(r.party) }))}
                      docs={rep.docs} onDocs={(fn) => updateRep(i, (r) => ({ ...r, docs: fn(r.docs) }))}
                      attempted={attempted} hideEmailHint
                    />
                    {instrKind && (
                      <DocSlot token={token} kind={instrKind} anchor={principalAnchor}
                        anchorHint="Preencha o CPF da parte principal acima antes de anexar este documento."
                        value={principalDocs.instrument} onChange={(v) => setPrincipalDocs((d) => ({ ...d, instrument: v }))} showError={attempted} />
                    )}
                  </div>
                );
              })}

              {recebeRepasse && (
                <div className="pt-2 border-t border-[#9BAFC5]/10">
                  <p className="text-[11px] text-[#E8C97A] font-bold uppercase mb-2">Dados para repasse (ao menos um)</p>
                  <label className={LABEL_CLS}>Chave PIX</label>
                  <input value={pixKey} onChange={(e) => setPixKey(e.target.value)} className={`${INPUT_CLS} mb-3`} />
                  <div className="grid grid-cols-2 gap-2">
                    <input value={banco} onChange={(e) => setBanco(e.target.value)} placeholder="Banco" aria-label="Banco" className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-sm text-[#F5F1E8]" />
                    <select value={tipoConta} onChange={(e) => setTipoConta(e.target.value)} aria-label="Tipo de conta" className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-sm text-[#F5F1E8]">
                      <option value="corrente">Conta Corrente</option>
                      <option value="poupanca">Poupança</option>
                    </select>
                    <input value={agencia} onChange={(e) => setAgencia(e.target.value)} placeholder="Agência" aria-label="Agência" className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-sm text-[#F5F1E8]" />
                    <input value={conta} onChange={(e) => setConta(e.target.value)} placeholder="Conta" aria-label="Conta" className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-sm text-[#F5F1E8]" />
                  </div>
                </div>
              )}
            </div>

            {/* Sprint 1, Fase 4.2 (19/09/2026): consentimento LGPD, texto padrão até validação formal. */}
            <div className="pt-3 border-t border-[#9BAFC5]/10">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={lgpdAccepted} onChange={(e) => setLgpdAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-[#C9A84C] shrink-0" />
                <span className="text-[12px] text-[#9BAFC5] leading-relaxed">
                  Declaro estar ciente de que os dados pessoais fornecidos neste formulário
                  (identificação, documentos, endereço e, quando aplicável, dados bancários)
                  serão tratados pela V3 Partners Soluções Ltda exclusivamente para fins de
                  qualificação civil das partes na operação identificada acima, incluindo
                  verificação de identidade e elaboração do respectivo documento contratual,
                  em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
                  Os dados serão mantidos pelo prazo necessário à operação e eventuais
                  obrigações legais, e poderão ser compartilhados com prestadores de serviço
                  envolvidos nesta finalidade. <span className="text-[#9BAFC5]/70">(Texto padrão,
                  pendente de validação formal pelo departamento jurídico.)</span>
                </span>
              </label>
            </div>

            {formError && <p className="text-[12px] text-red-400" role="alert">{formError}</p>}

            <button onClick={startSubmit} disabled={submitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#C9A84C] text-[#09081A] rounded-lg text-sm font-bold hover:bg-[#E8C97A] transition disabled:opacity-50">
              Revisar e enviar qualificação
            </button>
          </div>
        )}
      </div>

      {/* Confirmação de envio (BRIEF 5.13): modal vermelho V3, só fecha por botão explícito, nunca ao clicar fora. */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-[#12112A] border-2 border-red-400/70 rounded-lg p-6 space-y-4">
            <h2 id="confirm-title" className="text-base font-bold text-[#F5F1E8]">Confirmar o envio da qualificação</h2>
            <p className="text-[12px] text-red-300 leading-relaxed">
              Depois do envio você não consegue mais alterar os dados por este link. Só a Mesa pode reabrir para correção. Confira o texto abaixo, que é exatamente o que será impresso no documento.
            </p>
            <p className="text-[13px] text-[#F5F1E8] leading-relaxed bg-[#09081A] border border-[#9BAFC5]/15 rounded p-3 text-justify">
              {previewText ?? "Não foi possível montar o texto. Volte e corrija os campos."}
            </p>
            {isMinorNature && (
              <p className="text-[12px] text-[#E8C97A]">Nesta etapa a declaração de ciência do representante legal ainda não é registrada por este formulário.</p>
            )}
            <div className="flex gap-3 justify-end pt-2">
              <button type="button" onClick={() => setConfirmOpen(false)} disabled={submitting}
                className="px-4 py-2 rounded border border-[#9BAFC5]/30 text-sm text-[#F5F1E8] hover:border-[#C9A84C]/60 disabled:opacity-50">Voltar e corrigir</button>
              <button type="button" onClick={confirmSend} disabled={submitting || !previewText}
                className="flex items-center gap-2 px-4 py-2 rounded bg-red-500/90 text-white text-sm font-bold hover:bg-red-500 disabled:opacity-50">
                {submitting ? <Loader2 size={14} className="animate-spin" /> : null} Confirmar envio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
