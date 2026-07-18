import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { lerConfigPagamento, salvarConfigPagamento, urlWebhook } from '../../services/pagamentos'
import { CreditCard, Check, Copy, ExternalLink, ShieldCheck, Info } from 'lucide-react'
import styles from './PagamentosConfig.module.css'

const fmtData = (iso) => iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : null

export default function PagamentosConfig() {
  const qc = useQueryClient()
  const { data: cfg, isLoading } = useQuery({ queryKey: ['pagamento-config'], queryFn: lerConfigPagamento })

  const [token, setToken] = useState('')
  const [publicKey, setPublicKey] = useState('')
  const [siteUrl, setSiteUrl] = useState('')

  const webhook = urlWebhook()

  const mSalvar = useMutation({
    mutationFn: () => salvarConfigPagamento({ token, publicKey, siteUrl }),
    onSuccess: () => {
      setToken(''); setPublicKey('') // não deixa o token digitado na tela
      qc.invalidateQueries({ queryKey: ['pagamento-config'] })
      toast.success('Credenciais salvas com segurança.')
    },
    onError: (e) => toast.error('Erro ao salvar: ' + e.message),
  })

  const copiar = (txt) => { navigator.clipboard?.writeText(txt); toast.success('Copiado!') }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.titulo}><CreditCard size={20} /> Pagamentos (Mercado Pago)</h1>
        <p className={styles.subtitulo}>
          Configure aqui as credenciais do Mercado Pago que liberam a venda de acesso.
          Os preços de cada turma/disciplina ficam na Central de Matrículas.
        </p>
      </div>

      {/* Status atual */}
      <div className={styles.statusBox}>
        {isLoading ? <span className={styles.statusNeutro}>Carregando…</span> : cfg?.configurado ? (
          <>
            <span className={styles.statusOk}><Check size={15} /> Token configurado</span>
            <span className={styles.statusInfo}>
              termina em <code>{cfg.token_final}</code>
              {cfg.atualizado_em && <> · atualizado em {fmtData(cfg.atualizado_em)}</>}
            </span>
          </>
        ) : (
          <span className={styles.statusPend}><Info size={15} /> Ainda não configurado — cole o Access Token abaixo.</span>
        )}
      </div>

      {/* Formulário */}
      <div className={styles.card}>
        <label className={styles.campo}>
          <span className={styles.campoLabel}>Access Token de produção <span className={styles.req}>(secreto)</span></span>
          <input className={styles.input} type="password" autoComplete="off"
            placeholder={cfg?.configurado ? '•••••••• (deixe em branco para manter o atual)' : 'APP_USR-...'}
            value={token} onChange={e => setToken(e.target.value)} />
          <span className={styles.dica}>
            <ShieldCheck size={12} /> Guardado no servidor e nunca exibido de volta. Painel do MP → Suas integrações → sua aplicação → Credenciais de produção.
          </span>
        </label>

        <label className={styles.campo}>
          <span className={styles.campoLabel}>Public Key <span className={styles.opc}>(opcional)</span></span>
          <input className={styles.input} autoComplete="off"
            placeholder={cfg?.mp_public_key || 'APP_USR-... (não é segredo)'}
            value={publicKey} onChange={e => setPublicKey(e.target.value)} />
        </label>

        <label className={styles.campo}>
          <span className={styles.campoLabel}>URL do site <span className={styles.opc}>(opcional)</span></span>
          <input className={styles.input} autoComplete="off"
            placeholder={cfg?.site_url || 'https://matheusprospero.com.br'}
            value={siteUrl} onChange={e => setSiteUrl(e.target.value)} />
          <span className={styles.dica}>Para onde o aluno volta após pagar. Se em branco, usa o padrão do servidor.</span>
        </label>

        <div className={styles.acoes}>
          <button className={styles.btnPrimary} disabled={mSalvar.isPending || (!token && !publicKey && !siteUrl)}
            onClick={() => mSalvar.mutate()}>
            <Check size={15} /> {mSalvar.isPending ? 'Salvando…' : 'Salvar credenciais'}
          </button>
        </div>
      </div>

      {/* Passos que ainda dependem do painel/CLI */}
      <div className={styles.passos}>
        <h2 className={styles.passosTitulo}>Para concluir a ativação</h2>
        <ol className={styles.lista}>
          <li>
            No painel do Mercado Pago, cadastre o <strong>webhook de pagamentos</strong> apontando para:
            {webhook ? (
              <div className={styles.copyRow}>
                <code className={styles.code}>{webhook}</code>
                <button className={styles.iconBtn} title="Copiar" onClick={() => copiar(webhook)}><Copy size={14} /></button>
              </div>
            ) : <em> (defina a URL do Supabase no build para exibir aqui)</em>}
          </li>
          <li>
            Publique as duas Edge Functions uma vez (via Supabase CLI) — veja
            <code className={styles.codeInline}>supabase/functions/README.md</code>. Depois disso, tudo é gerenciado por esta página.
          </li>
          <li>Defina os preços das turmas na <strong>Central de Matrículas</strong>.</li>
        </ol>
        <a className={styles.link} href="https://www.mercadopago.com.br/developers/panel" target="_blank" rel="noreferrer">
          Abrir painel do Mercado Pago <ExternalLink size={13} />
        </a>
      </div>
    </div>
  )
}
