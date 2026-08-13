import { useEffect, useState, useCallback, useMemo } from 'react'
import { db } from '../db/database'
import type { LedgerEntry } from '../db/database'
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns'
import { ko } from 'date-fns/locale'

const EXPENSE_CATS = ['식비', '교통', '쇼핑', '의료', '문화', '생활', '기타']
const INCOME_CATS  = ['급여', '용돈', '부수입', '기타']

function formatAmount(n: number) {
  return n.toLocaleString('ko-KR') + '원'
}

export default function LedgerPage() {
  const [viewDate, setViewDate]   = useState(new Date())
  const [entries, setEntries]     = useState<LedgerEntry[]>([])
  const [showAdd, setShowAdd]     = useState(false)
  const [type, setType]           = useState<'income' | 'expense'>('expense')
  const [amount, setAmount]       = useState('')
  const [category, setCategory]   = useState('식비')
  const [memo, setMemo]           = useState('')
  const [entryDate, setEntryDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  const load = useCallback(async () => {
    const start = format(startOfMonth(viewDate), 'yyyy-MM-dd')
    const end   = format(endOfMonth(viewDate),   'yyyy-MM-dd')
    const list  = await db.ledger
      .where('date').between(start, end, true, true)
      .reverse().sortBy('date')
    setEntries(list)
  }, [viewDate])

  useEffect(() => { load() }, [load])

  const { totalIncome, totalExpense } = useMemo(() => ({
    totalIncome:  entries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0),
    totalExpense: entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0),
  }), [entries])

  const balance = totalIncome - totalExpense

  const grouped = useMemo(() => {
    const map = new Map<string, LedgerEntry[]>()
    for (const e of entries) {
      const list = map.get(e.date) ?? []
      list.push(e)
      map.set(e.date, list)
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [entries])

  const openAdd = (t: 'income' | 'expense') => {
    setType(t)
    setCategory(t === 'expense' ? '식비' : '급여')
    setAmount('')
    setMemo('')
    setEntryDate(format(new Date(), 'yyyy-MM-dd'))
    setShowAdd(true)
  }

  const save = async () => {
    const n = parseInt(amount.replace(/,/g, ''), 10)
    if (!n || n <= 0) return
    await db.ledger.add({
      date: entryDate,
      type,
      amount: n,
      category,
      memo: memo || undefined,
      createdAt: Date.now(),
    })
    setShowAdd(false)
    load()
  }

  const deleteEntry = async (id: number) => {
    await db.ledger.delete(id)
    load()
  }

  const cats = type === 'expense' ? EXPENSE_CATS : INCOME_CATS

  return (
    <div className="page-enter px-4 pt-6 pb-4">
      {/* 월 네비게이션 */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => setViewDate(d => subMonths(d, 1))}
          className="w-10 h-10 flex items-center justify-center text-gray-400 text-2xl active:bg-gray-100 rounded-full"
        >‹</button>
        <h1 className="text-lg font-bold text-gray-900">
          {format(viewDate, 'yyyy년 M월', { locale: ko })}
        </h1>
        <button
          onClick={() => setViewDate(d => addMonths(d, 1))}
          className="w-10 h-10 flex items-center justify-center text-gray-400 text-2xl active:bg-gray-100 rounded-full"
        >›</button>
      </div>

      {/* 월별 요약 카드 */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-4">
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="text-center">
            <p className="text-[11px] text-gray-400 mb-1">수입</p>
            <p className="text-base font-bold text-emerald-500">
              {totalIncome > 0 ? formatAmount(totalIncome) : '-'}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[11px] text-gray-400 mb-1">지출</p>
            <p className="text-base font-bold text-red-400">
              {totalExpense > 0 ? formatAmount(totalExpense) : '-'}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[11px] text-gray-400 mb-1">잔액</p>
            <p className={`text-base font-bold ${balance >= 0 ? 'text-gray-900' : 'text-red-400'}`}>
              {totalIncome === 0 && totalExpense === 0 ? '-' : formatAmount(balance)}
            </p>
          </div>
        </div>

        {totalIncome > 0 && totalExpense > 0 && (
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-400 rounded-full transition-all"
              style={{ width: `${Math.min((totalExpense / totalIncome) * 100, 100)}%` }}
            />
          </div>
        )}
      </div>

      {/* 추가 버튼 */}
      <div className="grid grid-cols-2 gap-2 mb-5">
        <button
          onClick={() => openAdd('income')}
          className="py-3 rounded-xl bg-emerald-500/10 text-emerald-600 font-semibold text-sm border border-emerald-500/20 active:bg-emerald-500/20"
        >
          + 수입
        </button>
        <button
          onClick={() => openAdd('expense')}
          className="py-3 rounded-xl bg-red-500/10 text-red-400 font-semibold text-sm border border-red-500/20 active:bg-red-500/20"
        >
          + 지출
        </button>
      </div>

      {/* 내역 목록 */}
      {grouped.length === 0 ? (
        <p className="text-center text-gray-300 text-sm py-10">내역이 없습니다</p>
      ) : (
        <div className="space-y-4 pb-6">
          {grouped.map(([date, list]) => {
            const dayIncome  = list.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0)
            const dayExpense = list.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0)
            return (
              <div key={date}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500">
                    {format(new Date(date), 'M월 d일 (EEE)', { locale: ko })}
                  </p>
                  <div className="flex gap-3 text-xs">
                    {dayIncome  > 0 && <span className="text-emerald-500">+{dayIncome.toLocaleString()}</span>}
                    {dayExpense > 0 && <span className="text-red-400">-{dayExpense.toLocaleString()}</span>}
                  </div>
                </div>

                <ul className="space-y-1.5">
                  {list.map(e => (
                    <li
                      key={e.id}
                      className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-3"
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0 ${
                        e.type === 'income' ? 'bg-emerald-500/10' : 'bg-red-500/10'
                      }`}>
                        {e.type === 'income' ? '📈' : '📉'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">{e.category}</p>
                        {e.memo && <p className="text-xs text-gray-400 truncate">{e.memo}</p>}
                      </div>
                      <p className={`text-sm font-semibold shrink-0 ${
                        e.type === 'income' ? 'text-emerald-500' : 'text-red-400'
                      }`}>
                        {e.type === 'income' ? '+' : '-'}{e.amount.toLocaleString()}
                      </p>
                      <button
                        onClick={() => e.id && deleteEntry(e.id)}
                        className="w-7 h-7 flex items-center justify-center text-gray-300 text-lg active:text-red-400 shrink-0"
                      >×</button>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}

      {/* 입력 바텀시트 */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowAdd(false)}>
          <div
            className="w-full max-w-[480px] bg-white rounded-t-3xl p-5 modal-sheet space-y-4 border-t border-gray-100"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className={`text-lg font-semibold ${type === 'income' ? 'text-emerald-500' : 'text-red-400'}`}>
                {type === 'income' ? '수입 추가' : '지출 추가'}
              </h3>
              <button onClick={() => setShowAdd(false)} className="w-8 h-8 flex items-center justify-center text-gray-400 text-2xl">✕</button>
            </div>

            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => { setType('expense'); setCategory('식비') }}
                className={`flex-1 py-2 text-sm rounded-lg font-medium transition-colors ${
                  type === 'expense' ? 'bg-red-500 text-white' : 'text-gray-400'
                }`}
              >지출</button>
              <button
                onClick={() => { setType('income'); setCategory('급여') }}
                className={`flex-1 py-2 text-sm rounded-lg font-medium transition-colors ${
                  type === 'income' ? 'bg-emerald-500 text-white' : 'text-gray-400'
                }`}
              >수입</button>
            </div>

            <div>
              <label className="text-sm text-gray-500 mb-1.5 block">금액</label>
              <div className="relative">
                <input
                  type="number" inputMode="numeric"
                  className="w-full bg-gray-100 rounded-xl pl-4 pr-10 py-3.5 text-gray-900 text-lg font-bold outline-none focus:ring-1 ring-indigo-500"
                  placeholder="0"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  autoFocus
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">원</span>
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-500 mb-1.5 block">날짜</label>
              <input
                type="date"
                className="w-full bg-gray-100 rounded-xl px-4 py-3 text-gray-900 outline-none focus:ring-1 ring-indigo-500"
                value={entryDate}
                onChange={e => setEntryDate(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm text-gray-500 mb-2 block">카테고리</label>
              <div className="flex flex-wrap gap-2">
                {cats.map(c => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={`px-3 py-1.5 rounded-xl text-sm transition-colors ${
                      category === c
                        ? type === 'income'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-red-500 text-white'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-500 mb-1.5 block">메모 (선택)</label>
              <input
                className="w-full bg-gray-100 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 outline-none focus:ring-1 ring-indigo-500"
                placeholder="내용 입력..."
                value={memo}
                onChange={e => setMemo(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && save()}
              />
            </div>

            <button
              onClick={save}
              className={`w-full py-3.5 rounded-xl text-white font-semibold text-base ${
                type === 'income' ? 'bg-emerald-500 active:bg-emerald-600' : 'bg-red-500 active:bg-red-600'
              }`}
            >
              저장
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
