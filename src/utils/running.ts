import type { RunningPlan, WorkoutEntry } from '../db/database.ts'

export function isRunning(workout: WorkoutEntry): boolean {
  return !!workout.runningType || /러닝|런닝|달리기|트레드밀|트레드 밀|running|treadmill|jogging/i.test(workout.name)
}

export function runningProgress(plan: RunningPlan, workouts: WorkoutEntry[]) {
  const day = workouts.filter(w => w.date === plan.date)
  const runs = day.filter(isRunning)
  const actual = runs.reduce((sum, w) => sum + Math.max(0, (plan.targetUnit === 'minutes' ? w.duration : w.distance) || 0), 0)
  const substitute = day.find(w => w.id === plan.substituteWorkoutId)
  const status = plan.skipped ? '건너뜀' : substitute ? '대체 완료' : actual >= plan.target ? '완료' : runs.length ? '일부 완료' : '예정'
  return { actual, status }
}

export function runningPace(minutes?: number, km?: number): string {
  if (!minutes || !km || minutes <= 0 || km <= 0) return '—'
  const seconds = Math.round(minutes * 60 / km)
  return `${Math.floor(seconds / 60)}′${String(seconds % 60).padStart(2, '0')}″/km`
}
