import { useState } from 'react'
import BiTodayTab from './BiTodayTab'
import BiMealTab from './BiMealTab'
import BiSummaryTab from './BiSummaryTab'
import BiTrendTab from './BiTrendTab'

type SubTab = 'today' | 'meal' | 'summary' | 'trend'

export default function BodyImprovePage() {
  const [sub, setSub] = useState<SubTab>('today')

  return (
    <div className="page-enter flex flex-col">
      <div className="px-4 pt-6 pb-0">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">몸개선</h1>
        <div className="flex gap-1 bg-gray-100 rounded-2xl p-1">
          {([
            ['today',   '📋 오늘'],
            ['meal',    '🍱 식단'],
            ['summary', '📊 요약'],
            ['trend',   '📈 추세'],
          ] as [SubTab, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setSub(id)}
              className={`flex-1 py-2.5 text-xs rounded-xl font-medium transition-colors ${
                sub === id ? 'bg-emerald-500 text-white' : 'text-gray-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {sub === 'today'   && <BiTodayTab onOpenMeals={() => setSub('meal')} />}
      {sub === 'meal'    && <BiMealTab />}
      {sub === 'summary' && <BiSummaryTab />}
      {sub === 'trend'   && <BiTrendTab />}
    </div>
  )
}
