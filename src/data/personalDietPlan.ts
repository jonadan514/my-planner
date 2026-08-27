export type DietPlanShift = 'day' | 'night' | 'holiday'

export interface DietPlanMeal {
  time: string
  title: string
  items: string
}

export const PERSONAL_DIET_PLAN = {
  goal: {
    startedAt: '2026-08-21',
    startWeightKg: 93,
    latestCheckAt: '2026-08-27',
    latestWeightKg: 91.6,
    firstGoalAt: '2026-10-30',
    firstGoalWeightKg: 83,
    finalGoalWeightKg: 72,
  },
  targets: {
    calorieMinKcal: 1800,
    calorieMaxKcal: 2000,
    proteinMinGrams: 140,
    proteinMaxGrams: 150,
    carbohydrateMinGrams: 130,
    carbohydrateMaxGrams: 160,
    vegetableTargetGrams: 500,
    dietaryFiberTargetGrams: 30,
    exerciseMinutes: 30,
  },
  shiftLabels: {
    day: '주간근무',
    night: '야간근무',
    holiday: '휴무일',
  } satisfies Record<DietPlanShift, string>,
  shiftMeals: {
    day: [
      { time: '10:00', title: '첫 섭취', items: '더단백 또는 테이크핏 맥스 1개' },
      { time: '11:30', title: '점심', items: '방울토마토 10~15알 · 구운계란 2개 · 닭가슴살 180~200g · 밥 100g · 채소 150~200g' },
      { time: '17:00', title: '간식', items: '단백질 음료 1개 우선 · 단백질바는 가끔' },
      { time: '20:00', title: '저녁', items: '한 접시 양 조절식 · 밥 100g 또는 탄수 반찬 중 하나 · 채소 200g+' },
    ],
    night: [
      { time: '10:00', title: '첫 섭취', items: '구운계란 2개' },
      { time: '12:00', title: '주 식사', items: '채소 250g · 고기 1회분 · 밥 100g' },
      { time: '19:00', title: '근무 전 식사', items: '방울토마토 10~15알 · 구운계란 2개 · 닭가슴살 150~200g · 밥 100g' },
      { time: '22:00', title: '선택 간식', items: '배고프거나 단백질이 부족할 때 단백질 음료 1개' },
    ],
    holiday: [
      { time: '10:00', title: '첫 섭취', items: '구운계란 2개' },
      { time: '12:00', title: '점심', items: '채소 250g · 고기 1회분 · 밥 100g' },
      { time: '16~17시', title: '단백질 보완', items: '단백질 음료 1개' },
      { time: '19:00', title: '저녁', items: '한 접시 양 조절식 · 채소 200g+' },
    ],
  } satisfies Record<DietPlanShift, DietPlanMeal[]>,
  proteinPortions: [
    { name: '시판 닭가슴살', grams: '180~200g', note: '포장 중량 · 열량과 나트륨 확인' },
    { name: '돼지 앞다리살', grams: '180~200g', note: '조리 전 · 눈에 보이는 지방 제거' },
    { name: '돼지 목살', grams: '130~150g', note: '조리 전 · 지방이 많아 양을 낮춤' },
    { name: '소고기 안심', grams: '170~180g', note: '조리 전 · 버터 없이 굽기' },
    { name: '생선', grams: '180~200g', note: '조리 전 · 구이 또는 찜' },
  ],
  portionRules: [
    '한 끼는 한 접시에 한 번만 담고 추가하지 않기',
    '생채소 200~250g 또는 익힌 채소 150~200g',
    '밥 100g과 탄수화물 반찬 중 한 가지만 선택',
    '기타 반찬은 2~3종, 합계 100~150g',
    '국은 건더기 위주, 국물은 몇 숟가락만',
    '볶음기름은 직접 조리할 때 1티스푼(약 5g)',
  ],
  vegetables: [
    '브로콜리', '콜리플라워', '숙주', '콩나물', '애호박', '새송이버섯',
    '느타리버섯', '표고버섯', '오이', '파프리카', '피망', '청경채',
    '시금치', '가지', '무', '생배추', '양배추', '양상추', '쌈채소', '깻잎',
  ],
  vegetableCombos: [
    '냉동 브로콜리 150g + 버섯 100g',
    '양배추 150g + 오이 100g',
    '숙주 또는 콩나물 200g + 애호박 100g',
    '쌈채소·깻잎 100g + 오이·파프리카 150g',
    '청경채 150g + 버섯 100g',
  ],
  carbohydrateVegetables: ['감자', '고구마', '옥수수', '단호박', '연근', '우엉', '완두콩'],
  adjustmentRules: [
    '체중은 매일 아침 측정하되 7일 평균으로 판단',
    '주당 평균 0.6~1.0kg 감량이면 현재 계획 유지',
    '2주 연속 1.2kg 이상 감량하거나 어지럼·심한 허기가 있으면 100~200kcal 추가',
    '2주 연속 0.4kg 미만 감량이면 하루 100kcal 조정 또는 평균 걸음 1,000보 추가',
  ],
} as const

