import { useEffect, useState } from 'react'
import { liveQuery } from 'dexie'
import { db, runningPlans } from '../db/database'
import { runningProgress } from '../utils/running'

export default function RunningSchedule({ date }: { date: string }) {
  const [label, setLabel] = useState('')
  useEffect(() => {
    const subscription = liveQuery(async () => {
      const plan = await runningPlans.where('date').equals(date).first()
      if (!plan) return ''
      const workouts = await db.workoutLogs.where('date').equals(date).toArray()
      return `🏃 ${plan.kind} ${plan.target}${plan.targetUnit === 'minutes' ? '분' : 'km'} · ${runningProgress(plan, workouts).status}`
    }).subscribe(setLabel)
    return () => subscription.unsubscribe()
  }, [date])
  return label ? <div className="my-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 break-words">{label}</div> : null
}
