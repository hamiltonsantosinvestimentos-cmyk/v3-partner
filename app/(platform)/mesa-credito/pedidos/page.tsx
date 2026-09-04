import { redirect } from "next/navigation";

// "Pedidos de Partners" migrou para a Mesa Operacional.
// Mantém a rota antiga viva para links e favoritos já compartilhados.
export default function PedidosPartnersLegacyRedirect() {
  redirect("/mesa-operacional/pedidos");
}
