/** Format ISO/RFC3339 for <input type="datetime-local"> in local timezone. */
export function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Parse datetime-local value as local time → ISO UTC string. */
export function fromDatetimeLocalValue(local: string): string {
  return new Date(local).toISOString()
}

/** Locale-aware admin datetime (short). */
export function formatAdminDateTime(iso?: string | null, locale = 'ru-RU'): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}
