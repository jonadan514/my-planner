import { useState } from 'react'
import BottomNav from './components/BottomNav'
import HomePage from './pages/HomePage'
import CalendarPage from './pages/CalendarPage'
import TodoPage from './pages/TodoPage'
import HealthPage from './pages/HealthPage'
import LedgerPage from './pages/LedgerPage'
import BodyImprovePage from './pages/BodyImprovePage'

export type TabId = 'home' | 'calendar' | 'todo' | 'health' | 'ledger' | 'body'

export default function App() {
  const [tab, setTab] = useState<TabId>('home')

  return (
    <div className="flex flex-col bg-[#f5f6fa] text-gray-900" style={{ height: '100dvh' }}>
      <main className="flex-1 overflow-y-auto" style={{ paddingBottom: '72px' }}>
        {tab === 'home'     && <HomePage onNavigate={setTab} />}
        {tab === 'calendar' && <CalendarPage />}
        {tab === 'todo'     && <TodoPage />}
        {tab === 'health'   && <HealthPage />}
        {tab === 'ledger'   && <LedgerPage />}
        {tab === 'body'     && <BodyImprovePage />}
      </main>
      <BottomNav active={tab} onChange={setTab} />
    </div>
  )
}
