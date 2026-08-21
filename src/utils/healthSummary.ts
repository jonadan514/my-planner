import type { HealthRecord } from '../db/database'

export interface HealthSnapshot {
  steps: number
  sleepMinutes?: number
  weightKg?: number
  bodyFatPercent?: number
}

function latestValue(records: HealthRecord[], dataType: HealthRecord['dataType']): number | undefined {
  return records
    .filter(record => record.dataType === dataType && record.value != null)
    .toSorted((a, b) => b.startTime.localeCompare(a.startTime))[0]?.value
}

export function getHealthSnapshot(records: HealthRecord[], today: string): HealthSnapshot {
  const todayRecords = records.filter(record => record.date === today)
  const sleepMinutes = todayRecords
    .filter(record => record.dataType === 'SLEEP' && record.durationMinutes != null)
    .reduce<number | undefined>((longest, record) => Math.max(longest ?? 0, record.durationMinutes ?? 0), undefined)

  return {
    steps: todayRecords
      .filter(record => record.dataType === 'STEPS')
      .reduce((total, record) => total + (record.value ?? 0), 0),
    sleepMinutes,
    weightKg: latestValue(records, 'WEIGHT'),
    bodyFatPercent: latestValue(records, 'BODY_FAT'),
  }
}
