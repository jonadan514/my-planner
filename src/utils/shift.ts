import type { ShiftConfig } from '../db/database'
import { differenceInDays, parseISO } from 'date-fns'

export function getShiftForDate(
  config: ShiftConfig,
  dateStr: string,
): { label: string; color: string } | null {
  if (config.holidays?.includes(dateStr)) return { label: '휴무', color: '#10b981' }
  if (!config.pattern.length) return null
  const anchor = parseISO(config.startDate)
  const target = parseISO(dateStr)
  const diff = differenceInDays(target, anchor)
  const idx = ((diff % config.pattern.length) + config.pattern.length) % config.pattern.length
  return config.pattern[idx]
}
