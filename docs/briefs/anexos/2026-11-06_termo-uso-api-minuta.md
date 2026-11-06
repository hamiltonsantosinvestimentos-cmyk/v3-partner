# Termo de Uso da API de Propostas V3, versão 2.1

> Texto entregue pelo Hamilton no chat em 06/11/2026. Substitui a minuta 1.0 redigida por Claude.
> Lacunas preenchidas pelo Hamilton em 06/11/2026: vigência de 12 meses, sede conforme o cartão CNPJ (consultado na base pública da Receita em 06/11/2026), multa de R$ 200.000,00 e foro do Rio de Janeiro/RJ.
> Situação do parecer do Robson: ver a seção PARECER DE COMPLIANCE do BRIEF `docs/briefs/2026-11-06_api-partner-propostas-credito.md`.

---

TERMO DE USO DA API DE PROPOSTAS DE CRÉDITO DA V3 PARTNERS
Versão 2.1. Vigência de 12 (doze) meses, contados da data de publicação na plataforma.

V3 PARTNERS SOLUÇÕES LTDA., inscrita no CNPJ sob nº 14.219.287/0001-50, com sede na Rua Visconde de Pirajá, nº 414, sala 718, Ipanema, Rio de Janeiro/RJ, CEP 22410-905, doravante "V3", e a pessoa jurídica ou o empresário identificado e validado no cadastro da plataforma, doravante "PARTNER", em conjunto "Partes", estabelecem as condições abaixo para utilização da API de Propostas de Crédito ("API").

## 1. Objeto, abrangência e hierarquia

1.1. A API é uma interface tecnológica disponibilizada pela V3. Por meio dela, o Partner que tiver credenciais válidas integra seus sistemas à plataforma da V3 para cadastrar propostas de crédito, transmitir dados e documentos, consultar o andamento e receber respostas técnicas ou operacionais sobre as propostas.

1.2. A API será utilizada exclusivamente para as finalidades, operações, campos, formatos, limites e fluxos documentados pela V3 e autorizados na parceria comercial vigente entre as Partes.

1.3. Este Termo complementa o contrato de parceria, seus anexos e as políticas da plataforma.
- Prevalece o contrato de parceria quanto às condições comerciais, às comissões e à relação principal.
- Prevalece este Termo quanto às regras de credenciais, integração, segurança, proteção de dados no uso da API e sanções pelo uso indevido.
- A regra acima vale salvo disposição expressa em contrário no contrato de parceria.

1.4. A disponibilização da API não constitui mandato, representação, sociedade, vínculo trabalhista, franquia, exclusividade nem correspondência bancária. Também não autoriza o Partner a assumir obrigações em nome da V3 ou de instituições financeiras e parceiras.

1.5. A V3 poderá atualizar a documentação técnica, os endpoints, os campos, os mecanismos de autenticação, os limites e os requisitos de segurança, observadas as regras de comunicação deste Termo.

## 2. Cadastro, representação e responsabilidade do Partner

2.1. O Partner declara que:
- está regularmente constituído ou legitimamente habilitado a exercer suas atividades;
- os dados cadastrais fornecidos são completos, verdadeiros e atualizados;
- o aceite deste Termo é feito por representante com poderes suficientes.

2.2. O Partner manterá atualizados seus dados cadastrais e seus contatos técnicos, de segurança e jurídicos. Também informará alterações societárias, operacionais ou de representação que possam afetar o uso da API.

2.3. O Partner responde pelos atos de quem tiver acesso aos seus sistemas ou ambientes por concessão dele, sem prejuízo da apuração da responsabilidade de cada agente nos termos da lei. Isso inclui seus sócios, administradores, empregados, prepostos, consultores e fornecedores.

2.4. O Partner não poderá sublicenciar, revender, ceder, compartilhar nem disponibilizar a API ou suas credenciais a terceiros, salvo autorização prévia e escrita da V3.

## 3. Credenciais, chaves e autenticação

3.1. Cada chave de API:
- é vinculada ao Partner e ao ambiente para o qual foi emitida;
- é confidencial e intransferível;
- é exibida uma única vez, no momento da criação. Cabe ao Partner armazená-la imediatamente em cofre de segredos ou mecanismo equivalente.

