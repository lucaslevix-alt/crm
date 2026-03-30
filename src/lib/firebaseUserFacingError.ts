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
