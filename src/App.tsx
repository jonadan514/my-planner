import { useState } from 'react'
import BottomNav from './components/BottomNav'
import HomePage from './pages/HomePage'
import CalendarPage from './pages/CalendarPage'
import HealthPage from './pages/HealthPage'
import BodyImprovePage from './pages/BodyImprovePage'

export type TabId = 'home' | 'calendar' | 'health' | 'body'

export default function App() {
  const [tab, setTab] = useState<TabId>('home')

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-transparent text-slate-900">
      <main className="app-scroll flex-1 overflow-y-auto" style={{ paddingBottom: '72px' }}>
        {tab === 'home'     && <HomePage onNavigate={setTab} />}
        {tab === 'calendar' && <CalendarPage />}
        {tab === 'health'   && <HealthPage />}
        {tab === 'body'     && <BodyImprovePage />}
      </main>
      <BottomNav active={tab} onChange={setTab} />
    </div>
  )
}
