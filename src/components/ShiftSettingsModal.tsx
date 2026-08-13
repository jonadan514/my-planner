import { useState } from 'react'
import { db } from '../db/database'
import type { ShiftConfig } from '../db/database'
import { format, addDays, parseISO, differenceInDays, subDays } from 'date-fns'
import { ko } from 'date-fns/locale'

const PRESETS = [
  {
    id: '3조2교대' as const,
    name: '3조 2교대',
    cycle: 21,
    desc: '주간 1주 → 야간/비번 교대 2주',
    pattern: [
      ...Array.from({ length: 7  }, () => ({ label: '주간', color: '#f59e0b' })),
      ...Array.from({ length: 14 }, (_, i) =>
        i % 2 === 0
          ? { label: '야간', color: '#6366f1' }
          : { label: '비번', color: '#6b7280' }
      ),
    ],
  },
  {
    id: '4조2교대' as const,
    name: '4조 2교대',
    cycle: 8,
    desc: '주주야비휴야비휴 반복',
    pattern: [
      { label: '주간', color: '#f59e0b' },
      { label: '주간', color: '#f59e0b' },
      { label: '야간', color: '#6366f1' },
      { label: '비번', color: '#22d3ee' },
      { label: '휴무', color: '#10b981' },
      { label: '야간', color: '#6366f1' },
      { label: '비번', color: '#22d3ee' },
      { label: '휴무', color: '#10b981' },
    ],
  },
]

interface Props {
  current: ShiftConfig | null
  onClose: () => void
  onSaved: () => void
}

