export const metadata = {
  title: "Termos de Uso — V3 Partners",
  description: "Termos de Uso da plataforma V3 Partners.",
};

export default function TermosUsoPage() {
  return (
    <div className="min-h-screen bg-[#09081A] text-[#F0ECE4] py-16 px-6">
      <div className="max-w-3xl mx-auto">
        <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-[2px]">V3 Partners</p>
        <h1 className="text-3xl font-bold mt-2 mb-1">Termos de Uso</h1>
        <p className="text-[#7A8FA8] text-sm mb-2">Última atualização: 4 de setembro de 2026</p>
        <p className="text-[#7A8FA8] text-xs mb-10">
          Versão inicial deste documento, sujeita a revisão jurídica antes de ser considerada definitiva.
        </p>

        <div className="space-y-8 text-sm leading-relaxed text-[#C8D4E3]">
          <section>
            <h2 className="text-lg font-semibold text-[#F0ECE4] mb-2">1. Aceitação dos termos</h2>
            <p>
              Ao acessar ou utilizar qualquer site, formulário ou simulador público operado pela V3
              Partners Soluções Ltda (CNPJ 14.219.287/0001-50), você concorda com estes Termos de Uso.
              Se não concordar, não utilize o serviço.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#F0ECE4] mb-2">2. Natureza do serviço</h2>
            <p>
              Os simuladores e formulários públicos da V3 Partners (incluindo o Simulador Home Equity)
              têm caráter <strong className="text-[#F0ECE4]">exclusivamente ilustrativo</strong>. Os
              valores de taxa, parcela, prazo e limite de crédito apresentados são estimativas, não
              constituem proposta de crédito nem garantem aprovação, e estão sujeitos a análise de
              crédito, avaliação do imóvel e condições vigentes no momento da contratação.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#F0ECE4] mb-2">3. Dados fornecidos</h2>
            <p>
              Os dados preenchidos em formulários e simuladores são tratados conforme a nossa{" "}
              <a href="/politica-privacidade" className="text-[#C9A84C] underline">Política de Privacidade</a>.
              Ao enviar um formulário, você declara que as informações fornecidas são verdadeiras e de
              sua titularidade (ou que possui autorização para informá-las).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#F0ECE4] mb-2">4. Propriedade intelectual</h2>
            <p>
              O conteúdo, marca, layout e ferramentas de cálculo disponibilizados pela V3 Partners são
              protegidos por direitos autorais e de propriedade intelectual. É vedada a reprodução,
              cópia ou engenharia reversa dos materiais para fins comerciais sem autorização expressa.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#F0ECE4] mb-2">5. Isenção de responsabilidade</h2>
            <p>
              A V3 Partners envida esforços para manter as informações e simulações precisas e
              atualizadas, mas não garante a ausência de erros técnicos ou desatualização pontual dos
              parâmetros exibidos. O uso das simulações é por conta e risco do usuário, sem prejuízo do
              direito de solicitar esclarecimentos ao nosso time.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#F0ECE4] mb-2">6. Modificações</h2>
            <p>
              Estes Termos de Uso podem ser atualizados a qualquer momento, sem aviso prévio. A versão
              vigente estará sempre disponível nesta página.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#F0ECE4] mb-2">7. Lei aplicável</h2>
            <p>
              Estes termos são regidos pelas leis da República Federativa do Brasil, com foro eleito
              na comarca do Rio de Janeiro/RJ para dirimir eventuais controvérsias.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#F0ECE4] mb-2">8. Contato</h2>
            <p>
              Dúvidas sobre estes Termos de Uso podem ser enviadas para{" "}
              <a href="mailto:deal@v3partners.com.br" className="text-[#C9A84C] underline">
                deal@v3partners.com.br
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
