import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Bell, CalendarClock, CalendarDays, Check, ChevronRight, Clock3, X } from 'lucide-react'
import { Link } from 'react-router-dom'

import type { Reminder } from '@trajectory/shared'
import { reminderService } from '@/services/reminder.service'

import './reminder-notification-center.css'

interface ReminderNotificationCenterProps {
  userId: string
}

interface ScheduledReminder {
  reminder: Reminder
  notifyAtMs: number
  dueAtMs: number
}

type BrowserNotificationPermission = NotificationPermission | 'unsupported'

const DAY_MS = 24 * 60 * 60 * 1000
const UPCOMING_WINDOW_MS = 7 * DAY_MS
const REFRESH_INTERVAL_MS = 60 * 1000
const CLOCK_INTERVAL_MS = 15 * 1000
const READ_STORAGE_PREFIX = 'trajectory:reminder-notifications:read:'
const SENT_STORAGE_PREFIX = 'trajectory:reminder-notifications:browser-sent:'

function getNotificationTime(reminder: Reminder): number | null {
  if (reminder.notifyAt) {
    const explicitTime = new Date(reminder.notifyAt).getTime()
    if (Number.isFinite(explicitTime)) return explicitTime
  }

  const dueAt = new Date(reminder.dueAt).getTime()
  return Number.isFinite(dueAt) ? dueAt - DAY_MS : null
}

function getNotificationKey(reminder: Reminder, notifyAtMs: number): string {
  return `${reminder.id}:${notifyAtMs}`
}

function readStoredIds(storageKey: string): string[] {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string').slice(-250)
      : []
  } catch {
    return []
  }
}

function writeStoredIds(storageKey: string, ids: string[]): void {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(ids.slice(-250)))
  } catch {
    // The center still works for the current page session when storage is unavailable.
  }
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Дата не указана'
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