3.2. O Partner deverá:
- (a) armazenar a chave exclusivamente em ambiente de servidor protegido, com acesso mínimo e controlado;
- (b) não inserir a chave em aplicações de navegador, dispositivos de usuários finais, aplicativos móveis, planilhas, mensagens, e-mails, repositórios de código ou ferramentas públicas;
- (c) não registrar a chave em logs, mensagens de erro ou sistemas de monitoramento sem mascaramento;
- (d) substituir a chave antes do vencimento e sempre que solicitado pela V3;
- (e) manter controles de autenticação, segregação de ambientes e gestão de acessos.

3.3. Toda chave terá de 1 (um) a 10 (dez) endereços IP ou faixas de IP autorizados, cadastrados pelo Partner, e validade de 12 (doze) meses.
- Chamadas de endereço não autorizado serão recusadas e registradas.
- A chave vencida deixa de funcionar.
- O Partner deve comunicar previamente as alterações de endereço.

3.4. O Partner é responsável pela guarda e pela utilização das credenciais sob sua administração.
- Para fins operacionais e de auditoria, as chamadas autenticadas por chave válida serão presumidas originadas de ambiente autorizado pelo Partner, até a revogação ou o bloqueio da credencial.
- Essa presunção é relativa. Ela não impede a apuração de fraude, de falha de segurança da V3 ou de uso comprovadamente não autorizado.

3.5. Diante de suspeita ou confirmação de comprometimento, uso indevido ou perda de controle de uma credencial, o Partner deverá:
- revogá-la imediatamente ou solicitar seu bloqueio;
- comunicar a V3 em até 24 (vinte e quatro) horas da ciência, pelo canal indicado na plataforma ou pelo e-mail suporte@v3partners.com.br;
- informar, na medida do possível, o período, os sistemas afetados, os tipos de dados potencialmente envolvidos e as medidas de contenção adotadas.

3.6. A V3 poderá invalidar, substituir ou bloquear credenciais diante de risco, suspeita de comprometimento, determinação legal ou necessidade de segurança. A medida razoável e proporcional não gera direito a indenização.

## 4. Obrigações do Partner sobre propostas, clientes e documentos

4.1. Antes de transmitir qualquer dado ou documento, o Partner deverá assegurar que:
- (a) possui autorização, poderes ou outra condição jurídica válida para o envio;
- (b) informou o titular, de forma clara e adequada, sobre o compartilhamento com a V3 e suas finalidades;
- (c) identificou e documentou a base legal aplicável ao tratamento e ao compartilhamento;
- (d) observou os deveres de sigilo, transparência e prevenção e as demais normas aplicáveis à sua atividade.

4.2. O Partner transmitirá apenas dados adequados, pertinentes e limitados ao necessário para a finalidade da proposta, observando os campos e documentos solicitados pela V3.
- É vedado enviar dados excessivos, desatualizados, obtidos ilicitamente ou sem relação com a análise.

4.3. O Partner declara e garante, sob sua responsabilidade, que os dados e documentos enviados:
- foram obtidos de forma lícita;
- são íntegros e autênticos, segundo as verificações que lhe competem;
- correspondem ao cliente e à operação informados;
- não foram adulterados, falsificados nem apresentados de modo enganoso.

4.4. O Partner não poderá inserir:
- dados de terceiros sem fundamento jurídico;
- dados sensíveis sem necessidade e sem fundamento legal específico;
- dados de crianças ou adolescentes sem observância das exigências legais;
- dados obtidos mediante fraude, engenharia social, violação de sigilo ou acesso não autorizado.

4.5. O Partner conservará evidências razoáveis da origem dos dados, da informação prestada ao titular, da base legal utilizada, das autorizações e dos poderes de representação, e das verificações de identidade e autenticidade exigíveis à sua atividade.
- Essas evidências serão disponibilizadas à V3 quando justificadamente necessárias para auditoria, apuração de fraude, atendimento a autoridade ou defesa de direitos.

4.6. O Partner não poderá prometer nem garantir, em nome da V3 ou de instituição parceira, aprovação de crédito, taxa, prazo, limite, liberação de recursos ou qualquer outra condição, salvo autorização formal e específica.
- Também não poderá induzir o cliente a acreditar que a transmissão da proposta equivale à aprovação ou à contratação do crédito.

