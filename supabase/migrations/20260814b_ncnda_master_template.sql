-- ============================================================
-- MIGRATION: NCNDA Mestre (Confidencialidade, Nao Circunvencao e
-- Vinculo pela Introducao) -- minuta cross-desk, texto real fornecido
-- por Joao em 14/08/2026, nao adaptado, so convertido pra HTML e com o
-- bloco do Head parametrizado por variavel (ver nota abaixo).
--
-- Contexto: Hamilton reportou nao conseguir enviar NDA/link de
-- qualificacao pela Mesa de Credito (N1/N2/N3) nem achar o botao na
-- Central de Contratos. Causa raiz real (nao suposicao): contract_templates
-- nunca teve NENHUMA linha com vertical='credito', e /api/contracts/generate
-- ja aceitava credit_proposal_id no payload mas nunca resolvia variavel
-- nenhuma a partir dele (bloco morto desde que o campo foi criado). Este
-- template destrava a geracao; a rota que o consome ganhou o bloco
-- credit_proposal_id na mesma sessao (ver app/api/contracts/generate/route.ts).
--
-- Desenho: o texto e desk-agnostico por design (variavel deal_origin_desk +
-- objeto_operacao_detalhado condicional, documentado no proprio texto
-- fornecido). Por isso UMA linha serve para varias mesas -- a resolucao de
-- qual objeto/desk entra e feita no SERVIDOR (generate/route.ts), nao por
-- condicional dentro do template (resolveContractVariables so faz
-- substituicao direta de {{chave}}, sem if/else). vertical='credito' foi
-- escolhido porque e o gatilho real desta sessao; nada impede reutilizar a
-- mesma linha para outra vertical futuramente, bastaria o generate() dessa
-- vertical resolver as mesmas chaves.
--
-- Bloco do Head: no texto original fornecido, o "HEAD DE COMPLIANCE" vem
-- fixo como Dr. Luis Athaydes. Corrigido a pedido explicito de Joao na
-- mesma sessao ("o Head sempre ira variar de onde for enviado para
-- assinatura"): virou {{head_role_label}}/{{head_full_name}}/
-- {{head_qualificacao}}/{{head_cpf}}/{{head_email}}, resolvidos por
-- lib/ncnda-desk-head.ts a partir do desk de origem. {{signatures_block}}
-- do texto original foi removido do corpo: wrapContractInV3Html ja anexa
-- um bloco de assinatura (linha/nome/CPF) por parte automaticamente
-- (lib/contract-render.ts), redundante com o que o texto original pedia.
--
-- Rollback:
--   DELETE FROM contract_templates WHERE template_name = 'NCNDA Mestre — Confidencialidade, Não Circunvenção e Vínculo pela Introdução';
-- ============================================================

insert into contract_templates (template_name, vertical, contract_series, body_text_raw, is_active, approval_status, created_by)
values (
  'NCNDA Mestre — Confidencialidade, Não Circunvenção e Vínculo pela Introdução',
  'credito',
  'V3C-NDA',
  $html$<p style="text-align:center;font-size:11px;color:#9BAFC5">PROTOCOLADO SOB O DEAL Nº: <strong>{{deal_id}}</strong> &middot; MESA DE ORIGEM: <strong>{{deal_origin_desk}}</strong></p>

<h2>DAS PARTES SIGNATÁRIAS</h2>
<p><strong>ESTRUTURADORA E CÂMARA NEUTRA:</strong></p>
<p>V3 PARTNERS SOLUÇÕES LTDA., pessoa jurídica de direito privado, inscrita no CNPJ/MF sob o n.º 14.219.287/0001-50, com sede na Rua Visconde de Pirajá, n.º 414, Sala 718, Ipanema, Rio de Janeiro/RJ, CEP: 22.410-002, neste ato devidamente representada na forma de seu contrato social por seu sócio-administrador, JOÃO LEMOS NETTO, brasileiro, empresário, inscrito no CPF sob o n.º 078.678.257-97, e-mail: joao.lemos@v3partners.com.br;</p>
<p><strong>{{head_role_label}}:</strong></p>
<p>{{head_full_name}}, {{head_qualificacao}}, inscrito(a) no CPF/MF sob o n.º {{head_cpf}}, e-mail: {{head_email}};</p>
<p><strong>PARTES ADERENTES, INTERMEDIÁRIOS E MANDATÁRIOS QUALIFICADOS:</strong></p>
<p>{{party_qualifications_block}}</p>
<p><strong>ADESÕES FUTURAS:</strong> Este instrumento possui natureza de "Acordo Mestre" (Master Agreement), permitindo a adesão de novos parceiros, consultores ou investidores mediante a assinatura de Termo de Adesão específico vinculado ao DEAL Nº {{deal_id}}, que passará a integrar este contrato para todos os fins de direito.</p>
<p>As Partes, individualmente denominadas "PARTE" e, em conjunto, "PARTES", têm entre si, justo e contratado o presente Instrumento, que se regerá pelas cláusulas e condições seguintes:</p>

<h2>DOS CONSIDERANDOS</h2>
<p>CONSIDERANDO que as PARTES pretendem estabelecer uma relação de cooperação técnica e operacional para o intercâmbio de oportunidades de negócios, estruturação e liquidação de ativos, especificamente no âmbito de: {{considerando_escopo_mesa}};</p>
<p>CONSIDERANDO que, para a viabilização de tais negócios, haverá a necessidade de revelação de informações estratégicas, segredos de negócio e a introdução de leads (clientes potenciais) e parceiros comerciais;</p>
<p>CONSIDERANDO a necessidade de proteger a origem das informações e garantir que a introdução de uma oportunidade por uma PARTE à outra seja devidamente respeitada, evitando a exclusão indevida do introdutor na cadeia de remuneração;</p>
<p>CONSIDERANDO que as introduções de clientes, oportunidades e ativos, bem como as trocas de informações confidenciais, serão registradas por meios eletrônicos, especialmente e-mail e logs de sistemas da V3 PARTNERS, e integrarão o presente contrato para todos os fins de direito.</p>

<h2>CLÁUSULA PRIMEIRA, DO OBJETO</h2>
<p>1.1 O presente instrumento tem por objeto estabelecer o marco regulatório e as condições de segurança jurídica para o intercâmbio de Informações Confidenciais e a Introdução de Clientes/Oportunidades entre as PARTES, voltado especificamente para: {{objeto_operacao_detalhado}}</p>
<p>1.2 Este contrato atua como um "acordo guarda-chuva", aplicando-se a todas as interações, reuniões, trocas de e-mails, mensagens ou documentos realizados entre as PARTES a partir da data de sua assinatura, independentemente de cada transação específica vir a ser formalizada em contrato próprio de compra e venda, cessão ou prestação de serviços.</p>

<h2>CLÁUSULA SEGUNDA, DAS DEFINIÇÕES</h2>
<p>2.1 Para fins deste instrumento, aplicam-se as seguintes definições:</p>
<p>a) <strong>Informações Confidenciais:</strong> Quaisquer informações, dados, documentos, estratégias, listas de parceiros/clientes/oportunidades, termos de negócios, condições comerciais, dados financeiros, técnicos, operacionais, mercadológicos, planos de negócios, know-how, segredos comerciais, ou quaisquer outros dados, verbais, escritos ou por meio digital, revelados por uma Parte à outra, direta ou indiretamente, em qualquer formato, que sejam identificados como confidenciais ou que, pela sua natureza, devam ser considerados como tal.</p>
<p>b) <strong>Cliente Introduzido:</strong> Pessoa física ou jurídica, pública ou privada, cuja identidade e necessidade de negócio foram reveladas por uma PARTE à outra, seja diretamente ou através de seus representantes, para fins de prospecção ou fechamento de negócio.</p>
<p>c) <strong>Oportunidade:</strong> Qualquer cenário de negócio envolvendo ativos, serviços especializados, créditos tributários, precatórios, direitos creditórios, M&amp;A ou captação de dívida apresentado no âmbito deste acordo.</p>
<p>d) <strong>Não Circunvenção:</strong> A obrigação irrestrita de não contatar, contratar ou realizar negócios diretamente com o Cliente Introduzido, ou utilizar-se de terceiros para tal fim, visando excluir a PARTE que realizou a introdução original ou a V3 PARTNERS.</p>
<p>e) <strong>Negócio Decorrente:</strong> Qualquer transação, contrato, acordo ou operação comercial, financeira ou de serviços que seja celebrado entre uma Parte e um Cliente Introduzido pela outra Parte, ou entre Clientes Introduzidos, ou entre terceiros e Clientes Introduzidos, que tenha sido originado, facilitado ou influenciado pela Introdução.</p>
<p>f) <strong>Introdução:</strong> A apresentação documental e/ou formal de um Cliente Introduzido ou de uma Oportunidade por uma Parte à outra, conforme o Protocolo de Registro estabelecido na Cláusula Quinta.</p>
<p>g) <strong>Meios Eletrônicos:</strong> E-mail, plataformas de comunicação digital, logs de salas de dados (Data Room) ou outros sistemas eletrônicos que permitam o registro e a comprovação da comunicação entre as Partes.</p>

