/**
 * Envia os e-mails da fila (tabela emails_fila do Supabase) pelo Gmail.
 *
 * COMO INSTALAR (uma vez):
 * 1. Acesse https://script.google.com → Novo projeto (logado na conta Gmail do professor).
 * 2. Cole este arquivo inteiro no editor (substituindo o conteúdo).
 * 3. Menu ⚙ Configurações do projeto → Propriedades do script → adicione:
 *      SUPABASE_URL   = https://rjhvcgitazfgjfrxainq.supabase.co
 *      SERVICE_ROLE   = <chave service_role do Supabase (Settings → API)>
 * 4. Rode a função enviarEmailsPendentes uma vez pelo editor (botão ▶) para
 *    autorizar o acesso ao Gmail.
 * 5. Relógio (Acionadores) → Adicionar acionador:
 *      função enviarEmailsPendentes · baseado em tempo · a cada 10 minutos.
 *
 * Pronto: tudo que o app colocar na fila (tela Reportados → "Resolver + avisar")
 * sai pelo seu Gmail em até 10 minutos.
 */

function enviarEmailsPendentes() {
  var props = PropertiesService.getScriptProperties();
  var URL = props.getProperty('SUPABASE_URL');
  var KEY = props.getProperty('SERVICE_ROLE');
  if (!URL || !KEY) throw new Error('Configure SUPABASE_URL e SERVICE_ROLE nas Propriedades do script.');

  var headers = {
    apikey: KEY,
    Authorization: 'Bearer ' + KEY,
    'Content-Type': 'application/json',
  };

  // Busca até 20 pendentes por ciclo (Gmail tem cota diária; 20/10min é folgado)
  var resp = UrlFetchApp.fetch(
    URL + '/rest/v1/emails_fila?status=eq.pendente&select=id,para,assunto,corpo&order=criado_em&limit=20',
    { headers: headers, muteHttpExceptions: true }
  );
  if (resp.getResponseCode() !== 200) {
    console.error('Erro ao consultar a fila: ' + resp.getContentText());
    return;
  }

  var fila = JSON.parse(resp.getContentText());
  if (!fila.length) return;

  fila.forEach(function (e) {
    var patch;
    try {
      GmailApp.sendEmail(e.para, e.assunto, e.corpo, {
        name: 'Prof. Matheus Próspero',
      });
      patch = { status: 'enviado', enviado_em: new Date().toISOString() };
    } catch (err) {
      patch = { status: 'erro', erro: String(err) };
    }
    UrlFetchApp.fetch(URL + '/rest/v1/emails_fila?id=eq.' + e.id, {
      method: 'patch',
      headers: headers,
      payload: JSON.stringify(patch),
      muteHttpExceptions: true,
    });
  });

  console.log('Processados: ' + fila.length + ' e-mail(s).');
}
