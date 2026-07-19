-- ============================================================================
-- Matrícula manual do professor: motivo (fora do padrão) + data de pagamento prevista.
-- Rodar no SQL Editor do Supabase (depois de matricula_periodo.sql). Idempotente.
--
-- Usado quando o professor matricula alguém à mão (cortesia, bolsa, pagamento
-- presencial/combinado etc.). O período de acesso (acesso_desde/acesso_ate) já
-- existe; aqui entram só a justificativa e a data de pagamento prevista.
-- ============================================================================

alter table matriculas add column if not exists motivo             text;
alter table matriculas add column if not exists pagamento_previsto date;

-- Nada de RLS novo: o professor já grava via policy "matricula_admin_total".
