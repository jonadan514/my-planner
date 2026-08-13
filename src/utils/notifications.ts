export async function requestPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export function canNotify() {
  return 'Notification' in window && Notification.permission === 'granted'
}

// 서비스워커를 통해 알림 발행 (Android 상태바에 표시됨)
async function swNotify(tag: string, title: string, options: NotificationOptions) {
  const reg = await navigator.serviceWorker?.ready
  if (reg) {
    await reg.showNotification(title, { tag, ...options })
  } else {
    new Notification(title, { tag, ...options })
  }
}

export async function showFastingNotification(startTime: number, goalHours: number) {
  if (!canNotify()) return
  const endTime = new Date(startTime + goalHours * 3600000)
  const endStr = `${endTime.getMonth() + 1}/${endTime.getDate()} ${String(endTime.getHours()).padStart(2,'0')}:${String(endTime.getMinutes()).padStart(2,'0')}`

  await swNotify('fasting', '⏱ 단식 진행 중', {
    body: `목표 ${goalHours}시간 · ${endStr} 종료 예정`,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    requireInteraction: true,   // 사용자가 닫기 전까지 유지
    silent: true,
    data: { type: 'fasting' },
  })
}

export async function showFastingComplete(duration: number) {
  if (!canNotify()) return
  const h = Math.floor(duration / 3600000)
  const m = Math.floor((duration % 3600000) / 60000)

  await swNotify('fasting', '🎉 단식 완료!', {
    body: `${h}시간 ${m}분 달성했습니다`,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
  })
}

export async function clearFastingNotification() {
  const reg = await navigator.serviceWorker?.ready
  if (!reg) return
  const notifications = await reg.getNotifications({ tag: 'fasting' })
  notifications.forEach(n => n.close())
}

export async function showShiftNotification(label: string, color: string) {
  if (!canNotify()) return
  const today = new Date()
  const dateStr = `${today.getMonth() + 1}월 ${today.getDate()}일`

  await swNotify('shift', `👔 오늘 근무: ${label}`, {
    body: `${dateStr} 근무 일정입니다`,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    silent: true,
    data: { type: 'shift', color },
  })
}
