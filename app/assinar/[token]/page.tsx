import { createClient } from "@supabase/supabase-js";
import { AssinarClient } from "./assinar-client";

interface ContratoData {
  id: string;
  status: string;
  client_name: string;
  client_cpf: string | null;
  client_email: string;
  commission_perc: number;
  deal_value: number | null;
  credit_line: string | null;
  proposal_code: string | null;
  expires_at: string;
  signed_at: string | null;
}

async function getContrato(token: string): Promise<{ contrato?: ContratoData; error?: string }> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("contratos_mandato")
    .select("id, status, client_name, client_cpf, client_email, commission_perc, deal_value, credit_line, proposal_code, expires_at, signed_at")
    .eq("token", token)
    .single();

  if (error || !data) return { error: "Contrato não encontrado." };

  if (data.status === "PENDENTE" && new Date(data.expires_at) < new Date()) {
    await supabase.from("contratos_mandato").update({ status: "EXPIRADO" }).eq("token", token);
    return { error: "Este link de assinatura expirou. Entre em contato com a V3 Partners." };
  }

  return { contrato: data as ContratoData };
}

export default async function AssinarPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { contrato, error } = await getContrato(token);

  if (error || !contrato) {
    return (
      <div className="min-h-screen bg-[#09081A] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto">
            <span className="text-3xl">⚠️</span>
          </div>
          <h1 className="text-xl font-bold text-white">Link Inválido</h1>
          <p className="text-[#7A8FA8] text-sm">{error ?? "Este link de assinatura não é válido."}</p>
          <p className="text-[#7A8FA8] text-xs">
            Entre em contato com a equipe V3 Partners pelo e-mail{" "}
            <a href="mailto:contato@v3partners.com.br" className="text-[#C9A84C] hover:underline">
              contato@v3partners.com.br
            </a>
          </p>
        </div>
      </div>
    );
  }

  return <AssinarClient token={token} contrato={contrato} />;
}