4.7. O Partner corrigirá, complementará ou retirará, com a maior brevidade, dados e documentos incorretos, incompletos, desatualizados ou enviados por engano.
- Comunicará a V3 quando a inconsistência puder afetar a análise, o titular ou a conformidade da operação.

4.8. Autorização para consultas de crédito.
- Antes de transmitir a proposta, o Partner colherá do cliente, e de cada sócio, garantidor ou coobrigado que será consultado, autorização expressa, específica e comprovável para:
  - consulta ao Sistema de Informações de Crédito do Banco Central (SCR);
  - consulta a bureaus de crédito, cadastros públicos e serviços de prevenção à fraude;
  - essas consultas feitas pela V3 e pelas instituições que analisarão a proposta.
- A autorização seguirá o modelo disponibilizado pela V3, ou outro de conteúdo equivalente.
- A prova será guardada pelo Partner por 5 (cinco) anos e entregue à V3 em até 2 (dois) dias úteis da solicitação.
- A V3 poderá recusar ou suspender a proposta enquanto a autorização não for comprovada.

4.9. Proibição de cobrança antecipada.
- É vedado ao Partner cobrar ou receber do cliente qualquer valor em nome da V3 ou de instituição financeira, seja a título de taxa, sinal, seguro, cadastro, análise ou liberação.
- Também é vedado condicionar o envio ou o andamento da proposta a qualquer pagamento.
- Fica ressalvada a cobrança emitida pela própria V3 por meio da plataforma, com pagamento feito diretamente à conta da V3.
- Os valores que o Partner cobrar pelos próprios serviços são de sua exclusiva responsabilidade e devem ser informados ao cliente como cobrança do Partner, nunca da V3.

4.10. O Partner não se apresentará como correspondente bancário, empregado, representante ou preposto da V3 ou de instituição financeira, salvo se possuir esse vínculo por contrato próprio e nos limites dele.

## 5. Proteção de dados pessoais

5.1. As Partes cumprirão a Lei nº 13.709/2018 (LGPD), o Marco Civil da Internet, as normas da Autoridade Nacional de Proteção de Dados (ANPD) e as demais regras de proteção de dados e segurança da informação.

5.2. Em regra, cada Parte atuará como controladora independente nas operações de tratamento cujas finalidades e elementos essenciais determinar por conta própria.
- A qualificação refletirá a realidade de cada fluxo.
- Se, em operação específica, uma Parte tratar dados pessoais em nome e sob instruções documentadas da outra, as Partes formalizarão anexo de tratamento de dados com as obrigações de controlador e de operador.
- A nomenclatura deste Termo não altera a qualificação legal efetiva.

5.3. O Partner é responsável por definir e documentar a base legal da coleta e do compartilhamento dos dados com a V3, e por cumprir os deveres de transparência perante o titular na etapa sob sua responsabilidade.
- O consentimento não será exigido quando houver outra base legal válida.
- Quando utilizado, o consentimento será livre, informado, inequívoco, específico e comprovável.

5.4. A V3 é responsável por definir e documentar as bases legais, as finalidades, os critérios de retenção e os demais elementos dos tratamentos que realizar como controladora.
- Isso inclui a análise, a estruturação, a gestão e o encaminhamento da proposta a instituições financeiras, correspondentes, prestadores de serviços e demais destinatários legítimos do fluxo de crédito.

5.5. Cada Parte manterá registro das operações de tratamento sob sua responsabilidade e adotará medidas técnicas e administrativas aptas a proteger os dados pessoais. Também assegurará que as pessoas autorizadas estejam sujeitas a deveres de confidencialidade.

5.6. O Partner cooperará com a V3 no atendimento de solicitações de titulares relativas a dados transmitidos pela API.
- Se receber solicitação que envolva tratamento realizado pela V3, a encaminhará ao canal de privacidade da V3 em até 2 (dois) dias úteis.
- Não responderá em nome da V3 nem prometerá resultado fora do seu controle.
- A V3 prestará cooperação equivalente.

5.7. Cada Parte atenderá diretamente às solicitações dos titulares e às requisições de autoridades relativas aos tratamentos sob sua responsabilidade.
- As Partes cooperarão, dentro dos limites legais, para localizar dados, corrigir informações, restringir tratamentos e eliminar ou anonimizar dados quando cabível.

