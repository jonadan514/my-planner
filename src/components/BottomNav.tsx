import type { ReactElement } from 'react'
import type { TabId } from '../App'

interface Props {
  active: TabId
  onChange: (id: TabId) => void
}

function HomeIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V10.5z"/>
      <path d="M9 21V13h6v8"/>
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <path d="M16 2v4M8 2v4M3 10h18"/>
      <circle cx="8" cy="15" r="1.2" fill="currentColor" stroke="none"/>
      <circle cx="12" cy="15" r="1.2" fill="currentColor" stroke="none"/>
      <circle cx="16" cy="15" r="1.2" fill="currentColor" stroke="none"/>
    </svg>
  )
}

function HeartIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
    </svg>
  )
}

function BodyIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="2"/>
      <path d="M12 8v5"/>
      <path d="M8.5 10.5l-1.5 5"/>
      <path d="M15.5 10.5l1.5 5"/>
      <path d="M9.5 21l2.5-3.5 2.5 3.5"/>
    </svg>
  )
}

const TABS: Array<{ id: TabId; label: string; Icon: () => ReactElement; color: string }> = [
  { id: 'home',     label: '홈',    Icon: HomeIcon,     color: '#15803d' },
  { id: 'calendar', label: '달력',  Icon: CalendarIcon, color: '#16a34a' },
  { id: 'health',   label: '건강',  Icon: HeartIcon,    color: '#059669' },
  { id: 'body',     label: '몸개선', Icon: BodyIcon,     color: '#0d9488' },
]

export default function BottomNav({ active, onChange }: Props) {
  return (
    <nav className="fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 border-t border-emerald-100 bg-white/95 backdrop-blur-xl bottom-nav-safe">
      <div className="flex">
        {TABS.map(({ id, label, Icon, color }) => {
          const isActive = active === id
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className="relative flex-1 flex flex-col items-center pt-1.5 pb-2 min-h-[52px] transition-colors"
              style={{ color: isActive ? color : '#9ca3af' }}
            >
              {/* 상단 컬러 인디케이터 */}
              {isActive && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2.5px] rounded-full"
                  style={{ background: color }}
                />
              )}

              {/* 아이콘 — 활성 시 컬러 배경 필 */}
              <span
                className="flex items-center justify-center w-9 h-7 rounded-xl transition-all duration-200"
                style={isActive ? { background: color + '1a' } : {}}
              >
                <Icon />
              </span>

              {/* 레이블 */}
              <span
                className="text-[10px] font-semibold mt-0.5 tracking-tight transition-colors"
              >
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
