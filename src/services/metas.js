import { supabase } from './supabase'

// Metas do aluno persistidas no banco (tabela `metas`), com o localStorage
// 'config-meta' servindo de cache local para o código síncrono já existente
// (ModalMeta.lerCfgMeta). A fonte durável (multi-dispositivo, visível ao
// professor) é o banco.

const CFG_DEFAULT = {
  metaDiaria: 20, metaDias: 7, metaSemanal: null, planoId: null,
  objetivo: { banca_id: null, assuntos: [] }, porDisciplina: {},
}

// linha do banco -> cfg usado no app
function linhaParaCfg(row) {
  const obj = row?.objetivo || {}
  return {
    ...CFG_DEFAULT,
    metaDiaria: row?.meta_diaria ?? CFG_DEFAULT.metaDiaria,
    metaDias: row?.dias_alvo ?? CFG_DEFAULT.metaDias,
    metaSemanal: row?.meta_semanal ?? null,
    planoId: row?.plano_id ?? null,
    objetivo: { banca_id: obj.banca_id ?? null, assuntos: obj.assuntos ?? [] },
    porDisciplina: obj.porDisciplina ?? {},
  }
}

function cfgParaLinha(cfg, usuarioId) {
  return {
    usuario_id: usuarioId,
    meta_diaria: Number(cfg.metaDiaria) || 20,
    meta_semanal: cfg.metaSemanal != null ? Number(cfg.metaSemanal) : null,
    dias_alvo: Number(cfg.metaDias) || 7,
    plano_id: cfg.planoId || null,
    objetivo: {
      banca_id: cfg.objetivo?.banca_id || null,
      assuntos: cfg.objetivo?.assuntos || [],
      porDisciplina: cfg.porDisciplina || {},
    },
    atualizado_em: new Date().toISOString(),
  }
}

// Lê as metas do banco. Se existir, também sincroniza o cache local.
export async function lerMetas() {
  const { data, error } = await supabase.from('metas').select('*').maybeSingle()
  if (error) throw error
  const cfg = linhaParaCfg(data)
  try { localStorage.setItem('config-meta', JSON.stringify(cfg)) } catch { /* ignora */ }
  return cfg
}

// Grava as metas no banco e atualiza o cache local.
export async function salvarMetas(cfg) {
  const { data: sessao } = await supabase.auth.getUser()
  const uid = sessao?.user?.id
  if (!uid) throw new Error('Sessão não encontrada')
  const { error } = await supabase
    .from('metas')
    .upsert(cfgParaLinha(cfg, uid), { onConflict: 'usuario_id' })
  if (error) throw error
  try { localStorage.setItem('config-meta', JSON.stringify(cfg)) } catch { /* ignora */ }
  return cfg
}

// Lê a meta de OUTRO aluno (uso do professor no acompanhamento). Requer admin (RLS).
export async function lerMetasDe(usuarioId) {
  const { data, error } = await supabase.from('metas').select('*').eq('usuario_id', usuarioId).maybeSingle()
  if (error) throw error
  return linhaParaCfg(data)
}
