import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyHealthExercise, workoutKindLabel } from '../src/utils/healthExercise.ts'

test('Health Connect 운동 타입으로 러닝과 트레드밀을 구분한다', () => {
  assert.deepEqual(classifyHealthExercise({ unit: '달리기', exerciseKind: 'RUNNING', runningType: 'outdoor' }), {
    workoutKind: 'running', category: '러닝', name: '달리기', runningType: 'outdoor',
  })
  assert.equal(classifyHealthExercise({ unit: '러닝머신', exerciseKind: 'RUNNING', runningType: 'treadmill' })?.runningType, 'treadmill')
})

test('삼성헬스 웨이트 세션을 웨이트로 분류한다', () => {
  assert.deepEqual(classifyHealthExercise({ unit: '레그 프레스', exerciseKind: 'WEIGHT' }), {
    workoutKind: 'weight', category: '웨이트', name: '레그 프레스',
  })
})

test('이전 APK 기록은 이름으로 보완 분류하고 다른 운동은 제외한다', () => {
  assert.equal(classifyHealthExercise({ unit: '트레드밀' })?.workoutKind, 'running')
  assert.equal(classifyHealthExercise({ unit: '근력 운동' })?.workoutKind, 'weight')
  assert.equal(classifyHealthExercise({ unit: '실내 자전거', exerciseKind: 'OTHER' }), undefined)
  assert.equal(workoutKindLabel({ date: '2026-09-10', name: '웨이트 트레이닝', category: '자동 기록', createdAt: 1 }), '웨이트')
})
