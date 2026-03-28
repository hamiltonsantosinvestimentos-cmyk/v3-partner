import Link from "next/link";
import { ShieldX, ArrowLeft } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-[#060D1A] flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
          <ShieldX className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">Acesso Negado</h1>
        <p className="text-muted-foreground text-sm max-w-sm">
          Você não tem permissão para acessar esta página. Entre em contato com o administrador.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-[#1B4FD8] hover:text-[#3B6EF8] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao Dashboard
        </Link>
      </div>
    </div>
  );
}
