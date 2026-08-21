import { useState } from 'react'
import type { Event } from '../db/database'

interface Props {
  date: string
  event: Event | null
  colors: string[]
  onClose: () => void
  onSave: (ev: Event) => void
  onDelete: (id: number) => void
}

export default function EventModal({ date, event, colors, onClose, onSave, onDelete }: Props) {
  const [title, setTitle] = useState(event?.title ?? '')
  const [startTime, setStartTime] = useState(event?.startTime ?? '')
  const [endTime, setEndTime] = useState(event?.endTime ?? '')
  const [memo, setMemo] = useState(event?.memo ?? '')
  const [color, setColor] = useState(event?.color ?? colors[0])
  const [timeError, setTimeError] = useState('')

  const handleSave = () => {
    if (!title.trim()) return
    if (startTime && endTime && endTime <= startTime) {
      setTimeError('종료 시간은 시작 시간보다 늦어야 합니다')
      return
    }
    setTimeError('')
    onSave({
      ...(event ?? {}),
      title: title.trim(),
      date,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      memo: memo || undefined,
      color,
      createdAt: event?.createdAt ?? Date.now(),
    } as Event)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-[480px] bg-white rounded-t-3xl p-5 pb-8 space-y-4 border-t border-gray-100"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">{event ? '일정 수정' : '일정 추가'}</h3>
          <button onClick={onClose} className="text-gray-400 text-xl">✕</button>
        </div>

        <input
          className="w-full bg-gray-100 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 outline-none focus:ring-1 ring-emerald-500"
          placeholder="제목"
          value={title}
          onChange={e => setTitle(e.target.value)}
          autoFocus
        />

        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">시작</label>
            <input
              type="time"
              className="w-full bg-gray-100 rounded-xl px-3 py-2.5 text-gray-900 outline-none"
              value={startTime}
              onChange={e => { setStartTime(e.target.value); setTimeError('') }}
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">종료</label>
            <input
              type="time"
              className="w-full bg-gray-100 rounded-xl px-3 py-2.5 text-gray-900 outline-none"
              value={endTime}
              onChange={e => { setEndTime(e.target.value); setTimeError('') }}
            />
          </div>
        </div>
        {timeError && <p className="text-xs text-red-400 -mt-2">{timeError}</p>}

        <textarea
          className="w-full bg-gray-100 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 outline-none resize-none h-20"
          placeholder="메모 (선택)"
          value={memo}
          onChange={e => setMemo(e.target.value)}
        />

        {/* 색상 선택 */}
        <div className="flex gap-2">
          {colors.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-gray-400/50' : ''}`}
              style={{ background: c }}
            />
          ))}
        </div>

        <div className="flex gap-2 pt-1">
          {event?.id && (
            <button
              onClick={() => event.id && onDelete(event.id)}
              className="flex-1 py-3 rounded-xl bg-red-500/10 text-red-400 font-medium"
            >
              삭제
            </button>
          )}
          <button
            onClick={handleSave}
            className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-medium"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
