"use client";

import { useState, useEffect, useCallback } from "react";
import { Eye, EyeOff, Wifi, WifiOff, RefreshCw, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PipefyConfigProps {
  mesaName: string;
  storageKey: string;
  stageMapping: Array<{ localStage: string; label: string }>;
}

interface PipefyPhase {
  id: string;
  name: string;
}

interface SyncLog {
  timestamp: string;
  status: "success" | "error" | "info";
  message: string;
}

interface PipefyConfigData {
  token: string;
  pipeId: string;
  autoSync: boolean;
  lastSync: string | null;
  phaseMapping: Record<string, string>;
  syncLogs: SyncLog[];
}

const defaultConfig: PipefyConfigData = {
  token: "",
  pipeId: "",
  autoSync: false,
  lastSync: null,
  phaseMapping: {},
  syncLogs: [],
};

export function PipefyConfig({ mesaName, storageKey, stageMapping }: PipefyConfigProps) {
  const lsKey = `v3_pipefy_${storageKey}`;

  const [config, setConfig] = useState<PipefyConfigData>(defaultConfig);
  const [showToken, setShowToken] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "testing" | "connected" | "error">("idle");
  const [connectedUser, setConnectedUser] = useState<string | null>(null);
  const [phases, setPhases] = useState<PipefyPhase[]>([]);
  const [loadingPhases, setLoadingPhases] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(lsKey);
      if (saved) {
        const parsed = JSON.parse(saved) as PipefyConfigData;
        setConfig({ ...defaultConfig, ...parsed });
      }
    } catch {
      // ignore parse errors
    }
  }, [lsKey]);

  const saveConfig = useCallback((updated: PipefyConfigData) => {
    setConfig(updated);
    try {
      localStorage.setItem(lsKey, JSON.stringify(updated));
    } catch {
      // ignore storage errors
    }
  }, [lsKey]);

  const updateConfig = useCallback((partial: Partial<PipefyConfigData>) => {
    setConfig(prev => {
      const updated = { ...prev, ...partial };
      try {
        localStorage.setItem(lsKey, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  }, [lsKey]);

  const addLog = useCallback((status: SyncLog["status"], message: string) => {
    const entry: SyncLog = {
      timestamp: new Date().toISOString(),
      status,
      message,
    };
    setConfig(prev => {
      const logs = [entry, ...prev.syncLogs].slice(0, 5);
      const updated = { ...prev, syncLogs: logs };
      try {
        localStorage.setItem(lsKey, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  }, [lsKey]);

  const handleTestConnection = async () => {
    if (!config.token) return;
    setConnectionStatus("testing");
    try {
      const res = await fetch("/api/pipefy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", token: config.token }),
      });
      const data = await res.json();
      if (data.success) {
        setConnectionStatus("connected");
        setConnectedUser(data.data?.name ?? "Usuário Pipefy");
        addLog("success", `Conexão estabelecida com sucesso. Usuário: ${data.data?.name ?? "?"}`);
      } else {
        setConnectionStatus("error");
        setConnectedUser(null);
        addLog("error", `Falha na conexão: ${data.error}`);
      }
    } catch (err) {
      setConnectionStatus("error");
      setConnectedUser(null);
      addLog("error", "Erro de rede ao testar conexão");
    }
  };

  const handleLoadPhases = async () => {
    if (!config.token || !config.pipeId) return;
    setLoadingPhases(true);
    try {
      const res = await fetch("/api/pipefy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_pipe", token: config.token, pipeId: config.pipeId }),
      });
      const data = await res.json();
      if (data.success) {
        setPhases(data.data?.phases ?? []);
        addLog("success", `${data.data?.phases?.length ?? 0} fases carregadas do pipe "${data.data?.name ?? config.pipeId}"`);
      } else {
        addLog("error", `Erro ao carregar fases: ${data.error}`);
      }
    } catch {
      addLog("error", "Erro de rede ao carregar fases");
    } finally {
      setLoadingPhases(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    addLog("info", "Sincronização iniciada (modo demo)");
    await new Promise(r => setTimeout(r, 1500));
    const now = new Date().toISOString();
    addLog("success", "Sincronização concluída com sucesso (modo demo)");
    setConfig(prev => {
      const updated = { ...prev, lastSync: now };
      try { localStorage.setItem(lsKey, JSON.stringify(updated)); } catch { /* ignore */ }
      return updated;
    });
    setSyncing(false);
  };

  const statusBadge = () => {
    if (connectionStatus === "connected") {
      return (
        <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <CheckCircle size={11} />
          Conectado{connectedUser ? ` — ${connectedUser}` : ""}
        </span>
      );
    }
    if (connectionStatus === "error") {
      return (
        <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">
          <XCircle size={11} />
          Erro de conexão
        </span>
      );
    }
    if (connectionStatus === "testing") {
      return (
        <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
          <RefreshCw size={11} className="animate-spin" />
          Testando...
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-[#122036] text-[#7A8FA8] border border-[#122036]">
        <AlertCircle size={11} />
        Não testado
      </span>
    );
  };

  const logIcon = (status: SyncLog["status"]) => {
    if (status === "success") return <CheckCircle size={12} className="text-emerald-400 flex-shrink-0 mt-0.5" />;
    if (status === "error") return <XCircle size={12} className="text-red-400 flex-shrink-0 mt-0.5" />;
    return <AlertCircle size={12} className="text-blue-400 flex-shrink-0 mt-0.5" />;
  };

  const formatLogTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-4">
      {/* Top row: 2 cards side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Credenciais Card */}
        <div className="rounded-xl border border-[#122036] bg-[#091221] p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wifi size={15} className="text-[#C9A84C]" />
              <h4 className="text-sm font-semibold text-[#E8EDF5]">Credenciais — Mesa {mesaName}</h4>
            </div>
            {statusBadge()}
          </div>

          <div className="space-y-3">
            {/* Token */}
            <div>
              <label className="text-xs text-[#7A8FA8] mb-1.5 block">API Token Pipefy</label>
              <div className="relative">
                <input
                  type={showToken ? "text" : "password"}
                  value={config.token}
                  onChange={e => updateConfig({ token: e.target.value })}
                  placeholder="Cole seu Personal Access Token aqui"
                  className="w-full rounded-lg border border-[#122036] bg-[#0F1E35] text-[#E8EDF5] text-xs px-3 py-2.5 pr-10 placeholder:text-[#7A8FA8] focus:outline-none focus:border-[#C9A84C] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7A8FA8] hover:text-[#E8EDF5] transition-colors"
                >
                  {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Pipe ID */}
            <div>
              <label className="text-xs text-[#7A8FA8] mb-1.5 block">Pipe ID</label>
              <input
                type="number"
                value={config.pipeId}
                onChange={e => updateConfig({ pipeId: e.target.value })}
                placeholder="Ex: 302745281"
                className="w-full rounded-lg border border-[#122036] bg-[#0F1E35] text-[#E8EDF5] text-xs px-3 py-2.5 placeholder:text-[#7A8FA8] focus:outline-none focus:border-[#C9A84C] transition-colors"
              />
            </div>

            {/* Test button */}
            <button
              onClick={handleTestConnection}
              disabled={!config.token || connectionStatus === "testing"}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-[#C9A84C]/50 bg-[#C9A84C]/10 text-[#C9A84C] text-xs font-medium py-2.5 hover:bg-[#C9A84C]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {connectionStatus === "testing" ? (
                <RefreshCw size={13} className="animate-spin" />
              ) : (
                <Wifi size={13} />
              )}
              Testar Conexão
            </button>
          </div>
        </div>

        {/* Stage Mapping Card */}
        <div className="rounded-xl border border-[#122036] bg-[#091221] p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-[#E8EDF5]">Mapeamento de Etapas</h4>
            <button
              onClick={handleLoadPhases}
              disabled={!config.token || !config.pipeId || loadingPhases}
              className="flex items-center gap-1.5 text-xs text-[#7A8FA8] hover:text-[#C9A84C] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCw size={12} className={loadingPhases ? "animate-spin" : ""} />
              Carregar Fases
            </button>
          </div>

          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {stageMapping.map(({ localStage, label }) => (
              <div key={localStage} className="flex items-center gap-2">
                <span className="text-xs text-[#E8EDF5] w-28 flex-shrink-0 truncate" title={label}>{label}</span>
                <span className="text-[#7A8FA8] text-xs">→</span>
                <select
                  value={config.phaseMapping[localStage] ?? ""}
                  onChange={e => {
                    const updated = { ...config.phaseMapping, [localStage]: e.target.value };
                    updateConfig({ phaseMapping: updated });
                  }}
                  className="flex-1 rounded-md border border-[#122036] bg-[#0F1E35] text-[#E8EDF5] text-xs px-2 py-1.5 focus:outline-none focus:border-[#C9A84C] transition-colors"
                >
                  <option value="">Não sincronizar</option>
                  {phases.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {phases.length === 0 && (
            <p className="text-xs text-[#7A8FA8] mt-3 text-center">
              {config.token && config.pipeId
                ? "Clique em \"Carregar Fases\" para buscar as etapas do pipe"
                : "Configure o Token e Pipe ID para carregar as fases"}
            </p>
          )}
        </div>
      </div>

      {/* Sync Settings Card (full width) */}
      <div className="rounded-xl border border-[#122036] bg-[#091221] p-5">
        <h4 className="text-sm font-semibold text-[#E8EDF5] mb-4">Configurações de Sincronização</h4>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
          {/* Auto sync toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              onClick={() => updateConfig({ autoSync: !config.autoSync })}
              className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${
                config.autoSync ? "bg-[#C9A84C]" : "bg-[#122036]"
              }`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  config.autoSync ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </div>
            <span className="text-xs text-[#E8EDF5]">Sincronização automática</span>
          </label>

          {/* Sync now button */}
          <button
            onClick={handleSyncNow}
            disabled={syncing}
            className="flex items-center gap-2 rounded-lg border border-[#122036] bg-[#0F1E35] text-[#E8EDF5] text-xs font-medium px-4 py-2 hover:border-[#C9A84C]/50 hover:text-[#C9A84C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
            Sincronizar Agora
          </button>

          {/* Last sync */}
          {config.lastSync && (
            <div className="flex items-center gap-1.5 text-xs text-[#7A8FA8]">
              <Clock size={12} />
              Última sync: {formatLogTime(config.lastSync)}
            </div>
          )}
        </div>

        {/* Sync logs */}
        {config.syncLogs.length > 0 && (
          <div className="border-t border-[#122036] pt-3 mt-3">
            <p className="text-xs text-[#7A8FA8] mb-2">Últimos eventos</p>
            <div className="space-y-1.5">
              {config.syncLogs.map((log, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  {logIcon(log.status)}
                  <span className="text-[#7A8FA8] flex-shrink-0">{formatLogTime(log.timestamp)}</span>
                  <span className={
                    log.status === "success" ? "text-emerald-400" :
                    log.status === "error" ? "text-red-400" : "text-blue-400"
                  }>{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {config.syncLogs.length === 0 && (
          <p className="text-xs text-[#7A8FA8] text-center py-2">Nenhum evento de sincronização registrado</p>
        )}
      </div>
    </div>
  );
}
