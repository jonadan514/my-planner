import { useEffect, useState, useCallback } from 'react'
import { db } from '../db/database'
import type { FastingRecord } from '../db/database'
import { format } from 'date-fns'
import {
  requestPermission,
  showFastingNotification, showFastingComplete, clearFastingNotification,
} from '../utils/notifications'

const GOALS = [14, 16, 18, 24]

export default function FastingPage() {
  const [active, setActive] = useState<FastingRecord | null>(null)
  const [records, setRecords] = useState<FastingRecord[]>([])
  const [goalHours, setGoalHours] = useState(16)
  const [now, setNow] = useState(Date.now())
  const [editStartTime, setEditStartTime] = useState(false)
  const [startInput, setStartInput] = useState('')
  const getNotifPerm = (): NotificationPermission =>
    'Notification' in window ? Notification.permission : 'denied'
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(getNotifPerm)

  const load = useCallback(async () => {
    const all = await db.fastingRecords.orderBy('startTime').reverse().toArray()
    const cur = all.find(r => !r.endTime) ?? null
    setActive(cur)
    setRecords(all.filter(r => r.endTime))
  }, [])

  useEffect(() => { load() }, [load])

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
    load()
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
    load()
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
    setNotifPerm(granted ? 'granted' : 'denied')
  }

  return (
    <div className="page-enter px-4 py-5">
      {/* 알림 권한 배너 */}
      {notifPerm !== 'granted' && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 mb-4 flex items-center gap-3">
          <span className="text-lg">🔔</span>
          <div className="flex-1">
            <p className="text-xs text-amber-400 font-medium">알림 권한 필요</p>
            <p className="text-[10px] text-[#888]">단식 시작·종료 시 상태바 알림을 받으려면 허용해주세요</p>
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
                  ? 'bg-indigo-500 text-white'
                  : 'bg-[#1e1e2a] text-[#888]'
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
            <circle cx="100" cy="100" r="90" fill="none" stroke="#1e1e2a" strokeWidth="12" />
            <circle
              cx="100" cy="100" r="90"
              fill="none"
              stroke={progress >= 1 ? '#10b981' : '#6366f1'}
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
                <span className="text-xs text-[#666] mb-1">
                  {progress >= 1 ? '🎉 목표 달성!' : '단식 중'}
                </span>
                <span className="text-3xl font-mono font-bold text-white tabular-nums">
                  {pad(h)}:{pad(m)}:{pad(s)}
                </span>
                <span className="text-xs text-[#555] mt-1">목표 {active.goalHours}시간</span>
              </>
            ) : (
              <>
                <span className="text-[#555] text-sm">단식 안함</span>
                <span className="text-2xl font-bold text-white mt-1">{goalHours}h</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 시작/종료 시간 정보 */}
      {active && (
        <div className="bg-[#1e1e2a] rounded-2xl p-4 mb-5 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[#666]">시작</p>
              <p className="text-sm text-white">{format(new Date(active.startTime), 'M/d HH:mm')}</p>
            </div>
            <button
              onClick={() => {
                setStartInput(format(new Date(active.startTime), "yyyy-MM-dd'T'HH:mm"))
                setEditStartTime(v => !v)
              }}
              className="text-xs text-indigo-400 border border-indigo-400/30 px-2 py-1 rounded-lg"
            >
              수정
            </button>
          </div>
          {editStartTime && (
            <div className="flex gap-2">
              <input
                type="datetime-local"
                className="flex-1 bg-[#252532] rounded-xl px-3 py-2 text-white outline-none text-sm"
                value={startInput}
                onChange={e => setStartInput(e.target.value)}
              />
              <button onClick={applyStartEdit} className="text-xs bg-indigo-500 text-white px-3 py-2 rounded-xl">
                적용
              </button>
            </div>
          )}
          {expectedEnd && (
            <div>
              <p className="text-xs text-[#666]">예상 종료</p>
              <p className="text-sm text-white">{format(expectedEnd, 'M/d HH:mm')}</p>
            </div>
          )}
        </div>
      )}

      {/* 시작/종료 버튼 */}
      <button
        onClick={active ? stopFasting : startFasting}
        className={`w-full py-4 rounded-2xl font-semibold text-lg transition-colors ${
          active
            ? 'bg-red-500/20 text-red-400 active:bg-red-500/30'
            : 'bg-indigo-500 text-white active:bg-indigo-600'
        }`}
      >
        {active ? '단식 종료' : '단식 시작'}
      </button>

      {/* 기록 목록 */}
      {records.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-white mb-3">단식 기록</h3>
          <ul className="space-y-2">
            {records.slice(0, 10).map(r => {
              const dur = r.endTime! - r.startTime
              const achieved = dur >= r.goalHours * 3600000
              return (
                <li key={r.id} className="bg-[#1e1e2a] rounded-xl p-3.5 flex items-center gap-3">
                  <span className="text-lg">{achieved ? '✅' : '⏹'}</span>
                  <div className="flex-1">
                    <p className="text-sm text-white">{formatDur(dur)}</p>
                    <p className="text-xs text-[#666]">
                      {format(new Date(r.startTime), 'M/d HH:mm')} ~ {format(new Date(r.endTime!), 'HH:mm')}
                      {' · '}목표 {r.goalHours}h
                    </p>
                  </div>
                  <button
                    onClick={() => r.id && deleteRecord(r.id)}
                    className="text-[#444] text-lg active:text-red-400"
                  >×</button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
