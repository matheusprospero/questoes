import { supabase } from './supabase'

// Metas do aluno persistidas no banco (tabela `metas`), com o localStorage
// 'config-meta' servindo de cache local para o código síncrono já existente
// (ModalMeta.lerCfgMeta). A fonte durável (multi-dispositivo, visível ao
// professor) é o banco.

const CFG_DEFAULT = {
  metaDiaria: 20, metaDias: 7, metaSemanal: null, planoId: null,
  objetivo: { banca_id: null, assuntos: [] }, porDisciplina: {},
  // Lembrete diário por e-mail (por aluno)
  lembreteAtivo: true,          // recebe o e-mail de lembrete?
  diasSemana: [1, 2, 3, 4, 5],  // dias em que a meta vale (0=dom..6=sáb)
  semanas: 0,                   // por quantas semanas a meta fica ativa (0 = sem prazo)
  inicioMeta: null,             // data de início da contagem de semanas (YYYY-MM-DD)
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
    lembreteAtivo: row?.lembrete_ativo ?? true,
    diasSemana: row?.dias_semana ?? CFG_DEFAULT.diasSemana,
    semanas: row?.semanas ?? 0,
    inicioMeta: row?.inicio_meta ?? null,
  }
}

function cfgParaLinha(cfg, usuarioId) {
  const semanas = Math.max(0, Number(cfg.semanas) || 0)
  const hoje = new Date().toLocaleDateString('en-CA')
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
    lembrete_ativo: cfg.lembreteAtivo !== false,
    dias_semana: (cfg.diasSemana && cfg.diasSemana.length ? cfg.diasSemana : [1,2,3,4,5]).map(Number),
    semanas,
    // início: mantém o existente; se definir prazo e não houver início, começa hoje
    inicio_meta: semanas > 0 ? (cfg.inicioMeta || hoje) : null,
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
