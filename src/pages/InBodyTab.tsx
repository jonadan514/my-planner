import { useEffect, useState, useCallback, useRef } from 'react'
import { db } from '../db/database'
import type { InBodyRecord } from '../db/database'
import { format } from 'date-fns'
import { createWorker } from 'tesseract.js'

type Metric = 'weight' | 'muscle' | 'bodyFatPct'
const METRIC_LABELS: Record<Metric, string> = { weight: '체중', muscle: '근육량', bodyFatPct: '체지방률' }
const METRIC_UNIT:  Record<Metric, string>  = { weight: 'kg',  muscle: 'kg',    bodyFatPct: '%' }

const FIELDS: { key: keyof InBodyRecord; label: string; unit: string; step: string }[] = [
  { key: 'weight',      label: '체중',     unit: 'kg',   step: '0.1' },
  { key: 'muscle',      label: '근육',     unit: 'kg',   step: '0.01' },
  { key: 'bodyFatPct',  label: '체지방',   unit: '%',    step: '0.1' },
  { key: 'water',       label: '수분',     unit: '%',    step: '0.1' },
  { key: 'protein',     label: '단백질',   unit: '%',    step: '0.1' },
  { key: 'visceral',    label: '내장지방', unit: '레벨', step: '1' },
  { key: 'bmr',         label: '기초대사', unit: 'kcal', step: '1' },
  { key: 'bmi',         label: 'BMI',      unit: '',     step: '0.1' },
  { key: 'boneDensity', label: '뼈밀도',   unit: 'kg',   step: '0.01' },
]

function parseScreenshotText(raw: string): { data: Partial<InBodyRecord>; matched: string[] } {
  const text = raw.replace(/(\d),(\d{3})/g, '$1$2')
  const data: Partial<InBodyRecord> = {}
  const matched: string[] = []

  const num = String.raw`(\d+(?:[.,]\d+)?)`

  const patterns: Array<{ key: keyof InBodyRecord; regex: RegExp; label: string }> = [
    { key: 'weight',      label: '체중',     regex: new RegExp(String.raw`체\s*중\s*${num}\s*k`, 'i') },
    { key: 'muscle',      label: '근육',     regex: new RegExp(String.raw`근\s*육\s*${num}\s*k`, 'i') },
    { key: 'bodyFatPct',  label: '체지방',   regex: new RegExp(String.raw`체\s*지\s*방\s*${num}\s*%?`, 'i') },
    { key: 'water',       label: '수분',     regex: new RegExp(String.raw`수\s*분\s*${num}\s*%?`, 'i') },
    { key: 'protein',     label: '단백질',   regex: new RegExp(String.raw`단\s*백\s*질\s*${num}\s*%?`, 'i') },
    { key: 'visceral',    label: '내장지방', regex: new RegExp(String.raw`내\s*장\s*지?\s*방\s*${num}`, 'i') },
    { key: 'bmr',         label: '기초대사', regex: new RegExp(String.raw`기\s*초\s*대?\s*사\s*량?\s*${num}`, 'i') },
    { key: 'bmi',         label: 'BMI',      regex: new RegExp(String.raw`BMI\s*${num}`, 'i') },
    { key: 'boneDensity', label: '뼈밀도',   regex: new RegExp(String.raw`뼈\s*밀\s*도\s*${num}\s*k?`, 'i') },
  ]

  for (const p of patterns) {
    const m = text.match(p.regex)
    if (m) {
      const val = parseFloat(m[1].replace(',', ''))
      if (!isNaN(val)) {
        data[p.key] = val as never
        matched.push(p.label)
      }
    }
  }

  return { data, matched }
}

type OcrStatus = 'idle' | 'processing' | 'done' | 'error'

