import type { WorkoutEntry } from '../db/database'

function normalizedName(name: string): string {
  return name.toLowerCase().replace(/[\s·_-]/g, '')
    .replace(/트레드밀|달리기/g, '러닝')
    .replace(/실내자전거|사이클/g, '자전거')
    .replace(/웨이트트레이닝/g, '근력운동')
}

export function isWorkoutDuplicateCandidate(manual: WorkoutEntry, automatic: WorkoutEntry): boolean {
  if (manual.origin === 'HEALTH_CONNECT' || automatic.origin !== 'HEALTH_CONNECT') return false
  if (manual.date !== automatic.date) return false

  const manualName = normalizedName(manual.name)
  const automaticName = normalizedName(automatic.name)
  const sameName = manualName.includes(automaticName) || automaticName.includes(manualName)
  const comparableDuration = manual.duration != null && automatic.duration != null
  const closeDuration = comparableDuration && Math.abs((manual.duration ?? 0) - (automatic.duration ?? 0)) <= 10
  const bothCardio = manual.category === '유산소'
    && ['러닝', '걷기', '자전거', '로잉', '일립티컬', '수영'].some(name => automaticName.includes(name))

  return sameName && (!comparableDuration || closeDuration) || bothCardio && closeDuration
}

export function findWorkoutDuplicateCandidate(
  automatic: WorkoutEntry,
  manualEntries: WorkoutEntry[],
): WorkoutEntry | undefined {
  return manualEntries
    .filter(manual => isWorkoutDuplicateCandidate(manual, automatic))
    .toSorted((a, b) => {
      const aDifference = Math.abs((a.duration ?? automatic.duration ?? 0) - (automatic.duration ?? 0))
      const bDifference = Math.abs((b.duration ?? automatic.duration ?? 0) - (automatic.duration ?? 0))
      return aDifference - bDifference
    })[0]
}
