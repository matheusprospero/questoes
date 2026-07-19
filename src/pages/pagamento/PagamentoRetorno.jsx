import { useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock, XCircle, ArrowRight } from 'lucide-react'
import styles from './PagamentoRetorno.module.css'

// Página para onde o Mercado Pago devolve o aluno após o checkout.
// ?status = sucesso | pendente | erro
const CONTEUDO = {
  sucesso: {
    Icone: CheckCircle2, cor: '#15803d',
    titulo: 'Pagamento aprovado!',
    texto: 'Seu acesso já foi liberado. Bons estudos!',
  },
  pendente: {
    Icone: Clock, cor: '#b45309',
    titulo: 'Pagamento em processamento',
    texto: 'Se você pagou por PIX, o acesso é liberado assim que o banco confirmar — normalmente em alguns instantes. Você pode fechar esta página; a matrícula aparece sozinha em "Meus cursos".',
  },
  erro: {
    Icone: XCircle, cor: '#b91c1c',
    titulo: 'Pagamento não concluído',
    texto: 'O pagamento não foi aprovado. Nenhuma cobrança foi feita. Você pode tentar novamente quando quiser.',
  },
}

export default function PagamentoRetorno() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  // nosso parâmetro é `retorno` (o MP anexa um `status` próprio que colidia)
  const status = params.get('retorno') || params.get('status') || 'pendente'
  const c = CONTEUDO[status] || CONTEUDO.pendente
  const { Icone } = c

  useEffect(() => {
    // força recarregar as matrículas ao voltar (o webhook pode já ter liberado)
    qc.invalidateQueries({ queryKey: ['minhas-matriculas'] })
  }, [qc])

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <Icone size={48} strokeWidth={1.6} style={{ color: c.cor }} />
        <h1 className={styles.titulo}>{c.titulo}</h1>
        <p className={styles.texto}>{c.texto}</p>
        <button className={styles.btn} onClick={() => navigate('/turmas')}>
          Ir para Meus cursos <ArrowRight size={15} />
        </button>
      </div>
    </div>
  )
}
