// Tema claro/escuro persistido em localStorage
export function temaAtual() {
  return localStorage.getItem('tema') === 'escuro' ? 'escuro' : 'claro'
}
export function aplicarTema(t) {
  document.documentElement.setAttribute('data-theme', t === 'escuro' ? 'dark' : 'light')
}
export function definirTema(t) {
  localStorage.setItem('tema', t)
  aplicarTema(t)
}
// Aplica o tema salvo assim que o app carrega
aplicarTema(temaAtual())
