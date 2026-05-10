"use client";

import { useState, useEffect } from "react";
import { MapPin, AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import type { UserRole } from "@/lib/constants";

const PARTNER_ROLES: UserRole[] = ["PARTNER", "PARTNER_PRO"];
const STORAGE_KEY = "v3_location_asked";

interface LocationGateProps {
  role: UserRole;
}

export function LocationGate({ role }: LocationGateProps) {
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<"idle" | "requesting" | "denied" | "success">("idle");

  useEffect(() => {
    if (!PARTNER_ROLES.includes(role)) return;

    // Só pergunta uma vez por sessão
    const alreadyAsked = sessionStorage.getItem(STORAGE_KEY);
    if (alreadyAsked) return;

    // Se já tem localização salva ou já recusou, não pergunta de novo
    fetch("/api/onboarding/location")
      .then((r) => r.json())
      .then((d) => {
        if (!d.has_location) {
          setVisible(true);
        }
      })
      .catch(() => {
        setVisible(true);
      });
  }, [role]);

  async function requestLocation() {
    setStatus("requesting");

    if (!navigator.geolocation) {
      setStatus("denied");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        // Permissão concedida — tenta reverse geocode
        let city = "Não identificada";
        let state = "";
        let country = "BR";

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`,
            { headers: { "Accept-Language": "pt-BR" } }
          );
          const geo = await res.json();
          city =
            geo?.address?.city ||
            geo?.address?.town ||
            geo?.address?.municipality ||
            geo?.address?.county ||
            "Não identificada";
          state = geo?.address?.state ?? "";
          country = geo?.address?.country_code?.toUpperCase() ?? "BR";
        } catch {
          // Nominatim falhou — salva com coordenadas sem cidade nomeada
        }

        await fetch("/api/onboarding/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            city,
            state,
            country,
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          }),
        }).catch(() => {});

        setStatus("success");
        sessionStorage.setItem(STORAGE_KEY, "1");
        setTimeout(() => setVisible(false), 1800);
      },
      async (err) => {
        // Só registra como "recusado" se o usuário explicitamente negou (code 1)
        // code 2 = GPS indisponível, code 3 = timeout — não são negativas do usuário
        if (err.code === 1) {
          await fetch("/api/onboarding/location", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ denied: true }),
          }).catch(() => {});
          sessionStorage.setItem(STORAGE_KEY, "1");
          setStatus("denied");
        } else {
          // GPS indisponível ou timeout — deixa tentar de novo (não marca como recusado)
          setStatus("idle");
          setVisible(true);
        }
      },
      { timeout: 20000, enableHighAccuracy: false }
    );
  }

  function handleDeny() {
    fetch("/api/onboarding/location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ denied: true }),
    }).catch(() => {});

    sessionStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Overlay escuro semi-transparente */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-md rounded-2xl border border-[#243A66] p-6 shadow-2xl"
        style={{ background: "#0D1929" }}
      >
        {/* Ícone */}
        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 rounded-2xl bg-[#C9A84C]/10 border border-[#C9A84C]/20 flex items-center justify-center">
            {status === "requesting" ? (
              <Loader2 className="w-8 h-8 text-[#C9A84C] animate-spin" />
            ) : status === "success" ? (
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            ) : status === "denied" ? (
              <AlertTriangle className="w-8 h-8 text-amber-400" />
            ) : (
              <MapPin className="w-8 h-8 text-[#C9A84C]" />
            )}
          </div>
        </div>

        {/* Conteúdo */}
        {status === "success" ? (
          <div className="text-center">
            <p className="text-lg font-bold text-[#F0ECE4] mb-1">Localização registrada!</p>
            <p className="text-sm text-[#7A8FA8]">Tudo certo. Você já pode usar a plataforma.</p>
          </div>
        ) : status === "denied" ? (
          <div className="text-center">
            <p className="text-lg font-bold text-[#F0ECE4] mb-2">Localização não compartilhada</p>
            <p className="text-sm text-[#7A8FA8] mb-5">
              Registramos que você optou por não compartilhar sua localização.
              Sua conta foi marcada como <span className="text-amber-400 font-medium">localização recusada</span> no painel administrativo.
            </p>
            <button
              onClick={() => setVisible(false)}
              className="w-full py-2.5 rounded-xl bg-[#C9A84C]/10 border border-[#C9A84C]/30 text-[#C9A84C] text-sm font-semibold hover:bg-[#C9A84C]/20 transition-colors"
            >
              Entendi, continuar
            </button>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-bold text-[#F0ECE4] text-center mb-2">
              Confirme sua localização
            </h3>
            <p className="text-sm text-[#7A8FA8] text-center mb-1">
              A V3 Partners solicita o compartilhamento da sua cidade para fins de segurança e conformidade operacional.
            </p>
            <p className="text-xs text-[#7A8FA8]/70 text-center mb-6">
              Seus dados de localização são usados apenas para verificar consistência de acesso e nunca são compartilhados com terceiros.
            </p>

            {/* Botões */}
            <div className="flex flex-col gap-2.5">
              <button
                onClick={requestLocation}
                disabled={status === "requesting"}
                className="w-full py-3 rounded-xl bg-[#C9A84C] text-[#09081A] text-sm font-bold hover:bg-[#E8C97A] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {status === "requesting" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Obtendo localização...
                  </>
                ) : (
                  <>
                    <MapPin className="w-4 h-4" />
                    Compartilhar minha localização
                  </>
                )}
              </button>
              <button
                onClick={handleDeny}
                disabled={status === "requesting"}
                className="w-full py-2.5 rounded-xl border border-[#243A66] text-[#7A8FA8] text-sm hover:text-[#F0ECE4] hover:border-[#7A8FA8] transition-colors disabled:opacity-40"
              >
                Não compartilhar agora
              </button>
            </div>

            <p className="text-xs text-[#7A8FA8]/60 text-center mt-4">
              Ao recusar, sua conta ficará marcada como "localização não confirmada" no painel admin.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
