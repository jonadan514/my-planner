import assert from 'node:assert/strict'
import test from 'node:test'
import { summarizeMeals } from '../src/db/database.ts'
import type { MealLog, UserNutritionTargets } from '../src/db/database.ts'

const targets: UserNutritionTargets = {
  calorieMinKcal: 1800,
  calorieMaxKcal: 2000,
  proteinMinGrams: 140,
  proteinMaxGrams: 150,
  carbohydrateMinGrams: 130,
  carbohydrateMaxGrams: 160,
  vegetableTargetGrams: 500,
  dietaryFiberTargetGrams: 30,
  exerciseMinutes: 30,
  createdAt: 0,
  updatedAt: 0,
}

function meal(overrides: Partial<MealLog>): MealLog {
  return {
    date: '2026-08-27',
    mealType: 'lunch',
    shiftType: 'day',
    isDefenseSnack: false,
    isUltraProcessed: false,
    isPlannedMeal: true,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

test('개인 식단의 열량과 식이섬유 목표를 일일 합계에 반영한다', () => {
  const summary = summarizeMeals([
    meal({ caloriesKcal: 900, dietaryFiberGrams: 14, proteinGrams: 70, carbohydrateGrams: 70, vegetableGrams: 250 }),
    meal({ mealType: 'dinner', caloriesKcal: 950, dietaryFiberGrams: 17, proteinGrams: 72, carbohydrateGrams: 75, vegetableGrams: 260 }),
  ], targets)

  assert.ok(summary)
  assert.equal(summary.totalCaloriesKcal, 1850)
  assert.equal(summary.totalDietaryFiberGrams, 31)
  assert.equal(summary.calorieStatus, 'TARGET')
  assert.equal(summary.dietaryFiberStatus, 'TARGET')
  assert.equal(summary.calorieRangeMet, true)
  assert.equal(summary.dietaryFiberGoalMet, true)
})
