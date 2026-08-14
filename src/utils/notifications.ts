import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

export type AppNotificationPermission = 'prompt' | 'granted' | 'denied'

const FASTING_PROGRESS_ID = 41001
const FASTING_COMPLETE_ID = 41002
const FASTING_CHANNEL_ID = 'fasting'

function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}

export async function getPermissionStatus(): Promise<AppNotificationPermission> {
  if (isNativeApp()) {
    const status = await LocalNotifications.checkPermissions()
    return status.display === 'granted'
      ? 'granted'
      : status.display === 'prompt' || status.display === 'prompt-with-rationale'
        ? 'prompt'
        : 'denied'
  }
  if (!('Notification' in window)) return 'denied'
  return Notification.permission === 'default' ? 'prompt' : Notification.permission
}

export async function requestPermission(): Promise<boolean> {
  if (isNativeApp()) {
    const current = await LocalNotifications.checkPermissions()
    const status = current.display === 'granted'
      ? current
      : await LocalNotifications.requestPermissions()
    return status.display === 'granted'
  }
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  return (await Notification.requestPermission()) === 'granted'
}

function canNotifyInBrowser(): boolean {
  return 'Notification' in window && Notification.permission === 'granted'
}

export function canNotify(): boolean {
  return isNativeApp() || canNotifyInBrowser()
}

async function ensureFastingChannel(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return
  await LocalNotifications.createChannel({
    id: FASTING_CHANNEL_ID,
    name: '단식 알림',
    description: '단식 진행 및 목표 완료 알림',
    importance: 4,
    visibility: 1,
    vibration: true,
  })
}

async function swNotify(tag: string, title: string, options: NotificationOptions) {
  const registration = await navigator.serviceWorker?.getRegistration()
  if (registration) {
    await registration.showNotification(title, { tag, ...options })
  } else {
    new Notification(title, { tag, ...options })
  }
}

export async function showFastingNotification(startTime: number, goalHours: number) {
  const targetTime = startTime + goalHours * 3_600_000
  const endTime = new Date(targetTime)
  const endStr = `${endTime.getMonth() + 1}/${endTime.getDate()} ${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`

  if (isNativeApp()) {
    await ensureFastingChannel()
    await clearFastingNotification()
    const notifications = [{
      id: FASTING_PROGRESS_ID,
      title: '⏱ 단식 진행 중',
      body: `목표 ${goalHours}시간 · ${endStr} 종료 예정`,
      channelId: FASTING_CHANNEL_ID,
      ongoing: true,
      autoCancel: false,
      extra: { type: 'fasting-progress' },
    }]
    if (targetTime > Date.now()) {
      notifications.push({
        id: FASTING_COMPLETE_ID,
        title: '🎉 단식 목표 시간 도달!',
        body: `${goalHours}시간 목표를 달성했습니다`,
        channelId: FASTING_CHANNEL_ID,
        ongoing: false,
        autoCancel: true,
        extra: { type: 'fasting-complete' },
        schedule: { at: endTime, allowWhileIdle: true },
      } as typeof notifications[number])
    }
    await LocalNotifications.schedule({ notifications })
    return
  }

  if (!canNotifyInBrowser()) return
  await swNotify('fasting', '⏱ 단식 진행 중', {
    body: `목표 ${goalHours}시간 · ${endStr} 종료 예정`,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    requireInteraction: true,
    silent: true,
    data: { type: 'fasting' },
  })
}

export async function showFastingComplete(duration: number) {
  const hours = Math.floor(duration / 3_600_000)
  const minutes = Math.floor((duration % 3_600_000) / 60_000)

  if (isNativeApp()) {
    await ensureFastingChannel()
    await LocalNotifications.schedule({ notifications: [{
      id: FASTING_COMPLETE_ID,
      title: '🎉 단식 완료!',
      body: `${hours}시간 ${minutes}분 달성했습니다`,
      channelId: FASTING_CHANNEL_ID,
      autoCancel: true,
      extra: { type: 'fasting-complete' },
    }] })
    return
  }

  if (!canNotifyInBrowser()) return
  await swNotify('fasting', '🎉 단식 완료!', {
    body: `${hours}시간 ${minutes}분 달성했습니다`,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
  })
}

export async function clearFastingNotification() {
  if (isNativeApp()) {
    await Promise.all([
      LocalNotifications.cancel({ notifications: [
        { id: FASTING_PROGRESS_ID },
        { id: FASTING_COMPLETE_ID },
      ] }),
      LocalNotifications.removeAllDeliveredNotifications(),
    ])
    return
  }

  const registration = await navigator.serviceWorker?.getRegistration()
  if (!registration) return
  const notifications = await registration.getNotifications({ tag: 'fasting' })
  notifications.forEach(notification => notification.close())
}

export async function showShiftNotification(label: string, color: string) {
  const today = new Date()
  const dateStr = `${today.getMonth() + 1}월 ${today.getDate()}일`
  if (isNativeApp()) {
    await LocalNotifications.schedule({ notifications: [{
      id: 42001,
      title: `👔 오늘 근무: ${label}`,
      body: `${dateStr} 근무 일정입니다`,
      autoCancel: true,
      extra: { type: 'shift', color },
    }] })
    return
  }
  if (!canNotifyInBrowser()) return
  await swNotify('shift', `👔 오늘 근무: ${label}`, {
    body: `${dateStr} 근무 일정입니다`,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    silent: true,
    data: { type: 'shift', color },
  })
}
