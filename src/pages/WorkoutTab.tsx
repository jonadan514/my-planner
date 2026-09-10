import { useState, useEffect, useCallback } from 'react'
import { db } from '../db/database'
import type { WorkoutEntry } from '../db/database'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import HealthConnectCard from '../components/HealthConnectCard'
import RunningTab from './RunningTab'
import { findWorkoutDuplicateCandidate } from '../utils/workoutDedup'
import { workoutKindLabel } from '../utils/healthExercise'

const CATEGORIES = ['가슴', '등', '하체', '어깨', '팔', '유산소', '기타']

type WorkoutType = 'weight' | 'cardio'

interface DayGroup {
  date: string
  entries: WorkoutEntry[]
}

function groupByDate(entries: WorkoutEntry[]): DayGroup[] {
  const map = new Map<string, WorkoutEntry[]>()
  for (const e of entries) {
    const arr = map.get(e.date) ?? []
    arr.push(e)
    map.set(e.date, arr)
  }
  return [...map.entries()]
    .map(([date, entries]) => ({ date, entries }))
    .sort((a, b) => b.date.localeCompare(a.date))
}

export default function WorkoutTab() {
  const [view, setView] = useState<'all' | 'running'>('all')
  const [groups, setGroups]           = useState<DayGroup[]>([])
  const [showForm, setShowForm]       = useState(false)
  const [wType, setWType]             = useState<WorkoutType>('weight')
  const [date, setDate]               = useState(format(new Date(), 'yyyy-MM-dd'))
  const [name, setName]               = useState('')
  const [category, setCategory]       = useState('가슴')
  const [sets, setSets]               = useState('')
  const [reps, setReps]               = useState('')
  const [weight, setWeight]           = useState('')
  const [duration, setDuration]       = useState('')
  const [distance, setDistance]       = useState('')
  const [memo, setMemo]               = useState('')
  const [editingMemoId, setEditingMemoId] = useState<number>()
  const [linkedMemo, setLinkedMemo] = useState('')

  const load = useCallback(
    () => db.workoutLogs.orderBy('createdAt').reverse().toArray(),
    [],
  )

  const applyLoadedWorkouts = useCallback((all: WorkoutEntry[]) => {
    setGroups(groupByDate(all))
  }, [])

  useEffect(() => {
    void load().then(applyLoadedWorkouts)
    const reloadAfterHealthSync = () => { void load().then(applyLoadedWorkouts) }
    window.addEventListener('health-connect-synced', reloadAfterHealthSync)
    return () => window.removeEventListener('health-connect-synced', reloadAfterHealthSync)
  }, [applyLoadedWorkouts, load])

  const resetForm = () => {
    setName(''); setSets(''); setReps(''); setWeight('')
    setDuration(''); setDistance(''); setMemo('')
    setCategory('가슴'); setWType('weight')
    setDate(format(new Date(), 'yyyy-MM-dd'))
  }

  const save = async () => {
    if (!name.trim()) return
    const entry: WorkoutEntry = {
      date,
      name: name.trim(),
      category,
      createdAt: Date.now(),
      ...(wType === 'weight' ? {
        workoutKind: 'weight' as const,
        sets:   sets   ? Number(sets)   : undefined,
        reps:   reps   ? Number(reps)   : undefined,
        weight: weight ? Number(weight) : undefined,
      } : {
        workoutKind: /러닝|런닝|달리기|트레드밀|러닝머신/i.test(name.trim()) ? 'running' as const : undefined,
        duration: duration ? Number(duration) : undefined,
        distance: distance ? Number(distance) : undefined,
      }),
      memo: memo.trim() || undefined,
    }
    const id = await db.workoutLogs.add(entry) as number
    const automaticEntries = await db.workoutLogs.where('date').equals(date)
      .and(item => item.origin === 'HEALTH_CONNECT' && !item.duplicateDismissed && item.linkedWorkoutId == null).toArray()
    const automaticCandidate = automaticEntries.find(automatic =>
      findWorkoutDuplicateCandidate(automatic, [{ ...entry, id }]) != null,
    )
    if (automaticCandidate?.id) await db.workoutLogs.update(automaticCandidate.id, { duplicateCandidateId: id })
    resetForm()
    setShowForm(false)
    await load().then(applyLoadedWorkouts)
  }

  const del = async (id: number) => {
    await db.workoutLogs.delete(id)
    await load().then(applyLoadedWorkouts)
  }

  const mergeDuplicate = async (automatic: WorkoutEntry) => {
    if (!automatic.id || !automatic.duplicateCandidateId) return
    const manual = await db.workoutLogs.get(automatic.duplicateCandidateId)
    if (!manual) return
    await db.transaction('rw', db.workoutLogs, async () => {
      await db.workoutLogs.update(automatic.id!, {
        name: automatic.name || manual.name,
        category: manual.category,
        sets: manual.sets,
        reps: manual.reps,
        weight: manual.weight,
        duration: automatic.duration ?? manual.duration,
        distance: automatic.distance ?? manual.distance,
        memo: [manual.memo, automatic.memo].filter(Boolean).join(' · ') || undefined,
        linkedWorkoutId: manual.id,
        duplicateCandidateId: undefined,
      })
      await db.workoutLogs.delete(manual.id!)
    })
    await load().then(applyLoadedWorkouts)
  }

  const keepDuplicateSeparate = async (automatic: WorkoutEntry) => {
    if (!automatic.id) return
    await db.workoutLogs.update(automatic.id, { duplicateCandidateId: undefined, duplicateDismissed: true })
    await load().then(applyLoadedWorkouts)
  }

  const startEditingLinkedMemo = (entry: WorkoutEntry) => {
    if (!entry.id) return
    setEditingMemoId(entry.id)
    setLinkedMemo(entry.memo ?? '')
  }

  const saveLinkedMemo = async () => {
    if (!editingMemoId) return
    await db.workoutLogs.update(editingMemoId, { memo: linkedMemo.trim() || undefined })
    setEditingMemoId(undefined)
    setLinkedMemo('')
    await load().then(applyLoadedWorkouts)
  }

  return (
    <div className="px-4 pt-3 pb-4">
      <div className="mb-3">
        <HealthConnectCard />
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <button type="button" onClick={() => { setView('all'); void load().then(applyLoadedWorkouts) }} className={`rounded-xl py-3 text-sm ${view === 'all' ? 'bg-emerald-600 text-white' : 'bg-white'}`}>전체 운동</button>
        <button type="button" onClick={() => setView('running')} className={`rounded-xl py-3 text-sm ${view === 'running' ? 'bg-emerald-600 text-white' : 'bg-white'}`}>🏃 러닝</button>
      </div>
      {view === 'running' ? <RunningTab /> : <>

      {/* 추가 버튼 */}
      <button
        onClick={() => setShowForm(v => !v)}
        className="w-full py-3 rounded-2xl bg-emerald-500 text-white font-semibold text-sm mb-5 active:bg-emerald-600"
      >
        + 운동 기록 추가
      </button>

      {/* 입력 폼 */}
      {showForm && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-5 space-y-3">
          {/* 날짜 */}
          <div>
            <label className="text-[11px] text-gray-400 mb-1 block">날짜</label>
            <input
              type="date"
              className="w-full bg-gray-100 rounded-xl px-3 py-2.5 text-gray-900 outline-none text-sm"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>

          {/* 웨이트 / 유산소 토글 */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {(['weight', 'cardio'] as WorkoutType[]).map(t => (
              <button
                key={t}
                onClick={() => { setWType(t); setCategory(t === 'cardio' ? '유산소' : '가슴') }}
                className={`flex-1 py-2 text-xs rounded-lg font-medium transition-colors ${
                  wType === t ? 'bg-emerald-500 text-white' : 'text-gray-400'
                }`}
              >
                {t === 'weight' ? '웨이트' : '유산소'}
              </button>
            ))}
          </div>

          {/* 카테고리 */}
          <div>
            <label className="text-[11px] text-gray-400 mb-1.5 block">부위 / 종류</label>
            <div className="flex flex-wrap gap-1.5">
              {(wType === 'cardio' ? ['유산소'] : CATEGORIES.filter(c => c !== '유산소')).map(c => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    category === c ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* 운동명 */}
          <div>
            <label className="text-[11px] text-gray-400 mb-1 block">운동명</label>
            <input
              type="text"
              placeholder={wType === 'weight' ? '벤치프레스, 스쿼트 ...' : '러닝, 사이클 ...'}
              className="w-full bg-gray-100 rounded-xl px-3 py-2.5 text-gray-900 placeholder-gray-400 outline-none text-sm"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          {/* 웨이트 필드 */}
          {wType === 'weight' && (
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[11px] text-gray-400 mb-1 block">세트</label>
                <input type="number" inputMode="numeric" placeholder="—"
                  className="w-full bg-gray-100 rounded-xl px-3 py-2.5 text-gray-900 placeholder-gray-400 outline-none text-sm text-center"
                  value={sets} onChange={e => setSets(e.target.value)} />
              </div>
              <div>
                <label className="text-[11px] text-gray-400 mb-1 block">횟수</label>
                <input type="number" inputMode="numeric" placeholder="—"
                  className="w-full bg-gray-100 rounded-xl px-3 py-2.5 text-gray-900 placeholder-gray-400 outline-none text-sm text-center"
                  value={reps} onChange={e => setReps(e.target.value)} />
              </div>
              <div>
                <label className="text-[11px] text-gray-400 mb-1 block">무게 (kg)</label>
                <input type="number" inputMode="decimal" placeholder="—"
                  className="w-full bg-gray-100 rounded-xl px-3 py-2.5 text-gray-900 placeholder-gray-400 outline-none text-sm text-center"
                  value={weight} onChange={e => setWeight(e.target.value)} />
              </div>
            </div>
          )}

          {/* 유산소 필드 */}
          {wType === 'cardio' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-gray-400 mb-1 block">시간 (분)</label>
                <input type="number" inputMode="numeric" placeholder="—"
                  className="w-full bg-gray-100 rounded-xl px-3 py-2.5 text-gray-900 placeholder-gray-400 outline-none text-sm text-center"
                  value={duration} onChange={e => setDuration(e.target.value)} />
              </div>
              <div>
                <label className="text-[11px] text-gray-400 mb-1 block">거리 (km)</label>
                <input type="number" inputMode="decimal" placeholder="—"
                  className="w-full bg-gray-100 rounded-xl px-3 py-2.5 text-gray-900 placeholder-gray-400 outline-none text-sm text-center"
                  value={distance} onChange={e => setDistance(e.target.value)} />
              </div>
            </div>
          )}

          {/* 메모 */}
          <div>
            <label className="text-[11px] text-gray-400 mb-1 block">메모 (선택)</label>
            <input type="text" placeholder="기록하고 싶은 내용..."
              className="w-full bg-gray-100 rounded-xl px-3 py-2.5 text-gray-900 placeholder-gray-400 outline-none text-sm"
              value={memo} onChange={e => setMemo(e.target.value)} />
          </div>

          {/* 저장/취소 */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => { resetForm(); setShowForm(false) }}
              className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-500 text-sm font-medium"
            >
              취소
            </button>
            <button
              onClick={save}
              className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-semibold active:bg-emerald-600"
            >
              저장
            </button>
          </div>
        </div>
      )}

      {/* 기록 목록 */}
      {groups.length === 0 ? (
        <p className="text-center text-gray-300 text-sm mt-8">아직 운동 기록이 없어요</p>
      ) : (
        <div className="space-y-5">
          {groups.map(({ date, entries }) => (
            <div key={date}>
              <p className="text-xs text-gray-400 font-medium mb-2">
                {format(parseISO(date), 'M월 d일 (EEE)', { locale: ko })}
              </p>
              <ul className="space-y-2">
                {entries.map(e => (
                  <li
                    key={e.id}
                    className="bg-white border border-gray-100 rounded-xl px-3.5 py-3 flex items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[10px] px-2 py-0.5 rounded-md shrink-0 ${e.origin === 'HEALTH_CONNECT' ? 'bg-emerald-50 text-emerald-600' : 'bg-emerald-500/15 text-emerald-500'}`}>
                          {e.origin === 'HEALTH_CONNECT' ? `Samsung Health · ${workoutKindLabel(e) ?? '운동'}` : e.category}
                        </span>
                        <span className="text-sm text-gray-900 font-medium truncate">{e.name}</span>
                      </div>
                      <p className="text-[11px] text-gray-400">
                        {e.sets != null && `${e.sets}세트`}
                        {e.reps != null && ` × ${e.reps}회`}
                        {e.weight != null && ` · ${e.weight}kg`}
                        {e.duration != null && `${Math.round(e.duration)}분`}
                        {e.distance != null && ` · ${e.distance.toFixed(2)}km`}
                        {e.caloriesKcal != null && ` · ${Math.round(e.caloriesKcal)}kcal`}
                        {e.averageHeartRate != null && ` · 평균 ${Math.round(e.averageHeartRate)}bpm`}
                        {e.memo && ` — ${e.memo}`}
                      </p>
                      {e.origin === 'HEALTH_CONNECT' && workoutKindLabel(e) === '웨이트' ? (
                        editingMemoId === e.id ? (
                          <div className="mt-2 rounded-xl bg-gray-50 p-2.5">
                            <label htmlFor={`linked-workout-memo-${e.id}`} className="block text-[10px] font-medium text-gray-500">
                              운동 부위와 세트
                            </label>
                            <textarea
                              id={`linked-workout-memo-${e.id}`}
                              rows={2}
                              maxLength={200}
                              autoFocus
                              value={linkedMemo}
                              onChange={event => setLinkedMemo(event.target.value)}
                              placeholder="예: 등 · 랫풀다운 3세트 · 시티드로우 3세트"
                              className="mt-1.5 w-full resize-none rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs text-gray-800 outline-none focus:border-emerald-400"
                            />
                            <div className="mt-2 flex justify-end gap-2">
                              <button type="button" onClick={() => { setEditingMemoId(undefined); setLinkedMemo('') }} className="rounded-lg px-3 py-1.5 text-[11px] text-gray-500">취소</button>
                              <button type="button" onClick={() => void saveLinkedMemo()} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-white">저장</button>
                            </div>
                          </div>
                        ) : (
                          <button type="button" onClick={() => startEditingLinkedMemo(e)} className="mt-2 text-[11px] font-medium text-emerald-600">
                            {e.memo ? '메모 수정' : '+ 운동 부위·세트 메모'}
                          </button>
                        )
                      ) : null}
                      {e.origin === 'HEALTH_CONNECT' && e.duplicateCandidateId ? (
                        <div className="mt-2 rounded-lg bg-amber-50 px-2.5 py-2">
                          <p className="text-[10px] text-amber-700">같은 날 수동 운동과 중복 가능성이 있습니다.</p>
                          <div className="mt-1.5 flex gap-2">
                            <button type="button" onClick={() => void mergeDuplicate(e)} className="text-[10px] font-semibold text-amber-700 underline">합치기</button>
                            <button type="button" onClick={() => void keepDuplicateSeparate(e)} className="text-[10px] text-gray-500 underline">각각 유지</button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                    {e.origin !== 'HEALTH_CONNECT' && <button
                      onClick={() => e.id && del(e.id)}
                      className="text-gray-300 text-lg active:text-red-400 shrink-0"
                    >×</button>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      </>}
    </div>
  )
}