export function ReminderNotificationCenter({ userId }: ReminderNotificationCenterProps) {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [readIds, setReadIds] = useState<string[]>([])
  const [now, setNow] = useState(() => Date.now())
  const [open, setOpen] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [browserPermission, setBrowserPermission] = useState<BrowserNotificationPermission>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
    return window.Notification.permission
  })
  const [permissionError, setPermissionError] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const panelId = useId()

  useEffect(() => {
    setReadIds(readStoredIds(`${READ_STORAGE_PREFIX}${userId}`))
  }, [userId])

  useEffect(() => {
    let active = true

    const loadReminders = async () => {
      try {
        const result = await reminderService.getAll()
        if (!active) return
        setReminders(result)
        setLoadError(false)
      } catch {
        if (active) setLoadError(true)
      }
    }

    const refreshWhenVisible = () => {
      if (!document.hidden) void loadReminders()
    }

    void loadReminders()
    const intervalId = window.setInterval(refreshWhenVisible, REFRESH_INTERVAL_MS)
    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)

    return () => {
      active = false
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [userId])

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), CLOCK_INTERVAL_MS)
    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (!open) return

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const scheduledReminders = useMemo<ScheduledReminder[]>(() => {
    return reminders.flatMap((reminder) => {
      if (reminder.status !== 'pending') return []
      const notifyAtMs = getNotificationTime(reminder)
      const dueAtMs = new Date(reminder.dueAt).getTime()
      if (notifyAtMs === null || !Number.isFinite(dueAtMs)) return []
      return [{ reminder, notifyAtMs, dueAtMs }]
    })
  }, [reminders])

  const dueNotifications = useMemo(() => {
    return scheduledReminders
      .filter((item) => item.notifyAtMs <= now && item.dueAtMs >= now - UPCOMING_WINDOW_MS)
      .sort((first, second) => first.dueAtMs - second.dueAtMs)
  }, [scheduledReminders, now])

  const upcomingReminders = useMemo(() => {
    return scheduledReminders
      .filter((item) => item.notifyAtMs > now && item.notifyAtMs <= now + UPCOMING_WINDOW_MS)
      .sort((first, second) => first.notifyAtMs - second.notifyAtMs)
      .slice(0, 5)
  }, [scheduledReminders, now])

  const readIdSet = useMemo(() => new Set(readIds), [readIds])
  const unreadCount = dueNotifications.reduce((count, item) => {
    return count + (readIdSet.has(getNotificationKey(item.reminder, item.notifyAtMs)) ? 0 : 1)
  }, 0)

  const markRead = useCallback((item: ScheduledReminder) => {
    const key = getNotificationKey(item.reminder, item.notifyAtMs)
    if (readIds.includes(key)) return
    const next = [...readIds, key].slice(-250)
    setReadIds(next)
    writeStoredIds(`${READ_STORAGE_PREFIX}${userId}`, next)
  }, [readIds, userId])

  const markAllRead = () => {
    const next = [...new Set([
      ...readIds,
      ...dueNotifications.map((item) => getNotificationKey(item.reminder, item.notifyAtMs))
    ])].slice(-250)
    setReadIds(next)
    writeStoredIds(`${READ_STORAGE_PREFIX}${userId}`, next)
  }

  const enableBrowserNotifications = async () => {
    if (!('Notification' in window)) {
      setBrowserPermission('unsupported')
      return
    }

    try {
      setPermissionError(false)
      const permission = await window.Notification.requestPermission()
      setBrowserPermission(permission)
      if (permission === 'granted') {
        new window.Notification('Уведомления Trajectory включены', {
          body: 'Теперь браузер будет показывать всплывающие напоминания, пока сайт открыт.'
        })
      }
    } catch {
      setPermissionError(true)
    }
  }

  useEffect(() => {
    if (browserPermission !== 'granted' || typeof window === 'undefined' || !('Notification' in window)) return

    const storageKey = `${SENT_STORAGE_PREFIX}${userId}`
    const sentIds = readStoredIds(storageKey)
    const sentIdSet = new Set(sentIds)
    const nextSentIds = [...sentIds]

    for (const item of dueNotifications) {
      const key = getNotificationKey(item.reminder, item.notifyAtMs)
      if (sentIdSet.has(key) || readIdSet.has(key)) continue

      try {
        new window.Notification(item.reminder.title || 'Напоминание Trajectory', {
          body: `Срок: ${formatDateTime(item.reminder.dueAt)}`,
          tag: key
        })
        sentIdSet.add(key)
        nextSentIds.push(key)
      } catch {
        setPermissionError(true)
      }
    }

    if (nextSentIds.length !== sentIds.length) writeStoredIds(storageKey, nextSentIds)
  }, [browserPermission, dueNotifications, readIdSet, userId])

  return (
    <div className="reminder-notifications" ref={rootRef}>
      <button
        type="button"
        className="reminder-notification-trigger"
        aria-label={unreadCount > 0 ? `Уведомления: ${unreadCount} новых` : 'Уведомления'}
        aria-expanded={open}
        aria-controls={panelId}
        title="Уведомления"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={18} strokeWidth={1.9} />
        {unreadCount > 0 && <span className="reminder-notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>

      {open && (
        <section className="reminder-notification-panel" id={panelId} aria-label="Центр уведомлений">
          <div className="reminder-notification-heading">
            <div>
              <strong>Уведомления</strong>
              <span>{unreadCount > 0 ? `${unreadCount} новых напоминаний` : 'Твои личные сроки и задачи'}</span>
            </div>
            <div className="reminder-notification-heading-actions">
              {unreadCount > 0 && (
                <button type="button" className="reminder-notification-read-all" onClick={markAllRead}>
                  <Check size={13} /> Прочитать все
                </button>
              )}
              <button type="button" className="reminder-notification-close" aria-label="Закрыть уведомления" onClick={() => setOpen(false)}>
                <X size={17} />
              </button>
            </div>
          </div>

          <div className="reminder-notification-browser" aria-live="polite">
            {browserPermission === 'default' && (
              <button type="button" onClick={() => void enableBrowserNotifications()}>
                <Bell size={14} /> Включить всплывающие уведомления
              </button>
            )}
            {browserPermission === 'granted' && (
              <span className="reminder-notification-permission-enabled">Всплывающие уведомления включены</span>
            )}
            {browserPermission === 'denied' && (
              <span>Уведомления заблокированы браузером. Разреши их в настройках сайта.</span>
            )}
            {browserPermission === 'unsupported' && (
              <span>Этот браузер не поддерживает системные уведомления.</span>
            )}
            {permissionError && <span className="reminder-notification-permission-error">Не удалось показать уведомление. Проверь разрешения браузера.</span>}
          </div>

          {loadError && <p className="reminder-notification-error" role="status">Не удалось обновить напоминания. Проверь подключение и открой календарь ещё раз.</p>}

          {dueNotifications.length > 0 ? (
            <div className="reminder-notification-section">
              <h3>Пора напомнить</h3>
              <div className="reminder-notification-list">
                {dueNotifications.map((item) => {
                  const key = getNotificationKey(item.reminder, item.notifyAtMs)
                  const isRead = readIdSet.has(key)
                  const isOverdue = item.dueAtMs < now
                  return (
                    <Link
                      className={`reminder-notification-item${isRead ? ' is-read' : ' is-unread'}`}
                      key={key}
                      to="/calendar"
                      onClick={() => { markRead(item); setOpen(false) }}
                    >
                      <span className="reminder-notification-item-icon"><CalendarClock size={17} /></span>
                      <span className="reminder-notification-item-copy">
                        <strong>{item.reminder.title}</strong>
                        <span><CalendarDays size={13} /> {formatDateTime(item.reminder.dueAt)}</span>
                        <small>{isOverdue ? 'Срок события уже прошёл' : isRead ? 'Просмотрено' : 'Напоминание ожидает внимания'}</small>
                      </span>
                      {!isRead && <span className="reminder-notification-unread-dot" aria-label="Новое" />}
                    </Link>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="reminder-notification-empty">
              <span><Check size={18} /></span>
              <strong>Новых напоминаний пока нет</strong>
              <p>Когда наступит время уведомления, оно появится здесь.</p>
            </div>
          )}

          {upcomingReminders.length > 0 && (
            <div className="reminder-notification-section is-upcoming">
              <h3>Скоро</h3>
              <div className="reminder-notification-list">
                {upcomingReminders.map((item) => (
                  <Link
                    className="reminder-notification-upcoming"
                    key={getNotificationKey(item.reminder, item.notifyAtMs)}
                    to="/calendar"
                    onClick={() => setOpen(false)}
                  >
                    <span><Clock3 size={15} /></span>
                    <span>
                      <strong>{item.reminder.title}</strong>
                      <small>Напомнить: {formatDateTime(new Date(item.notifyAtMs).toISOString())}</small>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="reminder-notification-footer">
            <span>Обновляется, пока сайт открыт</span>
            <Link to="/calendar" onClick={() => setOpen(false)}>Открыть календарь <ChevronRight size={15} /></Link>
          </div>
        </section>
      )}
    </div>
  )
}