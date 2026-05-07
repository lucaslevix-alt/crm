import { FirebaseError } from 'firebase/app'

const MSG_FIRESTORE_PERMISSION =
  'Sem permissão no Firestore. Peça ao administrador para publicar as regras do projeto ' +
  '(na raiz: yarn firebase:deploy:rules ou firebase deploy --only firestore:rules). ' +
  'Confirme também o domínio em Firebase Console → Authentication → Settings → Authorized domains. ' +
  'Se já estiver tudo publicado, saia e entre de novo.'

/**
 * Mensagem amigável para erros do Firebase (ex.: Firestore permission-denied).
 * O texto em inglês "Missing or insufficient permissions" vem do SDK.
 */
export function formatFirebaseOrUnknownError(err: unknown): string {
  if (typeof err === 'string') {
    if (err.includes('Missing or insufficient permissions')) return MSG_FIRESTORE_PERMISSION
    return err
  }
  if (err instanceof FirebaseError) {
    const code = err.code || ''
    if (code.startsWith('functions/')) {
      if (code === 'functions/unauthenticated') {
        return 'Sessão expirada ou não autenticado. Faça login novamente.'
      }
      if (code === 'functions/permission-denied') {
        return err.message || 'Sem permissão para esta ação.'
      }
      if (code === 'functions/not-found') {
        return 'Function não encontrada. Faça deploy: npm run firebase:deploy:functions'
      }
      if (code === 'functions/failed-precondition') {
        return err.message || 'Requisito não cumprido (ex.: planilha sem acesso público ou aba incorreta).'
      }
      if (code === 'functions/unavailable') {
        return (
          err.message ||
          'Serviço temporariamente indisponível. Verifique rede / Firebase ou tente em instantes.'
        )
      }
      if (code === 'functions/internal') {
        const msg = (err.message || '').trim()
        if (msg && msg.toLowerCase() !== 'internal') return msg
        return (
          'Erro interno no servidor (sem detalhe). Refaça o deploy das functions ' +
          '(npm run firebase:deploy:functions), confira o nome da aba e partilha da planilha ' +
          '(“qualquer pessoa com o link” como leitor). Se persistir, veja os logs em Firebase Console → Functions.'
        )
      }
      return err.message || `Erro: ${code}`
    }
    if (err.code === 'permission-denied') return MSG_FIRESTORE_PERMISSION
    if (err.code === 'unauthenticated') {
      return 'Sessão expirada ou não autenticado. Faça login novamente.'
    }
    return err.message
  }
  if (err instanceof Error) {
    const m = err.message
    if (m.includes('Missing or insufficient permissions')) return MSG_FIRESTORE_PERMISSION
    return m
  }
  return String(err)
}
