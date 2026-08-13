import { useEffect, useState } from 'react'
import { db } from '../db/database'
import type { TabId } from '../App'
import { getShiftForDate } from '../utils/shift'
import type { Todo, FastingRecord, Event } from '../db/database'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { canNotify, requestPermission, showShiftNotification } from '../utils/notifications'

interface Props {
  onNavigate: (tab: TabId) => void
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <path d="M12 7v5l2.5 2.5"/>
    </svg>
  )
}

function BriefcaseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2"/>
      <path d="M16 7V5a2 2 0 00-2-2H8a2 2 0 00-2 2v2"/>
    </svg>
  )
}

export default function HomePage({ onNavigate }: Props) {
  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')
  const [todos, setTodos] = useState<Todo[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [fasting, setFasting] = useState<FastingRecord | null>(null)
  const [shift, setShift] = useState<{ label: string; color: string } | null>(null)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    db.todos.where('dueDate').equals(todayStr).filter(t => !t.done).toArray().then(setTodos)
    db.events.where('date').equals(todayStr).toArray().then(setEvents)
    db.fastingRecords.orderBy('startTime').last().then(r => {
      setFasting(r && !r.endTime ? r : null)
    })
    db.shiftConfigs.toCollection().last().then(cfg => {
      setShift(cfg ? getShiftForDate(cfg, todayStr) : null)
    })
  }, [todayStr])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const elapsed = fasting ? now - fasting.startTime : 0
  const elapsedH = Math.floor(elapsed / 3600000)
  const elapsedM = Math.floor((elapsed % 3600000) / 60000)

  const hour = new Date(now).getHours()
  const greeting =
    hour < 6  ? '야심한 밤이네요'  :
    hour < 12 ? '좋은 아침이에요' :
    hour < 18 ? '좋은 오후예요'   :
                '좋은 저녁이에요'

  return (
    <div className="page-enter px-4 pt-6 pb-4">
      {/* 날짜 + 시간 헤더 */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <p className="text-[11px] tracking-[0.14em] text-gray-400 mb-2 uppercase">
            {format(today, 'yyyy', { locale: ko })}
          </p>
          <h1 className="text-[2.6rem] font-bold text-gray-900 tracking-tight leading-none">
            {format(today, 'M월 d일', { locale: ko })}
          </h1>
          <p className="text-sm text-gray-400 mt-2">
            {format(today, 'EEEE', { locale: ko })}
          </p>
        </div>
        <div className="text-right pt-0.5">
          <p className="text-[2rem] font-light text-gray-900 tabular-nums leading-none tracking-tight">
            {format(new Date(now), 'HH:mm')}
          </p>
          <p className="text-[11px] text-gray-400 mt-2">{greeting}</p>
        </div>
      </div>

      {/* 근무 카드 */}
      {shift && (
        <div
          className="rounded-2xl p-4 mb-3 flex items-center gap-3 border"
          style={{ background: shift.color + '14', borderColor: shift.color + '28' }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: shift.color + '25', color: shift.color }}
          >
            <BriefcaseIcon />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-gray-400">오늘 근무</p>
            <p className="text-base font-semibold" style={{ color: shift.color }}>{shift.label}</p>
          </div>
          <button
            onClick={async () => {
              if (!canNotify()) await requestPermission()
              showShiftNotification(shift.label, shift.color)
            }}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 border border-gray-200 active:bg-gray-100 shrink-0 text-base"
          >🔔</button>
        </div>
      )}

      {/* 단식 카드 */}
      <div
        className="rounded-2xl p-4 mb-3 bg-white border border-gray-100 flex items-center gap-3 active:bg-gray-50"
        onClick={() => onNavigate('health')}
      >
        <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center text-indigo-500 shrink-0">
          <ClockIcon />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-gray-400">단식</p>
          {fasting ? (
            <>
              <p className="text-base font-semibold text-indigo-500">
                {elapsedH}h {elapsedM}m 진행중
              </p>
              <p className="text-xs text-gray-400 mt-0.5">목표 {fasting.goalHours}시간</p>
            </>
          ) : (
            <p className="text-base text-gray-400">단식 중이 아닙니다</p>
          )}
        </div>
        <span className="text-gray-300 text-xl shrink-0">›</span>
      </div>

      {/* 오늘 일정 */}
      <div
        className="rounded-2xl p-4 mb-3 bg-white border border-gray-100 active:bg-gray-50"
        onClick={() => onNavigate('calendar')}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-900">오늘 일정</p>
          <span className="text-gray-300 text-xl">›</span>
        </div>
        {events.length === 0 ? (
          <p className="text-gray-300 text-sm">일정이 없습니다</p>
        ) : (
          <ul className="space-y-2">
            {events.slice(0, 3).map(e => (
              <li key={e.id} className="flex items-center gap-2.5">
                <div
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: e.color || '#6366f1' }}
                />
                <span className="text-sm text-gray-700 flex-1 truncate">{e.title}</span>
                {e.startTime && (
                  <span className="text-xs text-gray-400 shrink-0">{e.startTime}</span>
                )}
              </li>
            ))}
            {events.length > 3 && (
              <p className="text-xs text-gray-400">+{events.length - 3}개 더</p>
            )}
          </ul>
        )}
      </div>

      {/* 오늘 할일 */}
      <div
        className="rounded-2xl p-4 bg-white border border-gray-100 active:bg-gray-50"
        onClick={() => onNavigate('todo')}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-900">오늘 할일</p>
          <div className="flex items-center gap-2">
            {todos.length > 0 && (
              <span className="text-xs bg-indigo-500/15 text-indigo-500 px-2 py-0.5 rounded-full">
                {todos.length}개
              </span>
            )}
            <span className="text-gray-300 text-xl">›</span>
          </div>
        </div>
        {todos.length === 0 ? (
          <p className="text-gray-300 text-sm">할일이 없습니다</p>
        ) : (
          <ul className="space-y-2">
            {todos.slice(0, 4).map(t => (
              <li key={t.id} className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full border border-gray-200 shrink-0" />
                <span className="text-sm text-gray-700 flex-1 truncate">{t.title}</span>
              </li>
            ))}
            {todos.length > 4 && (
              <p className="text-xs text-gray-400">+{todos.length - 4}개 더</p>
            )}
          </ul>
        )}
      </div>
    </div>
  )
}
