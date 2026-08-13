import { format } from 'date-fns'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { db } from '../db/database'
import type { HealthDataType, HealthRecord, HealthSyncStatus } from '../db/database'

const DATA_TYPES: HealthDataType[] = ['EXERCISE']

interface BridgeStatus {
  available: boolean
  grantedDataTypes: HealthDataType[]
}

interface ReadResult {
  records: Array<Omit<HealthRecord, 'id' | 'createdAt' | 'updatedAt'>>
  changeTokens?: Partial<Record<HealthDataType, string>>
}

interface HealthConnectBridge {
  getStatus(): Promise<BridgeStatus>
  requestReadPermissions(input: { dataTypes: HealthDataType[] }): Promise<BridgeStatus>
  readRecords(input: {
    dataTypes: HealthDataType[]
    startTime: string
    changeTokens?: Partial<Record<HealthDataType, string>>
  }): Promise<ReadResult>
}

const capacitorHealthConnectBridge = registerPlugin<HealthConnectBridge>('HealthConnectBridge')

declare global {
  interface Window {
    HealthConnectBridge?: HealthConnectBridge
  }
}

export function hasNativeHealthConnectBridge(): boolean {
  return (typeof window !== 'undefined' && window.HealthConnectBridge != null) || Capacitor.isNativePlatform()
}

function getNativeHealthConnectBridge(): HealthConnectBridge | undefined {
  if (typeof window !== 'undefined' && window.HealthConnectBridge) return window.HealthConnectBridge
  return Capacitor.isNativePlatform() ? capacitorHealthConnectBridge : undefined
}

export async function getHealthConnectStatus(): Promise<{
  status: HealthSyncStatus
  grantedDataTypes: HealthDataType[]
  lastSuccessfulSyncAt?: string
  errorCode?: string
}> {
  const bridge = getNativeHealthConnectBridge()
  if (!bridge) return { status: 'UNAVAILABLE', grantedDataTypes: [] }
  const [nativeStatus, syncStates] = await Promise.all([
    bridge.getStatus(),
    db.healthSyncStates.toArray(),
  ])
  const lastSuccessfulSyncAt = syncStates
    .map(state => state.lastSuccessfulSyncAt)
    .filter((value): value is string => value != null)
    .sort()
    .at(-1)
  if (!nativeStatus.available) return { status: 'UNAVAILABLE', grantedDataTypes: [] }
  if (nativeStatus.grantedDataTypes.length === 0) {
    return { status: 'PERMISSION_REQUIRED', grantedDataTypes: [] }
  }

  const grantedStates = syncStates.filter(state => nativeStatus.grantedDataTypes.includes(state.dataType))
  const errors = grantedStates.filter(state => state.status === 'ERROR')
  const status: HealthSyncStatus = grantedStates.some(state => state.status === 'SYNCING')
    ? 'SYNCING'
    : errors.length === grantedStates.length && errors.length > 0
      ? 'ERROR'
      : errors.length > 0
        ? 'PARTIAL'
        : grantedStates.length > 0 && grantedStates.every(state => state.status === 'SUCCESS')
          ? 'SUCCESS'
          : 'IDLE'
  return {
    status,
    grantedDataTypes: nativeStatus.grantedDataTypes,
    lastSuccessfulSyncAt,
    errorCode: errors[0]?.errorCode,
  }
}

async function saveImportedRecord(record: Omit<HealthRecord, 'id' | 'createdAt' | 'updatedAt'>, now: number) {
  const externalKey = `${record.sourcePackage ?? 'unknown'}:${record.dataType}:${record.externalRecordId}`
  const existing = await db.healthRecords.where('externalKey').equals(externalKey).first()
  await db.healthRecords.put({ ...record, externalKey, id: existing?.id, createdAt: existing?.createdAt ?? now, updatedAt: now })

  if (record.dataType === 'EXERCISE') {
    const workout = await db.workoutLogs.where('externalRecordId').equals(record.externalRecordId)
      .and(item => item.sourcePackage === record.sourcePackage).first()
    await db.workoutLogs.put({
      id: workout?.id,
      date: record.date,
      name: record.unit || 'Health Connect 운동',
      category: '자동 기록',
      duration: record.durationMinutes,
      distance: record.distanceKm,
      caloriesKcal: record.caloriesKcal,
      averageHeartRate: record.averageHeartRate,
      startTime: record.startTime,
      endTime: record.endTime,
      origin: 'HEALTH_CONNECT',
      externalRecordId: record.externalRecordId,
      sourcePackage: record.sourcePackage,
      createdAt: workout?.createdAt ?? now,
    })
  }

  if (record.dataType === 'WEIGHT' && record.value != null) {
    const measurement = await db.weeklyMeasurements.where('externalRecordId').equals(record.externalRecordId)
      .and(item => item.sourcePackage === record.sourcePackage).first()
    await db.weeklyMeasurements.put({
      id: measurement?.id,
      date: record.date,
      weightKg: record.value,
      origin: 'HEALTH_CONNECT',
      externalRecordId: record.externalRecordId,
      sourcePackage: record.sourcePackage,
      createdAt: measurement?.createdAt ?? now,
    })
  }
}

export async function syncHealthConnect(requestPermissions = false) {
  const bridge = getNativeHealthConnectBridge()
  if (!bridge) return getHealthConnectStatus()
  let nativeStatus = await bridge.getStatus()
  if (requestPermissions && nativeStatus.grantedDataTypes.length < DATA_TYPES.length) {
    nativeStatus = await bridge.requestReadPermissions({ dataTypes: DATA_TYPES })
  }
  if (nativeStatus.grantedDataTypes.length === 0) return getHealthConnectStatus()

  const now = Date.now()
  await Promise.all(nativeStatus.grantedDataTypes.map(dataType => db.healthSyncStates.put({
    dataType, status: 'SYNCING', updatedAt: now,
  })))

  try {
    const existingStates = await db.healthSyncStates.toArray()
    const changeTokens = Object.fromEntries(existingStates.flatMap(state => state.changeToken ? [[state.dataType, state.changeToken]] : []))
    const startTime = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()
    const result = await bridge.readRecords({ dataTypes: nativeStatus.grantedDataTypes, startTime, changeTokens })
    for (const record of result.records) await saveImportedRecord(record, now)
    const completedAt = new Date().toISOString()
    await Promise.all(nativeStatus.grantedDataTypes.map(dataType => db.healthSyncStates.put({
      dataType,
      status: 'SUCCESS',
      lastSuccessfulSyncAt: completedAt,
      changeToken: result.changeTokens?.[dataType],
      updatedAt: Date.now(),
    })))
    window.dispatchEvent(new CustomEvent('health-connect-synced'))
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : 'UNKNOWN'
    await Promise.all(nativeStatus.grantedDataTypes.map(dataType => db.healthSyncStates.put({
      dataType, status: 'ERROR', errorCode, updatedAt: Date.now(),
    })))
  }
  return getHealthConnectStatus()
}

export function healthRecordDate(isoTime: string): string {
  return format(new Date(isoTime), 'yyyy-MM-dd')
}
