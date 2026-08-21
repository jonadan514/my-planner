import assert from 'node:assert/strict'
import test from 'node:test'
import { recommendTargets } from '../src/utils/bodyProfile.ts'

test('현재 개인 프로필에서 설정한 감량 목표를 추천한다', () => {
  const result = recommendTargets({
    heightCm: 173,
    weightKg: 93,
    weeklyExerciseSessions: 3,
    averageDailySteps: 7000,
  })

  assert.equal(result.referenceWeightKg, 74.8)
  assert.deepEqual(result.targets, {
    proteinMinGrams: 120,
    proteinMaxGrams: 150,
    carbohydrateMinGrams: 130,
    carbohydrateMaxGrams: 180,
    vegetableTargetGrams: 500,
    exerciseMinutes: 30,
  })
})

test('현재 체중이 기준체중보다 낮으면 현재 체중을 사용한다', () => {
  const result = recommendTargets({
    heightCm: 173,
    weightKg: 70,
    weeklyExerciseSessions: 1,
    averageDailySteps: 4000,
  })

  assert.equal(result.referenceWeightKg, 70)
  assert.equal(result.targets.proteinMinGrams, 110)
  assert.equal(result.targets.proteinMaxGrams, 140)
  assert.equal(result.targets.carbohydrateMinGrams, 130)
  assert.equal(result.targets.carbohydrateMaxGrams, 160)
})
