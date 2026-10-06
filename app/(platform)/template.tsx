// Movimento V3: o template do Next remonta a cada troca de rota, então a página nova entra
// com a transição .v3-page-in (app/globals.css). Só visual; respeita "reduzir movimento".
export default function PlatformTemplate({ children }: { children: React.ReactNode }) {
  return <div className="v3-page-in h-full">{children}</div>;
}
