import { useEffect, useState } from 'react'
import { getHealthConnectStatus, syncHealthConnect } from '../integrations/healthConnect'
import type { HealthDataType, HealthSyncStatus } from '../db/database'

const TYPE_LABELS: Record<HealthDataType, string> = {
  EXERCISE: '운동', STEPS: '걸음', SLEEP: '수면', WEIGHT: '체중', BODY_FAT: '체지방',
}

interface ViewState {
  status: HealthSyncStatus
  grantedDataTypes: HealthDataType[]
  lastSuccessfulSyncAt?: string
}

const INITIAL_STATE: ViewState = { status: 'IDLE', grantedDataTypes: [] }

export default function HealthConnectCard() {
  const [state, setState] = useState<ViewState>(INITIAL_STATE)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getHealthConnectStatus().then(setState)
  }, [])

  const sync = async () => {
    setBusy(true)
    const next = await syncHealthConnect(true)
    setState(next)
    setBusy(false)
  }

  if (state.status === 'UNAVAILABLE') {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-4">
        <div className="flex items-center justify-between"><p className="text-sm font-semibold text-gray-900">Health Connect</p><span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded-lg">사용 불가</span></div>
        <p className="text-xs text-gray-400 mt-2">현재 웹/PWA 실행에서는 Android 건강 데이터에 접근할 수 없습니다. 수동 기록은 계속 사용할 수 있습니다.</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2"><p className="text-sm font-semibold text-gray-900">Health Connect</p><button onClick={sync} disabled={busy} className="text-xs text-indigo-500 disabled:text-gray-300">{busy ? '동기화 중' : state.status === 'PERMISSION_REQUIRED' ? '권한 연결' : '지금 동기화'}</button></div>
      <div className="flex flex-wrap gap-1.5">{(Object.keys(TYPE_LABELS) as HealthDataType[]).map(type => <span key={type} className={`text-[10px] px-2 py-1 rounded-lg ${state.grantedDataTypes.includes(type) ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>{TYPE_LABELS[type]}</span>)}</div>
      <p className="text-[10px] text-gray-400 mt-2">마지막 동기화: {state.lastSuccessfulSyncAt ? new Date(state.lastSuccessfulSyncAt).toLocaleString() : '없음'}</p>
    </div>
  )
}
