"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, AlertTriangle, CheckCircle2, Upload, ShieldCheck, X } from "lucide-react";
import {
  type PartyNature, type RepresentativeType, type CompanyLegalNature,
  PARTY_NATURE_LABELS, REPRESENTATIVE_TYPE_LABELS, REQUIRED_REPRESENTATIVE_TYPES,
} from "@/lib/legal-qualification";

const INPUT_CLS = "w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-sm text-[#F5F1E8] mt-1";
const LABEL_CLS = "text-[9px] text-[#9BAFC5] uppercase";

// Reaproveitamento de KYC (04/09/2026): estado de um slot de documento
// (identificação com foto ou contrato social) -- vale tanto para a parte
// principal quanto para qualquer nível da cadeia de representação.
type DocKind = "identificacao_foto" | "contrato_social";
const DOC_KIND_LABELS: Record<DocKind, string> = {
  identificacao_foto: "Documento de Identificação com Foto (RG/CNH/Passaporte)",
  contrato_social: "Contrato Social / Estatuto",
};

interface DocSlotState {
  status: "idle" | "checking" | "valid_reuse" | "uploading" | "uploaded" | "error";
  documentId?: string;
  filename?: string;
  validUntil?: string;
  error?: string;
}

function emptyDocSlot(): DocSlotState {
  return { status: "idle" };
}

/** Widget reaproveitável de anexo de KYC. Ao CPF/CNPJ mudar, checa silenciosamente se
 *  a V3 já tem um documento válido (< 12 meses) daquele número -- se tiver, esconde o
 *  upload e mostra o badge de reaproveitamento; se não, pede o arquivo e sobe na hora. */
