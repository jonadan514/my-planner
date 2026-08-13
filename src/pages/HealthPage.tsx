import { useState } from 'react'
import FastingTab from './FastingTab'
import InBodyTab from './InBodyTab'
import WorkoutTab from './WorkoutTab'

type SubTab = 'fasting' | 'inbody' | 'workout'

export default function HealthPage() {
  const [sub, setSub] = useState<SubTab>('fasting')

  return (
    <div className="page-enter flex flex-col">
      {/* 헤더 */}
      <div className="px-4 pt-6 pb-0">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">건강</h1>

        {/* 서브탭 */}
        <div className="flex gap-1 bg-white border border-gray-100 rounded-2xl p-1">
          <button
            onClick={() => setSub('fasting')}
            className={`flex-1 py-2.5 text-sm rounded-xl font-medium transition-colors ${
              sub === 'fasting' ? 'bg-indigo-500 text-white' : 'text-gray-400'
            }`}
          >
            ⏱ 단식
          </button>
          <button
            onClick={() => setSub('inbody')}
            className={`flex-1 py-2.5 text-sm rounded-xl font-medium transition-colors ${
              sub === 'inbody' ? 'bg-indigo-500 text-white' : 'text-gray-400'
            }`}
          >
            💪 인바디
          </button>
          <button
            onClick={() => setSub('workout')}
            className={`flex-1 py-2.5 text-sm rounded-xl font-medium transition-colors ${
              sub === 'workout' ? 'bg-indigo-500 text-white' : 'text-gray-400'
            }`}
          >
            🏋️ 운동
          </button>
        </div>
      </div>

      {/* 서브 페이지 */}
      {sub === 'fasting' && <FastingTab />}
      {sub === 'inbody'  && <InBodyTab />}
      {sub === 'workout' && <WorkoutTab />}
    </div>
  )
}
