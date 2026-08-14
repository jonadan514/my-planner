export interface ExerciseWithDuration {
  duration?: number
}

export interface DailyExerciseProgress {
  totalMinutes: number
  displayMinutes: number
  targetMinutes?: number
  complete: boolean
}

export function getDailyExerciseProgress(
  workouts: ExerciseWithDuration[],
  targetMinutes?: number,
): DailyExerciseProgress {
  const totalMinutes = workouts.reduce((total, workout) => {
    const duration = workout.duration
    return total + (typeof duration === 'number' && Number.isFinite(duration) && duration > 0 ? duration : 0)
  }, 0)
  const displayMinutes = Math.round(totalMinutes)
  const validTarget = typeof targetMinutes === 'number' && Number.isFinite(targetMinutes) && targetMinutes > 0
    ? Math.round(targetMinutes)
    : undefined

  return {
    totalMinutes,
    displayMinutes,
    targetMinutes: validTarget,
    complete: validTarget != null ? displayMinutes >= validTarget : workouts.length > 0,
  }
}