export default function ShiftSettingsModal({ current, onClose, onSaved }: Props) {
  const todayStr = format(new Date(), 'yyyy-MM-dd')

  const detectPresetId = (): '3조2교대' | '4조2교대' =>
    current?.pattern.length === 21 ? '3조2교대' : '4조2교대'

  const initialPresetId = detectPresetId()
  const initialPreset   = PRESETS.find(p => p.id === initialPresetId)!

  const detectCycleDay = (p: typeof PRESETS[0]) => {
    if (!current?.startDate) return 1
    const diff = differenceInDays(parseISO(todayStr), parseISO(current.startDate))
    return ((diff % p.pattern.length) + p.pattern.length) % p.pattern.length + 1
  }

  const [selectedId,       setSelectedId]       = useState<'3조2교대' | '4조2교대'>(initialPresetId)
  const [refDate,          setRefDate]           = useState(todayStr)
  const [cycleDay,         setCycleDay]          = useState(() => detectCycleDay(initialPreset))
  const [holidays,         setHolidays]          = useState<string[]>(current?.holidays ?? [])
  const [showHolidayInput, setShowHolidayInput]  = useState(false)

  const preset       = PRESETS.find(p => p.id === selectedId)!
  const uniqueShifts = [...new Map(preset.pattern.map(d => [d.label, d])).values()]

  const startDate = format(subDays(parseISO(refDate), cycleDay - 1), 'yyyy-MM-dd')

  const clamp = (n: number) => Math.max(1, Math.min(preset.cycle, n))

  const previewDays = Array.from({ length: 7 }, (_, i) => {
    const date    = addDays(new Date(), i)
    const dateStr = format(date, 'yyyy-MM-dd')
    if (holidays.includes(dateStr)) return { date, shift: { label: '휴무', color: '#10b981' } }
    const diff = differenceInDays(parseISO(dateStr), parseISO(startDate))
    const idx  = ((diff % preset.pattern.length) + preset.pattern.length) % preset.pattern.length
    return { date, shift: preset.pattern[idx] }
  })

  const handlePresetChange = (id: '3조2교대' | '4조2교대') => {
    setSelectedId(id)
    setCycleDay(1)
  }

  const addHoliday = (dateStr: string) => {
    if (dateStr && !holidays.includes(dateStr))
      setHolidays(h => [...h, dateStr].sort())
    setShowHolidayInput(false)
  }

  const save = async () => {
    const cfg: ShiftConfig = { name: preset.name, pattern: preset.pattern, startDate, holidays }
    if (current?.id) await db.shiftConfigs.put({ ...cfg, id: current.id })
    else             await db.shiftConfigs.add(cfg)
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-[480px] bg-white rounded-t-3xl px-5 pt-5 space-y-4 max-h-[88vh] overflow-y-auto modal-sheet border-t border-gray-100"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">근무 패턴 설정</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 text-2xl">✕</button>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => handlePresetChange(p.id)}
              className={`flex-1 py-2.5 text-sm rounded-lg font-medium transition-colors ${
                selectedId === p.id ? 'bg-indigo-500 text-white' : 'text-gray-400'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>

        {/* 패턴 정보 */}
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500">{preset.desc}</p>
            <span className="text-[11px] text-gray-400">{preset.cycle}일 주기</span>
          </div>
          <div className="flex gap-0.5 flex-wrap mb-2">
            {preset.pattern.map((d, i) => (
              <span key={i} className="w-3 h-3 rounded-[3px]" style={{ background: d.color + '80' }} />
            ))}
          </div>
          <div className="flex gap-3">
            {uniqueShifts.map(d => (
              <span key={d.label} className="flex items-center gap-1 text-[10px]" style={{ color: d.color }}>
                <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ background: d.color }}/>
                {d.label}
              </span>
            ))}
          </div>
        </div>

        {/* 기준 날짜 설정 */}
        <div>
          <p className="text-xs text-gray-500 mb-2">현재 근무 기준 맞추기</p>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[11px] text-gray-400 mb-1 block">기준 날짜</label>
              <input
                type="date"
                className="w-full bg-gray-100 rounded-xl px-3 py-2.5 text-gray-900 outline-none text-sm"
                value={refDate}
                onChange={e => setRefDate(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="text-[11px] text-gray-400 mb-1 block">이 날은 사이클 몇 일차?</label>
              <div className="flex items-center bg-gray-100 rounded-xl h-[46px]">
                <button
                  onClick={() => setCycleDay(d => clamp(d - 1))}
                  className="w-11 h-full text-xl text-gray-400 active:text-gray-700 flex items-center justify-center shrink-0"
                >−</button>
                <span className="flex-1 text-center text-gray-900 font-bold tabular-nums">
                  {cycleDay}일
                </span>
                <button
                  onClick={() => setCycleDay(d => clamp(d + 1))}
                  className="w-11 h-full text-xl text-gray-400 active:text-gray-700 flex items-center justify-center shrink-0"
                >+</button>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-gray-300 mt-1.5">
            기준 날짜가 주기 첫날이면 1일, 8번째 날이면 8일 선택
          </p>
        </div>

        {/* 이번 주 미리보기 */}
        <div>
          <p className="text-xs text-gray-500 mb-1.5">이번 주 미리보기</p>
          <div className="grid grid-cols-7 gap-1">
            {previewDays.map(({ date, shift }, i) => (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <span className={`text-[10px] ${i === 0 ? 'text-indigo-500 font-semibold' : 'text-gray-400'}`}>
                  {format(date, 'EEE', { locale: ko })}
                </span>
                <div
                  className={`w-full py-1.5 rounded-lg flex items-center justify-center ${i === 0 ? 'ring-1 ring-indigo-400/40' : ''}`}
                  style={{ background: shift.color + '28' }}
                >
                  <span className="text-[10px] font-bold" style={{ color: shift.color }}>
                    {shift.label.slice(0, 1)}
                  </span>
                </div>
                <span className={`text-[9px] ${i === 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                  {format(date, 'd')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 추가 휴무 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500">추가 휴무</p>
            <button
              onClick={() => setShowHolidayInput(v => !v)}
              className="text-xs text-indigo-500 border border-indigo-400/30 px-2.5 py-1 rounded-lg active:bg-indigo-500/10"
            >
              + 날짜 추가
            </button>
          </div>

          {showHolidayInput && (
            <input
              type="date"
              autoFocus
              className="w-full bg-gray-100 rounded-xl px-4 py-2.5 text-gray-900 outline-none mb-2 focus:ring-1 ring-indigo-500"
              onChange={e => addHoliday(e.target.value)}
            />
          )}

          {holidays.length === 0 ? (
            <p className="text-[11px] text-gray-300">등록된 추가 휴무가 없습니다</p>
          ) : (
            <ul className="space-y-1">
              {holidays.map(d => (
                <li key={d} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"/>
                    <span className="text-sm text-gray-900">{d}</span>
                    <span className="text-[11px] text-gray-400">휴무</span>
                  </div>
                  <button
                    onClick={() => setHolidays(h => h.filter(x => x !== d))}
                    className="text-gray-300 text-lg active:text-red-400"
                  >×</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 저장 */}
        <button
          onClick={save}
          className="w-full py-3 rounded-xl bg-indigo-500 text-white font-semibold text-base active:bg-indigo-600"
        >
          저장
        </button>
      </div>
    </div>
  )
}
