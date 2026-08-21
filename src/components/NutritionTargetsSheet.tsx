import { useState } from 'react'
import { db } from '../db/database'
import type { UserNutritionTargets } from '../db/database'

interface Props {
  current: UserNutritionTargets | null
  onClose: () => void
  onSaved: (targets: UserNutritionTargets) => void
}

interface FormState {
  proteinMin: string
  proteinMax: string
  carbohydrateMin: string
  carbohydrateMax: string
  vegetableTarget: string
  exerciseMinutes: string
}

function optionalNumber(value: string): number | undefined {
  return value === '' ? undefined : Number(value)
}

export default function NutritionTargetsSheet({ current, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(() => ({
    proteinMin: current?.proteinMinGrams.toString() ?? '',
    proteinMax: current?.proteinMaxGrams?.toString() ?? '',
    carbohydrateMin: current?.carbohydrateMinGrams?.toString() ?? '',
    carbohydrateMax: current?.carbohydrateMaxGrams?.toString() ?? '',
    vegetableTarget: current?.vegetableTargetGrams?.toString() ?? '',
    exerciseMinutes: current?.exerciseMinutes?.toString() ?? '',
  }))
  const [error, setError] = useState('')

  const set = (key: keyof FormState, value: string) => {
    setForm(previous => ({ ...previous, [key]: value }))
    setError('')
  }

  const save = async () => {
    const proteinMin = Number(form.proteinMin)
    const proteinMax = optionalNumber(form.proteinMax)
    const carbohydrateMin = optionalNumber(form.carbohydrateMin)
    const carbohydrateMax = optionalNumber(form.carbohydrateMax)

    if (!Number.isFinite(proteinMin) || proteinMin <= 0) {
      setError('단백질 최소 목표를 입력해 주세요.')
      return
    }
    if (proteinMax != null && proteinMax < proteinMin) {
      setError('단백질 상한은 최소 목표보다 커야 합니다.')
      return
    }
    if (carbohydrateMin != null && carbohydrateMax != null && carbohydrateMax < carbohydrateMin) {
      setError('탄수화물 상한은 최소 목표보다 커야 합니다.')
      return
    }

    const now = Date.now()
    const next: UserNutritionTargets = {
      id: current?.id,
      proteinMinGrams: proteinMin,
      proteinMaxGrams: proteinMax,
      carbohydrateMinGrams: carbohydrateMin,
      carbohydrateMaxGrams: carbohydrateMax,
      vegetableTargetGrams: optionalNumber(form.vegetableTarget),
      exerciseMinutes: optionalNumber(form.exerciseMinutes),
      source: 'MANUAL',
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    }

    if (current?.id) await db.nutritionTargets.put(next)
    else next.id = await db.nutritionTargets.add(next) as number
    onSaved(next)
    onClose()
  }

  const fields: Array<{ key: keyof FormState; label: string; placeholder: string }> = [
    { key: 'proteinMin', label: '단백질 최소 (g) *', placeholder: '예: 90' },
    { key: 'proteinMax', label: '단백질 상한 (g)', placeholder: '예: 120' },
    { key: 'carbohydrateMin', label: '탄수화물 최소 (g)', placeholder: '예: 180' },
    { key: 'carbohydrateMax', label: '탄수화물 상한 (g)', placeholder: '예: 250' },
    { key: 'vegetableTarget', label: '채소 목표 (g)', placeholder: '예: 500' },
    { key: 'exerciseMinutes', label: '운동 완료 기준 (분)', placeholder: '예: 30' },
  ]

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-[480px] bg-white rounded-t-3xl p-5 max-h-[90dvh] overflow-y-auto modal-sheet"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-semibold text-gray-900">개인 영양 목표</h3>
          <button onClick={onClose} aria-label="닫기" className="w-8 h-8 text-gray-400 text-2xl">✕</button>
        </div>
        <p className="text-xs text-gray-400 mb-4">목표는 성공 점수를 늘리는 값이 아니라 충분한 범위를 확인하는 기준입니다.</p>

        <div className="grid grid-cols-2 gap-3">
          {fields.map(field => (
            <label key={field.key} className="text-xs text-gray-500">
              {field.label}
              <input
                type="number"
                min="0"
                inputMode="decimal"
                value={form[field.key]}
                placeholder={field.placeholder}
                onChange={event => set(field.key, event.target.value)}
                className="mt-1 w-full bg-gray-100 rounded-xl px-3 py-2.5 text-gray-900 outline-none"
              />
            </label>
          ))}
        </div>

        {error ? <p className="text-xs text-red-500 mt-3" role="alert">{error}</p> : null}
        <button onClick={save} className="mt-4 w-full py-3.5 rounded-xl bg-emerald-500 text-white font-semibold">
          목표 저장
        </button>
      </div>
    </div>
  )
}