5.8. A V3 poderá compartilhar dados pessoais com os destinatários necessários às finalidades informadas, observando a legislação, os contratos aplicáveis e as medidas de segurança pertinentes.
- Esses destinatários incluem instituições financeiras, correspondentes, fornecedores de tecnologia, provedores de infraestrutura e prestadores de prevenção à fraude.
- A V3 manterá, em seu aviso de privacidade, transparência sobre as categorias de destinatários e as finalidades.

5.9. Transferências internacionais de dados, quando existentes, observarão os mecanismos da LGPD e da regulamentação da ANPD.

5.10. Encerrada a finalidade ou a relação contratual, cada Parte eliminará, anonimizará ou manterá os dados pessoais conforme as hipóteses legais de conservação, as obrigações regulatórias, o exercício regular de direitos e a política de retenção aplicável.

5.11. O encarregado pelo tratamento de dados pessoais da V3 é Robson Lino, com contato pelo e-mail suporte@v3partners.com.br, com o assunto "Encarregado de Dados". A V3 manterá essa informação atualizada na plataforma e em seu aviso de privacidade.

5.12. Uso dos dados recebidos da V3.
- Os dados que o Partner receber pela API serão usados exclusivamente para acompanhar a proposta correspondente e atender o próprio cliente. Isso inclui andamento, pendências, comentários, documentos recebidos e faltantes, e link de análise.
- É vedado ao Partner:
  - (a) vender, ceder ou compartilhar esses dados com terceiros;
  - (b) usá-los para formar base de dados, perfil ou ranking de clientes ou instituições;
  - (c) usá-los para contatar diretamente as instituições, os financiadores ou as contrapartes apresentados pela V3, ou negociar com eles a mesma operação fora da V3, observadas as regras de não circunvenção do contrato de parceria;
  - (d) mantê-los por prazo superior ao necessário à finalidade ou à obrigação legal.

## 6. Segurança da informação e incidentes

6.1. Cada Parte implementará e manterá medidas técnicas e administrativas razoáveis e proporcionais aos riscos de suas operações, conforme aplicável:
- controle de acesso por necessidade e autenticação adequada;
- gestão de vulnerabilidades e atualização de sistemas;
- proteção de credenciais;
- cópias de segurança;
- monitoramento e segregação de ambientes;
- treinamento e procedimentos de resposta a incidentes.

6.2. A V3 adotará medidas de segurança compatíveis com a natureza da API e dos dados tratados, descritas na documentação técnica vigente.
- Entre elas: HTTPS, restrição por IP, validade das chaves, guarda das chaves apenas em forma criptográfica irreversível (hash), limitação de chamadas, bloqueio de comportamento anômalo e respostas com documentos mascarados.
- A documentação descreve os controles existentes, sem constituir garantia de resultado.

6.3. O Partner comunicará à V3, sem demora injustificada e em qualquer caso em até 24 (vinte e quatro) horas da ciência, qualquer incidente confirmado ou suspeita razoável de incidente em seus sistemas, credenciais ou fornecedores que possa comprometer os dados enviados à V3, a API ou a segurança da integração.

6.4. A comunicação será feita pelo e-mail suporte@v3partners.com.br e conterá as informações disponíveis sobre:
- natureza do incidente, data e hora;
- sistemas afetados;
- categorias e volume aproximado de dados;
- titulares potencialmente envolvidos;
- medidas de contenção;
- contato técnico responsável.

O Partner complementará as informações à medida que a apuração evoluir.

6.5. As Partes cooperarão na investigação, contenção, mitigação, preservação de evidências e atendimento a titulares e autoridades.
- Nenhuma Parte divulgará publicamente incidente que envolva a outra, nem atribuirá a ela responsabilidade, sem prévia coordenação, salvo obrigação legal ou determinação de autoridade.

6.6. Cada Parte avaliará e realizará as comunicações legalmente exigidas à ANPD e aos titulares relativas aos tratamentos sob sua responsabilidade, nos prazos legais e regulamentares.
- O aviso contratual de 24 horas não altera nem prorroga esses prazos.

6.7. A Parte que identificar vulnerabilidade crítica ou risco iminente poderá adotar medidas emergenciais, inclusive o bloqueio temporário de credenciais, rotas ou integrações, comunicando a outra Parte tão logo seja razoavelmente possível.

## 7. Uso aceitável e condutas proibidas