function KycDocSlot({ token, kind, documentNumber, value, onChange }: {
  token: string;
  kind: DocKind;
  documentNumber: string;
  value: DocSlotState;
  onChange: (v: DocSlotState) => void;
}) {
  useEffect(() => {
    const digits = documentNumber.replace(/\D/g, "");
    const expectedLen = kind === "identificacao_foto" ? 11 : 14;
    if (digits.length !== expectedLen) {
      if (value.status !== "idle" && value.status !== "uploading" && value.status !== "uploaded") onChange(emptyDocSlot());
      return;
    }
    if (value.status === "uploaded" || value.status === "uploading") return;

    onChange({ status: "checking" });
    const controller = new AbortController();
    fetch(`/api/cm/kyc/check?token=${token}&document=${digits}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (json.valid && json.document_kind === kind) {
          onChange({ status: "valid_reuse", validUntil: json.valid_until });
        } else {
          onChange(emptyDocSlot());
        }
      })
      .catch(() => onChange(emptyDocSlot()));
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentNumber, kind, token]);

  const upload = async (file: File) => {
    onChange({ status: "uploading" });
    const fd = new FormData();
    fd.append("file", file);
    fd.append("document_kind", kind);
    fd.append("document_number", documentNumber.replace(/\D/g, ""));
    try {
      const res = await fetch(`/api/cm/qualificacao/${token}/documents`, { method: "POST", body: fd });
      const json = await res.json();
      if (res.ok) {
        onChange({ status: "uploaded", documentId: json.document.id, filename: json.document.original_filename });
      } else {
        onChange({ status: "error", error: json.error ?? "Falha no upload" });
      }
    } catch {
      onChange({ status: "error", error: "Erro de conexão no upload" });
    }
  };

  const remove = async () => {
    if (value.documentId) {
      await fetch(`/api/cm/qualificacao/${token}/documents/${value.documentId}`, { method: "DELETE" }).catch(() => {});
    }
    onChange(emptyDocSlot());
  };

  return (
    <div>
      <p className="text-[9px] text-[#C9A84C] font-bold uppercase pt-1 mb-1">{DOC_KIND_LABELS[kind]} *</p>

      {value.status === "checking" && (
        <div className="flex items-center gap-2 text-[11px] text-[#9BAFC5] bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2">
          <Loader2 size={14} className="animate-spin" /> Verificando se já temos este documento...
        </div>
      )}

      {value.status === "valid_reuse" && (
        <div className="flex items-center gap-2 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded px-3 py-2">
          <ShieldCheck size={14} />
          Documentação KYC já validada e ativa na base da V³ Partners
          {value.validUntil ? ` (válida até ${new Date(value.validUntil).toLocaleDateString("pt-BR")})` : ""}.
        </div>
      )}

      {(value.status === "idle" || value.status === "error") && (
        <label className="flex items-center gap-2 text-[12px] text-[#9BAFC5] bg-[#12112A] border border-dashed border-[#9BAFC5]/25 rounded px-3 py-3 cursor-pointer hover:border-[#C9A84C]/50 transition">
          <Upload size={14} />
          Selecionar arquivo (JPG, PNG ou PDF, até 15MB)
          <input type="file" accept="image/jpeg,image/png,application/pdf" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
        </label>
      )}

      {value.status === "uploading" && (
        <div className="flex items-center gap-2 text-[11px] text-[#9BAFC5] bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2">
          <Loader2 size={14} className="animate-spin" /> Enviando arquivo...
        </div>
      )}

      {value.status === "uploaded" && (
        <div className="flex items-center justify-between gap-2 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded px-3 py-2">
          <span className="flex items-center gap-2 truncate"><CheckCircle2 size={14} /> {value.filename}</span>
          <button type="button" onClick={remove} className="text-[#9BAFC5] hover:text-red-400 shrink-0"><X size={14} /></button>
        </div>
      )}

      {value.status === "error" && <p className="text-[10px] text-red-400 mt-1">{value.error}</p>}
    </div>
  );
}

// Estado do representante, recursivo (01/09/2026, diretriz Dr. Athaydes):
// uma PJ pode ser representada por outra PJ, encadeado até chegar numa
// Pessoa Física -- `representation` aninhado é essa cadeia.
interface RepresentativeState {
  representative_type: RepresentativeType | "";
  party_nature: "PF" | "PJ";
  full_name: string; cpf_cnpj: string; rg: string; nationality: string; marital_status: string; profession: string; phone: string;
  endereco_rua: string; endereco_numero: string; endereco_complemento: string; endereco_bairro: string; endereco_cidade: string; endereco_estado: string; endereco_cep: string;
  company_name: string; company_cnpj: string; company_legal_nature: CompanyLegalNature;
  company_rua: string; company_numero: string; company_complemento: string; company_bairro: string; company_cidade: string; company_estado: string; company_cep: string;
  // Reaproveitamento de KYC (04/09/2026): cada nível da cadeia tem seu próprio
  // slot de documento -- identificacao_foto se PF, contrato_social se PJ.
  documents: { identificacao_foto: DocSlotState; contrato_social: DocSlotState };
  representation: RepresentativeState | null;
}

function emptyRepresentative(): RepresentativeState {
  return {
    representative_type: "", party_nature: "PF",
    full_name: "", cpf_cnpj: "", rg: "", nationality: "", marital_status: "", profession: "", phone: "",
    endereco_rua: "", endereco_numero: "", endereco_complemento: "", endereco_bairro: "", endereco_cidade: "", endereco_estado: "", endereco_cep: "",
    company_name: "", company_cnpj: "", company_legal_nature: "privado",
    company_rua: "", company_numero: "", company_complemento: "", company_bairro: "", company_cidade: "", company_estado: "", company_cep: "",
    documents: { identificacao_foto: emptyDocSlot(), contrato_social: emptyDocSlot() },
    representation: null,
  };
}

// Complemento (04/09/2026, achado real ao revisar um preenchimento):
// opcional, sem asterisco, nunca bloqueia o envio se ausente.
function EnderecoFields({ prefixLabel, rua, numero, complemento, bairro, cidade, estado, cep, onChange }: {
  prefixLabel: string;
  rua: string; numero: string; complemento: string; bairro: string; cidade: string; estado: string; cep: string;
  onChange: (field: "rua" | "numero" | "complemento" | "bairro" | "cidade" | "estado" | "cep", value: string) => void;
}) {
  return (
    <div>
      <p className="text-[9px] text-[#C9A84C] font-bold uppercase pt-1 mb-1">{prefixLabel} *</p>
      <div className="grid grid-cols-3 gap-2">
        <input value={rua} onChange={(e) => onChange("rua", e.target.value)} placeholder="Rua/Av." className="col-span-2 w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-sm text-[#F5F1E8]" />
        <input value={numero} onChange={(e) => onChange("numero", e.target.value)} placeholder="Número" className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-sm text-[#F5F1E8]" />
        <input value={complemento} onChange={(e) => onChange("complemento", e.target.value)} placeholder="Complemento (apto/sala/bloco, opcional)" className="col-span-3 w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-sm text-[#F5F1E8]" />
        <input value={bairro} onChange={(e) => onChange("bairro", e.target.value)} placeholder="Bairro" className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-sm text-[#F5F1E8]" />
        <input value={cidade} onChange={(e) => onChange("cidade", e.target.value)} placeholder="Cidade" className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-sm text-[#F5F1E8]" />
        <input value={estado} onChange={(e) => onChange("estado", e.target.value)} placeholder="Estado (UF)" className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-sm text-[#F5F1E8]" />
        <input value={cep} onChange={(e) => onChange("cep", e.target.value)} placeholder="CEP" className="col-span-3 w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-sm text-[#F5F1E8]" />
      </div>
    </div>
  );
}

// Componente recursivo: renderiza um representante e, se ele próprio for
// Pessoa Jurídica, renderiza embaixo (indentado) o representante DELE,
// restrito a administrador/representante legal -- e assim por diante, até
// a cadeia terminar numa Pessoa Física (nota de arquitetura do BRIEF).
function RepresentativeForm({ token, allowedTypes, depth, value, onChange }: {
  token: string;
  allowedTypes: RepresentativeType[];
  depth: number;
  value: RepresentativeState;
  onChange: (v: RepresentativeState) => void;
}) {
  const set = <K extends keyof RepresentativeState>(field: K, val: RepresentativeState[K]) => onChange({ ...value, [field]: val });

  return (
    <div className={`space-y-3 ${depth > 0 ? "pl-4 border-l-2 border-[#C9A84C]/20" : ""}`}>
      <div>
        <label className={LABEL_CLS}>Representante é *</label>
        <div className="flex gap-2 mt-1 flex-wrap">
          {allowedTypes.map((t) => (
            <button key={t} type="button" onClick={() => set("representative_type", t)}
              className={`px-3 py-2 rounded text-sm font-semibold border transition ${value.representative_type === t ? "bg-[#C9A84C]/15 border-[#C9A84C] text-[#F5F1E8]" : "bg-[#12112A] border-[#9BAFC5]/15 text-[#9BAFC5]"}`}>
              {REPRESENTATIVE_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={LABEL_CLS}>Este representante é *</label>
        <div className="flex gap-2 mt-1">
          <button type="button" onClick={() => set("party_nature", "PF")}
            className={`flex-1 px-3 py-2 rounded text-sm font-semibold border transition ${value.party_nature === "PF" ? "bg-[#C9A84C]/15 border-[#C9A84C] text-[#F5F1E8]" : "bg-[#12112A] border-[#9BAFC5]/15 text-[#9BAFC5]"}`}>
            Pessoa Física
          </button>
          <button type="button" onClick={() => set("party_nature", "PJ")}
            className={`flex-1 px-3 py-2 rounded text-sm font-semibold border transition ${value.party_nature === "PJ" ? "bg-[#C9A84C]/15 border-[#C9A84C] text-[#F5F1E8]" : "bg-[#12112A] border-[#9BAFC5]/15 text-[#9BAFC5]"}`}>
            Pessoa Jurídica
          </button>
        </div>
      </div>

      {value.party_nature === "PF" ? (
        <>
          <div>
            <label className={LABEL_CLS}>Nome Completo *</label>
            <input value={value.full_name} onChange={(e) => set("full_name", e.target.value)} className={INPUT_CLS} />
          </div>
          <div>
            <label className={LABEL_CLS}>CPF *</label>
            <input value={value.cpf_cnpj} onChange={(e) => set("cpf_cnpj", e.target.value)} className={INPUT_CLS} />
          </div>
          <div>
            <label className={LABEL_CLS}>Carteira de Identidade (RG, se houver)</label>
            <input value={value.rg} onChange={(e) => set("rg", e.target.value)} className={INPUT_CLS} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={LABEL_CLS}>Nacionalidade *</label><input value={value.nationality} onChange={(e) => set("nationality", e.target.value)} className={INPUT_CLS} /></div>
            <div><label className={LABEL_CLS}>Estado Civil *</label><input value={value.marital_status} onChange={(e) => set("marital_status", e.target.value)} className={INPUT_CLS} /></div>
            <div><label className={LABEL_CLS}>Profissão *</label><input value={value.profession} onChange={(e) => set("profession", e.target.value)} className={INPUT_CLS} /></div>
            <div><label className={LABEL_CLS}>Telefone com DDD *</label><input value={value.phone} onChange={(e) => set("phone", e.target.value)} className={INPUT_CLS} /></div>
          </div>
          <EnderecoFields prefixLabel="Endereço Residencial" rua={value.endereco_rua} numero={value.endereco_numero} complemento={value.endereco_complemento} bairro={value.endereco_bairro} cidade={value.endereco_cidade} estado={value.endereco_estado} cep={value.endereco_cep}
            onChange={(f, v) => set(`endereco_${f}` as keyof RepresentativeState, v as any)} />
          <KycDocSlot token={token} kind="identificacao_foto" documentNumber={value.cpf_cnpj}
            value={value.documents.identificacao_foto}
            onChange={(v) => set("documents", { ...value.documents, identificacao_foto: v })} />
        </>
      ) : (
        <>
          <div>
            <label className={LABEL_CLS}>Razão Social *</label>
            <input value={value.company_name} onChange={(e) => set("company_name", e.target.value)} className={INPUT_CLS} />
          </div>
          <div>
            <label className={LABEL_CLS}>CNPJ *</label>
            <input value={value.company_cnpj} onChange={(e) => set("company_cnpj", e.target.value)} className={INPUT_CLS} />
          </div>
          <EnderecoFields prefixLabel="Endereço da Sede" rua={value.company_rua} numero={value.company_numero} complemento={value.company_complemento} bairro={value.company_bairro} cidade={value.company_cidade} estado={value.company_estado} cep={value.company_cep}
            onChange={(f, v) => set(`company_${f}` as keyof RepresentativeState, v as any)} />
          <KycDocSlot token={token} kind="contrato_social" documentNumber={value.company_cnpj}
            value={value.documents.contrato_social}
            onChange={(v) => set("documents", { ...value.documents, contrato_social: v })} />

          {/* Encadeamento: esta PJ representante também precisa do próprio
              administrador/representante legal, recursivamente. */}
          <div className="pt-2 border-t border-[#9BAFC5]/10">
            <p className="text-[10px] text-[#C9A84C] font-bold uppercase mb-2">Quem representa esta empresa</p>
            <RepresentativeForm
              token={token}
              allowedTypes={["administrador", "representante_legal"]}
              depth={depth + 1}
              value={value.representation ?? emptyRepresentative()}
              onChange={(v) => set("representation", v)}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default function QualificacaoIntakePage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<"loading" | "ready" | "locked" | "error" | "success">("loading");
  const [data, setData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const [partyNature, setPartyNature] = useState<PartyNature>("PF");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [rg, setRg] = useState("");
  const [banco, setBanco] = useState("");
  const [agencia, setAgencia] = useState("");
  const [conta, setConta] = useState("");
  const [tipoConta, setTipoConta] = useState("corrente");
  const [pixKey, setPixKey] = useState("");

  const [companyName, setCompanyName] = useState("");
  const [companyCnpj, setCompanyCnpj] = useState("");
  const [companyLegalNature, setCompanyLegalNature] = useState<CompanyLegalNature>("privado");
  const [nationality, setNationality] = useState("");
  const [maritalStatus, setMaritalStatus] = useState("");
  const [profession, setProfession] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");

  const [enderecoRua, setEnderecoRua] = useState("");
  const [enderecoNumero, setEnderecoNumero] = useState("");
  const [enderecoComplemento, setEnderecoComplemento] = useState("");
  const [enderecoBairro, setEnderecoBairro] = useState("");
  const [enderecoCidade, setEnderecoCidade] = useState("");
  const [enderecoEstado, setEnderecoEstado] = useState("");
  const [enderecoCep, setEnderecoCep] = useState("");

  const [companyRua, setCompanyRua] = useState("");
  const [companyNumero, setCompanyNumero] = useState("");
  const [companyComplemento, setCompanyComplemento] = useState("");
  const [companyBairro, setCompanyBairro] = useState("");
  const [companyCidade, setCompanyCidade] = useState("");
  const [companyEstado, setCompanyEstado] = useState("");
  const [companyCep, setCompanyCep] = useState("");

  const [representation, setRepresentation] = useState<RepresentativeState>(emptyRepresentative());

  // Reaproveitamento de KYC (04/09/2026): slots da PARTE PRINCIPAL -- ID com
  // foto se PF, contrato social se PJ. Slots de qualquer representante vivem
  // dentro do próprio RepresentativeState (documents), já fiados acima.
  const [idDocSlot, setIdDocSlot] = useState<DocSlotState>(emptyDocSlot());
  const [contratoSocialSlot, setContratoSocialSlot] = useState<DocSlotState>(emptyDocSlot());

  useEffect(() => {
    if (!token) return;
    fetch(`/api/cm/qualificacao/${token}`)
      .then(async (res) => {
        const json = await res.json();
        if (res.status === 409) { setState("locked"); setErrorMsg(json.message); }
        else if (!res.ok) { setState("error"); setErrorMsg(json.error || "Link inválido"); }
        else { setData(json); setState("ready"); }
      })
      .catch(() => { setState("error"); setErrorMsg("Erro de conexão"); });
  }, [token]);

  const recebeRepasse = ["mandatario", "intermediario_finder_venda", "intermediario_finder_compra"].includes(data?.role_in_document);
  const representativeTypesRequired = REQUIRED_REPRESENTATIVE_TYPES[partyNature];

  // Reaproveitamento de KYC (04/09/2026): converte o estado de UI do slot de
  // documento no formato aceito pelo backend (reaproveitar ou referenciar o
  // upload recém-feito), e faz o mesmo recursivamente em toda a cadeia de
  // representação antes de enviar.
  const toDocRef = (slot: DocSlotState): { reuse: true } | { document_id: string } | null => {
    if (slot.status === "valid_reuse") return { reuse: true };
    if (slot.status === "uploaded" && slot.documentId) return { document_id: slot.documentId };
    return null;
  };
  const docReady = (slot: DocSlotState) => slot.status === "valid_reuse" || slot.status === "uploaded";
  const representationDocsReady = (rep: RepresentativeState | null): boolean => {
    if (!rep) return false;
    if (rep.party_nature === "PJ") return docReady(rep.documents.contrato_social) && representationDocsReady(rep.representation);
    return docReady(rep.documents.identificacao_foto);
  };
  const serializeRepresentation = (rep: RepresentativeState | null): any => {
    if (!rep) return null;
    return {
      ...rep,
      documents: { identificacao_foto: toDocRef(rep.documents.identificacao_foto), contrato_social: toDocRef(rep.documents.contrato_social) },
      representation: serializeRepresentation(rep.representation),
    };
  };

  const submit = async () => {
    setFormError("");

    if (partyNature !== "PJ" && !cpfCnpj.trim()) { setFormError("CPF é obrigatório"); return; }
    if (["PF", "PF_PROCURACAO", "INCAPAZ_RELATIVO"].includes(partyNature)) {
      const enderecoOk = enderecoRua.trim() && enderecoNumero.trim() && enderecoBairro.trim() && enderecoCidade.trim() && enderecoEstado.trim() && enderecoCep.trim();
      if (!nationality.trim() || !maritalStatus.trim() || !profession.trim() || !birthDate.trim() || !phone.trim() || !enderecoOk) {
        setFormError("Todos os campos marcados com * são obrigatórios");
        return;
      }
    }
    if (partyNature === "INCAPAZ_ABSOLUTO" && (!nationality.trim() || !birthDate.trim())) {
      setFormError("Nacionalidade e data de nascimento são obrigatórios");
      return;
    }
    if (partyNature === "PJ") {
      const enderecoEmpresaOk = companyRua.trim() && companyNumero.trim() && companyBairro.trim() && companyCidade.trim() && companyEstado.trim() && companyCep.trim();
      if (!companyName.trim() || !companyCnpj.trim() || !enderecoEmpresaOk) {
        setFormError("Razão social, CNPJ e endereço completo da sede são obrigatórios");
        return;
      }
    }
    if (representativeTypesRequired && !representation.representative_type) {
      setFormError(`Selecione o tipo de representante (${representativeTypesRequired.map((t) => REPRESENTATIVE_TYPE_LABELS[t]).join(" ou ")})`);
      return;
    }
    if (["PF", "PF_PROCURACAO", "INCAPAZ_RELATIVO"].includes(partyNature) && !docReady(idDocSlot)) {
      setFormError("Anexe o documento de identificação com foto (ou aguarde a checagem de reaproveitamento terminar)");
      return;
    }
    if (partyNature === "PJ" && !docReady(contratoSocialSlot)) {
      setFormError("Anexe o contrato social da empresa (ou aguarde a checagem de reaproveitamento terminar)");
      return;
    }
    if (representativeTypesRequired && !representationDocsReady(representation)) {
      setFormError("Anexe o(s) documento(s) obrigatório(s) do representante (identificação com foto ou contrato social)");
      return;
    }
    if (recebeRepasse && !pixKey.trim() && !banco.trim()) {
      setFormError("Informe ao menos dados bancários ou uma chave PIX");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/cm/qualificacao/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          party_nature: partyNature,
          cpf_cnpj: cpfCnpj.trim() || null,
          rg: rg.trim() || null,
          dados_bancarios: banco.trim() ? { banco: banco.trim(), agencia: agencia.trim(), conta: conta.trim(), tipo_conta: tipoConta } : null,
          pix_key: pixKey.trim() || null,
          company_name: partyNature === "PJ" ? companyName.trim() : null,
          company_cnpj: partyNature === "PJ" ? companyCnpj.trim() : null,
          company_legal_nature: partyNature === "PJ" ? companyLegalNature : null,
          nationality: nationality.trim() || null,
          marital_status: maritalStatus.trim() || null,
          profession: profession.trim() || null,
          birth_date: birthDate || null,
          phone: phone.trim() || null,
          endereco_rua: enderecoRua.trim() || null, endereco_numero: enderecoNumero.trim() || null,
          endereco_complemento: enderecoComplemento.trim() || null,
          endereco_bairro: enderecoBairro.trim() || null, endereco_cidade: enderecoCidade.trim() || null,
          endereco_estado: enderecoEstado.trim() || null, endereco_cep: enderecoCep.trim() || null,
          company_rua: partyNature === "PJ" ? companyRua.trim() : null, company_numero: partyNature === "PJ" ? companyNumero.trim() : null,
          company_complemento: partyNature === "PJ" ? (companyComplemento.trim() || null) : null,
          company_bairro: partyNature === "PJ" ? companyBairro.trim() : null, company_cidade: partyNature === "PJ" ? companyCidade.trim() : null,
          company_estado: partyNature === "PJ" ? companyEstado.trim() : null, company_cep: partyNature === "PJ" ? companyCep.trim() : null,
          documents: { identificacao_foto: toDocRef(idDocSlot), contrato_social: toDocRef(contratoSocialSlot) },
          representation: representativeTypesRequired ? serializeRepresentation(representation) : null,
        }),
      });
      const json = await res.json();
      if (res.ok) setState("success");
      else setFormError(json.error ?? "Erro ao enviar qualificação");
    } catch {
      setFormError("Erro de conexão");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09081A]">
      <div className="border-b border-[#C9A84C]/20 bg-[#12112A]">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <img src="https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png" alt="V3 Partners" className="h-8" />
          <div>
            <p className="text-sm font-bold text-[#F5F1E8]">Qualificação de Partes</p>
            <p className="text-[10px] text-[#9BAFC5]">V3 Partners</p>
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
              <p className="text-[9px] text-[#C9A84C] font-bold uppercase mb-1">{data.document_type_label}{data.anonymous_id ? ` · ${data.anonymous_id}` : ""}</p>
              <p className="text-sm text-[#F5F1E8] font-semibold">{data.full_name}</p>
              <p className="text-[11px] text-[#9BAFC5]">{data.email}</p>
            </div>

            <p className="text-[12px] text-[#9BAFC5] leading-relaxed">
              Complete a qualificação civil completa abaixo. Os campos variam conforme a natureza da parte. Todos os marcados com * são obrigatórios.
            </p>

            <div className="space-y-3">
              <div>
                <label className={LABEL_CLS}>Natureza da Parte *</label>
                <select value={partyNature} onChange={(e) => setPartyNature(e.target.value as PartyNature)} className={INPUT_CLS}>
                  {(Object.keys(PARTY_NATURE_LABELS) as PartyNature[]).map((n) => (
                    <option key={n} value={n}>{PARTY_NATURE_LABELS[n]}</option>
                  ))}
                </select>
              </div>

              {partyNature === "PJ" && (
                <div className="pt-2 border-t border-[#9BAFC5]/10 space-y-3">
                  <p className="text-[10px] text-[#C9A84C] font-bold uppercase">Dados da empresa</p>
                  <div>
                    <label className={LABEL_CLS}>Razão Social *</label>
                    <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={INPUT_CLS} />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>CNPJ *</label>
                    <input value={companyCnpj} onChange={(e) => setCompanyCnpj(e.target.value)} className={INPUT_CLS} />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Natureza Jurídica</label>
                    <select value={companyLegalNature} onChange={(e) => setCompanyLegalNature(e.target.value as CompanyLegalNature)} className={INPUT_CLS}>
                      <option value="privado">Direito Privado</option>
                      <option value="publico">Direito Público</option>
                      <option value="misto">Economia Mista</option>
                    </select>
                  </div>
                  <EnderecoFields prefixLabel="Endereço da Sede" rua={companyRua} numero={companyNumero} complemento={companyComplemento} bairro={companyBairro} cidade={companyCidade} estado={companyEstado} cep={companyCep}
                    onChange={(f, v) => {
                      const setters: Record<string, (v: string) => void> = { rua: setCompanyRua, numero: setCompanyNumero, complemento: setCompanyComplemento, bairro: setCompanyBairro, cidade: setCompanyCidade, estado: setCompanyEstado, cep: setCompanyCep };
                      setters[f](v);
                    }} />
                  <KycDocSlot token={token} kind="contrato_social" documentNumber={companyCnpj} value={contratoSocialSlot} onChange={setContratoSocialSlot} />
                </div>
              )}

              {partyNature === "ESPOLIO" && (
                <div className="pt-2 border-t border-[#9BAFC5]/10">
                  <p className="text-[10px] text-[#C9A84C] font-bold uppercase mb-2">Dados do falecido (nome já cadastrado acima)</p>
                  <label className={LABEL_CLS}>CPF do Falecido *</label>
                  <input value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} className={INPUT_CLS} />
                </div>
              )}

              {(partyNature === "PF" || partyNature === "PF_PROCURACAO" || partyNature === "INCAPAZ_RELATIVO" || partyNature === "INCAPAZ_ABSOLUTO") && (
                <div className="pt-2 border-t border-[#9BAFC5]/10 space-y-3">
                  <div>
                    <label className={LABEL_CLS}>CPF *</label>
                    <input value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} className={INPUT_CLS} />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Carteira de Identidade (RG, se houver)</label>
                    <input value={rg} onChange={(e) => setRg(e.target.value)} className={INPUT_CLS} />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Nacionalidade *</label>
                    <input value={nationality} onChange={(e) => setNationality(e.target.value)} className={INPUT_CLS} />
                  </div>

                  {partyNature !== "INCAPAZ_ABSOLUTO" && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div><label className={LABEL_CLS}>Estado Civil *</label><input value={maritalStatus} onChange={(e) => setMaritalStatus(e.target.value)} className={INPUT_CLS} /></div>
                        <div><label className={LABEL_CLS}>Profissão *</label><input value={profession} onChange={(e) => setProfession(e.target.value)} className={INPUT_CLS} /></div>
                      </div>
                      <div>
                        <label className={LABEL_CLS}>Telefone com DDD *</label>
                        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" className={INPUT_CLS} />
                      </div>
                      <EnderecoFields prefixLabel="Endereço Residencial" rua={enderecoRua} numero={enderecoNumero} complemento={enderecoComplemento} bairro={enderecoBairro} cidade={enderecoCidade} estado={enderecoEstado} cep={enderecoCep}
                        onChange={(f, v) => {
                          const setters: Record<string, (v: string) => void> = { rua: setEnderecoRua, numero: setEnderecoNumero, complemento: setEnderecoComplemento, bairro: setEnderecoBairro, cidade: setEnderecoCidade, estado: setEnderecoEstado, cep: setEnderecoCep };
                          setters[f](v);
                        }} />
                    </>
                  )}

                  <div>
                    <label className={LABEL_CLS}>Data de Nascimento *</label>
                    <input value={birthDate} onChange={(e) => setBirthDate(e.target.value)} type="date" className={INPUT_CLS} />
                  </div>

                  {["PF", "PF_PROCURACAO", "INCAPAZ_RELATIVO"].includes(partyNature) && (
                    <KycDocSlot token={token} kind="identificacao_foto" documentNumber={cpfCnpj} value={idDocSlot} onChange={setIdDocSlot} />
                  )}
                </div>
              )}

              {representativeTypesRequired && (
                <div className="pt-3 border-t border-[#9BAFC5]/10">
                  <p className="text-[10px] text-[#C9A84C] font-bold uppercase mb-2">Representante Legal</p>
                  <RepresentativeForm token={token} allowedTypes={representativeTypesRequired} depth={0} value={representation} onChange={setRepresentation} />
                </div>
              )}

              {recebeRepasse && (
                <div className="pt-2 border-t border-[#9BAFC5]/10">
                  <p className="text-[10px] text-[#C9A84C] font-bold uppercase mb-2">Dados para repasse (ao menos um)</p>
                  <label className={LABEL_CLS}>Chave PIX</label>
                  <input value={pixKey} onChange={(e) => setPixKey(e.target.value)} className={`${INPUT_CLS} mb-3`} />
                  <div className="grid grid-cols-2 gap-2">
                    <input value={banco} onChange={(e) => setBanco(e.target.value)} placeholder="Banco" className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-sm text-[#F5F1E8]" />
                    <select value={tipoConta} onChange={(e) => setTipoConta(e.target.value)} className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-sm text-[#F5F1E8]">
                      <option value="corrente">Conta Corrente</option>
                      <option value="poupanca">Poupança</option>
                    </select>
                    <input value={agencia} onChange={(e) => setAgencia(e.target.value)} placeholder="Agência" className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-sm text-[#F5F1E8]" />
                    <input value={conta} onChange={(e) => setConta(e.target.value)} placeholder="Conta" className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-sm text-[#F5F1E8]" />
                  </div>
                </div>
              )}
            </div>

            {formError && <p className="text-[11px] text-red-400">{formError}</p>}

            <button onClick={submit} disabled={submitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#C9A84C] text-[#09081A] rounded-lg text-sm font-bold hover:bg-[#E8C97A] transition disabled:opacity-50">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : null} Enviar Qualificação
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
