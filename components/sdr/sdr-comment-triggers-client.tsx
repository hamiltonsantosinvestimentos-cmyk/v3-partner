"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// ─── Types ───────────────────────────────────────────────────────────────────

type CommentTrigger = {
  id: string;
  nome: string;
  media_id: string | null;
  media_url: string | null;
  palavras_chave: string[];
  mensagem_dm: string;
  resposta_publica: string | null;
  ativo: boolean;
  total_disparos: number;
  created_at: string;
};

type CommentEvent = {
  id: string;
  trigger_id: string | null;
  comment_id: string;
  from_username: string | null;
  comment_text: string | null;
  dm_enviada: boolean;
  erro: string | null;
  created_at: string;
};

type InstagramMedia = {
  id: string;
  caption?: string;
  permalink?: string;
  media_type?: string;
  thumbnail_url?: string;
  media_url?: string;
};

const FORM_INICIAL = {
  nome: "",
  media_id: "",
  media_url: "",
  palavrasChaveTexto: "",
  mensagem_dm: "",
  resposta_publica: "",
};

// ─── Component ───────────────────────────────────────────────────────────────

export function SdrCommentTriggersClient() {
  const [triggers, setTriggers] = useState<CommentTrigger[]>([]);
  const [events, setEvents] = useState<CommentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<CommentTrigger | null>(null);
  const [form, setForm] = useState(FORM_INICIAL);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [mediaList, setMediaList] = useState<InstagramMedia[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaErro, setMediaErro] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sdr/comment-triggers");
      const data = await res.json();
      setTriggers(data.triggers ?? []);
      setEvents(data.events ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const fetchMedia = async () => {
    setMediaLoading(true);
    setMediaErro("");
    try {
      const res = await fetch("/api/sdr/instagram-media");
      const data = await res.json();
      if (!res.ok) { setMediaErro(data.error ?? "Erro ao buscar posts"); return; }
      setMediaList(data.media ?? []);
    } finally {
      setMediaLoading(false);
    }
  };

  const abrirNovo = () => {
    setEditando(null);
    setForm(FORM_INICIAL);
    setErro("");
    setShowModal(true);
    if (mediaList.length === 0) fetchMedia();
  };

  const abrirEdicao = (t: CommentTrigger) => {
    setEditando(t);
    setForm({
      nome: t.nome,
      media_id: t.media_id ?? "",
      media_url: t.media_url ?? "",
      palavrasChaveTexto: t.palavras_chave.join(", "),
      mensagem_dm: t.mensagem_dm,
      resposta_publica: t.resposta_publica ?? "",
    });
    setErro("");
    setShowModal(true);
    if (mediaList.length === 0) fetchMedia();
  };

  const salvar = async () => {
    const palavras_chave = form.palavrasChaveTexto.split(",").map((p) => p.trim()).filter(Boolean);
    if (!form.nome.trim() || !form.mensagem_dm.trim() || palavras_chave.length === 0) {
      setErro("Preencha nome, ao menos uma palavra-chave e a mensagem de DM.");
      return;
    }

    setSaving(true);
    setErro("");
    try {
      const payload = {
        nome: form.nome.trim(),
        media_id: form.media_id || null,
        media_url: form.media_url.trim() || null,
        palavras_chave,
        mensagem_dm: form.mensagem_dm.trim(),
        resposta_publica: form.resposta_publica.trim() || null,
      };
      const res = await fetch(
        editando ? `/api/sdr/comment-triggers/${editando.id}` : "/api/sdr/comment-triggers",
        { method: editando ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErro(data.error ?? "Erro ao salvar");
        return;
      }
      setShowModal(false);
      fetchData();
    } finally {
      setSaving(false);
    }
  };

  const toggleAtivo = async (t: CommentTrigger) => {
    await fetch(`/api/sdr/comment-triggers/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !t.ativo }),
    });
    fetchData();
  };

  const excluir = async (t: CommentTrigger) => {
    if (!confirm(`Excluir o gatilho "${t.nome}"?`)) return;
    await fetch(`/api/sdr/comment-triggers/${t.id}`, { method: "DELETE" });
    fetchData();
  };

  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[#F0ECE4] text-sm font-semibold">Comentário → DM automática</p>
          <p className="text-[#7A8FA8] text-xs mt-0.5">
            Quando alguém comenta uma palavra-chave num post do Instagram, o SDR manda uma DM automática (e, opcionalmente, responde no próprio comentário) — igual o recurso de Growth Tools do ManyChat.
          </p>
        </div>
        <Button onClick={abrirNovo} className="bg-[#C9A84C] text-[#09081A] hover:bg-[#E8C97A] font-bold shrink-0">
          + Novo gatilho
        </Button>
      </div>

      {loading ? (
        <p className="text-[#7A8FA8] text-sm">Carregando...</p>
      ) : triggers.length === 0 ? (
        <div className="border border-dashed border-[#243A66] rounded-2xl p-8 text-center">
          <p className="text-[#7A8FA8] text-sm">Nenhum gatilho criado ainda.</p>
        </div>
      ) : (
        <div className="grid gap-3 mb-8">
          {triggers.map((t) => (
            <div key={t.id} className="bg-[#111F35] border border-[#243A66] rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[#F0ECE4] text-sm font-semibold">{t.nome}</p>
                    <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${t.ativo ? "bg-emerald-400/10 text-emerald-400 border border-emerald-400/30" : "bg-[#243A66] text-[#7A8FA8] border border-[#243A66]"}`}>
                      {t.ativo ? "Ativo" : "Pausado"}
                    </span>
                  </div>
                  <p className="text-[#7A8FA8] text-xs mt-1">
                    Post: {t.media_url ? <a href={t.media_url} target="_blank" rel="noreferrer" className="text-[#C9A84C] underline">{t.media_url}</a> : "qualquer post"}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {t.palavras_chave.map((p) => (
                      <span key={p} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#162744] text-[#C9A84C] border border-[#243A66]">{p}</span>
                    ))}
                  </div>
                  <p className="text-[#7A8FA8] text-xs mt-2 line-clamp-2">DM: {t.mensagem_dm}</p>
                  <p className="text-[#3A5068] text-[10px] mt-1.5 uppercase tracking-wide font-bold">{t.total_disparos} disparo(s)</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => toggleAtivo(t)} className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-[#243A66] text-[#7A8FA8] hover:text-[#F0ECE4] hover:bg-[#162744]">
                    {t.ativo ? "Pausar" : "Ativar"}
                  </button>
                  <button onClick={() => abrirEdicao(t)} className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-[#243A66] text-[#7A8FA8] hover:text-[#F0ECE4] hover:bg-[#162744]">
                    Editar
                  </button>
                  <button onClick={() => excluir(t)} className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-red-400/30 text-red-400 hover:bg-red-400/10">
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[#C9A84C] text-[10px] uppercase tracking-widest font-bold mb-3">Últimos disparos</p>
      {events.length === 0 ? (
        <p className="text-[#7A8FA8] text-xs">Nenhum comentário processado ainda.</p>
      ) : (
        <div className="space-y-1.5">
          {events.map((e) => (
            <div key={e.id} className="flex items-center justify-between text-xs bg-[#111F35] border border-[#243A66] rounded-xl px-3 py-2">
              <span className="text-[#F0ECE4] truncate max-w-[50%]">@{e.from_username ?? "?"}: {e.comment_text}</span>
              <span className={e.erro ? "text-red-400" : e.dm_enviada ? "text-emerald-400" : "text-[#7A8FA8]"}>
                {e.erro ? "Erro" : e.dm_enviada ? "DM enviada" : "Pendente"}
              </span>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="bg-[#0D1B33] border-[#243A66] max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#F0ECE4]">{editando ? "Editar gatilho" : "Novo gatilho"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wide">Nome</label>
              <input
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Ex: Promoção post carrossel"
                className="w-full mt-1 bg-[#111F35] border border-[#243A66] rounded-lg px-3 py-2 text-sm text-[#F0ECE4] outline-none focus:border-[#C9A84C]"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wide">Post (vazio = vale pra qualquer post)</label>
              {mediaLoading ? (
                <p className="text-[#7A8FA8] text-xs mt-1">Buscando posts recentes...</p>
              ) : mediaErro ? (
                <p className="text-red-400 text-xs mt-1">{mediaErro}</p>
              ) : (
                <select
                  value={form.media_id}
                  onChange={(e) => {
                    const selecionado = mediaList.find((m) => m.id === e.target.value);
                    setForm((f) => ({ ...f, media_id: e.target.value, media_url: selecionado?.permalink ?? "" }));
                  }}
                  className="w-full mt-1 bg-[#111F35] border border-[#243A66] rounded-lg px-3 py-2 text-sm text-[#F0ECE4] outline-none focus:border-[#C9A84C]"
                >
                  <option value="">Qualquer post</option>
                  {mediaList.map((m) => (
                    <option key={m.id} value={m.id}>
                      {(m.caption ?? "(sem legenda)").slice(0, 60)}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wide">Palavras-chave (separadas por vírgula)</label>
              <input
                value={form.palavrasChaveTexto}
                onChange={(e) => setForm((f) => ({ ...f, palavrasChaveTexto: e.target.value }))}
                placeholder="PREÇO, QUERO, EU QUERO"
                className="w-full mt-1 bg-[#111F35] border border-[#243A66] rounded-lg px-3 py-2 text-sm text-[#F0ECE4] outline-none focus:border-[#C9A84C]"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wide">Mensagem enviada por DM</label>
              <textarea
                value={form.mensagem_dm}
                onChange={(e) => setForm((f) => ({ ...f, mensagem_dm: e.target.value }))}
                rows={4}
                placeholder="Oi! Vi seu comentário 😊 aqui está a informação que você pediu..."
                className="w-full mt-1 bg-[#111F35] border border-[#243A66] rounded-lg px-3 py-2 text-sm text-[#F0ECE4] outline-none focus:border-[#C9A84C] resize-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wide">Resposta pública no comentário (opcional)</label>
              <input
                value={form.resposta_publica}
                onChange={(e) => setForm((f) => ({ ...f, resposta_publica: e.target.value }))}
                placeholder="Te chamei no Direct! 📩"
                className="w-full mt-1 bg-[#111F35] border border-[#243A66] rounded-lg px-3 py-2 text-sm text-[#F0ECE4] outline-none focus:border-[#C9A84C]"
              />
            </div>
            {erro && <p className="text-red-400 text-xs">{erro}</p>}
            <Button onClick={salvar} disabled={saving} className="w-full bg-[#C9A84C] text-[#09081A] hover:bg-[#E8C97A] font-bold">
              {saving ? "Salvando..." : "Salvar gatilho"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
