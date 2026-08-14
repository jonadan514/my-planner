import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isToday, parseISO, addMonths, subMonths,
} from 'date-fns'
import { ko } from 'date-fns/locale'
import { db } from '../db/database'
import type { Event, ShiftConfig } from '../db/database'
import { getShiftForDate } from '../utils/shift'
import EventModal from '../components/EventModal'
import ShiftSettingsModal from '../components/ShiftSettingsModal'

const COLORS = ['#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#f43f5e', '#a78bfa', '#fb923c']

export default function CalendarPage() {
  const [viewDate, setViewDate] = useState(new Date())
  const [events, setEvents] = useState<Event[]>([])
  const [shiftConfig, setShiftConfig] = useState<ShiftConfig | null>(null)
  const [selected, setSelected] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
  const [showModal, setShowModal] = useState(false)
  const [editEvent, setEditEvent] = useState<Event | null>(null)
  const [showShift, setShowShift] = useState(false)

  const load = useCallback(async () => {
    const start = format(startOfMonth(viewDate), 'yyyy-MM-dd')
    const end   = format(endOfMonth(viewDate), 'yyyy-MM-dd')
    const [nextEvents, nextShiftConfig] = await Promise.all([
      db.events.where('date').between(start, end, true, true).toArray(),
      db.shiftConfigs.toCollection().last(),
    ])
    return { nextEvents, nextShiftConfig: nextShiftConfig ?? null }
  }, [viewDate])

  const applyLoadedCalendar = useCallback((data: Awaited<ReturnType<typeof load>>) => {
    setEvents(data.nextEvents)
    setShiftConfig(data.nextShiftConfig)
  }, [])

  useEffect(() => { void load().then(applyLoadedCalendar) }, [applyLoadedCalendar, load])

  const weeks = eachDayOfInterval({
    start: startOfWeek(startOfMonth(viewDate), { weekStartsOn: 0 }),
    end:   endOfWeek(endOfMonth(viewDate),     { weekStartsOn: 0 }),
  })

  const eventsByDate = useMemo(() => {
    const map = new Map<string, Event[]>()
    for (const e of events) {
      const list = map.get(e.date) ?? []
      list.push(e)
      map.set(e.date, list)
    }
    return map
  }, [events])

  const dayEvents = (ds: string) => eventsByDate.get(ds) ?? []
  const dayShift  = (ds: string) => shiftConfig ? getShiftForDate(shiftConfig, ds) : null
  const selectedEvents = dayEvents(selected)

  return (
    <div className="page-enter flex h-full min-h-0 flex-col overflow-hidden">

      {/* 월 네비게이션 */}
      <div className="flex items-center justify-between px-4 pt-5 pb-2 shrink-0">
        <button
          onClick={() => setViewDate(d => subMonths(d, 1))}
          className="w-10 h-10 flex items-center justify-center rounded-full text-gray-400 active:bg-gray-100 text-2xl"
        >‹</button>
        <h2 className="text-lg font-bold text-gray-900">
          {format(viewDate, 'yyyy년 M월', { locale: ko })}
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowShift(true)}
            className="h-8 flex items-center gap-1 px-2.5 text-xs text-gray-500 border border-gray-200 rounded-xl active:bg-gray-100"
          >
            <span>👔</span><span>근무</span>
          </button>
          <button
            onClick={() => setViewDate(d => addMonths(d, 1))}
            className="w-10 h-10 flex items-center justify-center rounded-full text-gray-400 active:bg-gray-100 text-2xl"
          >›</button>
        </div>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 px-3 shrink-0">
        {['일','월','화','수','목','금','토'].map((d, i) => (
          <div
            key={d}
            className={`text-center text-[11px] py-1.5 font-semibold ${
              i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'
            }`}
          >{d}</div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 px-3 shrink-0">
        {weeks.map(day => {
          const ds = format(day, 'yyyy-MM-dd')
          const inMonth = isSameMonth(day, viewDate)
          const isSelected = ds === selected
          const shift = inMonth ? dayShift(ds) : null
          const evts  = inMonth ? dayEvents(ds) : []
          const dow = day.getDay()

          return (
            <button
              key={ds}
              onClick={() => inMonth && setSelected(ds)}
              disabled={!inMonth}
              className={`flex flex-col items-center py-1.5 rounded-xl min-h-[58px] transition-colors ${
                isSelected ? 'bg-indigo-500/15' : 'active:bg-gray-100'
              } ${!inMonth ? 'opacity-20' : ''}`}
            >
              <span className={`w-8 h-8 flex items-center justify-center rounded-full text-[13px] font-semibold ${
                isToday(day)
                  ? 'bg-indigo-500 text-white'
                  : dow === 0 ? 'text-red-400' : dow === 6 ? 'text-blue-400' : 'text-gray-700'
              }`}>
                {format(day, 'd')}
              </span>
              {shift && (
                <span
                  className="text-[9px] font-bold px-1 rounded leading-[14px] mt-0.5"
                  style={{ color: shift.color, background: shift.color + '22' }}
                >
                  {shift.label}
                </span>
              )}
              {evts.length > 0 && (
                <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                  {evts.slice(0, 3).map((e, i) => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: e.color || '#6366f1' }} />
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* 선택 날짜 일정 */}
      <div className="app-scroll min-h-0 flex-1 overflow-y-auto px-4 mt-3">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-900">
            {format(parseISO(selected), 'M월 d일 (EEEE)', { locale: ko })}
          </p>
          <button
            onClick={() => { setEditEvent(null); setShowModal(true) }}
            className="h-9 px-3 text-sm bg-indigo-500 text-white rounded-xl active:bg-indigo-600 font-medium"
          >
            + 추가
          </button>
        </div>

        {selectedEvents.length === 0 ? (
          <p className="text-gray-300 text-sm py-4">일정이 없습니다</p>
        ) : (
          <ul className="space-y-2 pb-4">
            {selectedEvents.map(e => (
              <li
                key={e.id}
                onClick={() => { setEditEvent(e); setShowModal(true) }}
                className="rounded-2xl p-4 bg-white border border-gray-100 flex items-start gap-3 active:bg-gray-50"
              >
                <div className="w-1 rounded-full self-stretch shrink-0" style={{ background: e.color || '#6366f1' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] text-gray-900">{e.title}</p>
                  {(e.startTime || e.endTime) && (
                    <p className="text-xs text-gray-400 mt-1">
                      {e.startTime}{e.endTime ? ` ~ ${e.endTime}` : ''}
                    </p>
                  )}
                  {e.memo && <p className="text-xs text-gray-400 mt-1 truncate">{e.memo}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showShift && (
        <ShiftSettingsModal
          current={shiftConfig}
          onClose={() => setShowShift(false)}
          onSaved={() => { void load().then(applyLoadedCalendar) }}
        />
      )}

      {showModal && (
        <EventModal
          date={selected}
          event={editEvent}
          colors={COLORS}
          onClose={() => setShowModal(false)}
          onSave={async (ev) => {
            if (ev.id) await db.events.put(ev)
            else await db.events.add({ ...ev, createdAt: Date.now() })
            setShowModal(false)
            applyLoadedCalendar(await load())
          }}
          onDelete={async (id) => {
            await db.events.delete(id)
            setShowModal(false)
            applyLoadedCalendar(await load())
          }}
        />
      )}
    </div>
  )
}
