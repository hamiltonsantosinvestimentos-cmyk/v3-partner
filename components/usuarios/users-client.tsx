"use client";

import React, { useState, useEffect } from "react";
import { Users, Plus, Search, UserCheck, UserX, Pencil, Trash2, Clock, ShieldOff, ShieldCheck, Mail, Loader2, FileText, CalendarPlus, History } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, abbreviateName } from "@/lib/utils";
import { ROLE_LABELS, ROLE_COLORS, type UserRole } from "@/lib/constants";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Temporizador de 30 dias ─────────────────────────────────────────────────
const TRIAL_DAYS = 30;

function getDaysLeft(createdAt: string, trialExpiresAt?: string | null): number {
  if (trialExpiresAt) {
    const expires = new Date(trialExpiresAt).getTime();
    const diff = Math.floor((expires - Date.now()) / (1000 * 60 * 60 * 24));
    return Math.max(diff, 0);
  }
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const elapsed = Math.floor((now - created) / (1000 * 60 * 60 * 24));
  return Math.max(TRIAL_DAYS - elapsed, 0);
}

function isExpired(createdAt: string, trialExpiresAt?: string | null): boolean {
  return getDaysLeft(createdAt, trialExpiresAt) === 0;
}

function TrialBadge({ createdAt, trialExpiresAt, isActive }: { createdAt: string; trialExpiresAt?: string | null; isActive: boolean }) {
  const daysLeft = getDaysLeft(createdAt, trialExpiresAt);
  const pct = Math.round((daysLeft / TRIAL_DAYS) * 100);
  const expireDate = trialExpiresAt
    ? new Date(trialExpiresAt).toLocaleDateString("pt-BR")
    : new Date(new Date(createdAt).getTime() + TRIAL_DAYS * 86400000).toLocaleDateString("pt-BR");

  if (daysLeft === 0) {
    return (
      <div className="w-40">
        <div className="flex items-center gap-1.5 mb-1">
          <ShieldOff className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
          <span className="text-[11px] font-bold text-red-400">Expirado</span>
        </div>
        <div className="h-2 rounded-full bg-red-500/20 overflow-hidden">
          <div className="h-full w-0 rounded-full bg-red-500" />
        </div>
        <span className="text-[10px] text-red-400/60 mt-0.5 block">Bloqueado automaticamente</span>
      </div>
    );
  }

  const barColor   = daysLeft > 10 ? "bg-emerald-500" : daysLeft > 3 ? "bg-amber-400" : "bg-red-500";
  const textColor  = daysLeft > 10 ? "text-emerald-400" : daysLeft > 3 ? "text-amber-400" : "text-red-400";

  return (
    <div className="w-40">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <span className={`text-[11px] font-bold ${textColor}`}>
            {daysLeft}d restantes
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-muted-foreground mt-0.5 block">Expira {expireDate}</span>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  phone: string | null;
  document_cpf: string | null;
  is_active: boolean;
  created_at: string;
  trial_expires_at?: string | null;
  contract_signed?: boolean;
}

interface UsersClientProps {
  initialUsers: User[];
}

export function UsersClient({ initialUsers }: UsersClientProps) {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    role: "PARTNER" as UserRole,
    phone: "",
    document_cpf: "",
  });

  // Auto-bloqueia usuários com trial expirado
  useEffect(() => {
    const expired = users.filter((u) => u.is_active && isExpired(u.created_at, u.trial_expires_at));
    if (expired.length === 0) return;
    expired.forEach(async (u) => {
      const res = await fetch(`/api/usuarios/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: false }),
      });
      if (res.ok) {
        setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, is_active: false } : x));
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = users.filter((u) => {
    const matchSearch =
      !search ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.full_name || "").toLowerCase().includes(search.toLowerCase());
    const matchRole = !filterRole || u.role === filterRole;
    return matchSearch && matchRole;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Erro ao criar usuário");
      setLoading(false);
      return;
    }

    setUsers([data.user, ...users]);
    setIsCreateOpen(false);
    setForm({ email: "", password: "", full_name: "", role: "PARTNER", phone: "", document_cpf: "" });
    setLoading(false);
  };

  const handleToggleActive = async (user: User) => {
    const res = await fetch(`/api/usuarios/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !user.is_active }),
    });

    if (res.ok) {
      setUsers(users.map((u) =>
        u.id === user.id ? { ...u, is_active: !u.is_active } : u
      ));
    }
  };

  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [loadingContract, setLoadingContract] = useState<string | null>(null);
  const [renewalUser, setRenewalUser] = useState<User | null>(null);
  const [renewalDate, setRenewalDate] = useState("");
  const [renewingTrial, setRenewingTrial] = useState(false);

  const handleRenovarTrial = async () => {
    if (!renewalUser || !renewalDate) return;
    setRenewingTrial(true);
    // Usa fim do dia (23:59:59) no horário local para evitar problema de fuso UTC-3
    const newExpiry = new Date(`${renewalDate}T23:59:59`).toISOString();
    try {
      const res = await fetch(`/api/usuarios/${renewalUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // Também reativa o partner caso esteja bloqueado por trial expirado
        body: JSON.stringify({ trial_expires_at: newExpiry, is_active: true }),
      });
      if (res.ok) {
        setUsers(prev => prev.map(u =>
          u.id === renewalUser.id
            ? { ...u, trial_expires_at: newExpiry, is_active: true }
            : u
        ));
        setRenewalUser(null);
        setRenewalDate("");
      } else {
        const d = await res.json();
        alert(d.error ?? "Erro ao renovar trial.");
      }
    } catch {
      alert("Erro de rede. Tente novamente.");
    } finally {
      setRenewingTrial(false);
    }
  };

  const handleVerContrato = async (user: User) => {
    setLoadingContract(user.id);
    try {
      const res = await fetch(`/api/contratos/parceria?userId=${user.id}`);
      const data = await res.json();
      if (!data.found || !data.contract?.contract_html) {
        alert("Contrato não encontrado para este usuário.");
        return;
      }
      const win = window.open("", "_blank");
      if (win) {
        win.document.write(data.contract.contract_html);
        win.document.close();
      }
    } catch {
      alert("Erro ao buscar contrato. Tente novamente.");
    } finally {
      setLoadingContract(null);
    }
  };

  const handleReenviarEmail = async (user: User) => {
    if (!confirm(`Reenviar e-mail de boas-vindas para ${user.email}?\n\nIsso também redefinirá a senha para 12345678.`)) return;
    setSendingEmail(user.id);
    try {
      const res = await fetch("/api/usuarios/reenviar-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`E-mail enviado com sucesso para ${user.email}!`);
      } else {
        alert(`Erro: ${data.error}`);
      }
    } catch {
      alert("Erro ao enviar e-mail. Tente novamente.");
    } finally {
      setSendingEmail(null);
    }
  };

  const [editForm, setEditForm] = useState({ role: "" as UserRole, document_cpf: "", email: "", full_name: "", phone: "" });

  const handleUpdateRole = async (userId: string, newRole: UserRole) => {
    const res = await fetch(`/api/usuarios/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });

    if (res.ok) {
      setUsers(users.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
      setEditUser(null);
    }
  };

  const [editError, setEditError] = useState("");
  const [auditLogs, setAuditLogs] = useState<{ action: string; user_name: string; created_at: string }[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [showAudit, setShowAudit] = useState(false);

  async function fetchAudit(userId: string) {
    setLoadingAudit(true);
    try {
      const res = await fetch(`/api/audit-logs?entity=profiles&entity_id=${userId}&limit=20`);
      if (res.ok) {
        const d = await res.json();
        setAuditLogs(d.logs ?? []);
      }
    } finally {
      setLoadingAudit(false);
    }
  }

  const handleSaveEdit = async () => {
    if (!editUser) return;
    setLoading(true);
    setEditError("");
    const payload: Record<string, unknown> = {
      role: editForm.role,
      document_cpf: editForm.document_cpf || null,
      full_name: editForm.full_name.trim() || null,
      phone: editForm.phone.trim() || null,
    };
    // Só envia email se foi alterado
    if (editForm.email && editForm.email !== editUser.email) {
      payload.email = editForm.email.trim().toLowerCase();
    }
    const res = await fetch(`/api/usuarios/${editUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setUsers(users.map((u) =>
        u.id === editUser.id
          ? { ...u, role: editForm.role, document_cpf: editForm.document_cpf || null, email: payload.email as string ?? u.email, full_name: payload.full_name as string ?? u.full_name, phone: payload.phone as string ?? u.phone }
          : u
      ));
      setEditUser(null);
    } else {
      const d = await res.json();
      setEditError(d.error ?? "Erro ao salvar.");
    }
    setLoading(false);
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`Excluir o usuário "${user.full_name || user.email}"? Esta ação não pode ser desfeita.`)) return;

    const res = await fetch(`/api/usuarios/${user.id}`, { method: "DELETE" });
    if (res.ok) {
      setUsers(users.filter((u) => u.id !== user.id));
    }
  };

  const activeCount = users.filter((u) => u.is_active).length;
  const partnerCount = users.filter((u) => u.role === "PARTNER").length;
  const partnerProCount = users.filter((u) => u.role === "PARTNER_PRO").length;
  const expiredCount = users.filter((u) => isExpired(u.created_at, u.trial_expires_at)).length;
  const expiringCount = users.filter((u) => !isExpired(u.created_at, u.trial_expires_at) && getDaysLeft(u.created_at, u.trial_expires_at) <= 5).length;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Gestão de Usuários</h1>
            <p className="text-xs text-muted-foreground">
              Administre acessos e permissões da plataforma
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          Novo Usuário
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: "Total", value: users.length, color: "text-white" },
          { label: "Ativos", value: activeCount, color: "text-emerald-400" },
          { label: "Inativos", value: users.length - activeCount, color: "text-red-400" },
          { label: "Partners", value: partnerCount, color: "text-blue-400" },
          { label: "Partner PRO", value: partnerProCount, color: "text-[#C9A84C]" },
          { label: "Expirando (≤5d)", value: expiringCount, color: "text-amber-400" },
          { label: "Expirados", value: expiredCount, color: "text-red-500" },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className={`text-xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou e-mail..."
            className="w-full h-9 pl-9 pr-4 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none"
        >
          <option value="">Todos os perfis</option>
          {Object.entries(ROLE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  {["Usuário", "E-mail", "Perfil", "Status", "Contrato", "Criado em", "Trial 30 dias", "Ações"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr key={user.id} className="data-table-row">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1B4FD8] to-[#D4A017] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {abbreviateName(user.full_name || user.email)}
                        </div>
                        <span className="font-medium text-foreground">
                          {user.full_name || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                    <td className="px-4 py-3">
                      <Badge className={ROLE_COLORS[user.role]}>
                        {ROLE_LABELS[user.role]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={user.is_active ? "success" : "danger"}>
                        {user.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${user.contract_signed ? "bg-emerald-400" : "bg-red-500"}`} />
                        <span className={`text-xs font-medium ${user.contract_signed ? "text-emerald-400" : "text-red-400"}`}>
                          {user.contract_signed ? "Assinado" : "Pendente"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <TrialBadge createdAt={user.created_at} trialExpiresAt={user.trial_expires_at} isActive={user.is_active} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setEditUser(user); setEditForm({ role: user.role, document_cpf: user.document_cpf || "", email: user.email, full_name: user.full_name || "", phone: user.phone || "" }); setShowAudit(false); setAuditLogs([]); }}
                          className="p-1.5 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                          title="Editar perfil"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {/* Botão de desbloqueio — só aparece se expirado/inativo */}
                        {!user.is_active && isExpired(user.created_at, user.trial_expires_at) ? (
                          <button
                            onClick={() => handleToggleActive(user)}
                            className="p-1.5 rounded hover:bg-secondary transition-colors text-emerald-400 hover:text-emerald-300"
                            title="Desbloquear (Admin)"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleActive(user)}
                            className={`p-1.5 rounded hover:bg-secondary transition-colors ${
                              user.is_active
                                ? "text-amber-400 hover:text-amber-300"
                                : "text-emerald-400 hover:text-emerald-300"
                            }`}
                            title={user.is_active ? "Desativar" : "Ativar"}
                          >
                            {user.is_active ? (
                              <UserX className="w-3.5 h-3.5" />
                            ) : (
                              <UserCheck className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => { setRenewalUser(user); setRenewalDate(""); }}
                          className="p-1.5 rounded hover:bg-secondary transition-colors text-emerald-400 hover:text-emerald-300"
                          title="Renovar / Estender trial"
                        >
                          <CalendarPlus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleReenviarEmail(user)}
                          disabled={sendingEmail === user.id}
                          className="p-1.5 rounded hover:bg-secondary transition-colors text-blue-400 hover:text-blue-300 disabled:opacity-50"
                          title="Reenviar e-mail de boas-vindas"
                        >
                          {sendingEmail === user.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Mail className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => handleVerContrato(user)}
                          disabled={loadingContract === user.id}
                          className="p-1.5 rounded hover:bg-secondary transition-colors text-[#C9A84C] hover:text-[#E8C97A] disabled:opacity-50"
                          title="Ver contrato assinado"
                        >
                          {loadingContract === user.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <FileText className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
                          className="p-1.5 rounded hover:bg-secondary transition-colors text-red-500 hover:text-red-400"
                          title="Excluir usuário"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Novo Usuário</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 pb-1">
              <div className="space-y-1.5">
                <Label>Nome Completo</Label>
                <Input
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="João da Silva"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="joao@email.com"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Senha Temporária</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div className="space-y-1.5">
                <Label>CPF / CNPJ</Label>
                <Input
                  value={form.document_cpf}
                  onChange={(e) => setForm({ ...form, document_cpf: e.target.value })}
                  placeholder="000.000.000-00 ou 00.000.000/0001-00"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Perfil de Acesso</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm({ ...form, role: v as UserRole })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {error && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">
                  {error}
                </p>
              )}
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={loading}>
                Criar Usuário
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      {editUser && (
        <Dialog open={!!editUser} onOpenChange={() => { setEditUser(null); setEditError(""); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Editar Usuário</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Editando{" "}
                <strong className="text-foreground">
                  {editUser.full_name || editUser.email}
                </strong>
              </p>
              <div className="space-y-1.5">
                <Label>Nome Completo</Label>
                <Input
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  placeholder="Nome do partner"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
                {editForm.email !== editUser.email && editForm.email && (
                  <p className="text-[11px] text-amber-400">
                    E-mail será alterado de <strong>{editUser.email}</strong> para <strong>{editForm.email}</strong>
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Perfil de Acesso</Label>
                <Select
                  value={editForm.role}
                  onValueChange={(v) => setEditForm({ ...editForm, role: v as UserRole })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>CPF / CNPJ</Label>
                <Input
                  value={editForm.document_cpf}
                  onChange={(e) => setEditForm({ ...editForm, document_cpf: e.target.value })}
                  placeholder="000.000.000-00 ou 00.000.000/0001-00"
                />
              </div>
              {/* Histórico de auditoria */}
              <div className="border-t border-border/40 pt-3">
                <button
                  type="button"
                  onClick={() => { setShowAudit(v => !v); if (!showAudit && editUser) fetchAudit(editUser.id); }}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <History className="w-3.5 h-3.5" />
                  {showAudit ? "Ocultar histórico" : "Ver histórico de ações"}
                </button>
                {showAudit && (
                  <div className="mt-2 max-h-36 overflow-y-auto space-y-1">
                    {loadingAudit && <p className="text-xs text-muted-foreground">Carregando...</p>}
                    {!loadingAudit && auditLogs.length === 0 && (
                      <p className="text-xs text-muted-foreground">Nenhuma ação registrada.</p>
                    )}
                    {auditLogs.map((log, i) => (
                      <div key={i} className="flex items-center justify-between text-[11px] bg-secondary/40 rounded px-2 py-1">
                        <span className="text-foreground font-medium">{log.action.replace(/_/g, " ")}</span>
                        <span className="text-muted-foreground ml-2">{log.user_name}</span>
                        <span className="text-muted-foreground ml-2 whitespace-nowrap">{new Date(log.created_at).toLocaleString("pt-BR")}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {editError && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">
                  {editError}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setEditUser(null); setEditError(""); setShowAudit(false); }}>
                Cancelar
              </Button>
              <Button type="button" loading={loading} onClick={handleSaveEdit}>
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal Renovar Trial */}
      {renewalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setRenewalUser(null)} />
          <div className="relative w-full max-w-sm bg-[#111F35] border border-[#243A66] rounded-2xl shadow-2xl p-6 z-10">
            <h2 className="text-base font-bold text-[#F0ECE4] mb-1">Renovar / Estender Trial</h2>
            <p className="text-xs text-[#7A8FA8] mb-4">
              Definir nova data de expiração para <strong className="text-[#F0ECE4]">{renewalUser.full_name || renewalUser.email}</strong>
            </p>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-[#7A8FA8] mb-1.5">Nova data de expiração</label>
              <input
                type="date"
                value={renewalDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setRenewalDate(e.target.value)}
                className="w-full h-10 px-3 text-sm rounded-lg border bg-[#0A1628] border-[#243A66] text-[#F0ECE4] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setRenewalUser(null)}
                className="flex-1 h-10 rounded-lg border border-[#243A66] text-[#7A8FA8] hover:text-[#F0ECE4] text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleRenovarTrial}
                disabled={!renewalDate || renewingTrial}
                className="flex-1 h-10 rounded-lg bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] text-sm font-bold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {renewingTrial && <Loader2 className="w-4 h-4 animate-spin" />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
