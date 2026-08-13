import sharp from 'sharp'

const makeSvg = (size) => {
  const s = size
  const r = Math.round(s * 0.22)  // corner radius
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 100 100">
  <!-- 배경 -->
  <rect width="100" height="100" rx="${Math.round(r * 100 / s)}" fill="#6366f1"/>

  <!-- 달력 본체 -->
  <rect x="16" y="24" width="68" height="58" rx="7" fill="white" opacity="0.95"/>

  <!-- 달력 헤더 -->
  <rect x="16" y="24" width="68" height="20" rx="7" fill="#4f46e5"/>
  <rect x="16" y="37" width="68" height="7" fill="#4f46e5"/>

  <!-- 고리 (링) -->
  <rect x="33" y="17" width="6" height="14" rx="3" fill="#c7d2fe"/>
  <rect x="61" y="17" width="6" height="14" rx="3" fill="#c7d2fe"/>

  <!-- 달력 날짜 점들 -->
  <circle cx="30" cy="55" r="3.5" fill="#6366f1" opacity="0.35"/>
  <circle cx="43" cy="55" r="3.5" fill="#6366f1" opacity="0.7"/>
  <circle cx="56" cy="55" r="3.5" fill="#6366f1" opacity="0.35"/>
  <circle cx="70" cy="55" r="3.5" fill="#6366f1" opacity="0.35"/>

  <!-- 오늘 강조 -->
  <circle cx="30" cy="67" r="5" fill="#f59e0b"/>
  <rect x="38" y="63" width="22" height="8" rx="4" fill="#6366f1" opacity="0.2"/>

  <circle cx="30" cy="79" r="3.5" fill="#6366f1" opacity="0.35"/>
  <circle cx="43" cy="79" r="3.5" fill="#10b981" opacity="0.8"/>
  <circle cx="56" cy="79" r="3.5" fill="#6366f1" opacity="0.35"/>
  <circle cx="70" cy="79" r="3.5" fill="#f43f5e" opacity="0.6"/>
</svg>`
}

await sharp(Buffer.from(makeSvg(192))).png().toFile('public/icon-192.png')
await sharp(Buffer.from(makeSvg(512))).png().toFile('public/icon-512.png')
console.log('아이콘 생성 완료')
