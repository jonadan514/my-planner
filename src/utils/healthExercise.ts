import type { HealthExerciseKind, WorkoutEntry } from '../db/database.ts'

interface HealthExerciseDescriptor {
  unit?: string
  exerciseKind?: HealthExerciseKind
  runningType?: 'outdoor' | 'treadmill'
}

export interface ImportedExerciseClassification {
  workoutKind: 'running' | 'weight'
  category: '러닝' | '웨이트'
  name: string
  runningType?: 'outdoor' | 'treadmill'
}

const RUNNING_PATTERN = /러닝|런닝|달리기|조깅|트레드\s*밀|running|treadmill|jogging/i
const TREADMILL_PATTERN = /트레드\s*밀|러닝\s*머신|treadmill/i
const WEIGHT_PATTERN = /근력|웨이트|기구\s*운동|머신|벤치|프레스|스쿼트|데드리프트|랫\s*풀다운|로우|레그\s*(컬|익스텐션)|레터럴\s*레이즈|strength|weight|resistance|machine|bench|press|squat|deadlift|pulldown|row/i

export function classifyHealthExercise(exercise: HealthExerciseDescriptor): ImportedExerciseClassification | undefined {
  const sourceName = exercise.unit?.trim() ?? ''
  const isRunning = exercise.exerciseKind === 'RUNNING'
    || (exercise.exerciseKind == null && RUNNING_PATTERN.test(sourceName))
  const isWeight = exercise.exerciseKind === 'WEIGHT'
    || (exercise.exerciseKind == null && WEIGHT_PATTERN.test(sourceName))

  if (isRunning) {
    const runningType = exercise.runningType
      ?? (TREADMILL_PATTERN.test(sourceName) ? 'treadmill' : 'outdoor')
    return {
      workoutKind: 'running',
      runningType,
      category: '러닝',
      name: sourceName || (runningType === 'treadmill' ? '러닝머신' : '러닝'),
    }
  }
  if (isWeight) {
    return {
      workoutKind: 'weight',
      category: '웨이트',
      name: sourceName && sourceName !== 'Samsung Health 운동' ? sourceName : '웨이트 기구운동',
    }
  }
  return undefined
}

export function workoutKindLabel(workout: WorkoutEntry): '러닝' | '웨이트' | undefined {
  if (workout.workoutKind === 'running' || RUNNING_PATTERN.test(workout.name)) return '러닝'
  if (workout.workoutKind === 'weight' || WEIGHT_PATTERN.test(workout.name)) return '웨이트'
  return undefined
}
