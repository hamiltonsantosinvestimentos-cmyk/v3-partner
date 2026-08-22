export const metadata = {
  title: "Política de Privacidade — V3 Partners",
  description: "Política de Privacidade da plataforma V3 Partners.",
};

export default function PoliticaPrivacidadePage() {
  return (
    <div className="min-h-screen bg-[#09081A] text-[#F0ECE4] py-16 px-6">
      <div className="max-w-3xl mx-auto">
        <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-[2px]">V3 Partners</p>
        <h1 className="text-3xl font-bold mt-2 mb-1">Política de Privacidade</h1>
        <p className="text-[#7A8FA8] text-sm mb-10">Última atualização: 21 de agosto de 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-[#C8D4E3]">
          <section>
            <h2 className="text-lg font-semibold text-[#F0ECE4] mb-2">1. Quem somos</h2>
            <p>
              A V3 Partners Soluções Ltda (CNPJ 14.219.287/0001-50), com sede na Rua Visconde de
              Pirajá, 414/Sala 718, Ipanema, Rio de Janeiro/RJ, opera a plataforma V3 Partners
              (app.v3partners.com.br), voltada à gestão de parceiros, operações financeiras e
              atendimento a clientes e prospects.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#F0ECE4] mb-2">2. Dados que coletamos</h2>
            <p className="mb-2">Coletamos e tratamos, entre outros, os seguintes dados:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Dados de cadastro de parceiros e usuários da plataforma (nome, e-mail, telefone, documentos).</li>
              <li>
                Dados de contato e conversas trocadas pelo WhatsApp e pelo Instagram Direct com nosso
                atendimento (SDR), incluindo mensagens diretas e comentários públicos em publicações
                que mencionem palavras-chave configuradas para resposta automática.
              </li>
              <li>Identificador de perfil (ID e nome de usuário) fornecido pela Meta/Instagram ao interagir com nossa conta comercial.</li>
              <li>Dados operacionais e financeiros de parceiros e operações intermediadas pela plataforma.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#F0ECE4] mb-2">3. Como usamos esses dados</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Responder mensagens e comentários no Instagram e WhatsApp, incluindo respostas automatizadas por IA e por nossa equipe.</li>
              <li>Gerenciar o relacionamento com parceiros e clientes e as operações financeiras intermediadas.</li>
              <li>Cumprir obrigações legais e regulatórias aplicáveis ao setor financeiro.</li>
              <li>Melhorar nossos produtos, serviços e a qualidade do atendimento.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#F0ECE4] mb-2">4. Compartilhamento</h2>
            <p>
              Não vendemos dados pessoais. Compartilhamos dados apenas com prestadores de serviço
              essenciais à operação da plataforma (ex.: infraestrutura de nuvem, provedores de
              mensageria, meios de pagamento) e quando exigido por lei ou ordem judicial.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#F0ECE4] mb-2">5. Retenção e segurança</h2>
            <p>
              Mantemos os dados pelo tempo necessário às finalidades descritas nesta política ou
              conforme exigido por lei, com medidas técnicas e administrativas de segurança
              (controle de acesso, criptografia em trânsito e em repouso).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#F0ECE4] mb-2">6. Seus direitos (LGPD)</h2>
            <p>
              Você pode solicitar a qualquer momento a confirmação, o acesso, a correção, a
              anonimização, a portabilidade ou a exclusão dos seus dados pessoais, além de revogar
              consentimentos, entrando em contato pelo e-mail{" "}
              <a href="mailto:deal@v3partners.com.br" className="text-[#C9A84C] underline">
                deal@v3partners.com.br
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#F0ECE4] mb-2">7. Contato</h2>
            <p>
              Dúvidas sobre esta Política de Privacidade podem ser enviadas para{" "}
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