<h2>CLÁUSULA TERCEIRA, DA CONFIDENCIALIDADE</h2>
<p>3.1 As Partes comprometem-se a manter em sigilo absoluto todas as Informações Confidenciais recebidas uma da outra, utilizando-as exclusivamente para os fins de análise, viabilização e execução das Oportunidades objeto deste instrumento.</p>
<p>3.2 As Partes obrigam-se a não divulgar, reproduzir, copiar, ceder, transferir, comercializar ou de qualquer forma disponibilizar as Informações Confidenciais a terceiros, exceto se houver prévia e expressa autorização por escrito da Parte reveladora.</p>
<p>3.3 Cada Parte deverá empregar as mesmas medidas de segurança e cautela que utiliza para proteger suas próprias informações confidenciais de natureza similar, a fim de evitar o acesso não autorizado, a divulgação indevida ou o uso impróprio das Informações Confidenciais da outra Parte.</p>
<p>3.4 As Partes se obrigam a vincular seus empregados, prepostos, consultores, assessores e quaisquer outros colaboradores que venham a ter acesso às Informações Confidenciais às mesmas obrigações de sigilo e confidencialidade, não circunvenção e introdução estabelecidas neste Instrumento.</p>
<p>3.5 As PARTES se obrigam a colher a assinatura de Termos de Confidencialidade e Não Circunvenção individuais e equivalentes ao presente instrumento de seus respectivos prepostos e colaboradores sempre que solicitado pela outra PARTE ou pela V3 PARTNERS, sob pena de caracterização de descumprimento contratual grave e aplicação imediata das penalidades previstas na Cláusula Nona.</p>
<p>3.6 <strong>Responsabilidade Solidária:</strong> Cada PARTE responde solidariamente por quaisquer violações cometidas por seus respectivos vinculados mencionados no item anterior, independentemente da existência de vínculo empregatício direto ou da natureza da relação jurídica estabelecida com o preposto.</p>
<p>3.7 As obrigações de confidencialidade não se aplicarão a informações que:</p>
<p>a) Já eram de conhecimento da Parte receptora antes da revelação pela Parte reveladora, comprovado por registros escritos, inequívocos e irrefutáveis que deverão ser enviados em anexo à resposta da comunicação com a parte reveladora em até 2 (dois) dias corridos, contados do momento em que se recebeu a comunicação inicial, após esse prazo a Parte receptora estará vinculada às obrigações de confidencialidade, não circunvenção e introdução;</p>
<p>b) Sejam exigidas por lei, ordem judicial ou administrativa, caso em que a Parte receptora deverá notificar a Parte reveladora e a V3 PARTNERS, sempre que legalmente permitido, antes da divulgação.</p>

