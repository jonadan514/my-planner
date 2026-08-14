import { useEffect, useState } from 'react'
import { getHealthConnectStatus, hasNativeHealthConnectBridge, syncHealthConnect } from '../integrations/healthConnect'
import type { HealthDataType, HealthSyncStatus } from '../db/database'

const TYPE_LABELS: Record<HealthDataType, string> = {
  EXERCISE: '운동', STEPS: '걸음', SLEEP: '수면', WEIGHT: '체중', BODY_FAT: '체지방',
}
const VISIBLE_DATA_TYPES: HealthDataType[] = ['EXERCISE']

interface ViewState {
  status: HealthSyncStatus
  grantedDataTypes: HealthDataType[]
  lastSuccessfulSyncAt?: string
  lastRecordCount?: number
  sourcePackages?: string[]
  errorCode?: string
}

const INITIAL_STATE: ViewState = { status: 'IDLE', grantedDataTypes: [] }

export default function HealthConnectCard() {
  const [state, setState] = useState<ViewState>(INITIAL_STATE)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getHealthConnectStatus().then(setState).catch(error => setState({
      status: 'ERROR',
      grantedDataTypes: [],
      errorCode: error instanceof Error ? error.message : '상태를 확인하지 못했습니다.',
    }))
  }, [])

  const sync = async () => {
    setBusy(true)
    try {
      const next = await syncHealthConnect(true)
      setState(next)
    } catch (error) {
      setState(previous => ({
        ...previous,
        status: 'ERROR',
        errorCode: error instanceof Error ? error.message : '동기화하지 못했습니다.',
      }))
    } finally {
      setBusy(false)
    }
  }

  if (state.status === 'UNAVAILABLE') {
    const unavailableMessage = hasNativeHealthConnectBridge()
      ? '이 기기에서 Health Connect를 찾지 못했습니다. Android 설정에서 Health Connect를 설치하거나 업데이트한 뒤 다시 실행해 주세요.'
      : '브라우저에서는 건강 데이터에 접근할 수 없습니다. Prec Android 앱을 설치하면 삼성헬스 운동기록을 연결할 수 있습니다.'
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-4">
        <div className="flex items-center justify-between"><p className="text-sm font-semibold text-gray-900">Health Connect</p><span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded-lg">사용 불가</span></div>
        <p className="text-xs text-gray-400 mt-2">{unavailableMessage}</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2"><p className="text-sm font-semibold text-gray-900">Samsung Health · Health Connect</p><button onClick={sync} disabled={busy} className="text-xs text-indigo-500 disabled:text-gray-300">{busy ? '동기화 중' : state.status === 'PERMISSION_REQUIRED' ? '운동 권한 연결' : '지금 동기화'}</button></div>
      <div className="flex flex-wrap gap-1.5">{VISIBLE_DATA_TYPES.map(type => <span key={type} className={`text-[10px] px-2 py-1 rounded-lg ${state.grantedDataTypes.includes(type) ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>{TYPE_LABELS[type]}</span>)}</div>
      <p className="text-[10px] text-gray-400 mt-2">마지막 동기화: {state.lastSuccessfulSyncAt ? new Date(state.lastSuccessfulSyncAt).toLocaleString() : '없음'}</p>
      {state.lastSuccessfulSyncAt && (
        <p className={`mt-1 text-[10px] ${state.lastRecordCount ? 'text-emerald-600' : 'text-amber-500'}`}>
          최근 90일 운동 {state.lastRecordCount ?? 0}건 확인
          {state.sourcePackages?.length ? ` · ${state.sourcePackages.join(', ')}` : ''}
        </p>
      )}
      {state.lastSuccessfulSyncAt && state.lastRecordCount === 0 && (
        <p className="mt-1 text-[10px] leading-4 text-gray-400">
          Samsung Health → 설정 → Health Connect에서 운동 공유가 켜져 있는지 확인해 주세요.
        </p>
      )}
      {(state.status === 'ERROR' || state.status === 'PARTIAL') && <p className="text-[10px] text-red-400 mt-1">{state.errorCode || '동기화 중 오류가 발생했습니다.'}</p>}
    </div>
  )
}
