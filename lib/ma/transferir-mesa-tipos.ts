// Tipos do bloco C (transferir de esteira) que também são usados no navegador.
// Sem nenhuma importação do servidor, para o componente de cliente poder importar daqui.
export type DeskDestino = "bolsa" | "credito";

export type TransferenciaMesa = {
  destino: DeskDestino;
  registro_id: string;
  codigo: string | null;
  cancelado: boolean;
  criado_em: string;
};
