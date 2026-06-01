"use client";

import { Mic } from "lucide-react";

interface Props {
  intake: { origem_audio?: string | null };
  userRole: string;
}

const VIEWER_ROLES = ["ADMIN", "GESTAO", "MESA", "MESA_OPERACIONAL"];

export function AudioIntakeBadge({ intake, userRole }: Props) {
  if (!VIEWER_ROLES.includes(userRole)) return null;
  if (intake.origem_audio !== "whatsapp") return null;

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium shrink-0"
      style={{
        background: "#162744",
        color: "#E8C97A",
        border: "1px solid #243A66",
      }}
    >
      <Mic size={10} />
      WhatsApp Audio
    </span>
  );
}
