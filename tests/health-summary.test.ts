import assert from 'node:assert/strict'
import test from 'node:test'
import { getHealthSnapshot } from '../src/utils/healthSummary.ts'
import type { HealthRecord } from '../src/db/database.ts'

function record(overrides: Partial<HealthRecord>): HealthRecord {
  return {
    externalRecordId: 'id', dataType: 'STEPS', date: '2026-08-21',
    startTime: '2026-08-21T00:00:00Z', createdAt: 0, updatedAt: 0, ...overrides,
  }
}

test('오늘 활동과 최신 신체 측정값을 요약한다', () => {
  const snapshot = getHealthSnapshot([
    record({ externalRecordId: 'steps', value: 7123 }),
    record({ externalRecordId: 'sleep-short', dataType: 'SLEEP', durationMinutes: 120 }),
    record({ externalRecordId: 'sleep-main', dataType: 'SLEEP', durationMinutes: 430 }),
    record({ externalRecordId: 'weight-old', dataType: 'WEIGHT', value: 94, startTime: '2026-08-20T00:00:00Z' }),
    record({ externalRecordId: 'weight-new', dataType: 'WEIGHT', value: 93, startTime: '2026-08-21T00:00:00Z' }),
    record({ externalRecordId: 'fat', dataType: 'BODY_FAT', value: 28.5 }),
  ], '2026-08-21')

  assert.deepEqual(snapshot, { steps: 7123, sleepMinutes: 430, weightKg: 93, bodyFatPercent: 28.5 })
})
