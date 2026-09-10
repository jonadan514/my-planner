import test from 'node:test'
import assert from 'node:assert/strict'
import { runningPace, runningProgress, isRunning } from '../src/utils/running.ts'

const plan = { date: '2026-09-10', kind: '가벼운 러닝', target: 30, targetUnit: 'minutes' as const, createdAt: 1 }
const run = { id: 1, date: plan.date, name: '러닝', category: '자동 기록', duration: 32, distance: 4.1, createdAt: 1 }
test('러닝 시간 달성과 거리 미달, 다른 날짜 제외', () => {
  assert.equal(runningProgress(plan, [run]).status, '완료')
  assert.equal(runningProgress({ ...plan, targetUnit: 'km', target: 5 }, [run]).status, '일부 완료')
  assert.equal(runningProgress(plan, [{ ...run, date: '2026-09-09' }]).status, '예정')
})
test('자전거는 러닝 합계에 포함하지 않고 명시적으로 대체', () => {
  const bike = { ...run, name: '실내 자전거' }
  assert.equal(runningProgress(plan, [bike]).actual, 0)
  assert.equal(runningProgress({ ...plan, substituteWorkoutId: 1 }, [bike]).status, '대체 완료')
  assert.equal(runningProgress({ ...plan, skipped: true }, [run]).status, '건너뜀')
})
test('러닝머신 분류와 페이스 초 단위 반올림', () => {
  assert.equal(isRunning({ ...run, name: 'Running (treadmill)' }), true)
  assert.equal(runningPace(32, 4.1), '7′48″/km')
  assert.equal(runningPace(30, 0), '—')
})