<h2>CLÁUSULA QUARTA, DO VÍNCULO PELA INTRODUÇÃO E DA NÃO CIRCUNVENÇÃO</h2>
<p>4.1 As Partes reconhecem e aceitam que a Introdução formal de um Cliente Introduzido ou de uma Oportunidade por uma Parte à outra, conforme o Protocolo de Registro da Cláusula Quinta, estabelece um vínculo de origem e exclusividade em favor da Parte introdutora e da V3 PARTNERS como interveniente estruturadora.</p>
<p>4.2 Em virtude do vínculo estabelecido, as Partes comprometem-se, de forma mútua e recíproca, a não contornar (circunventar) a outra Parte. É expressamente vedado à PARTE RECEPTORA, incluindo seus sócios, diretores, empregados, prepostos, representantes, empresas coligadas, controladas ou terceiros a elas vinculados, realizar, sem anuência prévia e por escrito da Parte Introdutora e da V3 PARTNERS:</p>
<p>a) Qualquer contato direto, abordagem comercial, negociação ou contratação direta com o Cliente Introduzido ou acerca da Oportunidade revelada;</p>
<p>b) Tentar ou efetivar Negócio Decorrente da Introdução sem a participação da Parte Introdutora e da V3 PARTNERS, ou sem a formalização de instrumento específico (FPA / Contrato de Fechamento) que garanta sua devida participação e remuneração.</p>
<p>4.3 A proibição de circunvenção e a proteção da Introdução abrangem negócios imediatos e futuros, ainda que estruturados de forma distinta da proposta original, estendendo-se a qualquer tentativa de exclusão da Parte Introdutora por interposta pessoa, estrutura offshore ou manobra societária.</p>