7.1. É vedado ao Partner, direta ou indiretamente:
- (a) utilizar a API para finalidade ilícita, fraudulenta ou diversa da parceria;
- (b) acessar, tentar acessar, consultar ou inferir dados, propostas ou recursos de outros Partners ou clientes;
- (c) contornar autenticação, limites, controles de segurança ou mecanismos antifraude;
- (d) realizar engenharia reversa, varredura, teste de intrusão ou teste de carga sem autorização prévia e escrita da V3;
- (e) introduzir malware, código malicioso, arquivos corrompidos ou conteúdo que comprometa a plataforma;
- (f) sobrecarregar, degradar, interromper ou interferir na API;
- (g) usar robôs ou rotinas automatizadas fora dos limites documentados;
- (h) copiar, modificar, descompilar, sublicenciar ou explorar comercialmente componentes da API sem autorização;
- (i) transmitir dados sem base legal ou em violação a sigilo;
- (j) utilizar a API para discriminação ilícita, fraude documental ou simulação de identidade.

7.2. O Partner observará a legislação aplicável à sua atividade e as políticas operacionais que a V3 disponibilize de forma razoável. Isso inclui as normas de prevenção à fraude, anticorrupção, proteção do consumidor, sigilo e prevenção à lavagem de dinheiro.

7.3. O Partner notificará a V3 imediatamente ao identificar proposta suspeita, documento possivelmente falsificado, uso indevido de identidade, tentativa de fraude ou acesso não autorizado relacionado à integração.

7.4. Prevenção à lavagem de dinheiro.
- O Partner informará na proposta, sempre que souber ou puder razoavelmente apurar:
  - se o cliente, seus sócios ou seus representantes são pessoas expostas politicamente;
  - quem é o beneficiário final da pessoa jurídica;
  - qualquer circunstância atípica sobre a origem dos recursos, das garantias ou da operação.
- A V3 poderá recusar, suspender ou encerrar a análise de qualquer proposta por critério de risco, sem dever de explicar o motivo, inclusive quando a lei proibir essa revelação.
- O Partner não informará ao cliente a existência de suspeita, apuração ou comunicação a autoridade de que tenha conhecimento.

## 8. Propriedade intelectual e confidencialidade

8.1. A API, seus códigos, arquitetura, documentação, marcas, layouts, especificações, melhorias e materiais relacionados pertencem à V3 ou a seus licenciantes.
- Este Termo concede ao Partner licença limitada, revogável, não exclusiva, intransferível e não sublicenciável para utilizar a API durante a vigência da parceria e estritamente para a finalidade contratada.

8.2. Nenhum direito de propriedade intelectual é transferido ao Partner.
- O Partner não removerá avisos de titularidade, não registrará sinais distintivos semelhantes e não reivindicará titularidade sobre a API.
- O Partner não utilizará as marcas da V3 sem autorização prévia e escrita.

8.3. Cada Parte manterá sigilo sobre as informações não públicas recebidas da outra, sejam técnicas, comerciais ou operacionais, credenciais ou dados pessoais.
- Usará essas informações apenas para executar a relação contratual.
- Restringirá o acesso a quem precise conhecê-las e esteja sujeito a dever de confidencialidade.

8.4. Não são confidenciais as informações:
- comprovadamente públicas sem violação deste Termo;
- já legitimamente conhecidas pela Parte receptora;
- recebidas licitamente de terceiro sem dever de sigilo;
- desenvolvidas de forma independente.

8.5. A divulgação exigida por lei ou por autoridade é permitida na extensão necessária.
- Quando legalmente permitido, a Parte obrigada avisará previamente a outra e cooperará para limitar a divulgação.

8.6. As obrigações de confidencialidade vigoram por 5 (cinco) anos após o término do Termo.
- Para segredos de negócio, não há limite de prazo enquanto mantiverem essa natureza.
- Para dados pessoais, vigoram enquanto subsistirem os deveres legais de proteção.

## 9. Registros, evidências e auditoria

9.1. A V3 poderá manter registros técnicos e de auditoria das chamadas à API, incluindo:
- identificador da credencial, sem exposição do segredo;
- Partner, IP de origem, data e hora;
- rota, resultado e códigos de resposta;
- eventos de autenticação, segurança e bloqueio.