export default function InBodyTab() {
  const [records, setRecords]       = useState<InBodyRecord[]>([])
  const [metric, setMetric]         = useState<Metric>('weight')
  const [showForm, setShowForm]     = useState(false)
  const [form, setForm]             = useState<Partial<InBodyRecord>>({ date: format(new Date(), 'yyyy-MM-dd') })
  const [ocrStatus, setOcrStatus]   = useState<OcrStatus>('idle')
  const [ocrPreview, setOcrPreview] = useState<string | null>(null)
  const [matched, setMatched]       = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const all = await db.inBodyRecords.orderBy('date').reverse().toArray()
    setRecords(all)
  }, [])

  // Dexie 조회가 완료된 뒤 상태를 갱신하는 비동기 로더입니다.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [load])

  const handleScreenshot = async (file: File) => {
    setOcrPreview(prev => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
    setOcrStatus('processing')
    setMatched([])
    setShowForm(true)

    const worker = await createWorker('kor+eng')
    try {
      const { data: { text } } = await worker.recognize(file)
      const { data, matched: m } = parseScreenshotText(text)
      if (m.length === 0) {
        setOcrStatus('error')
      } else {
        setForm(prev => ({ ...prev, ...data }))
        setMatched(m)
        setOcrStatus('done')
      }
    } catch {
      setOcrStatus('error')
    } finally {
      await worker.terminate()
    }
  }

  const save = async () => {
    if (!form.date) return
    await db.inBodyRecords.add({ ...form, createdAt: Date.now() } as InBodyRecord)
    setForm({ date: format(new Date(), 'yyyy-MM-dd') })
    setOcrPreview(prev => { if (prev) URL.revokeObjectURL(prev); return null })
    setOcrStatus('idle')
    setMatched([])
    setShowForm(false)
    load()
  }

  const deleteRecord = async (id: number) => {
    await db.inBodyRecords.delete(id)
    load()
  }

  const chartData = records.slice(0, 30).reverse()
    .map(r => r[metric] as number | undefined)
    .filter((v): v is number => v !== undefined)

  const renderChart = () => {
    if (chartData.length < 2) return null
    const W = 320, H = 90, pad = 10
    const minV = Math.min(...chartData) - 0.5
    const maxV = Math.max(...chartData) + 0.5
    const range = maxV - minV || 1
    const pts = chartData.map((v, i) => {
      const x = pad + (i / (chartData.length - 1)) * (W - pad * 2)
      const y = H - pad - ((v - minV) / range) * (H - pad * 2)
      return [x, y] as [number, number]
    })
    const path = 'M ' + pts.map(p => p.join(',')).join(' L ')
    const area = `${path} L ${pts[pts.length-1][0]},${H-pad} L ${pts[0][0]},${H-pad} Z`
    const last = pts[pts.length - 1]
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <defs>
          <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#16a34a" stopOpacity="0.25"/>
            <stop offset="100%" stopColor="#16a34a" stopOpacity="0"/>
          </linearGradient>
        </defs>
        <path d={area} fill="url(#cg)"/>
        <path d={path} fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx={last[0]} cy={last[1]} r="4" fill="#16a34a"/>
        <text x={last[0]} y={last[1] - 8} textAnchor="middle" fontSize="9" fill="#16a34a" fontWeight="600">
          {chartData[chartData.length - 1].toFixed(1)}
        </text>
        <text x={pad} y={H - 2}  fontSize="8" fill="#9ca3af">{minV.toFixed(1)}</text>
        <text x={pad} y={pad + 4} fontSize="8" fill="#9ca3af">{maxV.toFixed(1)}</text>
      </svg>
    )
  }

  const latest = records[0]

  return (
    <div className="px-4 pt-3 pb-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-500">인바디 기록</h2>
        <div className="flex gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            className="h-10 px-3 flex items-center gap-1.5 text-sm bg-white text-gray-500 border border-gray-200 rounded-xl active:bg-gray-50"
          >
            <span>🖼️</span><span>스크린샷</span>
          </button>
          <button
            onClick={() => {
              setForm({ date: format(new Date(), 'yyyy-MM-dd') })
              setOcrPreview(null)
              setOcrStatus('idle')
              setMatched([])
              setShowForm(true)
            }}
            className="h-10 px-3 text-sm bg-emerald-500 text-white rounded-xl active:bg-emerald-600 font-medium"
          >
            + 직접입력
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            if (e.target.files?.[0]) handleScreenshot(e.target.files[0])
            e.target.value = ''
          }}
        />
      </div>

      {/* 최근 요약 */}
      {latest && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-4">
          <p className="text-xs text-gray-400 mb-3">최근 측정 · {latest.date}</p>
          <div className="grid grid-cols-3 gap-2">
            {(['weight','muscle','bodyFatPct'] as const).map(k => {
              const f = FIELDS.find(f => f.key === k)!
              const val = latest[k]
              return val !== undefined ? (
                <div key={k} className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-gray-900">{val}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{f.label} {f.unit}</p>
                </div>
              ) : null
            })}
          </div>
        </div>
      )}

      {/* 지표 탭 */}
      <div className="flex gap-1 bg-white border border-gray-100 rounded-2xl p-1 mb-3">
        {(Object.keys(METRIC_LABELS) as Metric[]).map(m => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            className={`flex-1 py-2.5 text-sm rounded-xl font-medium transition-colors ${
              metric === m ? 'bg-emerald-500 text-white' : 'text-gray-400'
            }`}
          >
            {METRIC_LABELS[m]}
          </button>
        ))}
      </div>

      {/* 차트 */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-4">
        <p className="text-xs text-gray-400 mb-2">{METRIC_LABELS[metric]} ({METRIC_UNIT[metric]})</p>
        {chartData.length < 2
          ? <p className="text-gray-300 text-sm text-center py-5">측정 기록이 2개 이상 필요합니다</p>
          : renderChart()
        }
      </div>

      {/* 기록 목록 */}
      <ul className="space-y-2 pb-6">
        {records.slice(0, 20).map(r => (
          <li key={r.id} className="bg-white border border-gray-100 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-900">{r.date}</p>
              <button
                onClick={() => r.id && deleteRecord(r.id)}
                className="w-8 h-8 flex items-center justify-center text-gray-300 text-xl active:text-red-400"
              >×</button>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {FIELDS.map(f => {
                const val = r[f.key] as number | undefined
                return val !== undefined ? (
                  <span key={f.key} className="text-xs text-gray-400">
                    {f.label} <span className="text-gray-700 font-medium">{val}{f.unit}</span>
                  </span>
                ) : null
              })}
            </div>
          </li>
        ))}
      </ul>

      {/* 입력 바텀시트 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowForm(false)}>
          <div
            className="w-full max-w-[480px] bg-white rounded-t-3xl p-5 modal-sheet space-y-4 max-h-[90dvh] overflow-y-auto border-t border-gray-100"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {ocrStatus === 'processing' ? '분석 중...' : '인바디 기록'}
              </h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center text-gray-400 text-2xl">✕</button>
            </div>

            {ocrStatus === 'processing' && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex items-center gap-3">
                <div className="w-5 h-5 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin shrink-0" />
                <p className="text-sm text-emerald-500">스크린샷 분석 중...</p>
              </div>
            )}

            {ocrStatus === 'done' && matched.length > 0 && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 space-y-1.5">
                <p className="text-sm text-emerald-500 font-medium">✓ {matched.length}개 항목 자동 입력</p>
                <div className="flex flex-wrap gap-1.5">
                  {matched.map(label => (
                    <span key={label} className="text-[11px] bg-emerald-500/15 text-emerald-600 px-2 py-0.5 rounded-full">
                      {label}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-gray-400">값을 확인하고 잘못된 항목만 수정 후 저장하세요.</p>
              </div>
            )}

            {ocrStatus === 'error' && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                <p className="text-sm text-red-400">인식에 실패했습니다. 직접 입력해주세요.</p>
              </div>
            )}

            {ocrPreview && (
              <img src={ocrPreview} className="w-full max-h-44 object-contain rounded-xl bg-gray-100" alt="미리보기" />
            )}

            <div>
              <label className="text-sm text-gray-500 mb-1.5 block">측정일</label>
              <input
                type="date"
                className="w-full bg-gray-100 rounded-xl px-4 py-3 text-gray-900 outline-none focus:ring-1 ring-emerald-500"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {FIELDS.map(f => {
                const val = form[f.key] as number | undefined
                const isAuto = ocrStatus === 'done' && matched.includes(f.label)
                return (
                  <div key={f.key}>
                    <label className="text-sm text-gray-500 mb-1.5 flex items-center gap-1">
                      {f.label}
                      {f.unit && <span className="text-gray-300">({f.unit})</span>}
                      {isAuto && <span className="text-emerald-500 text-[10px] ml-auto">자동</span>}
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step={f.step}
                      className={`w-full bg-gray-100 rounded-xl px-3 py-3 text-gray-900 outline-none focus:ring-1 ring-emerald-500 ${
                        isAuto ? 'ring-1 ring-emerald-500/50' : ''
                      }`}
                      value={val ?? ''}
                      onChange={e => {
                        const v = e.target.value === '' ? undefined : parseFloat(e.target.value)
                        setForm(prev => ({ ...prev, [f.key]: v }))
                      }}
                      placeholder="-"
                    />
                  </div>
                )
              })}
            </div>

            <button
              onClick={save}
              disabled={ocrStatus === 'processing'}
              className="w-full py-3.5 rounded-xl bg-emerald-500 text-white font-semibold text-base active:bg-emerald-600 disabled:opacity-50"
            >
              저장
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
