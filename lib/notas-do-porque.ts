/**
 * Notas do porquê (regra de João, 10/10/2026): todo campo, consulta, revelação ou aceite que
 * toca dado pessoal traz uma nota curta dizendo por que é pedido, o que se faz com ele, quem vê,
 * por quanto tempo fica e o que acontece se não for informado. Textos aprovados por João em
 * 10/10/2026. Os que tocam dado pessoal aguardam revisão do Robson (VALIDAR COM ROBSON).
 * Sem travessão. Os números são os que o sistema aplica hoje.
 */
export type Nota = { titulo: string; texto: string };

export const NOTAS_DO_PORQUE = {
  // A. Formulário público de qualificação
  doc_cpf_cnpj: {
    titulo: "CPF ou CNPJ",
    texto: "Pedimos o seu CPF (ou o CNPJ da empresa) para ter certeza de quem está assinando e para montar o contrato. Só a equipe autorizada da V3 vê, e o número fica escondido na tela até alguém clicar para ver, com o registro de quem viu. Sem ele não conseguimos montar o contrato.",
  },
  doc_identidade_envio: {
    titulo: "Documento de identidade",
    texto: "Pedimos o documento para confirmar a sua identidade ou os poderes de quem assina pela empresa. O arquivo fica em ambiente restrito, só abre com o clique de quem tem autorização, e cada abertura fica registrada. Guardamos por 36 meses depois do fim da operação.",
  },
  repasse: {
    titulo: "Dados para repasse",
    texto: "Só preencha se você for receber um repasse. Usamos apenas para pagar o valor combinado. A equipe vê esses dados escondidos, e só abrem com clique e registro.",
  },
  aceite_aviso: {
    titulo: "Aviso de Privacidade",
    texto: "É o seu consentimento para tratarmos os seus dados nesta operação. O texto completo está logo abaixo. Você pode pedir acesso, correção ou exclusão pelo e-mail privacidade@v3partners.com.br. Sem o aceite não conseguimos continuar a qualificação.",
  },
  aceite_kyc: {
    titulo: "Análise de KYC",
    texto: "Nas operações de intermediação e de fusões e aquisições, quem decide pela parte passa por uma checagem de cadastro, processos judiciais e crédito antes do contrato. É uma conferência de segurança para os dois lados. O resultado não é compartilhado com as outras partes.",
  },
  representante: {
    titulo: "Representante da empresa",
    texto: "Pedimos os dados de quem assina pela empresa porque é essa pessoa que assume o compromisso. Ela precisa ser a pessoa indicada no contrato social ou na procuração. Os dados ficam protegidos do mesmo jeito dos demais.",
  },
  // B. Ficha de qualificação (equipe V3)
  revelar_dado: {
    titulo: "Revelar dado",
    texto: "Mostra o dado completo. Cada revelação fica registrada com o seu nome, o campo e a hora, e esse registro é guardado por 36 meses. Use só quando precisar para o seu trabalho.",
  },
  abrir_documento: {
    titulo: "Abrir documento",
    texto: "O documento abre por um link que vale 60 segundos. A abertura fica registrada antes de o arquivo aparecer. Se o registro falhar, o arquivo não abre.",
  },
  // C. Aba Due Diligence
  consultas: {
    titulo: "Consultas",
    texto: "Cada consulta fica registrada em seu nome, e algumas têm custo. Antes de gastar, o sistema confere o documento e avisa se a mesma pessoa foi consultada há menos de 60 dias, para não pagar duas vezes.",
  },
  consulta_recente: {
    titulo: "Consulta recente",
    texto: "Esta consulta já foi feita há pouco tempo. Reaproveitar o resultado evita custo e retrabalho. Se mesmo assim precisar refazer, escreva o motivo: ele fica registrado.",
  },
  selo_nao_consultado: {
    titulo: "Não consultado",
    texto: "A fonte não respondeu. Isso não quer dizer que está tudo bem: quer dizer que a checagem não aconteceu e precisa ser refeita.",
  },
  selo_sem_dados: {
    titulo: "Sem dados",
    texto: "A fonte não tem informação sobre este documento. Não é o mesmo que não ter problema: apenas não há registro para mostrar.",
  },
  pf_bloqueada: {
    titulo: "Pessoa física",
    texto: "A consulta de pessoa física só é feita para quem decide na operação (cedente ou mandatário) e depois que a pessoa aceitou o Aviso de Privacidade que explica essa análise. Isso protege a pessoa e a V3.",
  },
  scr: {
    titulo: "SCR",
    texto: "O SCR é o sistema de informações de crédito do Banco Central. Mostra dívidas vencidas, prejuízos e limites. É dado financeiro e só é consultado para quem decide na operação.",
  },
  scr_detalhe: {
    titulo: "Detalhe do SCR",
    texto: "O detalhe é dado financeiro da pessoa. Só abre com clique, a abertura fica registrada com quem abriu e quando, e há um limite de 30 aberturas em 10 minutos.",
  },
  gerar_relatorio: {
    titulo: "Gerar relatório",
    texto: "Reúne o resultado mais recente de cada consulta em um PDF com o número do NCNDA de origem. Fica guardado na pasta de compliance por 12 meses e depois é apagado automaticamente.",
  },
  abrir_relatorio: {
    titulo: "Abrir relatório",
    texto: "O relatório tem o documento completo da parte. Abrir fica registrado, o link vale 60 segundos, e quem abre mais de 10 relatórios em um dia aparece no monitoramento.",
  },
  pasta_compliance: {
    titulo: "Pasta de compliance",
    texto: "O nome da pasta usa só o número do NCNDA e um código curto da parte, nunca CPF, CNPJ ou nome. Assim ninguém descobre quem é a pessoa só olhando o nome da pasta.",
  },
  acessos_relatorios: {
    titulo: "Acessos aos relatórios",
    texto: "Mostra quem abriu cada relatório, para detectar uso indevido. O IP aparece com o final escondido, e o registro é guardado por 36 meses.",
  },
  // D. Outros pontos
  agendamento_auto: {
    titulo: "Agendamento automático",
    texto: "Ligado: o convite de reunião vai direto para a outra parte, sem passar pelo analista. Desligado: o analista agenda manualmente. Só o ADMIN altera, e cada mudança fica registrada com quem fez.",
  },
  parado_30_dias: {
    titulo: "Parado há mais de 30 dias",
    texto: "Conta quantos itens estão na mesma etapa há mais de 30 dias. Serve para achar onde o processo trava. Os números são só agregados e nunca mostram quem é o ativo ou o comprador.",
  },
} as const satisfies Record<string, Nota>;

export type NotaId = keyof typeof NOTAS_DO_PORQUE;
