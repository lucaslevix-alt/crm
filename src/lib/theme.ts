export const CRM_THEME_KEY = 'crm_theme'

export type ThemeMode = 'dark' | 'light'

export function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark'
  try {
    return window.localStorage.getItem(CRM_THEME_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function applyTheme(mode: ThemeMode): void {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', mode)
}

export function persistTheme(mode: ThemeMode): void {
  try {
    window.localStorage.setItem(CRM_THEME_KEY, mode)
  } catch {
    /* ignore */
  }
}
