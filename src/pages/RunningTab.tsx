import { useEffect, useState } from 'react'
import { liveQuery } from 'dexie'
import { addDays, format, parseISO } from 'date-fns'
import { db, runningPlans } from '../db/database'
import type { RunningPlan, WorkoutEntry } from '../db/database'
import { isRunning, runningPace, runningProgress } from '../utils/running'
import { findWorkoutDuplicateCandidate } from '../utils/workoutDedup'

const field = 'w-full min-w-0 rounded-xl border border-emerald-100 bg-white p-2.5 text-sm'
const button = 'rounded-xl bg-emerald-600 px-3 py-2.5 text-xs text-white disabled:opacity-40'
const kinds = ['가벼운 러닝', '걷기·러닝 혼합', '인터벌', '거리 러닝']

export default function RunningTab() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [tab, setTab] = useState('오늘')
  const [plans, setPlans] = useState<RunningPlan[]>([])
  const [workouts, setWorkouts] = useState<WorkoutEntry[]>([])
  const [date, setDate] = useState(today)
  const [kind, setKind] = useState(kinds[0])
  const [unit, setUnit] = useState<'minutes' | 'km'>('minutes')
  const [target, setTarget] = useState('30')
  const [repeat, setRepeat] = useState('1')
  const [editing, setEditing] = useState<number>()
  const [recordDate, setRecordDate] = useState(today)
  const [minutes, setMinutes] = useState('')
  const [distance, setDistance] = useState('')
  const [runningType, setRunningType] = useState<'outdoor' | 'treadmill'>('outdoor')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const subscription = liveQuery(async () => Promise.all([runningPlans.orderBy('date').toArray(), db.workoutLogs.toArray()]))
      .subscribe({ next: ([p, w]) => { setPlans(p); setWorkouts(w) }, error: () => setMessage('기록을 불러오지 못했습니다. 앱을 다시 열어주세요.') })
    return () => subscription.unsubscribe()
  }, [])
  const action = async (operation: () => Promise<unknown>) => {
    setBusy(true)
    setMessage('')
    try { await operation() } catch (error) { setMessage(error instanceof Error ? error.message : '저장하지 못했습니다.') }
    finally { setBusy(false) }
  }
  const savePlan = () => action(async () => {
    if (!date || !Number.isFinite(Number(target)) || Number(target) <= 0) throw new Error('날짜와 0보다 큰 목표를 입력해주세요.')
    await db.transaction('rw', runningPlans, async () => {
      for (let i = 0; i < (editing ? 1 : Number(repeat)); i++) {
        const nextDate = format(addDays(parseISO(date), i * 8), 'yyyy-MM-dd')
        const existing = await runningPlans.where('date').equals(nextDate).first()
        if (existing && existing.id !== editing) throw new Error(`${nextDate}에 이미 계획이 있습니다. 기존 계획을 수정해주세요.`)
        await runningPlans.put({ id: editing, date: nextDate, kind, targetUnit: unit, target: Number(target), createdAt: Date.now() })
      }
    })
    setEditing(undefined)
    setMessage('계획을 저장했습니다. 홈과 달력에서도 볼 수 있어요.')
  })
  const saveRun = () => action(async () => {
    const duration = Number(minutes), km = distance ? Number(distance) : undefined
    if (!recordDate || !Number.isFinite(duration) || duration <= 0 || (km != null && (!Number.isFinite(km) || km <= 0))) throw new Error('운동시간과 거리는 0보다 큰 숫자로 입력해주세요.')
    const entry: WorkoutEntry = { date: recordDate, name: runningType === 'outdoor' ? '야외 러닝' : '러닝머신', workoutKind: 'running', runningType, category: '러닝', duration, distance: km, origin: 'MANUAL', createdAt: Date.now() }
    const imported = workouts.filter(w => w.date === recordDate && w.origin === 'HEALTH_CONNECT')
    if (imported.some(w => isRunning(w) && findWorkoutDuplicateCandidate(w, [entry]))) throw new Error('비슷한 연동 기록이 있습니다. 전체 운동에서 확인 후 기록해주세요.')
    await db.workoutLogs.add(entry)
    setMinutes(''); setDistance(''); setMessage('운동 기록에 저장했습니다.')
    window.dispatchEvent(new CustomEvent('health-connect-synced'))
  })
  const runs = workouts.filter(isRunning).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
  return <div className="space-y-3 min-w-0">
    <div className="grid grid-cols-3 gap-1 rounded-xl bg-emerald-50 p-1">{['오늘', '기록', '계획'].map(t => <button type="button" key={t} onClick={() => setTab(t)} className={tab === t ? button : 'py-2.5 text-xs text-emerald-700'}>{t}</button>)}</div>
    {message && <p role="status" className="text-xs text-emerald-800 break-words">{message}</p>}
    {tab !== '기록' && <>
      {(tab === '오늘' ? plans.filter(p => p.date === today) : plans).map(plan => {
        const progress = runningProgress(plan, workouts)
        return <section key={plan.id} className="rounded-2xl border border-emerald-100 bg-white p-3 space-y-2">
          <p className="text-xs text-gray-500">{plan.date} · {progress.status}</p>
          <p className="text-sm font-semibold">{plan.kind} · {plan.target}{plan.targetUnit === 'minutes' ? '분' : 'km'}</p>
          <p className="text-xs text-emerald-700">실제 러닝 {Number(progress.actual.toFixed(2))}{plan.targetUnit === 'minutes' ? '분' : 'km'}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={button} onClick={() => { setEditing(plan.id); setDate(plan.date); setKind(plan.kind); setUnit(plan.targetUnit); setTarget(String(plan.target)); setTab('계획') }}>수정·날짜 이동</button>
            <button type="button" disabled={busy} className={button} onClick={() => void action(() => runningPlans.update(plan.id!, { skipped: !plan.skipped }))}>{plan.skipped ? '계획 복원' : '건너뛰기'}</button>
          </div>
          <label className="block text-xs">다른 운동으로 대체
            <select className={field} value={plan.substituteWorkoutId ?? ''} onChange={e => void action(() => runningPlans.update(plan.id!, { substituteWorkoutId: e.target.value ? Number(e.target.value) : undefined, skipped: false }))}>
              <option value="">대체하지 않음</option>{workouts.filter(w => w.date === plan.date && !isRunning(w)).map(w => <option key={w.id} value={w.id}>{w.name} {w.duration ?? 0}분</option>)}
            </select>
          </label>
        </section>
      })}
      {tab === '오늘' && !plans.some(p => p.date === today) && <p className="text-sm text-gray-500 py-3">오늘 예정된 러닝이 없습니다. 계획 탭에서 추가해보세요.</p>}
    </>}
    {tab === '계획' && <form className="rounded-2xl bg-white p-3 space-y-3" onSubmit={e => { e.preventDefault(); void savePlan() }}>
      <h3 className="text-sm font-semibold">{editing ? '계획 수정' : '러닝 계획 추가'}</h3>
      <label className="block text-xs">날짜<input required type="date" className={field} value={date} onChange={e => setDate(e.target.value)} /></label>
      <label className="block text-xs">운동 종류<select className={field} value={kind} onChange={e => setKind(e.target.value)}>{kinds.map(k => <option key={k}>{k}</option>)}</select></label>
      <div className="grid grid-cols-2 gap-2"><label className="text-xs">목표<input required type="number" min="0.1" step="0.1" className={field} value={target} onChange={e => setTarget(e.target.value)} /></label><label className="text-xs">기준<select className={field} value={unit} onChange={e => setUnit(e.target.value as typeof unit)}><option value="minutes">시간 (분)</option><option value="km">거리 (km)</option></select></label></div>
      {!editing && <label className="block text-xs">8일 교대주기 반복<select className={field} value={repeat} onChange={e => setRepeat(e.target.value)}><option value="1">이번 날짜만</option><option value="4">8일 간격으로 4회</option><option value="8">8일 간격으로 8회</option></select><span className="text-gray-500">선택한 날짜부터 반복합니다. 여러 주기 날짜는 각각 추가하세요.</span></label>}
      <button disabled={busy} className={button}>계획 저장</button>{editing && <button type="button" className="ml-3 text-xs" onClick={() => setEditing(undefined)}>수정 취소</button>}
    </form>}
    {tab === '기록' && <form className="rounded-2xl bg-white p-3 space-y-3" onSubmit={e => { e.preventDefault(); void saveRun() }}>
      <h3 className="text-sm font-semibold">러닝 직접 기록</h3><p className="text-xs text-gray-500">삼성헬스에서 이미 가져온 운동은 아래 기록에서 확인하세요.</p>
      <label className="block text-xs">운동 날짜<input required type="date" className={field} value={recordDate} onChange={e => setRecordDate(e.target.value)} /></label>
      <label className="block text-xs">장소<select className={field} value={runningType} onChange={e => setRunningType(e.target.value as typeof runningType)}><option value="outdoor">야외 러닝</option><option value="treadmill">러닝머신</option></select></label>
      <div className="grid grid-cols-2 gap-2"><label className="text-xs">시간 (분)<input required type="number" min="0.1" step="0.1" className={field} value={minutes} onChange={e => setMinutes(e.target.value)} /></label><label className="text-xs">거리 (km, 선택)<input type="number" min="0.01" step="0.01" className={field} value={distance} onChange={e => setDistance(e.target.value)} /></label></div>
      <button disabled={busy} className={button}>러닝 기록 저장</button>
    </form>}
    {tab !== '계획' && <div className="space-y-2">{(tab === '오늘' ? runs.filter(w => w.date === today) : runs).map(w => <section key={w.id} className="rounded-2xl bg-white border border-emerald-100 p-3 space-y-2">
      <p className="text-xs text-gray-500">{w.date} · {w.origin === 'HEALTH_CONNECT' ? 'Health Connect 연동' : '직접 입력'}</p>
      <p className="text-sm font-semibold break-words">{w.name}</p><p className="text-xs">{w.duration?.toFixed(1) ?? '—'}분 · {w.distance?.toFixed(2) ?? '—'}km · {runningPace(w.duration, w.distance)}</p>
      <p className="text-xs text-gray-500">평균 심박수 {w.averageHeartRate ?? '—'} · {w.caloriesKcal?.toFixed(0) ?? '—'}kcal</p>
      <label className="block text-xs">운동 후 강도<select className={field} value={w.perceivedEffort ?? ''} onChange={e => void action(() => db.workoutLogs.update(w.id!, { perceivedEffort: (e.target.value || undefined) as WorkoutEntry['perceivedEffort'] }))}><option value="">선택 안 함</option><option value="easy">쉬움</option><option value="moderate">적당함</option><option value="hard">힘듦</option></select></label>
      <label className="block text-xs">메모<input className={field} defaultValue={w.memo ?? ''} onBlur={e => { if (e.target.value !== (w.memo ?? '')) void action(() => db.workoutLogs.update(w.id!, { memo: e.target.value })) }} /></label>
    </section>)}{!runs.length && <p className="text-xs text-gray-500">아직 러닝 기록이 없습니다.</p>}</div>}
  </div>
}