<h2>CLÁUSULA QUINTA, DO PROTOCOLO DE REGISTRO E INTERCÂMBIO DE INFORMAÇÕES</h2>
<p>5.1 As Introduções de Clientes Introduzidos e Oportunidades, bem como a troca de Informações Confidenciais, serão formalizadas por Meios Eletrônicos, preferencialmente e-mail e trilhas de auditoria da plataforma V3 PARTNERS, direcionados aos endereços eletrônicos oficiais das Partes: {{official_emails_protocol}}</p>
<p>5.2 Para que uma Introdução seja considerada válida e gere o vínculo previsto neste Instrumento, a comunicação de Introdução deverá conter, no mínimo:</p>
<p>a) Identificação clara da Parte Introdutora e da Parte Receptora;</p>
<p>b) Objeto da Introdução (conforme natureza da Mesa de Negócios);</p>
<p>c) Identificação completa do Cliente Introduzido (nome/razão social, CNPJ/CPF) e/ou descrição detalhada da Oportunidade/Ativo;</p>
<p>d) Anexos relevantes, se houver, contendo arquivos e Informações Confidenciais iniciais.</p>
<p>5.3 A Parte receptora deverá confirmar o recebimento do e-mail/notificação de Introdução em até 2 (dois) dias úteis. A ausência de manifestação no prazo implicará na aceitação tácita da Introdução e do vínculo.</p>
<p>5.4 A Parte que introduzir clientes/negócios que se enquadrarem no dispositivo na letra "a)" da Subcláusula 3.7 (clientes que já faziam parte previamente da carteira da parte receptora), a Parte receptora deverá, impreterivelmente no prazo indicado de 2 (dois) dias corridos, formalizar a "contestação da introdução" acompanhada de prova documental prévia irrefutável, sob pena de decadência.</p>
<p>5.5 Todas as comunicações e trocas de informações realizadas por meios eletrônicos, registros em logs de data room ou por meio de chamadas telefônicas, conforme este protocolo, serão consideradas partes integrantes e indissociáveis do presente Instrumento para todos os fins de direito.</p>

<h2>CLÁUSULA SEXTA, DA EXCLUSÃO DE TERCEIROS E AUTONOMIA</h2>
<p>6.1 O presente instrumento não vincula compulsoriamente os clientes finais (detentores originários de ativos ou compradores finais), os quais não são necessariamente signatários desta peça preliminar. Este acordo regula estritamente a relação de ética, sigilo e proteção entre os profissionais e empresas aqui signatários.</p>
<p>6.2 As PARTES reconhecem que a concretização de transações específicas dependerá de contratos próprios, acordos de divisão de honorários (FPA) e auditorias técnicas (due diligence), não gerando este instrumento obrigação de fechamento de negócio, mas sim de proteção integral da jornada de introdução.</p>

<h2>CLÁUSULA SÉTIMA, DO EFEITO ADESIVO E RESPONSABILIDADE DE PREPOSTOS</h2>
<p>7.1 As obrigações de sigilo, confidencialidade e não circunvenção previstas neste instrumento aplicam-se integralmente aos sócios, diretores, empregados, prepostos, consultores e colaboradores externos de cada PARTE, que doravante passam a ser denominados "Aderentes Indiretos".</p>

