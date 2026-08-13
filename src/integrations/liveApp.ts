import { Capacitor, registerPlugin } from '@capacitor/core'
import { db } from '../db/database'

const LOCAL_APP_HOST = 'localhost'
const BACKUP_SCHEMA_VERSION = 1

interface LiveAppBridgeState {
  liveMode: boolean
  hasPendingBackup: boolean
}

interface LiveAppBridge {
  getState(): Promise<LiveAppBridgeState>
  enableLiveApp(input: { backup: string }): Promise<void>
  restartInLiveMode(): Promise<void>
  readPendingBackup(): Promise<{ backup: string }>
  completeMigration(): Promise<void>
}

interface DatabaseBackup {
  schemaVersion: number
  exportedAt: string
  tables: Record<string, unknown[]>
}

export type LiveAppInitializationResult =
  | { status: 'ready' }
  | { status: 'switching' }

const liveAppBridge = registerPlugin<LiveAppBridge>('LiveAppBridge')
let initializationPromise: Promise<LiveAppInitializationResult> | undefined

function isDatabaseBackup(value: unknown): value is DatabaseBackup {
  if (typeof value !== 'object' || value == null) return false
  const candidate = value as Partial<DatabaseBackup>
  if (candidate.schemaVersion !== BACKUP_SCHEMA_VERSION) return false
  if (typeof candidate.tables !== 'object' || candidate.tables == null) return false
  return Object.values(candidate.tables).every(Array.isArray)
}

async function exportDatabase(): Promise<string> {
  await db.open()
  const tables: Record<string, unknown[]> = {}
  for (const table of db.tables) tables[table.name] = await table.toArray()
  return JSON.stringify({
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    tables,
  } satisfies DatabaseBackup)
}

async function importDatabase(serializedBackup: string): Promise<void> {
  const parsed: unknown = JSON.parse(serializedBackup)
  if (!isDatabaseBackup(parsed)) throw new Error('백업 데이터 형식이 올바르지 않습니다.')

  await db.open()
  const knownTableNames = new Set(db.tables.map(table => table.name))
  const tableNames = Object.keys(parsed.tables).filter(name => knownTableNames.has(name))
  const tables = tableNames.map(name => db.table(name))

  await db.transaction('rw', tables, async () => {
    for (const tableName of tableNames) {
      const table = db.table(tableName)
      const records = parsed.tables[tableName]
      await table.clear()
      if (records.length > 0) await table.bulkPut(records)
    }
  })
}

async function runInitialization(): Promise<LiveAppInitializationResult> {
  if (!Capacitor.isNativePlatform()) return { status: 'ready' }

  const state = await liveAppBridge.getState()
  const isBundledApp = window.location.hostname === LOCAL_APP_HOST

  if (isBundledApp) {
    if (!navigator.onLine) {
      throw new Error('처음 한 번은 인터넷 연결이 필요합니다. 연결 후 다시 시도해 주세요.')
    }
    if (state.liveMode) {
      await liveAppBridge.restartInLiveMode()
    } else {
      await liveAppBridge.enableLiveApp({ backup: await exportDatabase() })
    }
    return { status: 'switching' }
  }

  if (state.hasPendingBackup) {
    const { backup } = await liveAppBridge.readPendingBackup()
    await importDatabase(backup)
    await liveAppBridge.completeMigration()
  }

  return { status: 'ready' }
}

export function initializeLiveApp(): Promise<LiveAppInitializationResult> {
  if (!initializationPromise) {
    initializationPromise = runInitialization().catch(error => {
      initializationPromise = undefined
      throw error
    })
  }
  return initializationPromise
}
