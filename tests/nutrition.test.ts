import assert from 'node:assert/strict'
import test from 'node:test'
import { getFastingBand, getLatestCompletedFastingInterval } from '../src/utils/nutrition.ts'
import type { MealLog } from '../src/db/database.ts'

function meal(date: string, time: string, containsCalories = true): MealLog {
  return {
    date,
    time,
    mealType: 'other',
    shiftType: 'holiday',
    containsCalories,
    isDefenseSnack: false,
    isUltraProcessed: false,
    isPlannedMeal: false,
    createdAt: 0,
    updatedAt: 0,
  }
}

test('공복 구간 경계를 분류한다', () => {
  assert.equal(getFastingBand(719), 'UNDER_12H')
  assert.equal(getFastingBand(720), 'H12_TO_14')
  assert.equal(getFastingBand(840), 'H14_TO_16')
  assert.equal(getFastingBand(960), 'H16_PLUS')
})

test('날짜를 넘긴 열량 섭취 사이 시간을 계산한다', () => {
  const result = getLatestCompletedFastingInterval([
    meal('2026-08-12', '20:15'),
    meal('2026-08-13', '08:00', false),
    meal('2026-08-13', '10:30'),
  ])
  assert.equal(result?.minutes, 14 * 60 + 15)
  assert.equal(result?.band, 'H14_TO_16')
})

test('일반적인 끼니 간격은 공복 구간 집계에서 제외한다', () => {
  const result = getLatestCompletedFastingInterval([
    meal('2026-08-12', '20:00'),
    meal('2026-08-13', '10:00'),
    meal('2026-08-13', '13:00'),
  ])
  assert.equal(result?.minutes, 14 * 60)
})