9.2. Os registros de acesso a aplicações serão mantidos pelo prazo legal aplicável, inclusive o prazo de 6 (seis) meses do art. 15 do Marco Civil da Internet, quando cabível.
- A V3 poderá manter trilhas operacionais e de segurança por 12 (doze) meses.
- O prazo poderá ser superior quando houver justificativa legal, regulatória, de segurança, de exercício regular de direitos ou de preservação de evidências.

9.3. Os registros de incidentes de segurança envolvendo dados pessoais serão mantidos pelo prazo mínimo da regulamentação da ANPD, atualmente de 5 (cinco) anos.

9.4. A V3 não registrará o conteúdo integral de documentos e chamadas em logs técnicos, salvo quando estritamente necessário, com acesso restrito e prazo de retenção definido.
- O Partner também evitará inserir dados pessoais, documentos ou credenciais em logs e mensagens de erro.

9.5. Mediante solicitação razoável, o Partner fornecerá as informações e evidências necessárias para verificar a conformidade com este Termo, investigar incidente, fraude ou uso indevido, ou atender obrigação legal.
- Auditorias presenciais ou técnicas serão previamente agendadas, limitadas ao escopo pertinente e preservarão segredos comerciais e dados de terceiros, salvo urgência ou exigência legal.

## 10. Disponibilidade, alterações e suporte

10.1. A V3 envidará esforços comercialmente razoáveis para manter a API disponível, mas não garante operação ininterrupta, ausência de erros ou compatibilidade permanente com sistemas de terceiros.

10.2. A API é ferramenta de integração. A V3 não garante:
- aprovação de propostas;
- concessão ou liberação de crédito;
- condições comerciais, taxas, prazos ou limites;
- funding;
- aceitação por instituições financeiras;
- resultado de análise.

Essas decisões pertencem às instituições responsáveis, segundo critérios próprios.

10.3. Alterações incompatíveis com versões anteriores serão comunicadas, sempre que viável, com antecedência mínima de 30 (trinta) dias.
- O prazo poderá ser reduzido ou dispensado em caso de urgência, exigência legal ou regulatória, vulnerabilidade, incidente, risco à segurança ou determinação de terceiro essencial à operação.

10.4. O Partner é responsável por desenvolver, testar, manter e atualizar sua integração, inclusive compatibilidade, conectividade, infraestrutura, tratamento de erros, reprocessamento seguro e prevenção de duplicidade.
- A V3 não responde por falhas originadas exclusivamente em sistemas, redes, provedores ou equipamentos sob controle do Partner ou de terceiros por ele contratados.

10.5. Os limites de chamadas, o tamanho de arquivos, os formatos, os timeouts, as janelas de manutenção e os canais de suporte serão definidos na documentação técnica ou em comunicados operacionais da V3.
- Poderão ser ajustados por razões de capacidade, segurança ou estabilidade.

## 11. Suspensão, bloqueio e revogação

11.1. A V3 poderá suspender, limitar ou revogar, total ou parcialmente, o acesso à API ou qualquer credencial, imediatamente e sem aviso prévio, quando:
- (a) houver suspeita razoável de comprometimento, fraude ou uso não autorizado;
- (b) houver violação deste Termo, do contrato de parceria ou da lei;
- (c) houver risco à segurança, disponibilidade, integridade ou confidencialidade da plataforma ou de dados;
- (d) houver inadimplência ou irregularidade cadastral relevante;
- (e) a parceria for encerrada ou suspensa, ou o Partner deixar de ter plano com acesso à API;
- (f) houver determinação de autoridade ou de instituição parceira;
- (g) a medida for necessária para manutenção emergencial.

11.2. Sempre que a natureza do evento permitir, a V3 informará o Partner sobre a suspensão e a razão geral da medida, sem revelar informações que possam comprometer a segurança, investigações ou direitos de terceiros.

11.3. Quando a irregularidade for sanável e não houver risco relevante, a V3 poderá conceder prazo razoável para correção.
- A suspensão não afasta as obrigações vencidas, os deveres de confidencialidade e de proteção de dados, a indenização e as demais obrigações que, por natureza, sobrevivam ao encerramento.

11.4. A proposta com indício de fraude, de documento falso ou de violação das cláusulas 4.8 e 4.9 ficará suspensa até a conclusão da apuração.
- A comissão vinculada a essa proposta só será devida se a apuração afastar a irregularidade.
- A apuração será concluída em prazo razoável, assegurado ao Partner o direito de apresentar esclarecimentos.

