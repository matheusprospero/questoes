# -*- coding: utf-8 -*-
"""
Importador de questões para o Supabase (banco de questões de concursos).

O que faz:
  1. Sobe as imagens referenciadas para o bucket de Storage "midia".
  2. Insere as questões (e alternativas) já apontando para as URLs públicas.

Como usar (na SUA máquina — a chave nunca sai daqui):
  1. Pegue a service_role key em: Supabase → Settings → API → "service_role" (secret).
  2. Cole-a no arquivo  importador/conteudo/service_role.txt  (essa pasta é ignorada pelo git),
     OU defina a variável de ambiente SUPABASE_SERVICE_ROLE.
  3. Rode:
        python importador/importar.py importador/conteudo/sorocaba_2025_peb.json
     Para reimportar do zero esse mesmo lote (apaga as questões do mesmo órgão/ano antes):
        python importador/importar.py importador/conteudo/sorocaba_2025_peb.json --limpar

Requisitos: só a biblioteca padrão do Python (urllib). Nenhuma dependência externa.
"""
import sys, os, json, re, mimetypes, urllib.request, urllib.parse, urllib.error

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
BUCKET = "midia"

# ── Configuração (URL do projeto + service_role) ─────────────────────────────

def ler_env_projeto():
    url = os.environ.get("VITE_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
    if not url:
        env = os.path.join(RAIZ, ".env")
        if os.path.exists(env):
            for linha in open(env, encoding="utf-8"):
                if linha.strip().startswith("VITE_SUPABASE_URL="):
                    url = linha.split("=", 1)[1].strip()
                    break
    if not url:
        sys.exit("ERRO: não encontrei VITE_SUPABASE_URL (no .env do projeto ou no ambiente).")
    return url.rstrip("/")

def ler_service_role():
    chave = os.environ.get("SUPABASE_SERVICE_ROLE")
    if not chave:
        arq = os.path.join(AQUI, "conteudo", "service_role.txt")
        if os.path.exists(arq):
            chave = open(arq, encoding="utf-8").read().strip()
    if not chave:
        sys.exit("ERRO: service_role não encontrada.\n"
                 "  → cole a chave em importador/conteudo/service_role.txt\n"
                 "    ou defina a variável de ambiente SUPABASE_SERVICE_ROLE.")
    return chave

URL = ler_env_projeto()
KEY = ler_service_role()

# ── Chamadas à API ───────────────────────────────────────────────────────────

def api(method, path, body=None, extra_headers=None, raw=None, content_type=None):
    headers = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
    if extra_headers:
        headers.update(extra_headers)
    data = None
    if raw is not None:
        data = raw
        headers["Content-Type"] = content_type or "application/octet-stream"
    elif body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(URL + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            txt = r.read().decode("utf-8")
            return json.loads(txt) if txt.strip() else None
    except urllib.error.HTTPError as e:
        detalhe = e.read().decode("utf-8", "ignore")
        sys.exit(f"ERRO {e.code} em {method} {path}\n{detalhe}")

def rest_get(table, query):
    return api("GET", f"/rest/v1/{table}?{query}")

def id_por_nome(table, nome, extra=""):
    q = f"select=id&nome=eq.{urllib.parse.quote(nome)}{extra}"
    r = rest_get(table, q + "&limit=1")
    return r[0]["id"] if r else None

def garantir(table, filtros_iguais, valores):
    """Retorna o id de um registro que casa com filtros_iguais; cria se não existir."""
    query = "select=id&limit=1&" + "&".join(
        f"{k}=eq.{urllib.parse.quote(str(v))}" for k, v in filtros_iguais.items())
    r = rest_get(table, query)
    if r:
        return r[0]["id"]
    criado = api("POST", f"/rest/v1/{table}", body=valores,
                 extra_headers={"Prefer": "return=representation"})
    return criado[0]["id"]

def upload_imagem(caminho_local, caminho_storage):
    with open(caminho_local, "rb") as f:
        dados = f.read()
    ct = mimetypes.guess_type(caminho_local)[0] or "image/png"
    api("POST", f"/storage/v1/object/{BUCKET}/{caminho_storage}",
        raw=dados, content_type=ct, extra_headers={"x-upsert": "true"})
    return f"{URL}/storage/v1/object/public/{BUCKET}/{caminho_storage}"

# ── Importação ───────────────────────────────────────────────────────────────

IMG_HTML = ('<p><img src="{url}" alt="figura da questão" '
            'style="max-width:100%;height:auto;display:block;margin:10px 0" /></p>')

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    flags = {a for a in sys.argv[1:] if a.startswith("--")}
    if not args:
        sys.exit("uso: python importador/importar.py <lote.json> [--limpar]")

    lote = json.load(open(args[0], encoding="utf-8"))
    base_dir = os.path.dirname(os.path.abspath(args[0]))
    img_dir = os.path.join(base_dir, lote.get("imagens_dir", "imagens"))
    slug = lote["slug"]

    print(f"Projeto: {URL}")
    # Disciplina pode ser definida por questão; a do lote é o padrão. Criada se não existir.
    disc_cache = {}
    def get_disc(nome):
        if nome not in disc_cache:
            disc_cache[nome] = garantir("disciplinas", {"nome": nome},
                {"nome": nome, "cor": "#64748b", "ordem": 99})
        return disc_cache[nome]

    banca = garantir("bancas", {"nome": lote["banca"]}, {"nome": lote["banca"]}) if lote.get("banca") else None
    orgao = garantir("orgaos", {"nome": lote["orgao"]}, {"nome": lote["orgao"]}) if lote.get("orgao") else None

    # Escopo do lote: órgão + ano + cargo (permite vários cargos no mesmo concurso)
    cargo = lote.get("cargo")
    filtro = f"orgao_id=eq.{orgao}&ano=eq.{lote['ano']}"
    if cargo:
        filtro += "&cargo=eq." + urllib.parse.quote(cargo)

    # Limpeza opcional (evita duplicar em reimportações do MESMO cargo)
    if "--limpar" in flags and orgao:
        api("DELETE", f"/rest/v1/questoes?{filtro}")
        print(f"  (limpeza) questões anteriores de {lote['orgao']} {lote['ano']} · {cargo or 'todos os cargos'} removidas")
    else:
        existentes = rest_get("questoes", filtro + "&select=id&limit=1") if orgao else []
        if existentes:
            sys.exit("ATENÇÃO: já existem questões desse órgão/ano/cargo no banco.\n"
                     "  → rode de novo com --limpar para substituí-las, ou remova a duplicidade manualmente.")

    # cache de assuntos por (disciplina, nome)
    assunto_id = {}
    def get_assunto(disc_id, nome):
        chave = (disc_id, nome)
        if chave not in assunto_id:
            assunto_id[chave] = garantir("assuntos",
                {"disciplina_id": disc_id, "nome": nome},
                {"disciplina_id": disc_id, "nome": nome})
        return assunto_id[chave]

    # cache de upload de imagem
    url_imagem = {}
    def get_img_url(nome_arquivo):
        if nome_arquivo not in url_imagem:
            local = os.path.join(img_dir, nome_arquivo)
            if not os.path.exists(local):
                sys.exit(f"ERRO: imagem não encontrada: {local}")
            destino = f"questoes/{slug}/{nome_arquivo}"
            url_imagem[nome_arquivo] = upload_imagem(local, destino)
            print(f"  imagem enviada: {destino}")
        return url_imagem[nome_arquivo]

    total = 0
    for q in lote["questoes"]:
        enun = q["enunciado"]
        # 1) placeholder DENTRO de um src="..." → recebe só a URL
        #    (evita aninhar <p><img>…</p> dentro de outra tag img)
        enun = re.sub(
            r'src="\{\{IMG:([^}]+)\}\}"',
            lambda m: 'src="' + get_img_url(m.group(1)) + '"',
            enun,
        )
        # 2) placeholder sozinho no texto → vira o bloco <p><img …/></p>
        while "{{IMG:" in enun:
            ini = enun.index("{{IMG:")
            fim = enun.index("}}", ini)
            arq = enun[ini + 6:fim]
            enun = enun[:ini] + IMG_HTML.format(url=get_img_url(arq)) + enun[fim + 2:]

        disc = get_disc(q.get("disciplina") or lote["disciplina"])
        questao = {
            "tipo": q.get("tipo", "multipla_escolha"),
            "enunciado": enun,
            "comentario": q.get("comentario"),
            "video_url": q.get("video_url"),
            "disciplina_id": disc,
            "assunto_id": get_assunto(disc, q["assunto"]) if q.get("assunto") else None,
            "banca_id": banca,
            "orgao_id": orgao,
            "ano": lote.get("ano"),
            "cargo": lote.get("cargo"),
            "nivel": lote.get("nivel"),
            "dificuldade": q.get("dificuldade", 3),
            "gabarito_certo": q.get("gabarito_certo"),
        }
        criada = api("POST", "/rest/v1/questoes", body=questao,
                     extra_headers={"Prefer": "return=representation"})
        qid = criada[0]["id"]

        if q.get("alternativas"):
            alts = [{"questao_id": qid, "letra": a[0], "texto": a[1],
                     "correta": bool(a[2]), "ordem": i}
                    for i, a in enumerate(q["alternativas"])]
            api("POST", "/rest/v1/questao_alternativas", body=alts)
        total += 1
        print(f"  questão {q.get('num', total)} inserida")

    print(f"\nPronto! {total} questão(ões) importada(s) com sucesso.")

if __name__ == "__main__":
    main()
