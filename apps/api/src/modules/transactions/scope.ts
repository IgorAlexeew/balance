/** Границы месяца YYYY-MM как диапазон дат YYYY-MM-DD [from, to) */
export function monthDateRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number) as [number, number]
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
  return { from: `${month}-01`, to: `${next}-01` }
}