## 12. Responsabilidade, ressarcimento e limitação

12.1. Cada Parte responde pelos danos diretos comprovadamente causados à outra Parte ou a terceiros por seus próprios atos ou omissões, inclusive de seus administradores, empregados, prepostos e fornecedores, observados o nexo causal, a legislação aplicável e as limitações válidas deste Termo.

12.2. O Partner obriga-se a defender, indenizar e manter indenes a V3, suas sociedades afiliadas, administradores, empregados e representantes.
- A obrigação cobre reclamações, demandas, perdas, condenações, multas, danos, custos e despesas razoáveis, inclusive honorários advocatícios e custos de investigação.
- Vale para os casos decorrentes de:
  - (a) dados ou documentos enviados ilicitamente, falsos, adulterados ou sem autorização;
  - (b) violação pelo Partner da LGPD ou de outra norma aplicável;
  - (c) fraude, dolo, culpa ou descumprimento deste Termo pelo Partner ou por pessoas sob sua responsabilidade;
  - (d) uso indevido de credenciais ou da API imputável ao Partner;
  - (e) violação de direitos de terceiros pelo conteúdo transmitido pelo Partner;
  - (f) cobrança, promessa ou apresentação vedada pelas cláusulas 4.6, 4.9 e 4.10.

12.3. A V3 notificará o Partner sobre reclamação de terceiro para a qual pretenda ressarcimento, quando razoavelmente possível, permitindo sua participação na defesa.
- O Partner não celebrará acordo que imponha obrigação, reconhecimento de culpa ou restrição à V3 sem consentimento prévio e escrito dela.
- A falta de aviso só reduz o dever de ressarcimento na medida do prejuízo comprovado à defesa.

12.4. Nenhuma Parte responde perante a outra por danos indiretos, lucros cessantes, perda de oportunidade, perda de receita, perda de dados recuperáveis ou danos punitivos.
- A exclusão não se aplica quando o dano decorrer de:
  - dolo ou fraude;
  - violação de confidencialidade ou de propriedade intelectual;
  - envio de dados sem base legal, ou incidente causado por dolo ou culpa grave da Parte que o causou;
  - hipótese em que a exclusão seja vedada por lei.

12.5. A responsabilidade total da V3 perante o Partner por danos decorrentes deste Termo fica limitada ao valor efetivamente pago pelo Partner à V3, a título de mensalidade do plano, nos 12 (doze) meses anteriores ao evento que originou a reclamação.
- O limite não se aplica ao dolo ou à fraude da V3.
- O limite não afasta responsabilidades que a lei não permita limitar.

12.6. Nenhuma disposição deste Termo exclui ou limita responsabilidade perante titulares de dados ou autoridades públicas em desacordo com a legislação. A alocação contratual de responsabilidades produz efeitos apenas entre as Partes.

12.7. Multa por violação grave.
- O Partner pagará à V3 multa não compensatória de R$ 200.000,00 (duzentos mil reais) por evento, nas seguintes hipóteses:
  - (a) compartilhar ou ceder credencial (cl. 2.4 e 3.1);
  - (b) transmitir dado sem base legal, sem a autorização da cl. 4.8 ou obtido ilicitamente;
  - (c) enviar documento que saiba ou deva saber falso;
  - (d) cobrar valor vedado pela cl. 4.9;
  - (e) usar indevidamente os dados recebidos, nos termos da cl. 5.12.
- A multa não exclui a indenização do dano que a exceder, que a V3 poderá cobrar como indenização suplementar.

12.8. Compensação.
- Os valores líquidos devidos pelo Partner à V3 com base neste Termo poderão ser compensados com comissões ou outros créditos que o Partner tenha a receber da V3.
- Antes da compensação, a V3 enviará aviso escrito com o cálculo, e o Partner terá 5 (cinco) dias úteis para se manifestar.

## 13. Vigência, encerramento e efeitos

13.1. Este Termo entra em vigor no aceite eletrônico pelo representante autorizado do Partner e vigora enquanto houver acesso à API ou obrigações pendentes relacionadas ao seu uso.

13.2. O encerramento da parceria, por qualquer motivo, autoriza a V3 a revogar as credenciais e encerrar o acesso à API.
- Sobrevivem as disposições de confidencialidade, propriedade intelectual, proteção de dados, registros, responsabilidade, multa, compensação, ressarcimento e solução de controvérsias.

