import { useEffect, useState, useCallback, useRef } from 'react'
import { db } from '../db/database'
import type { Todo } from '../db/database'
import { format } from 'date-fns'

type Filter = 'all' | 'today' | 'pending'

export default function TodoPage() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [dueDate, setDueDate] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)
  const todayStr = format(new Date(), 'yyyy-MM-dd')

  const load = useCallback(async () => {
    const all = await db.todos.orderBy('createdAt').reverse().toArray()
    setTodos(all)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = todos.filter(t => {
    if (filter === 'today') return t.dueDate === todayStr
    if (filter === 'pending') return !t.done
    return true
  })

  const toggle = async (t: Todo) => {
    await db.todos.update(t.id!, { done: !t.done })
    load()
  }

  const deleteTodo = async (id: number) => {
    await db.todos.delete(id)
    load()
  }

  const openAdd = () => {
    setTitle('')
    setNotes('')
    setDueDate('')
    setShowAdd(true)
    // 키패드가 안정된 후 포커스 (레이아웃 먼저 렌더링)
    setTimeout(() => titleRef.current?.focus(), 100)
  }

  const closeAdd = () => {
    setShowAdd(false)
  }

  const addTodo = async () => {
    if (!title.trim()) return
    await db.todos.add({
      title: title.trim(),
      notes: notes.trim() || undefined,
      dueDate: dueDate || undefined,
      done: false,
      priority: 'medium',
      createdAt: Date.now(),
    })
    closeAdd()
    load()
  }

  const pendingCount = todos.filter(t => !t.done).length

  return (
    <div className="page-enter px-4 py-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">할 일</h1>
          <p className="text-xs text-gray-400 mt-0.5">미완료 {pendingCount}개</p>
        </div>
        <button
          onClick={openAdd}
          className="bg-indigo-500 text-white text-sm px-4 py-2 rounded-xl active:opacity-80"
        >
          + 추가
        </button>
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-1 mb-4 bg-white border border-gray-100 rounded-xl p-1">
        {(['all', 'today', 'pending'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 py-2 text-sm rounded-lg transition-colors ${
              filter === f ? 'bg-indigo-500 text-white' : 'text-gray-400'
            }`}
          >
            {f === 'all' ? '전체' : f === 'today' ? '오늘' : '미완료'}
          </button>
        ))}
      </div>

      {/* 할일 목록 */}
      <ul className="space-y-2 pb-4">
        {filtered.length === 0 && (
          <li className="text-center text-gray-300 text-sm py-8">할일이 없습니다 🎉</li>
        )}
        {filtered.map(t => (
          <li
            key={t.id}
            className={`rounded-xl p-3.5 bg-white border border-gray-100 flex items-start gap-3 ${t.done ? 'opacity-50' : ''}`}
          >
            <button
              onClick={() => toggle(t)}
              className="shrink-0 w-11 h-11 -m-2 flex items-center justify-center"
              aria-label={t.done ? '완료 취소' : '완료'}
            >
              <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                t.done ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300'
              }`}>
                {t.done && <span className="text-white text-[10px] leading-none">✓</span>}
              </span>
            </button>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${t.done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                {t.title}
              </p>
              {t.notes && (
                <p className="text-xs text-gray-400 mt-0.5 truncate">{t.notes}</p>
              )}
              {t.dueDate && (
                <p className={`text-xs mt-1 ${t.dueDate < todayStr && !t.done ? 'text-red-400' : 'text-gray-400'}`}>
                  {t.dueDate === todayStr ? '오늘 마감' : `마감 ${t.dueDate}`}
                </p>
              )}
            </div>
            <button
              onClick={() => t.id && deleteTodo(t.id)}
              className="text-gray-300 text-lg leading-none active:text-red-400 shrink-0 p-1"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      {/* 추가 모달 — 상단 고정으로 키패드에 가리지 않음 */}
      {showAdd && (
        <div
          className="fixed inset-0 z-50 bg-black/40 overflow-y-auto"
          onClick={closeAdd}
        >
          <div
            className="mx-auto mt-16 w-full max-w-[480px] bg-white rounded-3xl p-5 space-y-4 mb-8"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">할일 추가</h3>
              <button onClick={closeAdd} className="text-gray-400 text-xl p-1">✕</button>
            </div>

            {/* 제목 */}
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">제목</label>
              <input
                ref={titleRef}
                className="w-full bg-gray-100 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 outline-none focus:ring-2 ring-indigo-400 text-sm"
                placeholder="할일을 입력하세요"
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>

            {/* 내용 */}
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">내용 (선택)</label>
              <textarea
                rows={3}
                className="w-full bg-gray-100 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 outline-none focus:ring-2 ring-indigo-400 text-sm resize-none"
                placeholder="세부 내용이나 메모를 입력하세요"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

            {/* 마감일 */}
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">마감일 (선택)</label>
              <input
                type="date"
                className="w-full bg-gray-100 rounded-xl px-4 py-3 text-gray-900 outline-none focus:ring-2 ring-indigo-400 text-sm"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
              />
            </div>

            <button
              onClick={addTodo}
              disabled={!title.trim()}
              className="w-full py-3 rounded-xl bg-indigo-500 text-white font-medium active:opacity-80 disabled:opacity-40"
            >
              추가
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
