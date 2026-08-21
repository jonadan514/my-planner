import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { db } from '../db/database'
import { getHealthSnapshot } from '../utils/healthSummary'
import type { HealthSnapshot } from '../utils/healthSummary'

const EMPTY_SNAPSHOT: HealthSnapshot = { steps: 0 }

export default function HealthSnapshotCard() {
  const [snapshot, setSnapshot] = useState<HealthSnapshot>(EMPTY_SNAPSHOT)
  const today = format(new Date(), 'yyyy-MM-dd')

  const load = useCallback(async () => {
    const records = await db.healthRecords.toArray()
    setSnapshot(getHealthSnapshot(records, today))
  }, [today])

  useEffect(() => {
    queueMicrotask(() => { void load() })
    const reload = () => { void load() }
    window.addEventListener('health-connect-synced', reload)
    return () => window.removeEventListener('health-connect-synced', reload)
  }, [load])

  const sleepText = snapshot.sleepMinutes == null
    ? '—'
    : `${Math.floor(snapshot.sleepMinutes / 60)}시간 ${Math.round(snapshot.sleepMinutes % 60)}분`

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4">
      <p className="mb-3 text-sm font-semibold text-gray-900">오늘 활동·회복</p>
      <div className="grid grid-cols-2 gap-2">
        <Metric label="걸음" value={snapshot.steps > 0 ? snapshot.steps.toLocaleString() : '—'} unit={snapshot.steps > 0 ? '보' : ''} />
        <Metric label="수면" value={sleepText} />
        <Metric label="최근 체중" value={snapshot.weightKg == null ? '—' : snapshot.weightKg.toFixed(1)} unit={snapshot.weightKg == null ? '' : 'kg'} />
        <Metric label="최근 체지방" value={snapshot.bodyFatPercent == null ? '—' : snapshot.bodyFatPercent.toFixed(1)} unit={snapshot.bodyFatPercent == null ? '' : '%'} />
      </div>
    </div>
  )
}

function Metric({ label, value, unit = '' }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-xl bg-gray-50 px-3 py-2.5">
      <p className="text-[10px] text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-bold text-gray-800">{value}{unit ? <span className="ml-0.5 text-[10px] font-medium text-gray-400">{unit}</span> : null}</p>
    </div>
  )
}
