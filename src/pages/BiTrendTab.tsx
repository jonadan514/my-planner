import { useState, useEffect, useCallback } from 'react'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { db } from '../db/database'
import type { WeeklyMeasurement } from '../db/database'

type TrendJudgement = 'on_track' | 'normal' | 'apply_lever' | 'check_records'

const TREND_INFO: Record<TrendJudgement, { label: string; color: string; desc: string; lever?: string }> = {
  on_track:      { label: '✅ 순조롭게 진행 중',  color: '#10b981', desc: '4주 기준 -2kg 이상 감소. 현재 방식을 유지하세요.' },
  normal:        { label: '📊 정상 진행',         color: '#16a34a', desc: '4주 기준 -1~-2kg 감소. 기록을 꾸준히 이어가세요.' },
  apply_lever:   { label: '⚙️ 조절 레버 검토',    color: '#f59e0b', desc: '4주 기준 -1kg 미만 감소. 행동 점수 4점 이상이면 아래 레버를 순서대로 적용해 보세요.', lever: 'lever' },
  check_records: { label: '🔍 기록 정확도 점검',  color: '#ef4444', desc: '체중 변화가 없거나 증가했습니다. 식단 기록이 정확한지 먼저 확인하세요.' },
}

const LEVERS = [
  {
    step: '1단계',
    title: '밥 220g 고정',
    desc: '220~250g 범위에서 220g으로 좁혀, 탄수화물 여유분을 줄입니다.',
    tip: '저녁 밥을 120g → 100g으로 줄이는 것부터 시작.',
  },
  {
    step: '2단계',
    title: '방어간식 주 3회 이하',
    desc: '매일 방어간식을 먹던 경우, 주 3회 이하로 제한합니다.',
    tip: '배고픔보다 습관이 되어있다면 두유 → 물 대체 시도.',
  },
  {
    step: '3단계',
    title: '활동량 확대',
    desc: '걷기 시간을 늘리거나, 슈퍼티 홈 워크아웃을 주 1회 추가합니다.',
    tip: '비번·휴무일에 30분 걷기부터. 근력 운동날 밥 300g까지 허용.',
  },
]

function judgeTrend(measurements: WeeklyMeasurement[]): TrendJudgement | null {
  const withWeight = [...measurements]
    .filter(m => m.weightKg != null)
    .sort((a, b) => a.date.localeCompare(b.date))
  if (withWeight.length < 2) return null
  const oldest = withWeight[0]
  const recent = withWeight[withWeight.length - 1]
  const change = (recent.weightKg ?? 0) - (oldest.weightKg ?? 0)
  if (change <= -2) return 'on_track'
  if (change <= -1) return 'normal'
  if (change < 0) return 'apply_lever'
  return 'check_records'
}

function MiniLineChart({ measurements }: { measurements: WeeklyMeasurement[] }) {
  const pts = [...measurements]
    .filter(m => m.weightKg != null)
    .sort((a, b) => a.date.localeCompare(b.date))

  if (pts.length < 2) {
    return (
      <p className="text-xs text-gray-300 text-center py-6">
        체중 기록 2개 이상 필요
      </p>
    )
  }

  const W = 300, H = 100
  const PAD = { t: 10, r: 10, b: 24, l: 36 }
  const iW = W - PAD.l - PAD.r
  const iH = H - PAD.t - PAD.b
  const weights = pts.map(p => p.weightKg as number)
  const minY = Math.min(...weights)
  const maxY = Math.max(...weights)
  const range = maxY - minY || 1

  const cx = (i: number) => PAD.l + (i / Math.max(pts.length - 1, 1)) * iW
  const cy = (w: number) => PAD.t + ((maxY - w) / range) * iH
  const poly = pts.map((p, i) => `${cx(i)},${cy(p.weightKg as number)}`).join(' ')

  const yLabels = [minY, (minY + maxY) / 2, maxY]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {/* Grid */}
      <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} stroke="#f3f4f6" strokeWidth="1" />
      <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="#f3f4f6" strokeWidth="1" />

      {/* Y axis labels */}
      {yLabels.map((w, i) => (
        <text key={i} x={PAD.l - 4} y={cy(w) + 3} textAnchor="end" fontSize="8" fill="#9ca3af">
          {w.toFixed(1)}
        </text>
      ))}

      {/* X axis labels */}
      {pts.map((p, i) => (
        <text key={p.date} x={cx(i)} y={H - 4} textAnchor="middle" fontSize="7" fill="#9ca3af">
          {format(parseISO(p.date), 'M/d')}
        </text>
      ))}

      {/* Trend line */}
      <polyline
        fill="none"
        stroke="#16a34a"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={poly}
      />

      {/* Data points */}
      {pts.map((p, i) => (
        <circle
          key={p.date}
          cx={cx(i)}
          cy={cy(p.weightKg as number)}
          r="3.5"
          fill="white"
          stroke="#16a34a"
          strokeWidth="2"
        />
      ))}
    </svg>
  )
}