<h2>CLÁUSULA OITAVA, DA INDEPENDÊNCIA DAS PARTES E PROPRIEDADE INTELECTUAL</h2>
<p>8.1 O presente Instrumento não cria qualquer vínculo empregatício, societário, de representação comercial, consórcio, joint venture ou qualquer outra forma de associação entre as Partes, que não seja a expressamente prevista neste contrato. Cada Parte atuará de forma independente e autônoma, sendo responsável por suas próprias obrigações fiscais, trabalhistas, previdenciárias e civis.</p>
<p>8.2 Nenhuma das Partes adquire, por força deste Instrumento, qualquer direito de propriedade intelectual sobre as Informações Confidenciais, metodologias ou sistemas da outra Parte ou da V3 PARTNERS.</p>

<h2>CLÁUSULA NONA, DAS PENALIDADES</h2>
<p>9.1 A violação das obrigações de sigilo e confidencialidade ou a tentativa de circunvenção (contato direto não autorizado ou formulação de propostas paralelas, ainda que não formalizadas por escrito, realizadas pela parte ou por terceiro comprovadamente ligado ao infrator) sujeitará a PARTE infratora ao pagamento de multa pecuniária imediata no valor de R$ 200.000,00 (duzentos mil reais), tantas vezes quantas forem as violações, sem prejuízo da apuração de perdas e danos suplementares.</p>
<p>9.2 Em caso de descumprimento pleno da cláusula de Não Circunvenção (exclusão do introdutor ou da V3 PARTNERS da operação final), a PARTE infratora deverá pagar à PARTE prejudicada e à V3 PARTNERS o valor equivalente a 20% (vinte por cento) sobre o valor bruto da transação realizada, a título de cláusula penal compensatória.</p>
<p>9.3 O pagamento das multas previstas nesta cláusula não exime a PARTE infratora de outras sanções cíveis e criminais cabíveis, nem da interrupção imediata da conduta violadora mediante tutela provisória de urgência.</p>

<h2>CLÁUSULA DÉCIMA, DA VIGÊNCIA E RESCISÃO</h2>
<p>10.1 O presente Instrumento entra em vigor na data de sua assinatura eletrônica e vigerá por prazo indeterminado.</p>
<p>10.2 Qualquer das Partes poderá rescindir o presente Instrumento, a qualquer tempo e sem necessidade de justificativa, mediante notificação escrita com antecedência mínima de 30 (trinta) dias.</p>
<p>10.3 Não obstante a rescisão do presente Instrumento, as obrigações de Confidencialidade (Cláusula Terceira), Não Circunvenção e Vínculo pela Introdução (Cláusula Quarta), permanecerão em pleno vigor e efeito por um período de 60 (sessenta) meses contados do término da relação comercial entre as PARTES ou da última informação trocada.</p>

<h2>CLÁUSULA DÉCIMA PRIMEIRA, DA LEI APLICÁVEL E DO FORO</h2>
<p>11.1 O presente Instrumento será regido e interpretado de acordo com as leis da República Federativa do Brasil.</p>
<p>11.2 As Partes elegem o Foro da Comarca da Capital do Estado do Rio de Janeiro/RJ, para dirimir quaisquer dúvidas ou litígios decorrentes deste Instrumento, renunciando expressamente a qualquer outro, por mais privilegiado que seja.</p>

<h2>CLÁUSULA DÉCIMA SEGUNDA, DO FORMATO ELETRÔNICO, VALIDADE E ASSINATURAS</h2>
<p>12.1 O presente Acordo é lavrado exclusivamente em formato eletrônico, sendo as vias digitais consideradas originais para todos os fins de direito. A integridade e a autenticidade do documento são garantidas pela tecnologia de criptografia e certificação utilizada no momento das assinaturas (Medida Provisória nº 2.200-2/2001 e Lei nº 14.063/2020).</p>
<p>12.2 Em conformidade com o Artigo 784, § 4º, do Código de Processo Civil, as Partes declaram que a assinatura de testemunhas é integralmente dispensada, uma vez que a validade e a exequibilidade deste título executivo extrajudicial são asseguradas pela natureza eletrônica das assinaturas e pela trilha de auditoria digital (audit trail).</p>

<p style="text-align:center;margin-top:32px">Rio de Janeiro/RJ, {{current_contract_date}}.</p>$html$,
  true,
  'aprovado',
  (select id from profiles where role='ADMIN' limit 1)
);
-- Sem ON CONFLICT: contract_templates.template_name não tem unique
-- constraint (confirmado antes de escrever esta migration). Aplicar só
-- uma vez -- rodar de novo duplica a linha.
