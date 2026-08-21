import { useEffect, useState, useCallback } from 'react'
import { db } from '../db/database'
import type { FastingRecord } from '../db/database'
import { format } from 'date-fns'
import {
  getPermissionStatus, requestPermission,
  showFastingNotification, showFastingComplete, clearFastingNotification,
} from '../utils/notifications'
import type { AppNotificationPermission } from '../utils/notifications'

const GOALS = [14, 16, 18, 24]

export default function FastingTab() {
  const [active, setActive] = useState<FastingRecord | null>(null)
  const [records, setRecords] = useState<FastingRecord[]>([])
  const [goalHours, setGoalHours] = useState(16)
  const [now, setNow] = useState(() => Date.now())
  const [editStartTime, setEditStartTime] = useState(false)
  const [startInput, setStartInput] = useState('')
  const [notifPerm, setNotifPerm] = useState<AppNotificationPermission>('prompt')
  const [editingRecordId, setEditingRecordId] = useState<number | null>(null)
  const [recordStartInput, setRecordStartInput] = useState('')
  const [recordEndInput, setRecordEndInput] = useState('')
  const [recordGoalInput, setRecordGoalInput] = useState('')
  const [recordEditError, setRecordEditError] = useState('')

  const load = useCallback(
    () => db.fastingRecords.orderBy('startTime').reverse().toArray(),
    [],
  )

  const applyLoadedRecords = useCallback((all: FastingRecord[]) => {
    const cur = all.find(r => !r.endTime) ?? null
    setActive(cur)
    setRecords(all.filter(r => r.endTime))
  }, [])

  useEffect(() => { void load().then(applyLoadedRecords) }, [applyLoadedRecords, load])

  useEffect(() => {
    getPermissionStatus().then(setNotifPerm).catch(() => setNotifPerm('denied'))
  }, [])

  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [active])

  const elapsed = active ? now - active.startTime : 0
  const goal = active ? active.goalHours * 3600000 : goalHours * 3600000
  const progress = Math.min(elapsed / goal, 1)
  const h = Math.floor(elapsed / 3600000)
  const m = Math.floor((elapsed % 3600000) / 60000)
  const s = Math.floor((elapsed % 60000) / 1000)
  const pad = (n: number) => String(n).padStart(2, '0')

  const circumference = 2 * Math.PI * 90
  const dashOffset = circumference * (1 - progress)

  const startFasting = async () => {
    const granted = await requestPermission()
    setNotifPerm(granted ? 'granted' : await getPermissionStatus())
    const ts = Date.now()
    const id = await db.fastingRecords.add({ startTime: ts, goalHours })
    setActive({ id, startTime: ts, goalHours })
    setNow(ts)
    if (granted) showFastingNotification(ts, goalHours)
  }

  const stopFasting = async () => {
    if (!active?.id) return
    const endTime = Date.now()
    await db.fastingRecords.update(active.id, { endTime })
    await clearFastingNotification()
    const duration = endTime - active.startTime
    if (duration >= active.goalHours * 3600000) showFastingComplete(duration)
    await load().then(applyLoadedRecords)
  }

  const applyStartEdit = async () => {
    if (!active?.id || !startInput) return
    const ms = new Date(startInput).getTime()
    if (isNaN(ms)) return
    await db.fastingRecords.update(active.id, { startTime: ms })
    setActive(a => a ? { ...a, startTime: ms } : a)
    setEditStartTime(false)
  }

  const deleteRecord = async (id: number) => {
    await db.fastingRecords.delete(id)
    if (editingRecordId === id) setEditingRecordId(null)
    await load().then(applyLoadedRecords)
  }

  const openRecordEdit = (record: FastingRecord) => {
    if (!record.id || !record.endTime) return
    setEditingRecordId(record.id)
    setRecordStartInput(format(new Date(record.startTime), "yyyy-MM-dd'T'HH:mm"))
    setRecordEndInput(format(new Date(record.endTime), "yyyy-MM-dd'T'HH:mm"))
    setRecordGoalInput(String(record.goalHours))
    setRecordEditError('')
  }

  const saveRecordEdit = async () => {
    if (!editingRecordId) return
    const startTime = new Date(recordStartInput).getTime()
    const endTime = new Date(recordEndInput).getTime()
    const nextGoalHours = Number(recordGoalInput)
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
      setRecordEditError('종료 시간은 시작 시간보다 뒤여야 합니다.')
      return
    }
    if (!Number.isFinite(nextGoalHours) || nextGoalHours <= 0 || nextGoalHours > 168) {
      setRecordEditError('목표 시간은 1~168시간으로 입력해 주세요.')
      return
    }
    await db.fastingRecords.update(editingRecordId, {
      startTime,
      endTime,
      goalHours: nextGoalHours,
    })
    setEditingRecordId(null)
    setRecordEditError('')
    await load().then(applyLoadedRecords)
  }

  const formatDur = (ms: number) => {
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    return `${h}시간 ${m}분`
  }

  const expectedEnd = active
    ? new Date(active.startTime + active.goalHours * 3600000)
    : null

  const askPermission = async () => {
    const granted = await requestPermission()
    setNotifPerm(granted ? 'granted' : await getPermissionStatus())
  }

  return (
    <div className="px-4 pt-3 pb-4">
      {/* 알림 권한 배너 */}
      {notifPerm !== 'granted' && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 mb-4 flex items-center gap-3">
          <span className="text-lg">🔔</span>
          <div className="flex-1">
            <p className="text-xs text-amber-500 font-medium">알림 권한 필요</p>
            <p className="text-[10px] text-gray-400">
              {notifPerm === 'denied'
                ? '거부된 경우 설정 → 애플리케이션 → Prec → 알림에서 켜주세요'
                : '단식 진행·목표 완료 알림을 받으려면 허용해 주세요'}
            </p>
          </div>
          <button
            onClick={askPermission}
            className="text-xs bg-amber-500 text-black px-3 py-1.5 rounded-lg font-medium shrink-0"
          >
            허용
          </button>
        </div>
      )}

      {/* 목표 선택 */}
      {!active && (
        <div className="flex gap-2 mb-6 justify-center">
          {GOALS.map(g => (
            <button
              key={g}
              onClick={() => setGoalHours(g)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                goalHours === g
                  ? 'bg-emerald-500 text-white'
                  : 'bg-white border border-gray-200 text-gray-500'
              }`}
            >
              {g}h
            </button>
          ))}
        </div>
      )}

      {/* 원형 타이머 */}
      <div className="flex justify-center mb-6">
        <div className="relative w-52 h-52">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="90" fill="none" stroke="#e5e7eb" strokeWidth="12" />
            <circle
              cx="100" cy="100" r="90"
              fill="none"
              stroke={progress >= 1 ? '#15803d' : '#16a34a'}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{ transition: 'stroke-dashoffset 0.5s, stroke 0.5s' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {active ? (
              <>
                <span className="text-xs text-gray-400 mb-1">
                  {progress >= 1 ? '🎉 목표 달성!' : '단식 중'}
                </span>
                <span className="text-3xl font-mono font-bold text-gray-900 tabular-nums">
                  {pad(h)}:{pad(m)}:{pad(s)}
                </span>
                <span className="text-xs text-gray-400 mt-1">목표 {active.goalHours}시간</span>
              </>
            ) : (
              <>
                <span className="text-gray-400 text-sm">단식 안함</span>
                <span className="text-2xl font-bold text-gray-900 mt-1">{goalHours}h</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 시작/종료 시간 정보 */}
      {active && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-5 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">시작</p>
              <p className="text-sm text-gray-900">{format(new Date(active.startTime), 'M/d HH:mm')}</p>
            </div>
            <button
              onClick={() => {
                setStartInput(format(new Date(active.startTime), "yyyy-MM-dd'T'HH:mm"))
                setEditStartTime(v => !v)
              }}
              className="text-xs text-emerald-500 border border-emerald-400/30 px-2 py-1 rounded-lg"
            >
              수정
            </button>
          </div>
          {editStartTime && (
            <div className="flex gap-2">
              <input
                type="datetime-local"
                className="flex-1 bg-gray-100 rounded-xl px-3 py-2 text-gray-900 outline-none text-sm"
                value={startInput}
                onChange={e => setStartInput(e.target.value)}
              />
              <button onClick={applyStartEdit} className="text-xs bg-emerald-500 text-white px-3 py-2 rounded-xl">
                적용
              </button>
            </div>
          )}
          {expectedEnd && (
            <div>
              <p className="text-xs text-gray-400">예상 종료</p>
              <p className="text-sm text-gray-900">{format(expectedEnd, 'M/d HH:mm')}</p>
            </div>
          )}
        </div>
      )}

      {/* 시작/종료 버튼 */}
      <button
        onClick={active ? stopFasting : startFasting}
        className={`w-full py-4 rounded-2xl font-semibold text-lg transition-colors ${
          active
            ? 'bg-red-500/15 text-red-400 active:bg-red-500/25'
            : 'bg-emerald-500 text-white active:bg-emerald-600'
        }`}
      >
        {active ? '단식 종료' : '단식 시작'}
      </button>

      {/* 기록 목록 */}
      {records.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">단식 기록</h3>
          <ul className="space-y-2">
            {records.slice(0, 10).map(r => {
              const dur = r.endTime! - r.startTime
              const achieved = dur >= r.goalHours * 3600000
              return (
                <li key={r.id} className="bg-white border border-gray-100 rounded-xl p-3.5">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{achieved ? '✅' : '⏹'}</span>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">{formatDur(dur)}</p>
                      <p className="text-xs text-gray-400">
                        {format(new Date(r.startTime), 'M/d HH:mm')} ~ {format(new Date(r.endTime!), 'M/d HH:mm')}
                        {' · '}목표 {r.goalHours}h
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => editingRecordId === r.id ? setEditingRecordId(null) : openRecordEdit(r)}
                      className="rounded-lg px-2 py-1 text-xs text-emerald-500 active:bg-emerald-50"
                    >수정</button>
                    <button
                      type="button"
                      aria-label="단식 기록 삭제"
                      onClick={() => r.id && deleteRecord(r.id)}
                      className="text-gray-300 text-lg active:text-red-400"
                    >×</button>
                  </div>
                  {editingRecordId === r.id && (
                    <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                      <label className="block text-[11px] text-gray-400">
                        시작 시간
                        <input
                          type="datetime-local"
                          value={recordStartInput}
                          onChange={event => setRecordStartInput(event.target.value)}
                          className="mt-1 w-full rounded-xl bg-gray-100 px-3 py-2 text-sm text-gray-900 outline-none"
                        />
                      </label>
                      <label className="block text-[11px] text-gray-400">
                        종료 시간
                        <input
                          type="datetime-local"
                          value={recordEndInput}
                          onChange={event => setRecordEndInput(event.target.value)}
                          className="mt-1 w-full rounded-xl bg-gray-100 px-3 py-2 text-sm text-gray-900 outline-none"
                        />
                      </label>
                      <label className="block text-[11px] text-gray-400">
                        목표 시간
                        <input
                          type="number"
                          min="1"
                          max="168"
                          step="0.5"
                          value={recordGoalInput}
                          onChange={event => setRecordGoalInput(event.target.value)}
                          className="mt-1 w-full rounded-xl bg-gray-100 px-3 py-2 text-sm text-gray-900 outline-none"
                        />
                      </label>
                      {recordEditError && <p className="text-xs text-red-400">{recordEditError}</p>}
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingRecordId(null)}
                          className="flex-1 rounded-xl bg-gray-100 py-2 text-xs font-medium text-gray-500"
                        >취소</button>
                        <button
                          type="button"
                          onClick={saveRecordEdit}
                          className="flex-1 rounded-xl bg-emerald-500 py-2 text-xs font-semibold text-white"
                        >저장</button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
