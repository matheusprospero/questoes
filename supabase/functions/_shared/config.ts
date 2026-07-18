// Lê as credenciais do Mercado Pago. Prioriza o que o admin salvou pela página
// (tabela pagamento_config, lida com service_role) e cai para as variáveis de
// ambiente como fallback. Assim dá para configurar tudo pela interface, sem CLI.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export async function getMpConfig(admin: SupabaseClient) {
  let token = ''
  let siteUrl = ''
  try {
    const { data } = await admin
      .from('pagamento_config')
      .select('mp_access_token, site_url')
      .eq('id', 1)
      .single()
    token = data?.mp_access_token || ''
    siteUrl = data?.site_url || ''
  } catch { /* tabela ainda não criada: usa env */ }

  token = token || Deno.env.get('MP_ACCESS_TOKEN') || ''
  siteUrl = (siteUrl || Deno.env.get('SITE_URL') || '').replace(/\/$/, '')
  return { token, siteUrl }
}
