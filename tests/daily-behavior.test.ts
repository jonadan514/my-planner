import assert from 'node:assert/strict'
import test from 'node:test'
import { mergeAutomaticBehaviors, scoreDailyBehaviors } from '../src/utils/dailyBehavior.ts'

const automatic = { protein: true, carbs: true, vegetables: false, exercise: true, fasting: false }

test('행동점수를 5개 항목 기준으로 계산한다', () => {
  assert.equal(scoreDailyBehaviors(automatic), 3)
})

test('자동 갱신 시 사용자가 수동 수정한 항목만 보존한다', () => {
  const result = mergeAutomaticBehaviors(
    { protein: false, carbs: false, vegetables: true, exercise: false, fasting: true },
    { protein: 'MANUAL', carbs: 'MEAL_LOG', vegetables: 'MANUAL', exercise: 'HEALTH_CONNECT', fasting: 'MEAL_LOG' },
    automatic,
    { protein: 'MEAL_LOG', carbs: 'MEAL_LOG', vegetables: 'MEAL_LOG', exercise: 'HEALTH_CONNECT', fasting: 'MEAL_LOG' },
  )

  assert.deepEqual(result.behaviors, { protein: false, carbs: true, vegetables: true, exercise: true, fasting: false })
  assert.equal(result.sources.protein, 'MANUAL')
  assert.equal(result.sources.carbs, 'MEAL_LOG')
})