type SubTab = 'trend' | 'lever'

export default function BiTrendTab() {
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const [measurements, setMeasurements] = useState<WeeklyMeasurement[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [date, setDate] = useState(todayStr)
  const [weightStr, setWeightStr] = useState('')
  const [waistStr, setWaistStr] = useState('')
  const [note, setNote] = useState('')
  const [activeTab, setActiveTab] = useState<SubTab>('trend')

  const load = useCallback(async () => {
    const all = await db.weeklyMeasurements.orderBy('date').reverse().limit(8).toArray()
    setMeasurements(all.reverse())
  }, [])

  // Dexie 조회가 완료된 뒤 상태를 갱신하는 비동기 로더입니다.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [load])

  const openAdd = () => {
    setDate(todayStr)
    setWeightStr('')
    setWaistStr('')
    setNote('')
    setShowAdd(true)
  }

  const addMeasurement = async () => {
    if (!weightStr && !waistStr) return
    await db.weeklyMeasurements.add({
      date,
      weightKg: weightStr ? Number(weightStr) : undefined,
      waistCm:  waistStr  ? Number(waistStr)  : undefined,
      note:     note.trim() || undefined,
      createdAt: Date.now(),
    })
    setShowAdd(false)
    load()
  }

  const deleteMeasurement = async (id: number) => {
    await db.weeklyMeasurements.delete(id)
    load()
  }

  const trend = judgeTrend(measurements)
  const trendInfo = trend ? TREND_INFO[trend] : null

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">

      {/* 서브 탭 */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {([['trend', '📈 추세 분석'], ['lever', '⚙️ 조절 레버']] as [SubTab, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 py-2 text-xs rounded-lg font-medium transition-colors ${
              activeTab === id ? 'bg-emerald-500 text-white' : 'text-gray-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'trend' && (
        <>
          {/* 추세 판단 결과 */}
          {trendInfo ? (
            <div
              className="rounded-2xl p-4 border"
              style={{ background: trendInfo.color + '12', borderColor: trendInfo.color + '30' }}
            >
              <p className="font-bold text-sm mb-1" style={{ color: trendInfo.color }}>{trendInfo.label}</p>
              <p className="text-xs text-gray-600 leading-relaxed">{trendInfo.desc}</p>
              {trendInfo.lever && (
                <button
                  onClick={() => setActiveTab('lever')}
                  className="text-xs text-amber-600 mt-2 underline underline-offset-2"
                >
                  조절 레버 보기 →
                </button>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-center">
              <p className="text-xs text-gray-400">체중 기록을 2개 이상 추가하면 추세를 자동 판단합니다.</p>
              <p className="text-[11px] text-gray-300 mt-1">권장: 매 주기 첫 번째 휴무일 아침 측정</p>
            </div>
          )}

          {/* 체중 그래프 */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4">
            <p className="text-sm font-semibold text-gray-900 mb-3">체중 추이 (kg)</p>
            <MiniLineChart measurements={measurements} />
          </div>

          {/* 측정 기록 목록 */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-900">측정 기록</p>
              <button
                onClick={openAdd}
                className="text-xs text-emerald-600 border border-emerald-500/30 px-2.5 py-1 rounded-lg active:bg-emerald-500/10"
              >
                + 추가
              </button>
            </div>
            {measurements.length === 0 ? (
              <p className="text-xs text-gray-300 text-center py-4">측정 기록이 없습니다</p>
            ) : (
              <ul className="space-y-0 divide-y divide-gray-50">
                {[...measurements].reverse().map(m => (
                  <li key={m.id} className="flex items-center gap-2 py-2.5 first:pt-0 last:pb-0">
                    <span className="text-xs text-gray-400 w-16 shrink-0">
                      {format(parseISO(m.date), 'M/d (EEE)', { locale: ko })}
                    </span>
                    <div className="flex-1 flex items-baseline gap-3 min-w-0">
                      {m.weightKg && (
                        <span className="text-sm font-bold text-gray-800">{m.weightKg}kg</span>
                      )}
                      {m.waistCm && (
                        <span className="text-sm text-gray-500">허리 {m.waistCm}cm</span>
                      )}
                      {m.note && (
                        <span className="text-xs text-gray-300 truncate">{m.note}</span>
                      )}
                    </div>
                    <button
                      onClick={() => m.id && deleteMeasurement(m.id)}
                      className="text-gray-200 text-lg leading-none active:text-red-400 shrink-0 p-1"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {activeTab === 'lever' && (
        <div className="space-y-3">
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
            <p className="text-sm font-semibold text-emerald-800 mb-1">조절 레버란?</p>
            <p className="text-xs text-emerald-700 leading-relaxed">
              4주 추세가 -1kg 미만이고 행동 점수가 4점 이상일 때 적용하는 단계적 조정 방법입니다.
              1단계부터 순서대로 적용하고, 한 번에 모두 적용하지 않습니다.
            </p>
          </div>

          {LEVERS.map(({ step, title, desc, tip }) => (
            <div key={step} className="bg-white border border-gray-100 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded-lg shrink-0 mt-0.5">
                  {step}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 mb-1">{title}</p>
                  <p className="text-xs text-gray-500 leading-relaxed mb-2">{desc}</p>
                  <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                    <p className="text-[11px] text-emerald-700">💡 {tip}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
            <p className="text-xs font-semibold text-amber-700 mb-1">⚠️ 레버 적용 기준</p>
            <p className="text-xs text-amber-600 leading-relaxed">
              행동 점수가 4점 미만이라면 레버보다 기록 점수 회복이 우선입니다.
              레버는 기본 루틴이 충분히 지켜지고 있을 때만 의미가 있습니다.
            </p>
          </div>
        </div>
      )}

      {/* 측정값 추가 모달 */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/40 overflow-y-auto" onClick={() => setShowAdd(false)}>
          <div
            className="mx-auto mt-16 w-full max-w-[480px] bg-white rounded-3xl p-5 space-y-4 mb-8"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">측정값 추가</h3>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 text-xl p-1">✕</button>
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">측정일</label>
              <input
                type="date"
                className="w-full bg-gray-100 rounded-xl px-4 py-3 text-gray-900 outline-none text-sm"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">체중 (kg)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  className="w-full bg-gray-100 rounded-xl px-4 py-3 text-gray-900 outline-none text-sm"
                  placeholder="예: 83.5"
                  value={weightStr}
                  onChange={e => setWeightStr(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">허리둘레 (cm)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  className="w-full bg-gray-100 rounded-xl px-4 py-3 text-gray-900 outline-none text-sm"
                  placeholder="예: 88"
                  value={waistStr}
                  onChange={e => setWaistStr(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">메모 (선택)</label>
              <input
                type="text"
                className="w-full bg-gray-100 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 outline-none text-sm"
                placeholder="특이사항..."
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </div>

            <button
              onClick={addMeasurement}
              disabled={!weightStr && !waistStr}
              className="w-full py-3 rounded-xl bg-emerald-500 text-white font-medium active:opacity-80 disabled:opacity-40"
            >
              저장
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
