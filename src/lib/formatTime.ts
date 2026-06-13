/** Формат времени старта матча: DD.MM в HH:MM (Москва) */

export function formatMatchStartTime(iso: string): string {
  const date = new Date(iso)
  const formatted = date.toLocaleString('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  // "05.06.2026, 18:00" → "05.06 в 18:00"
  const [datePart, timePart] = formatted.split(', ')
  if (!datePart || !timePart) return formatted
  return `${datePart.slice(0, 5)} в ${timePart}`
}
