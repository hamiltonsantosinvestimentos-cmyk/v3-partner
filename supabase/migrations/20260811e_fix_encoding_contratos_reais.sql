-- Correcao de encoding: o clipboard usado no INSERT anterior corrompeu
-- acentuacao UTF-8 (bug do comando 'clip' do Windows, nao do dado em si).
-- Este UPDATE substitui o HTML pelo texto correto, sem alterar nenhuma
-- clausula juridica.

update contract_templates set body_text_raw =
$html$<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Contrato de Parceria Comercial e Intermediação de Negócios (Home Cash) · V3 Partners</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
body{font-family:'DM Sans',sans-serif;background:#09081A;color:#9BAFC5;padding:40px 60px;line-height:1.8;font-size:13px}
h1{font-size:20px;font-weight:700;color:#C9A84C;text-align:center;margin-bottom:8px}
h2{font-size:14px;font-weight:700;color:#C9A84C;margin:24px 0 8px;text-transform:uppercase;letter-spacing:.5px}
.header{text-align:center;margin-bottom:32px;padding-bottom:16px;border-bottom:2px solid #C9A84C}
.header img{height:40px;margin-bottom:8px}
.header p{font-size:11px;color:#9BAFC5}
p{margin-bottom:12px}
.parties{display:flex;flex-wrap:wrap;justify-content:center;gap:40px;margin-top:48px;padding-top:24px;border-top:1px solid #243A66}
.party{flex:1 1 200px;max-width:220px;text-align:center}
.party .line{width:200px;border-top:1px solid #9BAFC5;margin:40px auto 8px}
.party .name{font-weight:700;color:#F5F1E8;font-size:12px}
.party .doc{font-size:10px;color:#9BAFC5}
.footer{text-align:center;margin-top:48px;font-size:10px;color:#9BAFC5}
@media print{@page{size:A4;margin:13mm 14mm}body{background:#09081A!important;-webkit-print-color-adjust:exact!important}.header img{height:15mm!important}}
</style>
</head>
<body>
<div class="header">
<img src="https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png" alt="V3 Partners">
<h1>Contrato de Parceria Comercial e Intermediação de Negócios (Home Cash)</h1>
<p>V3 Partners Soluções Ltda, CNPJ 14.219.287/0001-50</p>
</div>
<p>De um lado:</p>
<p>V3 PARTNERS SOLUÇÕES LTDA., sociedade empresária limitada, sediada na Rua Visconde de Pirajá, nº 414, Sala 718, Ipanema, Rio de Janeiro/RJ, CEP 22.410-002, registrada na JUCERJA sob o NIRE nº 33.2.0898614-3 e inscrita no CNPJ/MF sob o nº 14.219.287/0001-50, neste ato representada por seu sócio administrador, JOÃO LEMOS NETTO, brasileiro, divorciado, empresário, portador da Carteira de Identidade nº 11734474-7 IFP/RJ e inscrito no CPF/MF sob o nº 078.678.257-97, residente e domiciliado na Rua Desembargador Oscar Tenório, nº 95, Ap. 102, Recreio dos Bandeirantes, Rio de Janeiro/RJ, CEP 22.975-110, e-mail: joao.lemos@v3partners.com.br, telefone: +55 (21) 98993-7178, doravante denominada simplesmente "V3" ou "ORIGINADORA";</p>
<p>E, de outro lado, atuando em sociedade comercial / joint venture no âmbito do projeto Home Cash:</p>
<p>DANIEL ALVES NICOLAU, brasileiro, casado, empresário, inscrito no CPF/MF sob o nº 371.203.358-39, residente e domiciliado na Av. Dr. Renato de Andrade Maia, nº 1524, Casa 04, Guarulhos/SP, CEP 07114-000, e-mail: dn@ssnpar.com, telefone: +55 (11) 98582-3027; e</p>
<p>DIOGO GALINDO MARCHESANO, brasileiro, solteiro, empresário, nascido em 13/03/1995, portador da Carteira de Identidade nº 47.651.113-6, inscrito no CPF/MF sob o nº 427.126.278-14, residente e domiciliado na Rua Quedas, nº 553, Casa 2, Vila Mazzei, São Paulo/SP, CEP 02082-030, e-mail: diogo.marchesano@dgmconsulting.com.br, telefone: +55 (11) 97155-9997;</p>
<p>(em conjunto ou representados sob a marca/estrutura comercial HOME CASH, doravante denominados simplesmente "HOME CASH" ou "ESTRUTURADORES");</p>
<p>Decidem as PARTES, de comum acordo, celebrar o presente Contrato de Parceria Comercial e Intermediação de Negócios, mediante as seguintes cláusulas e condições:</p>

<h2>CLÁUSULA PRIMEIRA, DO OBJETO E PAPEL DAS PARTES</h2>
<p>1.1. O presente contrato tem por objeto estabelecer as regras da parceria comercial entre a V3 e a HOME CASH para a prospecção, originação, estruturação financeira e intermediação de negócios e operações de crédito junto a fundos de investimento, securitizadoras e parceiros de capital.</p>
<p>1.2. Papel da V3 (ORIGINADORA): Caberá à V3 a captação, prospecção e indicação de clientes (Pessoas Físicas ou Jurídicas e seu respectivo Grupo Econômico, compreendendo controladoras, controladas, coligadas ou sob controle comum), a gestão da relação comercial inicial e a formalização direta do contrato de mandato/assessoria com o cliente originado.</p>
<p>1.3. Papel da HOME CASH (ESTRUTURADORA): Caberá à HOME CASH a análise técnica, modelagem, estruturação das teses de investimento e a intermediação/colocação das operações junto aos fundos de investimento, securitizadoras e investidores parceiros de sua rede.</p>
<p>1.4. O presente contrato tem natureza estritamente cível e mercantil, não gerando qualquer vínculo empregatício, societário ou de representação comercial exclusiva entre as PARTES.</p>

<h2>CLÁUSULA SEGUNDA, DA REMUNERAÇÃO E DIVISÃO DE HONORÁRIOS</h2>
<p>2.1. Fee de Estruturação (HOME CASH): Pertencerá integralmente (100%) à HOME CASH todo e qualquer valor pago pelos fundos de investimento, securitizadoras ou veículos parceiros de capital a título de fee de estruturação, comissão de originação do fundo, taxa de estruturação ou intermediação financeira referente às operações concretizadas.</p>
<p>Parágrafo Único: O valor recebido do fundo será dividido/distribuído entre os sócios/integrantes da HOME CASH conforme seus acordos societários internos, isentando a V3 de qualquer responsabilidade sobre essa divisão interna.</p>
<p>2.2. Valor do Mandato (V3): Pertencerá integralmente (100%) à V3 todo e qualquer valor cobrado do cliente/tomador a título de taxa de mandato, honorários de assessoria, consultoria ou success fee formalizados diretamente no contrato de mandato celebrado entre a V3 e o cliente.</p>
<p>2.3. Cada PARTE será individualmente responsável pelo faturamento, emissão das respectivas notas fiscais e recolhimento de todos os tributos incidentes sobre os valores que lhe couberem nos termos desta cláusula.</p>

<h2>CLÁUSULA TERCEIRA, DA NÃO-CIRCUNVENÇÃO E CONFIDENCIALIDADE (NCND)</h2>
<p>3.1. As PARTES acordam que, durante a vigência deste instrumento e pelo prazo de 12 (doze) meses após o seu término, não poderão, direta ou indiretamente, contatar, negociar ou realizar operações comerciais com os clientes, fundos ou oportunidades apresentados pela outra parte sem a prévia e expressa autorização por escrito.</p>
<p>3.2. É expressamente vedado que parceiros, licenciados, agentes autônomos ou partners da rede comercial da V3 estabeleçam relação comercial direta com a HOME CASH ou qualquer de seus integrantes/empresas do grupo, devendo todo e qualquer fluxo de negócios ser obrigatoriamente intermediado pela V3 PARTNERS.</p>
<p>3.3. Na hipótese de descumprimento do disposto nesta cláusula, a parte infratora ficará sujeita ao pagamento de multa compensatória equivalente a 2 (duas) vezes o montante total das comissões/honorários estimados que seriam devidos na operação circumventada, sem prejuízo de apuração de perdas e danos adicionais.</p>

<h2>CLÁUSULA QUARTA, DA FLUXO E IDENTIFICAÇÃO DAS INDICAÇÕES</h2>
<p>4.1. As indicações de clientes e operações deverão ser formalizadas formalmente via e-mail ou aplicativo de mensagem cadastrado, identificando claramente o cliente e os dados essenciais da demanda.</p>
<p>4.2. A HOME CASH confirmará o recebimento e informará se a indicação já se encontra em negociação em sua base de dados no prazo máximo de até 7 (sete) dias úteis.</p>
<p>4.3. Em cumprimento à Lei Geral de Proteção de Dados (Lei nº 13.709/2018, LGPD), as partes comprometem-se a tratar com sigilo e confidencialidade todos os dados pessoais e financeiros compartilhados durante as operações.</p>

<h2>CLÁUSULA QUINTA, DO PRAZO, RESCISÃO E AVISO PRÉVIO</h2>
<p>5.1. O presente instrumento é celebrado por prazo indeterminado, entrando em vigor na data de sua assinatura.</p>
<p>5.2. Qualquer das PARTES poderá rescindir o presente contrato a qualquer tempo, sem incidência de penalidade ou justa causa, mediante envio de notificação prévia por escrito com antecedência mínima de 15 (quinze) dias.</p>
<p>5.3. Em caso de rescisão do contrato, a V3 e a HOME CASH preservam integralmente o direito ao recebimento de suas respectivas parcelas de honorários e comissões (Cláusula Segunda) em relação a todas as operações e clientes que tenham sido indicados durante a vigência deste instrumento e cujos negócios venham a ser concretizados no prazo de até 12 (doze) meses após o encerramento do contrato.</p>

<h2>CLÁUSULA SEXTA, DO FORO</h2>
<p>6.1. Para dirimir quaisquer controvérsias oriundas do presente contrato, as PARTES elegem o Foro da Comarca da Capital do Estado do Rio de Janeiro/RJ, com renúncia expressa a qualquer outro, por mais privilegiado que seja.</p>

<p>E, por estarem assim justas e contratadas, as partes assinam o presente instrumento em vias de igual teor e forma para um só efeito.</p>
<p>Rio de Janeiro/RJ, 11 de agosto de 2026.</p>

<div class="parties"><div class="party"><div class="line"></div><div class="name">Daniel Alves Nicolau</div><div class="doc">CPF 371.203.358-39</div></div><div class="party"><div class="line"></div><div class="name">Diogo Galindo Marchesano</div><div class="doc">CPF 427.126.278-14</div></div><div class="party"><div class="line"></div><div class="name">V3 Partners Soluções Ltda</div><div class="doc">14.219.287/0001-50</div></div></div>
<div class="footer">
<p>Documento gerado automaticamente pela plataforma V3 Partners em 11/08/2026.</p>
<p>Este documento requer assinatura eletrônica para validade jurídica.</p>
</div>
</body>
</html>$html$
where template_name = 'Contrato de Parceria Comercial e Intermediacao de Negocios, Home Cash';

update operation_contracts set rendered_html =
$html$<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Contrato de Parceria Comercial e Intermediação de Negócios (Home Cash) · V3 Partners</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
body{font-family:'DM Sans',sans-serif;background:#09081A;color:#9BAFC5;padding:40px 60px;line-height:1.8;font-size:13px}
h1{font-size:20px;font-weight:700;color:#C9A84C;text-align:center;margin-bottom:8px}
h2{font-size:14px;font-weight:700;color:#C9A84C;margin:24px 0 8px;text-transform:uppercase;letter-spacing:.5px}
.header{text-align:center;margin-bottom:32px;padding-bottom:16px;border-bottom:2px solid #C9A84C}
.header img{height:40px;margin-bottom:8px}
.header p{font-size:11px;color:#9BAFC5}
p{margin-bottom:12px}
.parties{display:flex;flex-wrap:wrap;justify-content:center;gap:40px;margin-top:48px;padding-top:24px;border-top:1px solid #243A66}
.party{flex:1 1 200px;max-width:220px;text-align:center}
.party .line{width:200px;border-top:1px solid #9BAFC5;margin:40px auto 8px}
.party .name{font-weight:700;color:#F5F1E8;font-size:12px}
.party .doc{font-size:10px;color:#9BAFC5}
.footer{text-align:center;margin-top:48px;font-size:10px;color:#9BAFC5}
@media print{@page{size:A4;margin:13mm 14mm}body{background:#09081A!important;-webkit-print-color-adjust:exact!important}.header img{height:15mm!important}}
</style>
</head>
<body>
<div class="header">
<img src="https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png" alt="V3 Partners">
<h1>Contrato de Parceria Comercial e Intermediação de Negócios (Home Cash)</h1>
<p>V3 Partners Soluções Ltda, CNPJ 14.219.287/0001-50</p>
</div>
<p>De um lado:</p>
<p>V3 PARTNERS SOLUÇÕES LTDA., sociedade empresária limitada, sediada na Rua Visconde de Pirajá, nº 414, Sala 718, Ipanema, Rio de Janeiro/RJ, CEP 22.410-002, registrada na JUCERJA sob o NIRE nº 33.2.0898614-3 e inscrita no CNPJ/MF sob o nº 14.219.287/0001-50, neste ato representada por seu sócio administrador, JOÃO LEMOS NETTO, brasileiro, divorciado, empresário, portador da Carteira de Identidade nº 11734474-7 IFP/RJ e inscrito no CPF/MF sob o nº 078.678.257-97, residente e domiciliado na Rua Desembargador Oscar Tenório, nº 95, Ap. 102, Recreio dos Bandeirantes, Rio de Janeiro/RJ, CEP 22.975-110, e-mail: joao.lemos@v3partners.com.br, telefone: +55 (21) 98993-7178, doravante denominada simplesmente "V3" ou "ORIGINADORA";</p>
<p>E, de outro lado, atuando em sociedade comercial / joint venture no âmbito do projeto Home Cash:</p>
<p>DANIEL ALVES NICOLAU, brasileiro, casado, empresário, inscrito no CPF/MF sob o nº 371.203.358-39, residente e domiciliado na Av. Dr. Renato de Andrade Maia, nº 1524, Casa 04, Guarulhos/SP, CEP 07114-000, e-mail: dn@ssnpar.com, telefone: +55 (11) 98582-3027; e</p>
<p>DIOGO GALINDO MARCHESANO, brasileiro, solteiro, empresário, nascido em 13/03/1995, portador da Carteira de Identidade nº 47.651.113-6, inscrito no CPF/MF sob o nº 427.126.278-14, residente e domiciliado na Rua Quedas, nº 553, Casa 2, Vila Mazzei, São Paulo/SP, CEP 02082-030, e-mail: diogo.marchesano@dgmconsulting.com.br, telefone: +55 (11) 97155-9997;</p>
<p>(em conjunto ou representados sob a marca/estrutura comercial HOME CASH, doravante denominados simplesmente "HOME CASH" ou "ESTRUTURADORES");</p>
<p>Decidem as PARTES, de comum acordo, celebrar o presente Contrato de Parceria Comercial e Intermediação de Negócios, mediante as seguintes cláusulas e condições:</p>

<h2>CLÁUSULA PRIMEIRA, DO OBJETO E PAPEL DAS PARTES</h2>
<p>1.1. O presente contrato tem por objeto estabelecer as regras da parceria comercial entre a V3 e a HOME CASH para a prospecção, originação, estruturação financeira e intermediação de negócios e operações de crédito junto a fundos de investimento, securitizadoras e parceiros de capital.</p>
<p>1.2. Papel da V3 (ORIGINADORA): Caberá à V3 a captação, prospecção e indicação de clientes (Pessoas Físicas ou Jurídicas e seu respectivo Grupo Econômico, compreendendo controladoras, controladas, coligadas ou sob controle comum), a gestão da relação comercial inicial e a formalização direta do contrato de mandato/assessoria com o cliente originado.</p>
<p>1.3. Papel da HOME CASH (ESTRUTURADORA): Caberá à HOME CASH a análise técnica, modelagem, estruturação das teses de investimento e a intermediação/colocação das operações junto aos fundos de investimento, securitizadoras e investidores parceiros de sua rede.</p>
<p>1.4. O presente contrato tem natureza estritamente cível e mercantil, não gerando qualquer vínculo empregatício, societário ou de representação comercial exclusiva entre as PARTES.</p>

<h2>CLÁUSULA SEGUNDA, DA REMUNERAÇÃO E DIVISÃO DE HONORÁRIOS</h2>
<p>2.1. Fee de Estruturação (HOME CASH): Pertencerá integralmente (100%) à HOME CASH todo e qualquer valor pago pelos fundos de investimento, securitizadoras ou veículos parceiros de capital a título de fee de estruturação, comissão de originação do fundo, taxa de estruturação ou intermediação financeira referente às operações concretizadas.</p>
<p>Parágrafo Único: O valor recebido do fundo será dividido/distribuído entre os sócios/integrantes da HOME CASH conforme seus acordos societários internos, isentando a V3 de qualquer responsabilidade sobre essa divisão interna.</p>
<p>2.2. Valor do Mandato (V3): Pertencerá integralmente (100%) à V3 todo e qualquer valor cobrado do cliente/tomador a título de taxa de mandato, honorários de assessoria, consultoria ou success fee formalizados diretamente no contrato de mandato celebrado entre a V3 e o cliente.</p>
<p>2.3. Cada PARTE será individualmente responsável pelo faturamento, emissão das respectivas notas fiscais e recolhimento de todos os tributos incidentes sobre os valores que lhe couberem nos termos desta cláusula.</p>

<h2>CLÁUSULA TERCEIRA, DA NÃO-CIRCUNVENÇÃO E CONFIDENCIALIDADE (NCND)</h2>
<p>3.1. As PARTES acordam que, durante a vigência deste instrumento e pelo prazo de 12 (doze) meses após o seu término, não poderão, direta ou indiretamente, contatar, negociar ou realizar operações comerciais com os clientes, fundos ou oportunidades apresentados pela outra parte sem a prévia e expressa autorização por escrito.</p>
<p>3.2. É expressamente vedado que parceiros, licenciados, agentes autônomos ou partners da rede comercial da V3 estabeleçam relação comercial direta com a HOME CASH ou qualquer de seus integrantes/empresas do grupo, devendo todo e qualquer fluxo de negócios ser obrigatoriamente intermediado pela V3 PARTNERS.</p>
<p>3.3. Na hipótese de descumprimento do disposto nesta cláusula, a parte infratora ficará sujeita ao pagamento de multa compensatória equivalente a 2 (duas) vezes o montante total das comissões/honorários estimados que seriam devidos na operação circumventada, sem prejuízo de apuração de perdas e danos adicionais.</p>

<h2>CLÁUSULA QUARTA, DA FLUXO E IDENTIFICAÇÃO DAS INDICAÇÕES</h2>
<p>4.1. As indicações de clientes e operações deverão ser formalizadas formalmente via e-mail ou aplicativo de mensagem cadastrado, identificando claramente o cliente e os dados essenciais da demanda.</p>
<p>4.2. A HOME CASH confirmará o recebimento e informará se a indicação já se encontra em negociação em sua base de dados no prazo máximo de até 7 (sete) dias úteis.</p>
<p>4.3. Em cumprimento à Lei Geral de Proteção de Dados (Lei nº 13.709/2018, LGPD), as partes comprometem-se a tratar com sigilo e confidencialidade todos os dados pessoais e financeiros compartilhados durante as operações.</p>

<h2>CLÁUSULA QUINTA, DO PRAZO, RESCISÃO E AVISO PRÉVIO</h2>
<p>5.1. O presente instrumento é celebrado por prazo indeterminado, entrando em vigor na data de sua assinatura.</p>
<p>5.2. Qualquer das PARTES poderá rescindir o presente contrato a qualquer tempo, sem incidência de penalidade ou justa causa, mediante envio de notificação prévia por escrito com antecedência mínima de 15 (quinze) dias.</p>
<p>5.3. Em caso de rescisão do contrato, a V3 e a HOME CASH preservam integralmente o direito ao recebimento de suas respectivas parcelas de honorários e comissões (Cláusula Segunda) em relação a todas as operações e clientes que tenham sido indicados durante a vigência deste instrumento e cujos negócios venham a ser concretizados no prazo de até 12 (doze) meses após o encerramento do contrato.</p>

<h2>CLÁUSULA SEXTA, DO FORO</h2>
<p>6.1. Para dirimir quaisquer controvérsias oriundas do presente contrato, as PARTES elegem o Foro da Comarca da Capital do Estado do Rio de Janeiro/RJ, com renúncia expressa a qualquer outro, por mais privilegiado que seja.</p>

<p>E, por estarem assim justas e contratadas, as partes assinam o presente instrumento em vias de igual teor e forma para um só efeito.</p>
<p>Rio de Janeiro/RJ, 11 de agosto de 2026.</p>

<div class="parties"><div class="party"><div class="line"></div><div class="name">Daniel Alves Nicolau</div><div class="doc">CPF 371.203.358-39</div></div><div class="party"><div class="line"></div><div class="name">Diogo Galindo Marchesano</div><div class="doc">CPF 427.126.278-14</div></div><div class="party"><div class="line"></div><div class="name">V3 Partners Soluções Ltda</div><div class="doc">14.219.287/0001-50</div></div></div>
<div class="footer">
<p>Documento gerado automaticamente pela plataforma V3 Partners em 11/08/2026.</p>
<p>Este documento requer assinatura eletrônica para validade jurídica.</p>
</div>
</body>
</html>$html$
where contract_code = 'V3C-PAR-2026-0038';

update contract_templates set body_text_raw =
$html$<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Contrato de Parceria Comercial para Prospecção, Desenvolvimento de Negócios e Intermediação Comercial (Closer & Partner PRO) · V3 Partners</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
body{font-family:'DM Sans',sans-serif;background:#09081A;color:#9BAFC5;padding:40px 60px;line-height:1.8;font-size:13px}
h1{font-size:20px;font-weight:700;color:#C9A84C;text-align:center;margin-bottom:8px}
h2{font-size:14px;font-weight:700;color:#C9A84C;margin:24px 0 8px;text-transform:uppercase;letter-spacing:.5px}
.header{text-align:center;margin-bottom:32px;padding-bottom:16px;border-bottom:2px solid #C9A84C}
.header img{height:40px;margin-bottom:8px}
.header p{font-size:11px;color:#9BAFC5}
p{margin-bottom:12px}
.parties{display:flex;flex-wrap:wrap;justify-content:center;gap:40px;margin-top:48px;padding-top:24px;border-top:1px solid #243A66}
.party{flex:1 1 200px;max-width:220px;text-align:center}
.party .line{width:200px;border-top:1px solid #9BAFC5;margin:40px auto 8px}
.party .name{font-weight:700;color:#F5F1E8;font-size:12px}
.party .doc{font-size:10px;color:#9BAFC5}
.footer{text-align:center;margin-top:48px;font-size:10px;color:#9BAFC5}
@media print{@page{size:A4;margin:13mm 14mm}body{background:#09081A!important;-webkit-print-color-adjust:exact!important}.header img{height:15mm!important}}
</style>
</head>
<body>
<div class="header">
<img src="https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png" alt="V3 Partners">
<h1>Contrato de Parceria Comercial para Prospecção, Desenvolvimento de Negócios e Intermediação Comercial (Closer & Partner PRO)</h1>
<p>V3 Partners Soluções Ltda, CNPJ 14.219.287/0001-50</p>
</div>
<h2>CLÁUSULA PRIMEIRA, DAS PARTES</h2>
<p><strong>CONTRATANTE:</strong></p>
<p>V3 PARTNERS SOLUÇÕES LTDA., sociedade empresária limitada, sediada na Rua Visconde de Pirajá, nº 414, Sala 718, Ipanema, Rio de Janeiro/RJ, CEP 22.410-002, registrada na JUCERJA sob o NIRE nº 33.2.0898614-3 e inscrita no CNPJ/MF sob o nº 14.219.287/0001-50, neste ato representada por seu sócio administrador, JOÃO LEMOS NETTO, brasileiro, divorciado, empresário, portador da Carteira de Identidade nº 11734474-7 IFP/RJ e inscrito no CPF/MF sob o nº 078.678.257-97, residente e domiciliado na Rua Desembargador Oscar Tenório, nº 95, Ap. 102, Recreio dos Bandeirantes, Rio de Janeiro/RJ, CEP 22.975-110, e-mail: joao.lemos@v3partners.com.br, telefone: +55 (21) 98993-7178, doravante denominada simplesmente V3 PARTNERS ou CONTRATANTE.</p>
<p><strong>CONTRATADO:</strong></p>
<p>IRIS RODRIGUES DA SILVA 10004022661, Pessoa jurídica inscrita no CNPJ/MF sob o nº 15.133.730/0001-38, sediada na Rua José Cidio Maia, nº 415, Bairro Ponte Alta, Delfinópolis/MG, CEP 37910-000, neste ato representada por seu sócio, IRIS RODRIGUES DA SILVA, brasileiro, autônomo, nascido em Passos/MG em 01/10/1990, portador da Carteira de Identidade nº MG-16.624.342 e inscrito no CPF/MF sob o nº 100.040.226-61, residente e domiciliado na Rua José Cidio Maia, nº 355, Bairro Ponte Alta, Delfinópolis/MG, CEP 37910-000, telefone: +55 (11) 97477-7060, e-mail: iriswickman@hotmail.com, doravante denominado simplesmente PARCEIRO COMERCIAL ou CONTRATADO.</p>

<h2>CLÁUSULA SEGUNDA, DAS DEFINIÇÕES</h2>
<p>Para efeitos deste Contrato, os termos abaixo possuirão os seguintes significados:</p>
<p><strong>Cliente Elegível:</strong> Pessoa física ou jurídica captada pelo CONTRATADO e aceita pela V3 PARTNERS para iniciar relacionamento comercial.</p>
<p><strong>Cliente Ativo:</strong> Cliente que possua contrato vigente com a V3 PARTNERS, adimplente e gerando receitas efetivamente recebidas pela empresa.</p>
<p><strong>Novo Partner Elegível:</strong> Todo novo parceiro comercial (Partner, Partner PRO ou Enterprise) que aderir ao ecossistema da V3 PARTNERS como resultado da conversão e atendimento comercial realizados pelo CONTRATADO.</p>
<p><strong>Venda Elegível:</strong> Venda regularmente aprovada pela V3 PARTNERS, formalizada contratualmente e cujo pagamento tenha sido efetivamente recebido.</p>
<p><strong>Venda Líquida / Receita Líquida:</strong> Valor efetivamente recebido pela V3 PARTNERS após a dedução de: tributos; taxas financeiras; taxas de cartão; custos operacionais incidentes; cancelamentos; devoluções; chargebacks; descontos financeiros; inadimplência; e quaisquer valores não incorporados definitivamente ao caixa da empresa.</p>
<p><strong>Atuação como Closer:</strong> Atividade comercial exercida pelo CONTRATADO para a conversão e fechamento de vendas junto a leads fornecidos e gerados pela V3 PARTNERS.</p>
<p><strong>Atuação como Partner PRO:</strong> Atividade de originação própria efetuada pelo CONTRATADO através do ecossistema e ferramentas da V3 PARTNERS.</p>
<p><strong>Programa de Participação em Receitas de Novos Partners (PPRP):</strong> Sistema meritocrático de incentivo baseado nas vendas líquidas acumuladas do CONTRATADO como Closer, que confere uma porcentagem de participação (Over-Commission) sobre a receita líquida gerada pelas operações dos Novos Partners por ele integrados à plataforma.</p>
<p><strong>Leads:</strong> Toda oportunidade comercial cadastrada em qualquer sistema utilizado pela V3 PARTNERS.</p>
<p><strong>CRM:</strong> Qualquer sistema de gestão de relacionamento com clientes utilizado pela V3 PARTNERS.</p>
<p><strong>Know-how:</strong> Todo conhecimento técnico, comercial, estratégico, operacional, metodológico, tecnológico ou financeiro desenvolvido ou utilizado pela V3 PARTNERS.</p>

<h2>CLÁUSULA TERCEIRA, DO OBJETO</h2>
<p>3.1. O presente Contrato tem por objeto a prestação de serviços especializados de prospecção comercial, geração de oportunidades, qualificação de leads, negociação, fechamento de contratos (Closer) e acompanhamento de oportunidades para a V3 PARTNERS.</p>
<p>3.2. Parágrafo Primeiro. O CONTRATADO exercerá suas atividades com total autonomia técnica, administrativa e financeira, inexistindo qualquer subordinação jurídica característica das relações de emprego.</p>
<p>3.3. Parágrafo Segundo. O presente instrumento possui natureza exclusivamente civil e empresarial, não gerando vínculo empregatício, associação, sociedade, representação comercial exclusiva ou qualquer outra relação diversa da expressamente prevista neste Contrato.</p>
<p>3.4. Parágrafo Terceiro. O CONTRATADO poderá prestar serviços a terceiros, desde que tal atuação: (I) não gere conflito de interesses; (II) não utilize informações estratégicas da V3 PARTNERS; (III) não viole a cláusula de não concorrência prevista neste Contrato; e (IV) não prejudique a execução dos serviços contratados.</p>
<p>3.5. Parágrafo Quarto. Como benefício funcional condicional e temporário atrelado à prestação dos serviços de Closer, a CONTRATANTE concederá ao CONTRATADO o acesso gratuito e licença ao status de Partner PRO, permitindo-lhe realizar originação própria de negócios sob as regras fixadas na Cláusula Décima Sétima-A.</p>

<h2>CLÁUSULA QUARTA, DOS PRINCÍPIOS DA PARCERIA</h2>
<p>A relação entre as Partes será regida pelos princípios da boa-fé objetiva, transparência, cooperação, ética profissional, confidencialidade, lealdade comercial, livre iniciativa, meritocracia e autonomia empresarial. As Partes comprometem-se a atuar visando o desenvolvimento sustentável da operação comercial, preservando a reputação, a imagem e os interesses econômicos da V3 PARTNERS.</p>

<h2>CLÁUSULA QUINTA, DAS OBRIGAÇÕES DA CONTRATANTE</h2>
<p>Constituem obrigações da CONTRATANTE:</p>
<p>5.1. Disponibilizar ao CONTRATADO as informações comerciais, treinamentos, materiais institucionais, apresentações, políticas internas, tabelas comerciais e demais documentos necessários para a execução das atividades contratadas.</p>
<p>5.2. Disponibilizar acesso às ferramentas que entender necessárias para o desempenho das atividades (CRM, plataforma comercial, e-mail corporativo, sistemas internos), podendo restringir, ampliar ou cancelar tais acessos na forma prevista neste contrato.</p>
<p>5.3. Apurar as comissões e adicionais de performance de forma objetiva, conforme as regras previstas neste Contrato.</p>
<p>5.4. Efetuar o crédito das remunerações/premiações devidas ao CONTRATADO, desde que observadas as condições deste contrato e o efetivo recebimento das receitas que originaram a remuneração.</p>
<p>5.5. Definir políticas comerciais, campanhas, preços, descontos, processos, produtos e estratégias comerciais, podendo alterá-los unilateralmente, desde que não afetem direitos já adquiridos.</p>

<h2>CLÁUSULA SEXTA, DAS OBRIGAÇÕES DO CONTRATADO</h2>
<p>O CONTRATADO compromete-se a:</p>
<p>Desempenhar suas atividades com diligência, profissionalismo, ética e boa-fé; observar integralmente as políticas comerciais da V3 PARTNERS; preservar a imagem, reputação e credibilidade da CONTRATANTE; utilizar exclusivamente os materiais, apresentações e documentos aprovados pela CONTRATANTE; manter atualizados todos os registros de clientes, negociações e oportunidades no CRM indicado pela CONTRATANTE; fornecer informações verdadeiras, completas e atualizadas durante todas as etapas da negociação; comunicar imediatamente qualquer fato que possa comprometer a negociação ou a relação com clientes e parceiros; fornecer os dados necessários para o correto cadastramento e recebimento dos valores no cartão de premiação BluePay; manter regularidade fiscal, tributária e cadastral durante toda a vigência deste Contrato.</p>

<h2>CLÁUSULA SÉTIMA, DOS PADRÕES DE CONDUTA COMERCIAL</h2>
<p>O CONTRATADO deverá observar os mais elevados padrões de ética profissional. É expressamente vedado ao CONTRATADO: prometer benefícios, descontos ou condições comerciais sem autorização formal da CONTRATANTE; alterar contratos, propostas, formulários ou documentos oficiais; prestar informações falsas ou incompletas aos clientes; praticar atos que possam induzir clientes a erro; receber valores diretamente de clientes, salvo autorização expressa e por escrito da CONTRATANTE; oferecer produtos, serviços ou soluções concorrentes utilizando informações obtidas nesta parceria; praticar qualquer ato que possa prejudicar a reputação da CONTRATANTE ou de seus parceiros.</p>

<h2>CLÁUSULA OITAVA, DO USO DO CRM E FERRAMENTAS DA EMPRESA</h2>
<p>Todos os leads, cadastros, registros de atendimento, propostas, históricos e informações inseridas nos sistemas constituem patrimônio exclusivo da V3 PARTNERS. O CONTRATADO reconhece que não possui qualquer direito de propriedade sobre tais dados, não podendo copiá-los ou exportá-los sem autorização prévia e devendo eliminá-los ao término da relação contratual.</p>

<h2>CLÁUSULA NONA, DA COMUNICAÇÃO ENTRE AS PARTES</h2>
<p>Toda comunicação relevante deverá ocorrer por meios oficiais definidos pela CONTRATANTE (e-mail corporativo, plataforma interna, CRM e aplicativos de comunicação autorizados).</p>

<h2>CLÁUSULA DÉCIMA, DA FORMA DE PAGAMENTO, CARTÃO BLUEPAY E DESCONTO DE TRIBUTOS</h2>
<p>10.1. A liquidação de todas as comissões, remunerações e premiações apuradas em favor do CONTRATADO será realizada obrigatoriamente mediante crédito de saldo em Cartão de Premiação/Benefício mantido na plataforma BluePay, emitido em nome do representante ou indicado do CONTRATADO.</p>
<p>10.2. DESCONTO DE IMPOSTOS: Sobre o valor bruto das comissões e premiações apuradas no período, incidirá um desconto fixo de 6% (seis por cento), correspondente ao ressarcimento e retenção dos impostos e encargos tributários incidentes na operação de faturamento e transferência.</p>
<p>10.3. O pagamento líquido apurado (após a dedução do percentual tributário da cláusula 10.2) será creditado no cartão BluePay do CONTRATADO mensalmente, até o 5º (quinto) dia útil do mês subsequente ao do efetivo recebimento dos recursos pela CONTRATANTE.</p>

<h2>CLÁUSULA DÉCIMA PRIMEIRA, DA INTEGRIDADE E COMPLIANCE</h2>
<p>O CONTRATADO compromete-se a cumprir a legislação vigente e não praticar atos de fraude, corrupção, lavagem de dinheiro ou conflito de interesses. Havendo indícios de irregularidade, a CONTRATANTE poderá suspender pagamentos, solicitar documentos e rescindir o contrato por justa causa.</p>

<h2>CLÁUSULA DÉCIMA SEGUNDA, DA CONTESTAÇÃO DAS COMISSÕES</h2>
<p>A CONTRATANTE disponibilizará mensalmente relatório com o demonstrativo das comissões. O CONTRATADO terá o prazo de 30 (trinta) dias corridos para apresentar contestação fundamentada, sob pena de quitação integral das informações.</p>

<h2>CLÁUSULA DÉCIMA TERCEIRA, DA AUDITORIA E REVISÃO DAS COMISSÕES</h2>
<p>A CONTRATANTE poderá auditar e recalcular comissões pagas indevidamente por erro, cancelamento, inadimplência ou fraude, podendo compensar em pagamentos futuros ou solicitar a restituição no prazo de 15 (quinze) dias.</p>

<h2>CLÁUSULA DÉCIMA QUARTA, DA REMUNERAÇÃO E DUPLA MODALIDADE</h2>
<p>14.1. O CONTRATADO atuará sob o regime estrito de risco comercial, inexistindo qualquer pagamento de valor fixo, ajuda de custo ou garantia mínima por parte da CONTRATANTE.</p>
<p>14.2. A remuneração do CONTRATADO será exclusivamente variável e dependerá do papel desempenhado na operação:</p>
<p>I, Atuação como Closer (Leads da CONTRATANTE): Nas vendas realizadas a partir de leads fornecidos pela V3 PARTNERS, o CONTRATADO fará jus à comissão base de 20% (vinte por cento) da Venda Líquida / Receita Líquida efetivamente recebida, deduzido o percentual de impostos previsto na Cláusula 10.2, podendo acumular a participação na receita de novos partners prevista no Programa de Performance (Cláusula 27ª).</p>
<p>II, Atuação como Partner PRO (Originação Própria): Nas operações originadas exclusivamente pelo próprio CONTRATADO e por ele conduzidas dentro do ecossistema, o CONTRATADO fará jus ao comissionamento fixo de 50% (cinquenta por cento) sobre a Venda Líquida / Receita Líquida efetivamente recebida pela CONTRATANTE, igualmente sujeito ao desconto da Cláusula 10.2.</p>
<p>14.3. O pagamento será efetuado exclusivamente no cartão BluePay, cabendo ao CONTRATADO integral responsabilidade pela remuneração de seus colaboradores ou terceiros eventualmente envolvidos.</p>

<h2>CLÁUSULA DÉCIMA QUARTA-A, DA SUBCONTRATAÇÃO, EQUIPE E QUARTEIRIZAÇÃO</h2>
<p>14-A.1. O CONTRATADO assume total e exclusiva responsabilidade pela seleção, contratação, gestão, direção, treinamento e remuneração de qualquer profissional, colaborador, prestador de serviço, SDR (Sales Development Representative), Closer ou agente comercial que venha a integrar a sua equipe para a execução do objeto deste Contrato.</p>
<p>14-A.2. A CONTRATANTE (V3 PARTNERS) não possui qualquer relação jurídica, vínculo empregatício, societário ou responsabilidade direta, solidária ou subsidiária perante quaisquer terceiros integrados à equipe do CONTRATADO, cabendo a este arcar com 100% (cem por cento) de todos os custos trabalhistas, previdenciários, tributários e cíveis de seu time.</p>
<p>14-A.3. APROVAÇÃO PRÉVIA E ANUÊNCIA DOS SÓCIOS: A inclusão ou contratação de qualquer novo integrante, SDR, Closer ou parceiro na equipe do CONTRATADO dependerá, obrigatoriamente e sob pena de rescisão imediata por justa causa, de: I, comunicação prévia e formal à CONTRATANTE; II, anuência e autorização expressa, por escrito, de pelo menos um dos SÓCIOS ADMINISTRADORES da V3 PARTNERS.</p>
<p>14-A.4. ESPELHAMENTO CONTRATUAL E ASSINATURA DE TERMO DE ADESÃO/SIGILO: Todos os contratos celebrados pelo CONTRATADO com os membros de sua equipe (SDRs, Closers ou assistentes) deverão, obrigatoriamente: I, estar rigorosamente alinhados e subordinados às regras, limites e obrigações do presente Contrato; II, exigir a assinatura individual de Termo de Confidencialidade (NDA), Propriedade Intelectual, Proteção de Dados (LGPD) e Não Circunvenção em favor da V3 PARTNERS, cujo modelo deverá ser previamente aprovado pela CONTRATANTE antes da liberação de qualquer acesso a sistemas ou CRM.</p>
<p>14-A.5. RESPONSABILIDADE CIVIL E REGRESSIVA: O CONTRATADO responde de forma direta, integral e irrestrita por todos os atos, omissões, fraudes, vazamento de dados, falhas de conduta ou infrações contratuais praticados por qualquer membro integrante de sua equipe, obrigando-se a ressarcir e indenizar a V3 PARTNERS por quaisquer prejuízos, autuações ou condenações sofridas, incluindo honorários advocatícios e custas processuais.</p>

<h2>CLÁUSULA DÉCIMA QUINTA, DO FATO GERADOR DA COMISSÃO</h2>
<p>15.1. O direito à comissão somente nascerá quando ocorrerem, cumulativamente: (I) assinatura válida do contrato pelo cliente; (II) aprovação interna da operação; (III) efetivo pagamento pelo cliente; e (IV) efetivo recebimento do respectivo valor pela CONTRATANTE.</p>
<p>15.2. A simples proposta, cadastro, aprovação de crédito ou minuta contratual não gera direito à comissão.</p>

<h2>CLÁUSULA DÉCIMA SEXTA, DO VALOR LÍQUIDO</h2>
<p>Considera-se Valor Líquido o montante efetivamente recebido pela CONTRATANTE após a dedução de tributos, tarifas bancárias, taxas de cartão, custos financeiros, descontos comerciais, cancelamentos, devoluções, estornos, chargebacks e inadimplência.</p>

<h2>CLÁUSULA DÉCIMA SÉTIMA, DOS PLANOS COMERCIAIS DA PLATAFORMA</h2>
<p>Para fins de referência das operações comercializadas na data de assinatura deste contrato, os valores de tabela são:</p>
<table style="width:100%;border-collapse:collapse;margin:12px 0">
<tr style="border-bottom:1px solid #243A66"><th style="text-align:left;padding:6px 8px;color:#C9A84C">Plano</th><th style="text-align:left;padding:6px 8px;color:#C9A84C">Valor Venda</th><th style="text-align:left;padding:6px 8px;color:#C9A84C">Valor Líquido</th><th style="text-align:left;padding:6px 8px;color:#C9A84C">Comissão Closer Base (20%)</th></tr>
<tr style="border-bottom:1px solid #243A66"><td style="padding:6px 8px">Partner</td><td style="padding:6px 8px">R$ 10.897,00</td><td style="padding:6px 8px">R$ 9.081,56</td><td style="padding:6px 8px">R$ 1.816,31</td></tr>
<tr style="border-bottom:1px solid #243A66"><td style="padding:6px 8px">Partner PRO</td><td style="padding:6px 8px">R$ 15.897,00</td><td style="padding:6px 8px">R$ 13.248,56</td><td style="padding:6px 8px">R$ 2.649,71</td></tr>
<tr><td style="padding:6px 8px">Enterprise</td><td style="padding:6px 8px">R$ 49.897,00</td><td style="padding:6px 8px">R$ 41.514,30</td><td style="padding:6px 8px">R$ 8.302,86</td></tr>
</table>

<h2>CLÁUSULA DÉCIMA SÉTIMA-A, DO BENEFÍCIO PARTNER PRO E CONDIÇÃO DE PERMANÊNCIA</h2>
<p>17-A.1. O acesso do CONTRATADO ao status de Partner PRO é concedido a título de benfeitoria funcional temporária, diretamente vinculada e subordinada à vigência deste Contrato de Closer.</p>
<p>17-A.2. Encerrado ou rescindido o presente Contrato, por qualquer motivo e por qualquer das partes: I, o acesso gratuito e os benefícios do programa Partner PRO concedidos ao CONTRATADO serão imediatamente cancelados e revogados; II, cessará o direito do CONTRATADO de originar novos negócios sob a alíquota diferenciada de 50% vinculada a este instrumento.</p>
<p>17-A.3. O CONTRATADO poderá continuar utilizando o ecossistema Partner PRO após a rescisão contratual apenas e tão somente se assinar o contrato específico de licença/adesão e efetuar o pagamento do valor de tabela vigente do plano Partner PRO (R$ 15.897,00 ou valor equivalente à época).</p>

<h2>CLÁUSULA DÉCIMA OITAVA, DAS VENDAS PARCELADAS</h2>
<p>Nas operações parceladas, a comissão será paga proporcionalmente ao efetivo recebimento de cada parcela. A inadimplência suspende o pagamento e a eventual regularização posterior reativa o comissionamento no ciclo subsequente.</p>

<h2>CLÁUSULA DÉCIMA NONA, DOS CANCELAMENTOS, DISTRATOS E ESTORNOS</h2>
<p>Não será devida comissão sobre valores cancelados, estornados, devolvidos, perdidos por fraude ou inadimplidos. Caso já tenham sido pagos, a CONTRATANTE promoverá a compensação.</p>

<h2>CLÁUSULA VIGÉSIMA À VIGÉSIMA SEGUNDA, DAS ALTERAÇÕES E APURAÇÃO MENSAL</h2>
<p>20.1. Alterações promovidas pelo cliente (upgrades, downgrades, descontos) recalcularão as comissões a partir da efetivação do evento.</p>
<p>21.1. O cálculo considerará o valor vigendo na data da contratação, sem reajustes retroativos.</p>
<p>22.1. A apuração é mensal e o pagamento ocorrerá até o 5º (quinto) dia útil do mês subsequente.</p>

<h2>PROGRAMA DE PARTICIPAÇÃO EM RECEITAS DE NOVOS PARTNERS (PPRP)</h2>
<h2>CLÁUSULA VIGÉSIMA TERCEIRA À VIGÉSIMA QUINTA, DA NATUREZA E OBJETIVO</h2>
<p>O Programa de Participação em Receita de Novos Partners (PPRP) tem por finalidade conceder ao CONTRATADO um benefício adicional e incentivo meritocrático baseado no desempenho comercial por ele gerado na atração de novos parceiros para a V3 PARTNERS. Possui natureza exclusivamente contratual, empresarial, variável e condicional, não constituindo remuneração fixa, salário ou direito adquirido.</p>

<h2>CLÁUSULA VIGÉSIMA SEXTA E VIGÉSIMA SÉTIMA, DA REGRA DE APURAÇÃO E TABELA DE SOBRE-COMISSÃO (OVER-FEE)</h2>
<p>26.1. A avaliação da produção do CONTRATADO para enquadramento na faixa do PPRP ocorrerá a cada trimestre civil, calculando-se a média mensal do volume total de Vendas Líquidas fechadas por atuações do CONTRATADO como Closer efetivamente recebidas pela CONTRATANTE nos 3 (três) meses anteriores.</p>
<p>27.1. BASE DE CÁLCULO E APLICAÇÃO DO BENEFÍCIO: O percentual conquistado pelo CONTRATADO na tabela abaixo NÃO incidirá sobre as suas vendas diretas, mas incidirá exclusivamente como uma participação sobre a Receita Líquida efetivamente recebida pela V3 PARTNERS decorrente de operações estruturadas/colocadas pelos NOVOS PARTNERS trazidos e integrados ao ecossistema através da atuação comercial do CONTRATADO.</p>
<p>27.2. Tabela de enquadramento trimestral e alíquota sobre a receita dos Novos Partners:</p>
<table style="width:100%;border-collapse:collapse;margin:12px 0">
<tr style="border-bottom:1px solid #243A66"><th style="text-align:left;padding:6px 8px;color:#C9A84C">Faixa</th><th style="text-align:left;padding:6px 8px;color:#C9A84C">Média Mensal Trimestral de Vendas Líquidas do Closer</th><th style="text-align:left;padding:6px 8px;color:#C9A84C">Participação sobre a Receita dos Novos Partners</th></tr>
<tr style="border-bottom:1px solid #243A66"><td style="padding:6px 8px">Faixa Base</td><td style="padding:6px 8px">Até R$ 79.484,99</td><td style="padding:6px 8px">0,0%</td></tr>
<tr style="border-bottom:1px solid #243A66"><td style="padding:6px 8px">Faixa 1</td><td style="padding:6px 8px">R$ 79.485,00 a R$ 158.969,99</td><td style="padding:6px 8px">0,5%</td></tr>
<tr style="border-bottom:1px solid #243A66"><td style="padding:6px 8px">Faixa 2</td><td style="padding:6px 8px">R$ 158.970,00 a R$ 249.484,99</td><td style="padding:6px 8px">1,0%</td></tr>
<tr style="border-bottom:1px solid #243A66"><td style="padding:6px 8px">Faixa 3</td><td style="padding:6px 8px">R$ 249.485,00 a R$ 408.454,99</td><td style="padding:6px 8px">1,5%</td></tr>
<tr><td style="padding:6px 8px">Faixa 4</td><td style="padding:6px 8px">Igual ou Superior a R$ 408.455,00</td><td style="padding:6px 8px">2,0%</td></tr>
</table>
<p>27.3. O percentual da faixa conquistada valerá para os 3 (três) meses subsequentes à apuração. Ao término de cada trimestre civil será realizada nova avaliação, podendo o CONTRATADO subir de faixa, manter-se, descer de faixa ou retornar à Faixa Base.</p>
<p>27.4. Em caso de rescisão ou término deste Contrato por qualquer motivo, cessa imediatamente qualquer direito do CONTRATADO ao recebimento do PPRP, pertencendo todas as receitas futuras dos clientes e novos partners exclusivamente à CONTRATANTE.</p>

<h2>CLÁUSULA TRIGÉSIMA SEGUNDA À TRIGÉSIMA OITAVA, TITULARIDADE, CRM E PROPRIEDADE INTELECTUAL</h2>
<p>33.1. Todos os clientes, partners e leads prospectados ou atendidos constituem patrimônio comercial exclusivo da V3 PARTNERS.</p>
<p>34.1. O CONTRATADO não poderá copiar, exportar ou utilizar dados e leads para benefício próprio ou de terceiros.</p>
<p>37.1. O método comercial, playbooks, scripts, funis e processos pertencem exclusivamente à V3 PARTNERS.</p>
<p>39.1. Ao término do contrato, o CONTRATADO deverá devolver e eliminar todos os ativos físicos, digitais, credenciais e acessos recebidos.</p>

<h2>CLÁUSULA QUADRAGÉSIMA À QUADRAGÉSIMA OITAVA, CONFIDENCIALIDADE E SIGILO</h2>
<p>41.1. O CONTRATADO manterá estrito sigilo sobre todas as informações estratégicas, carteira de clientes, leads, CRM e tabelas da CONTRATANTE pelo período de vigência e por 5 (cinco) anos após o seu término.</p>
<p>47.1. O descumprimento da confidencialidade sujeitará a parte infratora à multa não compensatória no valor de R$ 100.000,00 (cem mil reais) por infração comprovada, sem prejuízo de perdas e danos adicionais.</p>

<h2>CLÁUSULA QUADRAGÉSIMA NONA À QUINQUAGÉSIMA SEXTA, NÃO CONCORRÊNCIA, NÃO ALICIAMENTO E NÃO CIRCUNVENÇÃO</h2>
<p>49.1. Não Concorrência: Durante a vigência e pelo prazo de 24 (vinte e quatro) meses após o término, o CONTRATADO não poderá utilizar as informações estratégicas ou o know-how recebidos para competir diretamente com a V3 PARTNERS.</p>
<p>50.1. Não Aliciamento: Pelo prazo de 24 (vinte e quatro) meses, o CONTRATADO obriga-se a não abordar clientes da V3 PARTNERS para oferecer soluções concorrentes, nem induzir o desligamento de colaboradores, parceiros ou prestadores de serviço da CONTRATANTE.</p>
<p>51.1. Não Circunvenção: O CONTRATADO compromete-se a não contornar ou negociar diretamente com clientes, fundos ou parceiros financeiros apresentados pela V3 PARTNERS durante o contrato e por 24 meses após o término.</p>
<p>55.1. Penalidades: A violação das regras de Não Concorrência, Não Aliciamento ou Não Circunvenção sujeitará o infrator ao pagamento de multa equivalente ao maior valor entre R$ 100.000,00 (cem mil reais) e o prejuízo direto comprovado.</p>

<h2>CLÁUSULA QUINQUAGÉSIMA SÉTIMA, DO PRAZO E RESCISÃO</h2>
<p>57.1. O presente contrato é celebrado por prazo indeterminado.</p>
<p>57.2. Qualquer das partes poderá rescindir o presente instrumento sem justa causa e sem incidência de penalidade contratual, mediante comunicação por escrito com antecedência mínima de 15 (quinze) dias.</p>

<h2>CLÁUSULA QUINQUAGÉSIMA OITAVA, DO FORO</h2>
<p>58.1. Fica eleito o Foro da Comarca da Capital do Estado do Rio de Janeiro/RJ para dirimir quaisquer dúvidas ou litígios decorrentes deste instrumento, com renúncia a qualquer outro, por mais privilegiado que seja.</p>

<p>E, por estarem assim justas e contratadas, as partes assinam o presente contrato na presença de 2 (duas) testemunhas.</p>
<p>Rio de Janeiro/RJ, 11 de agosto de 2026.</p>

<div class="parties"><div class="party"><div class="line"></div><div class="name">Iris Rodrigues da Silva</div><div class="doc">CNPJ 15.133.730/0001-38 · CPF 100.040.226-61</div></div><div class="party"><div class="line"></div><div class="name">V3 Partners Soluções Ltda</div><div class="doc">14.219.287/0001-50</div></div></div>
<div class="footer">
<p>Documento gerado automaticamente pela plataforma V3 Partners em 11/08/2026.</p>
<p>Este documento requer assinatura eletrônica para validade jurídica.</p>
</div>
</body>
</html>$html$
where template_name = 'Contrato de Parceria Comercial, Closer & Partner PRO, Iris Rodrigues da Silva';

update operation_contracts set rendered_html =
$html$<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Contrato de Parceria Comercial para Prospecção, Desenvolvimento de Negócios e Intermediação Comercial (Closer & Partner PRO) · V3 Partners</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
body{font-family:'DM Sans',sans-serif;background:#09081A;color:#9BAFC5;padding:40px 60px;line-height:1.8;font-size:13px}
h1{font-size:20px;font-weight:700;color:#C9A84C;text-align:center;margin-bottom:8px}
h2{font-size:14px;font-weight:700;color:#C9A84C;margin:24px 0 8px;text-transform:uppercase;letter-spacing:.5px}
.header{text-align:center;margin-bottom:32px;padding-bottom:16px;border-bottom:2px solid #C9A84C}
.header img{height:40px;margin-bottom:8px}
.header p{font-size:11px;color:#9BAFC5}
p{margin-bottom:12px}
.parties{display:flex;flex-wrap:wrap;justify-content:center;gap:40px;margin-top:48px;padding-top:24px;border-top:1px solid #243A66}
.party{flex:1 1 200px;max-width:220px;text-align:center}
.party .line{width:200px;border-top:1px solid #9BAFC5;margin:40px auto 8px}
.party .name{font-weight:700;color:#F5F1E8;font-size:12px}
.party .doc{font-size:10px;color:#9BAFC5}
.footer{text-align:center;margin-top:48px;font-size:10px;color:#9BAFC5}
@media print{@page{size:A4;margin:13mm 14mm}body{background:#09081A!important;-webkit-print-color-adjust:exact!important}.header img{height:15mm!important}}
</style>
</head>
<body>
<div class="header">
<img src="https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png" alt="V3 Partners">
<h1>Contrato de Parceria Comercial para Prospecção, Desenvolvimento de Negócios e Intermediação Comercial (Closer & Partner PRO)</h1>
<p>V3 Partners Soluções Ltda, CNPJ 14.219.287/0001-50</p>
</div>
<h2>CLÁUSULA PRIMEIRA, DAS PARTES</h2>
<p><strong>CONTRATANTE:</strong></p>
<p>V3 PARTNERS SOLUÇÕES LTDA., sociedade empresária limitada, sediada na Rua Visconde de Pirajá, nº 414, Sala 718, Ipanema, Rio de Janeiro/RJ, CEP 22.410-002, registrada na JUCERJA sob o NIRE nº 33.2.0898614-3 e inscrita no CNPJ/MF sob o nº 14.219.287/0001-50, neste ato representada por seu sócio administrador, JOÃO LEMOS NETTO, brasileiro, divorciado, empresário, portador da Carteira de Identidade nº 11734474-7 IFP/RJ e inscrito no CPF/MF sob o nº 078.678.257-97, residente e domiciliado na Rua Desembargador Oscar Tenório, nº 95, Ap. 102, Recreio dos Bandeirantes, Rio de Janeiro/RJ, CEP 22.975-110, e-mail: joao.lemos@v3partners.com.br, telefone: +55 (21) 98993-7178, doravante denominada simplesmente V3 PARTNERS ou CONTRATANTE.</p>
<p><strong>CONTRATADO:</strong></p>
<p>IRIS RODRIGUES DA SILVA 10004022661, Pessoa jurídica inscrita no CNPJ/MF sob o nº 15.133.730/0001-38, sediada na Rua José Cidio Maia, nº 415, Bairro Ponte Alta, Delfinópolis/MG, CEP 37910-000, neste ato representada por seu sócio, IRIS RODRIGUES DA SILVA, brasileiro, autônomo, nascido em Passos/MG em 01/10/1990, portador da Carteira de Identidade nº MG-16.624.342 e inscrito no CPF/MF sob o nº 100.040.226-61, residente e domiciliado na Rua José Cidio Maia, nº 355, Bairro Ponte Alta, Delfinópolis/MG, CEP 37910-000, telefone: +55 (11) 97477-7060, e-mail: iriswickman@hotmail.com, doravante denominado simplesmente PARCEIRO COMERCIAL ou CONTRATADO.</p>

<h2>CLÁUSULA SEGUNDA, DAS DEFINIÇÕES</h2>
<p>Para efeitos deste Contrato, os termos abaixo possuirão os seguintes significados:</p>
<p><strong>Cliente Elegível:</strong> Pessoa física ou jurídica captada pelo CONTRATADO e aceita pela V3 PARTNERS para iniciar relacionamento comercial.</p>
<p><strong>Cliente Ativo:</strong> Cliente que possua contrato vigente com a V3 PARTNERS, adimplente e gerando receitas efetivamente recebidas pela empresa.</p>
<p><strong>Novo Partner Elegível:</strong> Todo novo parceiro comercial (Partner, Partner PRO ou Enterprise) que aderir ao ecossistema da V3 PARTNERS como resultado da conversão e atendimento comercial realizados pelo CONTRATADO.</p>
<p><strong>Venda Elegível:</strong> Venda regularmente aprovada pela V3 PARTNERS, formalizada contratualmente e cujo pagamento tenha sido efetivamente recebido.</p>
<p><strong>Venda Líquida / Receita Líquida:</strong> Valor efetivamente recebido pela V3 PARTNERS após a dedução de: tributos; taxas financeiras; taxas de cartão; custos operacionais incidentes; cancelamentos; devoluções; chargebacks; descontos financeiros; inadimplência; e quaisquer valores não incorporados definitivamente ao caixa da empresa.</p>
<p><strong>Atuação como Closer:</strong> Atividade comercial exercida pelo CONTRATADO para a conversão e fechamento de vendas junto a leads fornecidos e gerados pela V3 PARTNERS.</p>
<p><strong>Atuação como Partner PRO:</strong> Atividade de originação própria efetuada pelo CONTRATADO através do ecossistema e ferramentas da V3 PARTNERS.</p>
<p><strong>Programa de Participação em Receitas de Novos Partners (PPRP):</strong> Sistema meritocrático de incentivo baseado nas vendas líquidas acumuladas do CONTRATADO como Closer, que confere uma porcentagem de participação (Over-Commission) sobre a receita líquida gerada pelas operações dos Novos Partners por ele integrados à plataforma.</p>
<p><strong>Leads:</strong> Toda oportunidade comercial cadastrada em qualquer sistema utilizado pela V3 PARTNERS.</p>
<p><strong>CRM:</strong> Qualquer sistema de gestão de relacionamento com clientes utilizado pela V3 PARTNERS.</p>
<p><strong>Know-how:</strong> Todo conhecimento técnico, comercial, estratégico, operacional, metodológico, tecnológico ou financeiro desenvolvido ou utilizado pela V3 PARTNERS.</p>

<h2>CLÁUSULA TERCEIRA, DO OBJETO</h2>
<p>3.1. O presente Contrato tem por objeto a prestação de serviços especializados de prospecção comercial, geração de oportunidades, qualificação de leads, negociação, fechamento de contratos (Closer) e acompanhamento de oportunidades para a V3 PARTNERS.</p>
<p>3.2. Parágrafo Primeiro. O CONTRATADO exercerá suas atividades com total autonomia técnica, administrativa e financeira, inexistindo qualquer subordinação jurídica característica das relações de emprego.</p>
<p>3.3. Parágrafo Segundo. O presente instrumento possui natureza exclusivamente civil e empresarial, não gerando vínculo empregatício, associação, sociedade, representação comercial exclusiva ou qualquer outra relação diversa da expressamente prevista neste Contrato.</p>
<p>3.4. Parágrafo Terceiro. O CONTRATADO poderá prestar serviços a terceiros, desde que tal atuação: (I) não gere conflito de interesses; (II) não utilize informações estratégicas da V3 PARTNERS; (III) não viole a cláusula de não concorrência prevista neste Contrato; e (IV) não prejudique a execução dos serviços contratados.</p>
<p>3.5. Parágrafo Quarto. Como benefício funcional condicional e temporário atrelado à prestação dos serviços de Closer, a CONTRATANTE concederá ao CONTRATADO o acesso gratuito e licença ao status de Partner PRO, permitindo-lhe realizar originação própria de negócios sob as regras fixadas na Cláusula Décima Sétima-A.</p>

<h2>CLÁUSULA QUARTA, DOS PRINCÍPIOS DA PARCERIA</h2>
<p>A relação entre as Partes será regida pelos princípios da boa-fé objetiva, transparência, cooperação, ética profissional, confidencialidade, lealdade comercial, livre iniciativa, meritocracia e autonomia empresarial. As Partes comprometem-se a atuar visando o desenvolvimento sustentável da operação comercial, preservando a reputação, a imagem e os interesses econômicos da V3 PARTNERS.</p>

<h2>CLÁUSULA QUINTA, DAS OBRIGAÇÕES DA CONTRATANTE</h2>
<p>Constituem obrigações da CONTRATANTE:</p>
<p>5.1. Disponibilizar ao CONTRATADO as informações comerciais, treinamentos, materiais institucionais, apresentações, políticas internas, tabelas comerciais e demais documentos necessários para a execução das atividades contratadas.</p>
<p>5.2. Disponibilizar acesso às ferramentas que entender necessárias para o desempenho das atividades (CRM, plataforma comercial, e-mail corporativo, sistemas internos), podendo restringir, ampliar ou cancelar tais acessos na forma prevista neste contrato.</p>
<p>5.3. Apurar as comissões e adicionais de performance de forma objetiva, conforme as regras previstas neste Contrato.</p>
<p>5.4. Efetuar o crédito das remunerações/premiações devidas ao CONTRATADO, desde que observadas as condições deste contrato e o efetivo recebimento das receitas que originaram a remuneração.</p>
<p>5.5. Definir políticas comerciais, campanhas, preços, descontos, processos, produtos e estratégias comerciais, podendo alterá-los unilateralmente, desde que não afetem direitos já adquiridos.</p>

<h2>CLÁUSULA SEXTA, DAS OBRIGAÇÕES DO CONTRATADO</h2>
<p>O CONTRATADO compromete-se a:</p>
<p>Desempenhar suas atividades com diligência, profissionalismo, ética e boa-fé; observar integralmente as políticas comerciais da V3 PARTNERS; preservar a imagem, reputação e credibilidade da CONTRATANTE; utilizar exclusivamente os materiais, apresentações e documentos aprovados pela CONTRATANTE; manter atualizados todos os registros de clientes, negociações e oportunidades no CRM indicado pela CONTRATANTE; fornecer informações verdadeiras, completas e atualizadas durante todas as etapas da negociação; comunicar imediatamente qualquer fato que possa comprometer a negociação ou a relação com clientes e parceiros; fornecer os dados necessários para o correto cadastramento e recebimento dos valores no cartão de premiação BluePay; manter regularidade fiscal, tributária e cadastral durante toda a vigência deste Contrato.</p>

<h2>CLÁUSULA SÉTIMA, DOS PADRÕES DE CONDUTA COMERCIAL</h2>
<p>O CONTRATADO deverá observar os mais elevados padrões de ética profissional. É expressamente vedado ao CONTRATADO: prometer benefícios, descontos ou condições comerciais sem autorização formal da CONTRATANTE; alterar contratos, propostas, formulários ou documentos oficiais; prestar informações falsas ou incompletas aos clientes; praticar atos que possam induzir clientes a erro; receber valores diretamente de clientes, salvo autorização expressa e por escrito da CONTRATANTE; oferecer produtos, serviços ou soluções concorrentes utilizando informações obtidas nesta parceria; praticar qualquer ato que possa prejudicar a reputação da CONTRATANTE ou de seus parceiros.</p>

<h2>CLÁUSULA OITAVA, DO USO DO CRM E FERRAMENTAS DA EMPRESA</h2>
<p>Todos os leads, cadastros, registros de atendimento, propostas, históricos e informações inseridas nos sistemas constituem patrimônio exclusivo da V3 PARTNERS. O CONTRATADO reconhece que não possui qualquer direito de propriedade sobre tais dados, não podendo copiá-los ou exportá-los sem autorização prévia e devendo eliminá-los ao término da relação contratual.</p>

<h2>CLÁUSULA NONA, DA COMUNICAÇÃO ENTRE AS PARTES</h2>
<p>Toda comunicação relevante deverá ocorrer por meios oficiais definidos pela CONTRATANTE (e-mail corporativo, plataforma interna, CRM e aplicativos de comunicação autorizados).</p>

<h2>CLÁUSULA DÉCIMA, DA FORMA DE PAGAMENTO, CARTÃO BLUEPAY E DESCONTO DE TRIBUTOS</h2>
<p>10.1. A liquidação de todas as comissões, remunerações e premiações apuradas em favor do CONTRATADO será realizada obrigatoriamente mediante crédito de saldo em Cartão de Premiação/Benefício mantido na plataforma BluePay, emitido em nome do representante ou indicado do CONTRATADO.</p>
<p>10.2. DESCONTO DE IMPOSTOS: Sobre o valor bruto das comissões e premiações apuradas no período, incidirá um desconto fixo de 6% (seis por cento), correspondente ao ressarcimento e retenção dos impostos e encargos tributários incidentes na operação de faturamento e transferência.</p>
<p>10.3. O pagamento líquido apurado (após a dedução do percentual tributário da cláusula 10.2) será creditado no cartão BluePay do CONTRATADO mensalmente, até o 5º (quinto) dia útil do mês subsequente ao do efetivo recebimento dos recursos pela CONTRATANTE.</p>

<h2>CLÁUSULA DÉCIMA PRIMEIRA, DA INTEGRIDADE E COMPLIANCE</h2>
<p>O CONTRATADO compromete-se a cumprir a legislação vigente e não praticar atos de fraude, corrupção, lavagem de dinheiro ou conflito de interesses. Havendo indícios de irregularidade, a CONTRATANTE poderá suspender pagamentos, solicitar documentos e rescindir o contrato por justa causa.</p>

<h2>CLÁUSULA DÉCIMA SEGUNDA, DA CONTESTAÇÃO DAS COMISSÕES</h2>
<p>A CONTRATANTE disponibilizará mensalmente relatório com o demonstrativo das comissões. O CONTRATADO terá o prazo de 30 (trinta) dias corridos para apresentar contestação fundamentada, sob pena de quitação integral das informações.</p>

<h2>CLÁUSULA DÉCIMA TERCEIRA, DA AUDITORIA E REVISÃO DAS COMISSÕES</h2>
<p>A CONTRATANTE poderá auditar e recalcular comissões pagas indevidamente por erro, cancelamento, inadimplência ou fraude, podendo compensar em pagamentos futuros ou solicitar a restituição no prazo de 15 (quinze) dias.</p>

<h2>CLÁUSULA DÉCIMA QUARTA, DA REMUNERAÇÃO E DUPLA MODALIDADE</h2>
<p>14.1. O CONTRATADO atuará sob o regime estrito de risco comercial, inexistindo qualquer pagamento de valor fixo, ajuda de custo ou garantia mínima por parte da CONTRATANTE.</p>
<p>14.2. A remuneração do CONTRATADO será exclusivamente variável e dependerá do papel desempenhado na operação:</p>
<p>I, Atuação como Closer (Leads da CONTRATANTE): Nas vendas realizadas a partir de leads fornecidos pela V3 PARTNERS, o CONTRATADO fará jus à comissão base de 20% (vinte por cento) da Venda Líquida / Receita Líquida efetivamente recebida, deduzido o percentual de impostos previsto na Cláusula 10.2, podendo acumular a participação na receita de novos partners prevista no Programa de Performance (Cláusula 27ª).</p>
<p>II, Atuação como Partner PRO (Originação Própria): Nas operações originadas exclusivamente pelo próprio CONTRATADO e por ele conduzidas dentro do ecossistema, o CONTRATADO fará jus ao comissionamento fixo de 50% (cinquenta por cento) sobre a Venda Líquida / Receita Líquida efetivamente recebida pela CONTRATANTE, igualmente sujeito ao desconto da Cláusula 10.2.</p>
<p>14.3. O pagamento será efetuado exclusivamente no cartão BluePay, cabendo ao CONTRATADO integral responsabilidade pela remuneração de seus colaboradores ou terceiros eventualmente envolvidos.</p>

<h2>CLÁUSULA DÉCIMA QUARTA-A, DA SUBCONTRATAÇÃO, EQUIPE E QUARTEIRIZAÇÃO</h2>
<p>14-A.1. O CONTRATADO assume total e exclusiva responsabilidade pela seleção, contratação, gestão, direção, treinamento e remuneração de qualquer profissional, colaborador, prestador de serviço, SDR (Sales Development Representative), Closer ou agente comercial que venha a integrar a sua equipe para a execução do objeto deste Contrato.</p>
<p>14-A.2. A CONTRATANTE (V3 PARTNERS) não possui qualquer relação jurídica, vínculo empregatício, societário ou responsabilidade direta, solidária ou subsidiária perante quaisquer terceiros integrados à equipe do CONTRATADO, cabendo a este arcar com 100% (cem por cento) de todos os custos trabalhistas, previdenciários, tributários e cíveis de seu time.</p>
<p>14-A.3. APROVAÇÃO PRÉVIA E ANUÊNCIA DOS SÓCIOS: A inclusão ou contratação de qualquer novo integrante, SDR, Closer ou parceiro na equipe do CONTRATADO dependerá, obrigatoriamente e sob pena de rescisão imediata por justa causa, de: I, comunicação prévia e formal à CONTRATANTE; II, anuência e autorização expressa, por escrito, de pelo menos um dos SÓCIOS ADMINISTRADORES da V3 PARTNERS.</p>
<p>14-A.4. ESPELHAMENTO CONTRATUAL E ASSINATURA DE TERMO DE ADESÃO/SIGILO: Todos os contratos celebrados pelo CONTRATADO com os membros de sua equipe (SDRs, Closers ou assistentes) deverão, obrigatoriamente: I, estar rigorosamente alinhados e subordinados às regras, limites e obrigações do presente Contrato; II, exigir a assinatura individual de Termo de Confidencialidade (NDA), Propriedade Intelectual, Proteção de Dados (LGPD) e Não Circunvenção em favor da V3 PARTNERS, cujo modelo deverá ser previamente aprovado pela CONTRATANTE antes da liberação de qualquer acesso a sistemas ou CRM.</p>
<p>14-A.5. RESPONSABILIDADE CIVIL E REGRESSIVA: O CONTRATADO responde de forma direta, integral e irrestrita por todos os atos, omissões, fraudes, vazamento de dados, falhas de conduta ou infrações contratuais praticados por qualquer membro integrante de sua equipe, obrigando-se a ressarcir e indenizar a V3 PARTNERS por quaisquer prejuízos, autuações ou condenações sofridas, incluindo honorários advocatícios e custas processuais.</p>

<h2>CLÁUSULA DÉCIMA QUINTA, DO FATO GERADOR DA COMISSÃO</h2>
<p>15.1. O direito à comissão somente nascerá quando ocorrerem, cumulativamente: (I) assinatura válida do contrato pelo cliente; (II) aprovação interna da operação; (III) efetivo pagamento pelo cliente; e (IV) efetivo recebimento do respectivo valor pela CONTRATANTE.</p>
<p>15.2. A simples proposta, cadastro, aprovação de crédito ou minuta contratual não gera direito à comissão.</p>

<h2>CLÁUSULA DÉCIMA SEXTA, DO VALOR LÍQUIDO</h2>
<p>Considera-se Valor Líquido o montante efetivamente recebido pela CONTRATANTE após a dedução de tributos, tarifas bancárias, taxas de cartão, custos financeiros, descontos comerciais, cancelamentos, devoluções, estornos, chargebacks e inadimplência.</p>

<h2>CLÁUSULA DÉCIMA SÉTIMA, DOS PLANOS COMERCIAIS DA PLATAFORMA</h2>
<p>Para fins de referência das operações comercializadas na data de assinatura deste contrato, os valores de tabela são:</p>
<table style="width:100%;border-collapse:collapse;margin:12px 0">
<tr style="border-bottom:1px solid #243A66"><th style="text-align:left;padding:6px 8px;color:#C9A84C">Plano</th><th style="text-align:left;padding:6px 8px;color:#C9A84C">Valor Venda</th><th style="text-align:left;padding:6px 8px;color:#C9A84C">Valor Líquido</th><th style="text-align:left;padding:6px 8px;color:#C9A84C">Comissão Closer Base (20%)</th></tr>
<tr style="border-bottom:1px solid #243A66"><td style="padding:6px 8px">Partner</td><td style="padding:6px 8px">R$ 10.897,00</td><td style="padding:6px 8px">R$ 9.081,56</td><td style="padding:6px 8px">R$ 1.816,31</td></tr>
<tr style="border-bottom:1px solid #243A66"><td style="padding:6px 8px">Partner PRO</td><td style="padding:6px 8px">R$ 15.897,00</td><td style="padding:6px 8px">R$ 13.248,56</td><td style="padding:6px 8px">R$ 2.649,71</td></tr>
<tr><td style="padding:6px 8px">Enterprise</td><td style="padding:6px 8px">R$ 49.897,00</td><td style="padding:6px 8px">R$ 41.514,30</td><td style="padding:6px 8px">R$ 8.302,86</td></tr>
</table>

<h2>CLÁUSULA DÉCIMA SÉTIMA-A, DO BENEFÍCIO PARTNER PRO E CONDIÇÃO DE PERMANÊNCIA</h2>
<p>17-A.1. O acesso do CONTRATADO ao status de Partner PRO é concedido a título de benfeitoria funcional temporária, diretamente vinculada e subordinada à vigência deste Contrato de Closer.</p>
<p>17-A.2. Encerrado ou rescindido o presente Contrato, por qualquer motivo e por qualquer das partes: I, o acesso gratuito e os benefícios do programa Partner PRO concedidos ao CONTRATADO serão imediatamente cancelados e revogados; II, cessará o direito do CONTRATADO de originar novos negócios sob a alíquota diferenciada de 50% vinculada a este instrumento.</p>
<p>17-A.3. O CONTRATADO poderá continuar utilizando o ecossistema Partner PRO após a rescisão contratual apenas e tão somente se assinar o contrato específico de licença/adesão e efetuar o pagamento do valor de tabela vigente do plano Partner PRO (R$ 15.897,00 ou valor equivalente à época).</p>

<h2>CLÁUSULA DÉCIMA OITAVA, DAS VENDAS PARCELADAS</h2>
<p>Nas operações parceladas, a comissão será paga proporcionalmente ao efetivo recebimento de cada parcela. A inadimplência suspende o pagamento e a eventual regularização posterior reativa o comissionamento no ciclo subsequente.</p>

<h2>CLÁUSULA DÉCIMA NONA, DOS CANCELAMENTOS, DISTRATOS E ESTORNOS</h2>
<p>Não será devida comissão sobre valores cancelados, estornados, devolvidos, perdidos por fraude ou inadimplidos. Caso já tenham sido pagos, a CONTRATANTE promoverá a compensação.</p>

<h2>CLÁUSULA VIGÉSIMA À VIGÉSIMA SEGUNDA, DAS ALTERAÇÕES E APURAÇÃO MENSAL</h2>
<p>20.1. Alterações promovidas pelo cliente (upgrades, downgrades, descontos) recalcularão as comissões a partir da efetivação do evento.</p>
<p>21.1. O cálculo considerará o valor vigendo na data da contratação, sem reajustes retroativos.</p>
<p>22.1. A apuração é mensal e o pagamento ocorrerá até o 5º (quinto) dia útil do mês subsequente.</p>

<h2>PROGRAMA DE PARTICIPAÇÃO EM RECEITAS DE NOVOS PARTNERS (PPRP)</h2>
<h2>CLÁUSULA VIGÉSIMA TERCEIRA À VIGÉSIMA QUINTA, DA NATUREZA E OBJETIVO</h2>
<p>O Programa de Participação em Receita de Novos Partners (PPRP) tem por finalidade conceder ao CONTRATADO um benefício adicional e incentivo meritocrático baseado no desempenho comercial por ele gerado na atração de novos parceiros para a V3 PARTNERS. Possui natureza exclusivamente contratual, empresarial, variável e condicional, não constituindo remuneração fixa, salário ou direito adquirido.</p>

<h2>CLÁUSULA VIGÉSIMA SEXTA E VIGÉSIMA SÉTIMA, DA REGRA DE APURAÇÃO E TABELA DE SOBRE-COMISSÃO (OVER-FEE)</h2>
<p>26.1. A avaliação da produção do CONTRATADO para enquadramento na faixa do PPRP ocorrerá a cada trimestre civil, calculando-se a média mensal do volume total de Vendas Líquidas fechadas por atuações do CONTRATADO como Closer efetivamente recebidas pela CONTRATANTE nos 3 (três) meses anteriores.</p>
<p>27.1. BASE DE CÁLCULO E APLICAÇÃO DO BENEFÍCIO: O percentual conquistado pelo CONTRATADO na tabela abaixo NÃO incidirá sobre as suas vendas diretas, mas incidirá exclusivamente como uma participação sobre a Receita Líquida efetivamente recebida pela V3 PARTNERS decorrente de operações estruturadas/colocadas pelos NOVOS PARTNERS trazidos e integrados ao ecossistema através da atuação comercial do CONTRATADO.</p>
<p>27.2. Tabela de enquadramento trimestral e alíquota sobre a receita dos Novos Partners:</p>
<table style="width:100%;border-collapse:collapse;margin:12px 0">
<tr style="border-bottom:1px solid #243A66"><th style="text-align:left;padding:6px 8px;color:#C9A84C">Faixa</th><th style="text-align:left;padding:6px 8px;color:#C9A84C">Média Mensal Trimestral de Vendas Líquidas do Closer</th><th style="text-align:left;padding:6px 8px;color:#C9A84C">Participação sobre a Receita dos Novos Partners</th></tr>
<tr style="border-bottom:1px solid #243A66"><td style="padding:6px 8px">Faixa Base</td><td style="padding:6px 8px">Até R$ 79.484,99</td><td style="padding:6px 8px">0,0%</td></tr>
<tr style="border-bottom:1px solid #243A66"><td style="padding:6px 8px">Faixa 1</td><td style="padding:6px 8px">R$ 79.485,00 a R$ 158.969,99</td><td style="padding:6px 8px">0,5%</td></tr>
<tr style="border-bottom:1px solid #243A66"><td style="padding:6px 8px">Faixa 2</td><td style="padding:6px 8px">R$ 158.970,00 a R$ 249.484,99</td><td style="padding:6px 8px">1,0%</td></tr>
<tr style="border-bottom:1px solid #243A66"><td style="padding:6px 8px">Faixa 3</td><td style="padding:6px 8px">R$ 249.485,00 a R$ 408.454,99</td><td style="padding:6px 8px">1,5%</td></tr>
<tr><td style="padding:6px 8px">Faixa 4</td><td style="padding:6px 8px">Igual ou Superior a R$ 408.455,00</td><td style="padding:6px 8px">2,0%</td></tr>
</table>
<p>27.3. O percentual da faixa conquistada valerá para os 3 (três) meses subsequentes à apuração. Ao término de cada trimestre civil será realizada nova avaliação, podendo o CONTRATADO subir de faixa, manter-se, descer de faixa ou retornar à Faixa Base.</p>
<p>27.4. Em caso de rescisão ou término deste Contrato por qualquer motivo, cessa imediatamente qualquer direito do CONTRATADO ao recebimento do PPRP, pertencendo todas as receitas futuras dos clientes e novos partners exclusivamente à CONTRATANTE.</p>

<h2>CLÁUSULA TRIGÉSIMA SEGUNDA À TRIGÉSIMA OITAVA, TITULARIDADE, CRM E PROPRIEDADE INTELECTUAL</h2>
<p>33.1. Todos os clientes, partners e leads prospectados ou atendidos constituem patrimônio comercial exclusivo da V3 PARTNERS.</p>
<p>34.1. O CONTRATADO não poderá copiar, exportar ou utilizar dados e leads para benefício próprio ou de terceiros.</p>
<p>37.1. O método comercial, playbooks, scripts, funis e processos pertencem exclusivamente à V3 PARTNERS.</p>
<p>39.1. Ao término do contrato, o CONTRATADO deverá devolver e eliminar todos os ativos físicos, digitais, credenciais e acessos recebidos.</p>

<h2>CLÁUSULA QUADRAGÉSIMA À QUADRAGÉSIMA OITAVA, CONFIDENCIALIDADE E SIGILO</h2>
<p>41.1. O CONTRATADO manterá estrito sigilo sobre todas as informações estratégicas, carteira de clientes, leads, CRM e tabelas da CONTRATANTE pelo período de vigência e por 5 (cinco) anos após o seu término.</p>
<p>47.1. O descumprimento da confidencialidade sujeitará a parte infratora à multa não compensatória no valor de R$ 100.000,00 (cem mil reais) por infração comprovada, sem prejuízo de perdas e danos adicionais.</p>

<h2>CLÁUSULA QUADRAGÉSIMA NONA À QUINQUAGÉSIMA SEXTA, NÃO CONCORRÊNCIA, NÃO ALICIAMENTO E NÃO CIRCUNVENÇÃO</h2>
<p>49.1. Não Concorrência: Durante a vigência e pelo prazo de 24 (vinte e quatro) meses após o término, o CONTRATADO não poderá utilizar as informações estratégicas ou o know-how recebidos para competir diretamente com a V3 PARTNERS.</p>
<p>50.1. Não Aliciamento: Pelo prazo de 24 (vinte e quatro) meses, o CONTRATADO obriga-se a não abordar clientes da V3 PARTNERS para oferecer soluções concorrentes, nem induzir o desligamento de colaboradores, parceiros ou prestadores de serviço da CONTRATANTE.</p>
<p>51.1. Não Circunvenção: O CONTRATADO compromete-se a não contornar ou negociar diretamente com clientes, fundos ou parceiros financeiros apresentados pela V3 PARTNERS durante o contrato e por 24 meses após o término.</p>
<p>55.1. Penalidades: A violação das regras de Não Concorrência, Não Aliciamento ou Não Circunvenção sujeitará o infrator ao pagamento de multa equivalente ao maior valor entre R$ 100.000,00 (cem mil reais) e o prejuízo direto comprovado.</p>

<h2>CLÁUSULA QUINQUAGÉSIMA SÉTIMA, DO PRAZO E RESCISÃO</h2>
<p>57.1. O presente contrato é celebrado por prazo indeterminado.</p>
<p>57.2. Qualquer das partes poderá rescindir o presente instrumento sem justa causa e sem incidência de penalidade contratual, mediante comunicação por escrito com antecedência mínima de 15 (quinze) dias.</p>

<h2>CLÁUSULA QUINQUAGÉSIMA OITAVA, DO FORO</h2>
<p>58.1. Fica eleito o Foro da Comarca da Capital do Estado do Rio de Janeiro/RJ para dirimir quaisquer dúvidas ou litígios decorrentes deste instrumento, com renúncia a qualquer outro, por mais privilegiado que seja.</p>

<p>E, por estarem assim justas e contratadas, as partes assinam o presente contrato na presença de 2 (duas) testemunhas.</p>
<p>Rio de Janeiro/RJ, 11 de agosto de 2026.</p>

<div class="parties"><div class="party"><div class="line"></div><div class="name">Iris Rodrigues da Silva</div><div class="doc">CNPJ 15.133.730/0001-38 · CPF 100.040.226-61</div></div><div class="party"><div class="line"></div><div class="name">V3 Partners Soluções Ltda</div><div class="doc">14.219.287/0001-50</div></div></div>
<div class="footer">
<p>Documento gerado automaticamente pela plataforma V3 Partners em 11/08/2026.</p>
<p>Este documento requer assinatura eletrônica para validade jurídica.</p>
</div>
</body>
</html>$html$
where contract_code = 'V3C-PAR-2026-0037';

select contract_code, rendered_html like '%Intermedia%o de Neg%cios%' as sem_acento_check,
  position('Intermedia' in rendered_html) as pos
from operation_contracts where contract_code in ('V3C-PAR-2026-0037','V3C-PAR-2026-0038');
