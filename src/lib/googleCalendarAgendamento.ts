/** Texto padrão da descrição do evento no Google Agenda (reunião SDR). */
export const AGENDAMENTO_GOOGLE_CALENDAR_DESCRIPTION = `Pontos importantes para nossa reunião ser produtiva:

⏰ Acessar a reunião com 5 min de antecedência;
🔕 Local tranquilo e sem interrupções;
💻 Entrar pelo notebook para ver a apresentação;
🥤 Ter água por perto.

Seguindo isso, seremos bem objetivos e proveitosos.`

/** Ex.: «22/05/2026 às 14:30» ou só a data se não houver hora. */
export function formatReuniaoLabelDataHora(date: string, time?: string): string {
  const d = date.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return date
  const base = new Date(`${d}T12:00:00`)
  const dia = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(base)
  const t = time?.trim().slice(0, 5)
  if (!t) return dia
  const [hh, mm] = t.split(':')
  return `${dia} às ${hh}:${mm}`
}

/** Título: LVX Digital <> [lead] | [dia e hora] */
export function buildAgendamentoGoogleCalendarTitle(nomeLead: string, date: string, time?: string): string {
  const nome = nomeLead.trim() || 'Lead'
  const quando = formatReuniaoLabelDataHora(date, time)
  return `LVX Digital <> ${nome} | ${quando}`
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Convidado LVX incluído em todos os eventos do Google Agenda (SDR). */
export const LVX_CALENDAR_GUEST_EMAIL = 'contato@lvxdigital.com.br'

/** Convidados fixos LVX + extras opcionais (`VITE_GOOGLE_CALENDAR_DEFAULT_GUESTS`, vírgula). */
export function getDefaultGoogleCalendarGuests(): string[] {
  const fixed = [LVX_CALENDAR_GUEST_EMAIL]
  const raw = (import.meta.env.VITE_GOOGLE_CALENDAR_DEFAULT_GUESTS as string | undefined)?.trim()
  const fromEnv = raw
    ? raw
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter((e) => EMAIL_RE.test(e))
    : []
  return [...new Set([...fixed, ...fromEnv].filter((e) => EMAIL_RE.test(e)))]
}

/** E-mails do lead + closer + convidados LVX (sem duplicar). */
export function buildAgendamentoGuestEmails(options?: {
  leadEmails?: string[]
  closerEmail?: string
}): string[] {
  const extra: string[] = [...(options?.leadEmails ?? [])]
  const ce = options?.closerEmail?.trim().toLowerCase()
  if (ce && EMAIL_RE.test(ce) && !extra.includes(ce)) extra.push(ce)
  return mergeGoogleCalendarGuestEmails(extra)
}

/** Vários e-mails no mesmo campo (vírgula, ponto e vírgula ou linha). */
export function parseLeadEmailsInput(raw: string): string[] {
  const parts = raw
    .split(/[,;\n]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  const out: string[] = []
  for (const e of parts) {
    if (EMAIL_RE.test(e) && !out.includes(e)) out.push(e)
  }
  return out
}

/** Convidado padrão LVX + e-mails do lead (sem duplicar). */
export function mergeGoogleCalendarGuestEmails(leadEmails: string[]): string[] {
  const merged = [...getDefaultGoogleCalendarGuests(), ...leadEmails]
  return [...new Set(merged.filter((e) => EMAIL_RE.test(e)))]
}

/** Link «Adicionar ao Google Agenda» (sem OAuth). */
export function buildGoogleCalendarAgendamentoUrl(params: {
  title: string
  date: string
  time?: string
  durationMinutes?: number
  details?: string
  location?: string
  /** Convidados (e-mails). Se omitido, usa `VITE_GOOGLE_CALENDAR_DEFAULT_GUESTS`. */
  guestEmails?: string[]
}): string {
  const date = params.date.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'https://calendar.google.com/calendar/render?action=TEMPLATE'

  const time = (params.time?.trim() || '10:00').slice(0, 5)
  const [hh, mm] = time.split(':').map((x) => parseInt(x, 10) || 0)
  const [y, m, d] = date.split('-')
  const startLocal = `${y}${m}${d}T${String(hh).padStart(2, '0')}${String(mm).padStart(2, '0')}00`
  const duration = params.durationMinutes ?? 60
  const endMin = hh * 60 + mm + duration
  const endH = Math.floor(endMin / 60) % 24
  const endM = endMin % 60
  const endDay = endMin >= 24 * 60 ? String(parseInt(d, 10) + 1).padStart(2, '0') : d
  const endLocal = `${y}${m}${endDay}T${String(endH).padStart(2, '0')}${String(endM).padStart(2, '0')}00`

  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: params.title,
    dates: `${startLocal}/${endLocal}`,
    ctz: 'America/Sao_Paulo'
  })
  if (params.details?.trim()) q.set('details', params.details.trim())
  if (params.location?.trim()) q.set('location', params.location.trim())
  const guests = params.guestEmails?.length
    ? mergeGoogleCalendarGuestEmails(
        params.guestEmails.map((e) => e.trim().toLowerCase()).filter((e) => EMAIL_RE.test(e))
      )
    : getDefaultGoogleCalendarGuests()
  if (guests.length > 0) q.set('add', guests.join(','))
  return `https://calendar.google.com/calendar/render?${q.toString()}`
}

/** URL do Google Agenda para agendamento SDR (título e descrição LVX). */
export function buildGoogleCalendarAgendamentoUrlForSdr(params: {
  nomeLead: string
  date: string
  time?: string
  durationMinutes?: number
  /** E-mails do lead e do closer (além do convidado LVX fixo). */
  leadEmails?: string[]
  closerEmail?: string
}): string {
  const guests = buildAgendamentoGuestEmails({
    leadEmails: params.leadEmails,
    closerEmail: params.closerEmail
  })
  return buildGoogleCalendarAgendamentoUrl({
    title: buildAgendamentoGoogleCalendarTitle(params.nomeLead, params.date, params.time),
    date: params.date,
    time: params.time,
    durationMinutes: params.durationMinutes,
    details: AGENDAMENTO_GOOGLE_CALENDAR_DESCRIPTION,
    guestEmails: guests
  })
}
