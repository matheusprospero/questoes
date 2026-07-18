// Cabeçalhos CORS: o front (GitHub Pages / matheusprospero.com.br) chama estas
// funções direto do navegador, então precisam responder ao preflight.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
