import { createClient } from "@supabase/supabase-js";
import { V3AssinarClient } from "./v3-assinar-client";

async function getContrato(token: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data, error } = await supabase
    .from("contratos_mandato")
    .select("id, status, client_name, client_cpf, client_email, commission_perc, deal_value, credit_line, proposal_code, signed_at, v3_signed_at, testemunha_nome, testemunha_signed_at, testemunha2_nome, testemunha2_signed_at, endereco, bairro, municipio, estado, cep, telefone")
    .eq("v3_token", token)
    .single();

  if (error || !data) return { error: "Contrato não encontrado." };
  return { contrato: data };
}

export default async function V3AssinarPage({ params }: { params: Promise<{ token: string }> }) {
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
          <p className="text-[#7A8FA8] text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return <V3AssinarClient token={token} contrato={contrato} />;
}
