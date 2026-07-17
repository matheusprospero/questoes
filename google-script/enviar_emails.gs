/**
 * Envia os e-mails da fila (tabela emails_fila do Supabase) pelo Gmail.
 *
 * ONDE ESTÁ INSTALADO (produção):
 * Script vinculado à planilha Google do professor — abrir a planilha e ir em
 * Extensões → Apps Script:
 * https://docs.google.com/spreadsheets/d/1QJ40pa27u93z3DTsixztXwafxbK3X3-_ggiBqezTo_4/edit
 * Acionador: enviarEmailsPendentes, baseado em tempo, a cada 10 minutos.
 * (Este arquivo no repositório é a cópia de referência — se editar aqui,
 * cole a atualização lá também.)
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

  // 1) Pede ao banco para enfileirar os lembretes diários de meta.
  //    A função só age a partir das 18h (config lembrete_config) e
  //    no máximo 1x/dia por aluno — chamar a cada 10 min é seguro.
  try {
    UrlFetchApp.fetch(URL + '/rest/v1/rpc/enfileirar_lembretes_metas', {
      method: 'post', headers: headers, payload: '{}', muteHttpExceptions: true,
    });
  } catch (e) {
    console.warn('Lembretes: ' + e);
  }

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
