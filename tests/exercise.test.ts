import assert from 'node:assert/strict'
import test from 'node:test'
import { getDailyExerciseProgress } from '../src/utils/exercise.ts'

test('화면에 30분으로 표시되는 운동은 30분 목표를 완료한다', () => {
  const result = getDailyExerciseProgress([{ duration: 29 + 59 / 60 }], 30)

  assert.equal(result.displayMinutes, 30)
  assert.equal(result.complete, true)
})

test('여러 운동의 시간을 합산해 완료 여부를 판정한다', () => {
  const result = getDailyExerciseProgress([{ duration: 20 }, { duration: 10 }], 30)

  assert.equal(result.displayMinutes, 30)
  assert.equal(result.complete, true)
})

test('완료 기준이 없으면 시간 없는 근력 운동 기록도 완료로 판정한다', () => {
  const result = getDailyExerciseProgress([{ duration: undefined }])

  assert.equal(result.displayMinutes, 0)
  assert.equal(result.complete, true)
})

test('운동 기록이 목표보다 짧으면 완료하지 않는다', () => {
  const result = getDailyExerciseProgress([{ duration: 24.4 }], 30)

  assert.equal(result.displayMinutes, 24)
  assert.equal(result.complete, false)
})
