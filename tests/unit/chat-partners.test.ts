import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularEsperas, ehMesa, ehPartner, faltaMigration, horarioComercial } from "../../lib/chat-partners";

const msg = (room_id: string, sender_role: string, created_at: string, content = "oi") => ({ room_id, sender_role, created_at, content });

test("espera começa na 1ª mensagem do partner depois da última resposta da Mesa", () => {
  const esperas = calcularEsperas([
    msg("partner_a", "PARTNER", "2026-10-20T10:00:00Z"),
    msg("partner_a", "MESA_OPERACIONAL", "2026-10-20T11:00:00Z"),
    msg("partner_a", "PARTNER", "2026-10-21T09:00:00Z", "e aí?"),
    msg("partner_a", "PARTNER", "2026-10-21T09:05:00Z", "alguém?"),
  ]);
  const e = esperas.get("partner_a");
  assert.equal(e?.desde, "2026-10-21T09:00:00Z");
  assert.equal(e?.ultima, "2026-10-21T09:05:00Z");
  assert.equal(e?.preview, "alguém?");
  assert.equal(e?.partner_id, "a");
});

test("resposta da Mesa ou aviso automático encerra a espera", () => {
  assert.equal(calcularEsperas([
    msg("partner_b", "GOLD", "2026-10-21T09:00:00Z"),
    msg("partner_b", "ADMIN", "2026-10-21T09:30:00Z"),
  ]).size, 0);
  assert.equal(calcularEsperas([
    msg("partner_c", "PARTNER", "2026-10-21T09:00:00Z"),
    msg("partner_c", "SYSTEM", "2026-10-21T09:30:00Z"),
  ]).size, 0);
});

test("ordem de entrada não importa e salas de instituição ficam de fora", () => {
  const esperas = calcularEsperas([
    msg("partner_d", "PARTNER", "2026-10-21T12:00:00Z"),
    msg("partner_d", "GESTAO", "2026-10-21T08:00:00Z"),
    msg("instituicao_x", "INSTITUICAO", "2026-10-21T08:00:00Z"),
  ]);
  assert.equal(esperas.get("partner_d")?.desde, "2026-10-21T12:00:00Z");
  assert.equal(esperas.has("instituicao_x"), false);
});

test("horário comercial de Brasília: seg–sex 8h–19h", () => {
  assert.equal(horarioComercial(new Date("2026-10-26T13:00:00Z")), true);   // seg 10h BRT
  assert.equal(horarioComercial(new Date("2026-10-26T10:30:00Z")), false);  // seg 7h30 BRT
  assert.equal(horarioComercial(new Date("2026-10-26T22:30:00Z")), false);  // seg 19h30 BRT
  assert.equal(horarioComercial(new Date("2026-10-25T15:00:00Z")), false);  // domingo
});

test("papéis e detecção de migration pendente", () => {
  assert.equal(ehMesa("MESA_OPERACIONAL"), true);
  assert.equal(ehMesa("PARTNER"), false);
  assert.equal(ehPartner("PARTNER_HE"), true);
  assert.equal(ehPartner("ADMIN"), false);
  assert.equal(faltaMigration({ code: "42P01", message: "relation \"chat_conversas\" does not exist" }), true);
  assert.equal(faltaMigration({ code: "PGRST204", message: "Could not find the 'anexos' column" }), true);
  assert.equal(faltaMigration({ code: "23505", message: "duplicate key" }), false);
  assert.equal(faltaMigration(null), false);
});