13.3. Após o encerramento, o Partner cessará o uso da API e eliminará as cópias de credenciais e de materiais técnicos confidenciais.
- Ficam ressalvadas as cópias cuja conservação seja exigida por lei ou necessária ao exercício regular de direitos, sempre sob proteção adequada.

## 14. Alterações do Termo e aceite eletrônico

14.1. A V3 poderá atualizar este Termo para refletir alterações legais, regulatórias, técnicas, operacionais ou de segurança. A versão atualizada será disponibilizada na plataforma com identificação de versão e data de vigência.

14.2. Alterações materiais serão submetidas a novo aceite eletrônico.
- As credenciais ficam suspensas até o novo aceite.
- Alterações urgentes, necessárias para cumprir a lei ou proteger a API, poderão produzir efeitos imediatos, com comunicação ao Partner tão logo possível.

14.3. O Partner reconhece a validade do aceite eletrônico realizado por usuário autenticado e autorizado, por clique em campo de confirmação ou mecanismo equivalente, como manifestação de concordância com este Termo.
- Fundamento: art. 10, § 2º, da MP nº 2.200-2/2001 e Lei nº 14.063/2020.

14.4. A V3 poderá conservar evidências eletrônicas do aceite, incluindo:
- versão do Termo e cópia integral do texto ou referência imutável;
- hash criptográfico SHA-256;
- identificação do usuário;
- data e hora com fuso horário;
- endereço IP, navegador e dispositivo, e identificadores técnicos da sessão.

O Partner reconhece que essas evidências podem demonstrar a disponibilização e o aceite do Termo, sem prejuízo do direito de contestar sua autenticidade ou integridade.

14.5. O Partner garante que o usuário que realizar o aceite tem poderes para vinculá-lo. A V3 poderá exigir confirmação adicional de representação ou autorização.

14.6. As cláusulas 4.8, 4.9, 11.4, 12.4, 12.5, 12.7 e 12.8 serão exibidas em destaque na tela de aceite, com caixa de confirmação própria.

## 15. Disposições gerais e foro

15.1. A tolerância de qualquer Parte quanto ao descumprimento de obrigação não constitui renúncia, novação ou alteração contratual.

15.2. Se qualquer disposição deste Termo for considerada inválida ou inexequível, as demais permanecem em vigor. As Partes substituirão a disposição afetada por outra válida que preserve, na maior medida possível, sua finalidade econômica e jurídica.

15.3. O Partner não cederá este Termo nem transferirá direitos e obrigações dele decorrentes sem autorização prévia e escrita da V3.
- A V3 poderá ceder este Termo a sociedade do mesmo grupo econômico ou a sucessora em reorganização societária, mediante comunicação ao Partner.

15.4. As comunicações operacionais poderão ser feitas pelos canais cadastrados na plataforma. O Partner é responsável por manter contatos válidos e monitorados.

15.5. Este Termo é regido pelas leis da República Federativa do Brasil.
- Fica eleito o foro previsto no contrato de parceria.
- Na falta dele, fica eleito o foro da comarca do Rio de Janeiro, Estado do Rio de Janeiro, com renúncia a qualquer outro, ressalvadas as competências legais inderrogáveis.

15.6. O Partner declara que não oferece, promete nem concede vantagem indevida a agente público, ou a empregado de instituição financeira ou parceira, para obter aprovação, condição ou prioridade em proposta. Declara também que observa a Lei nº 12.846/2013.

## Aceite eletrônico

[ ] Li, compreendi e aceito integralmente o Termo de Uso da API de Propostas de Crédito da V3 Partners, versão 2.1.

[ ] Li e aceito, em especial, as cláusulas em destaque: autorização para consultas de crédito (4.8), proibição de cobrança antecipada (4.9), suspensão de comissão em caso de fraude (11.4), limitação de responsabilidade (12.4 e 12.5), multa (12.7) e compensação (12.8).

O aceite será registrado eletronicamente pela plataforma, com a identificação do Partner e do usuário responsável, a versão e o hash do documento, a data e a hora, o IP e as informações técnicas da sessão.

Partner: ______________________________________________
CNPJ ou CPF: __________________________________________
Representante ou usuário que aceitou: __________________
Data e hora do aceite: _________________________________
