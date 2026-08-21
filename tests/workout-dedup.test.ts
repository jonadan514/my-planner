import assert from 'node:assert/strict'
import test from 'node:test'
import { isWorkoutDuplicateCandidate } from '../src/utils/workoutDedup.ts'
import type { WorkoutEntry } from '../src/db/database.ts'

function workout(overrides: Partial<WorkoutEntry>): WorkoutEntry {
  return { date: '2026-08-21', name: '러닝', category: '유산소', createdAt: 0, ...overrides }
}

test('같은 날 비슷한 시간의 러닝 기록을 중복 후보로 찾는다', () => {
  const manual = workout({ duration: 30 })
  const automatic = workout({ name: '트레드밀', duration: 29.9, category: '자동 기록', origin: 'HEALTH_CONNECT' })
  assert.equal(isWorkoutDuplicateCandidate(manual, automatic), true)
})

test('서로 다른 날짜의 운동은 병합 후보가 아니다', () => {
  const manual = workout({ duration: 30 })
  const automatic = workout({ date: '2026-08-20', duration: 30, origin: 'HEALTH_CONNECT' })
  assert.equal(isWorkoutDuplicateCandidate(manual, automatic), false)
})

test('개별 근력 운동과 전체 근력 세션은 자동 병합하지 않는다', () => {
  const manual = workout({ name: '벤치프레스', category: '가슴', sets: 3 })
  const automatic = workout({ name: '근력 운동', category: '자동 기록', duration: 45, origin: 'HEALTH_CONNECT' })
  assert.equal(isWorkoutDuplicateCandidate(manual, automatic), false)
})
