import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock3,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X
} from 'lucide-react'

import {
  SUBJECTS,
  type OlympiadStageType,
  type OlympiadWithStatus,
  type Reminder,
  type ReminderStatus,
  type ReminderType,
} from '@trajectory/shared'

import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { LoadingState } from '@/components/common/LoadingState'
import { PageHeader } from '@/components/common/PageHeader'
import { useAuth } from '@/app/providers'
import { olympiadService } from '@/services/olympiad.service'
import { reminderService } from '@/services/reminder.service'
import { readCalendarOlympiadIds, subscribeToCalendarSelection } from '@/services/calendar-selection.store'

import './calendar.css'

const REMINDER_LABELS: Record<ReminderType, string> = {
  registration_deadline: 'Завершение регистрации',
  stage_start: 'Начало этапа',
  stage_end: 'Окончание этапа',
  personal: 'Личное напоминание'
}

const STATUS_LABELS: Record<ReminderStatus, string> = {
  pending: 'Предстоит',
  completed: 'Выполнено',
  dismissed: 'Пропущено'
}

const FILTER_LABELS: Record<ReminderStatus | 'all', string> = {
  all: 'Все',
  pending: 'Активные',
  completed: 'Выполненные',
  dismissed: 'Пропущенные'
}

const STAGE_LABELS: Record<OlympiadStageType, string> = {
  registration: 'Начало регистрации',
  qualifying: 'Отборочный этап',
  final: 'Заключительный этап'
}

interface CalendarEvent {
  id: string
  dateKey: string
  kind: 'olympiad' | 'task' | 'reminder'
  reminderType?: ReminderType
  title: string
  description?: string
  dateLabel: string
  timeLabel: string
  subjectLabels?: string[]
  stageLabel?: string
  olympiadId?: string
  reminderStatus?: ReminderStatus
  sortRank: number
}

function dateKeyFromDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function getDateKey(value: string): string | null {
  const dateOnly = /^(\d{4}-\d{2}-\d{2})$/.exec(value)
  if (dateOnly) return dateOnly[1]
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : dateKeyFromDate(date)
}

function parseDateKey(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

function formatDayLabel(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(parseDateKey(value))
}

function formatTime(value: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(value)
}

function toLocalDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Не удалось выполнить действие. Попробуй ещё раз.'
}

function getStageRank(type: OlympiadStageType): number {
  if (type === 'registration') return 0
  if (type === 'qualifying') return 1
  return 2
}

function getReminderDefaultTime(dateKey?: string): string {
  if (dateKey) return `${dateKey}T09:00`
  return ''
}

export function CalendarPage() {
  const { session, user } = useAuth()
  const navigate = useNavigate()
  const calendarScope = user?.id ? `user:${user.id}` : 'guest'
  const [selectedOlympiadIds, setSelectedOlympiadIds] = useState<string[]>(() => readCalendarOlympiadIds(calendarScope))
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [olympiads, setOlympiads] = useState<OlympiadWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [viewDate, setViewDate] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [filter, setFilter] = useState<ReminderStatus | 'all'>('pending')
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<ReminderType>('personal')
  const [dueAt, setDueAt] = useState('')
  const [notifyAt, setNotifyAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)



  useEffect(() => {
    setSelectedOlympiadIds(readCalendarOlympiadIds(calendarScope))
    return subscribeToCalendarSelection(calendarScope, () => setSelectedOlympiadIds(readCalendarOlympiadIds(calendarScope)))
  }, [calendarScope])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    Promise.all([
      session?.access_token ? reminderService.getAll() : Promise.resolve([] as Reminder[]),
      olympiadService.getAll()
    ])
      .then(([loadedReminders, loadedOlympiads]) => {
        if (!active) return
        setReminders(loadedReminders)
        setOlympiads(loadedOlympiads)
      })
      .catch((loadError) => {
        if (active) setError(getErrorMessage(loadError))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [reloadKey, session?.access_token])

  const reload = useCallback(() => setReloadKey((value) => value + 1), [])

  const eventsByDate = useMemo(() => {
    const events = new Map<string, CalendarEvent[]>()

    const addEvent = (event: CalendarEvent) => {
      const current = events.get(event.dateKey) ?? []
      current.push(event)
      events.set(event.dateKey, current)
    }

    for (const olympiad of olympiads) {
      if (!selectedOlympiadIds.includes(olympiad.id)) continue
      const subjectLabels = olympiad.subjects
        .map((id) => SUBJECTS.find((subject) => subject.id === id)?.label ?? id)
      for (const stage of olympiad.season?.stages ?? []) {
        const dateKey = getDateKey(stage.startDate)
        if (!dateKey) continue
        addEvent({
          id: `olympiad-${olympiad.id}-${stage.id}`,
          dateKey,
          kind: 'olympiad',
          title: olympiad.name,
          description: olympiad.organizer,
          dateLabel: formatDayLabel(dateKey),
          timeLabel: 'Время начала уточняется у организатора',
          subjectLabels,
          stageLabel: STAGE_LABELS[stage.type],
          olympiadId: olympiad.id,
          sortRank: getStageRank(stage.type)
        })
      }
    }

    for (const reminder of reminders) {
      const dueDate = new Date(reminder.dueAt)
      if (Number.isNaN(dueDate.getTime())) continue
      const dateKey = dateKeyFromDate(dueDate)
      addEvent({
        id: `reminder-${reminder.id}`,
        dateKey,
        kind: reminder.type === 'personal' ? 'task' : 'reminder',
        reminderType: reminder.type,
        title: reminder.title,
        description: reminder.description,
        dateLabel: formatDayLabel(dateKey),
        timeLabel: `Время: ${formatTime(dueDate)}`,
        reminderStatus: reminder.status,
        sortRank: reminder.type === 'personal' ? 3 : 4
      })
    }

    for (const dayEvents of events.values()) {
      dayEvents.sort((first, second) => first.sortRank - second.sortRank || first.title.localeCompare(second.title, 'ru'))
    }

    return events
  }, [olympiads, reminders, selectedOlympiadIds])

  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()
    const firstDayOffset = (new Date(year, month, 1).getDay() + 6) % 7
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cellCount = Math.ceil((firstDayOffset + daysInMonth) / 7) * 7

    return Array.from({ length: cellCount }, (_, index) => {
      const dayNumber = index - firstDayOffset + 1
      return dayNumber >= 1 && dayNumber <= daysInMonth
        ? new Date(year, month, dayNumber)
        : null
    })
  }, [viewDate])

  const monthLabel = useMemo(() => new Intl.DateTimeFormat('ru-RU', {
    month: 'long',
    year: 'numeric'
  }).format(viewDate), [viewDate])

  const allReminders = reminders
  const sortedReminders = useMemo(() => {
    return [...allReminders]
      .filter((reminder) => filter === 'all' || reminder.status === filter)
      .sort((first, second) => new Date(first.dueAt).getTime() - new Date(second.dueAt).getTime())
  }, [allReminders, filter])

  const counts = useMemo(() => ({
    all: allReminders.length,
    pending: allReminders.filter((item) => item.status === 'pending').length,
    completed: allReminders.filter((item) => item.status === 'completed').length,
    dismissed: allReminders.filter((item) => item.status === 'dismissed').length
  }), [allReminders])

  const resetForm = () => {
    setEditingId(null)
    setTitle('')
    setDescription('')
    setType('personal')
    setDueAt('')
    setNotifyAt('')
    setFormOpen(false)
    setActionError(null)
  }

  const openCreateForm = (dateKey?: string) => {
    if (!session?.access_token) {
      navigate('/auth?mode=register')
      return
    }
    setEditingId(null)
    setTitle('')
    setDescription('')
    setType('personal')
    setDueAt(getReminderDefaultTime(dateKey))
    setNotifyAt('')
    setActionError(null)
    setFormOpen(true)
  }

  const startEditing = (reminder: Reminder) => {
    setEditingId(reminder.id)
    setTitle(reminder.title)
    setDescription(reminder.description ?? '')
    setType(reminder.type)
    setDueAt(toLocalDateTime(reminder.dueAt))
    setNotifyAt(reminder.notifyAt ? toLocalDateTime(reminder.notifyAt) : '')
    setFormOpen(true)
    setActionError(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setActionError(null)

    const parsedDate = new Date(dueAt)
    const parsedNotifyDate = notifyAt ? new Date(notifyAt) : null
    if (!dueAt || Number.isNaN(parsedDate.getTime())) {
      setActionError('Укажи корректные дату и время события.')
      return
    }
    if (parsedNotifyDate && Number.isNaN(parsedNotifyDate.getTime())) {
      setActionError('Укажи корректные дату и время будущего уведомления.')
      return
    }
    if (parsedNotifyDate && parsedNotifyDate.getTime() > parsedDate.getTime()) {
      setActionError('Время уведомления должно быть не позже времени самого события.')
      return
    }

    try {
      setSubmitting(true)
      const effectiveNotifyDate = parsedNotifyDate ?? new Date(parsedDate.getTime() - 24 * 60 * 60 * 1000)
      const payload = {
        title: title.trim(),
        description: description.trim(),
        type,
        dueAt: parsedDate.toISOString(),
        notifyAt: effectiveNotifyDate.toISOString()
      }

      if (editingId) {
        await reminderService.update(editingId, payload)
      } else {
        await reminderService.create(payload)
      }

      resetForm()
      reload()
    } catch (submitError) {
      setActionError(getErrorMessage(submitError))
    } finally {
      setSubmitting(false)
    }
  }

  const changeStatus = async (id: string, nextStatus: ReminderStatus) => {
    setActionError(null)
    try {
      setBusyId(id)
      await reminderService.updateStatus(id, nextStatus)
      reload()
    } catch (statusError) {
      setActionError(getErrorMessage(statusError))
    } finally {
      setBusyId(null)
    }
  }

  const removeReminder = async (reminder: Reminder) => {
    const confirmed = window.confirm(`Удалить напоминание «${reminder.title}»?`)
    if (!confirmed) return

    setActionError(null)
    try {
      setBusyId(reminder.id)
      await reminderService.delete(reminder.id)
      reload()
    } catch (deleteError) {
      setActionError(getErrorMessage(deleteError))
    } finally {
      setBusyId(null)
    }
  }

  const changeMonth = (direction: -1 | 1) => {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1))
    setSelectedDate(null)
  }

  return (
    <div className="dashboard-container calendar-page">
      <PageHeader
        eyebrow="ПЛАНИРУЙ СВОЁ ВРЕМЯ"
        title="Календарь олимпиад и напоминаний"
        description="Следи за началом этапов олимпиад и добавляй личные события, чтобы ничего не пропустить."
        action={(
          <button type="button" className="primary-button calendar-add-button" onClick={() => formOpen ? resetForm() : openCreateForm(selectedDate ?? undefined)}>
            <Plus size={17} /> {session?.access_token ? 'Новое напоминание' : 'Войти, чтобы добавить задачу'}
          </button>
        )}
      />

      <section className="panel calendar-guide">
        <div className="calendar-guide-copy">
          <strong>Как пользоваться календарём</strong>
          <p>Добавь интересующие олимпиады в календарь из каталога. Здесь будут отмечаться только выбранные тобой этапы, личные задачи и напоминания.</p>
        </div>
        <div className="calendar-legend">
          <span><i className="calendar-legend-dot is-olympiad" /> Этап олимпиады</span>
          <span><i className="calendar-legend-dot is-task" /> Личная задача</span>
          <span><i className="calendar-legend-dot is-reminder" /> Напоминание</span>
        </div>
        <div className="calendar-selected-count">Выбрано олимпиад: <strong>{selectedOlympiadIds.length}</strong> · <Link to="/olympiads">Открыть каталог</Link></div>
        <div className="calendar-notification-note">
          <Bell size={16} /> По умолчанию напоминание планируется за 1 день до события. Отправка уведомлений и подключение к MAX потребуют отдельной настройки серверной части.
        </div>
      </section>

      {formOpen && (
        <section className="panel calendar-form-panel">
          <div className="calendar-section-heading">
            <div>
              <span className="section-kicker">{editingId ? 'ИЗМЕНЕНИЕ СОБЫТИЯ' : 'НОВОЕ СОБЫТИЕ'}</span>
              <h2>{editingId ? 'Редактировать напоминание' : 'Создать напоминание'}</h2>
              <p>Дата события отображается в календаре. Время уведомления сохраняется отдельно и не отмечается точкой.</p>
            </div>
            <button type="button" className="calendar-icon-button" onClick={resetForm} aria-label="Закрыть форму">
              <X size={18} />
            </button>
          </div>

          <form className="calendar-form" onSubmit={handleSubmit}>
            <label className="calendar-field calendar-field-wide">
              <span>Название события</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                minLength={2}
                maxLength={200}
                placeholder="Например, подготовить документы"
                required
              />
            </label>

            <label className="calendar-field">
              <span>Тип события</span>
              <select value={type} onChange={(event) => setType(event.target.value as ReminderType)}>
                {Object.entries(REMINDER_LABELS).map(([value, label]) => (
                  <option value={value} key={value}>{label}</option>
                ))}
              </select>
            </label>

            <label className="calendar-field">
              <span>Дата и время события</span>
              <input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} required />
            </label>

            <label className="calendar-field calendar-field-wide">
              <span>Когда отправить уведомление</span>
              <input
                type="datetime-local"
                value={notifyAt}
                max={dueAt || undefined}
                onChange={(event) => setNotifyAt(event.target.value)}
              />
              <small>Если не выбрать время, оно будет установлено за 1 день до события. Фактическая отправка включается при настройке уведомлений на сервере.</small>
            </label>

            <label className="calendar-field calendar-field-wide">
              <span>Описание <small>(необязательно)</small></span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Добавь ссылку или важные детали"
              />
            </label>

            {actionError && <p className="calendar-form-error" role="alert">{actionError}</p>}

            <div className="calendar-form-actions">
              <button type="button" className="secondary-button" onClick={resetForm} disabled={submitting}>Отмена</button>
              <button type="submit" className="primary-button" disabled={submitting || title.trim().length < 2 || !dueAt}>
                {submitting ? 'Сохраняем...' : editingId ? 'Сохранить изменения' : 'Создать напоминание'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="panel calendar-month-panel">
        <div className="calendar-month-heading">
          <div>
            <span className="section-kicker">РАСПИСАНИЕ</span>
            <h2>{monthLabel}</h2>
          </div>
          <div className="calendar-month-controls" aria-label="Переключение месяца">
            <button type="button" className="calendar-icon-button" onClick={() => changeMonth(-1)} aria-label="Предыдущий месяц">
              <ChevronLeft size={19} />
            </button>
            <button type="button" className="calendar-icon-button" onClick={() => changeMonth(1)} aria-label="Следующий месяц">
              <ChevronRight size={19} />
            </button>
          </div>
        </div>

        {loading ? (
          <LoadingState message="Загружаем выбранные олимпиады и напоминания..." />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : (
          <>
            <div className="calendar-weekday-grid" aria-hidden="true">
              {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => <span key={day}>{day}</span>)}
            </div>
            <div className="calendar-month-grid">
              {calendarDays.map((date, index) => {
                if (!date) return <div className="calendar-day-cell is-empty" key={`empty-${index}`} />

                const dateKey = dateKeyFromDate(date)
                const dayEvents = eventsByDate.get(dateKey) ?? []
                const isSelected = selectedDate === dateKey
                const column = index % 7
                const row = Math.floor(index / 7)

                return (
                  <div
                    className={`calendar-day-cell${isSelected ? ' is-selected' : ''}${row < 2 ? ' is-upper-row' : ''}${column < 2 ? ' is-left-edge' : ''}${column > 4 ? ' is-right-edge' : ''}`}
                    key={dateKey}
                  >
                    <button
                      type="button"
                      className={`calendar-day-button${dayEvents.length ? ' has-events' : ''}`}
                      onClick={() => setSelectedDate((current) => current === dateKey ? null : dateKey)}
                      aria-pressed={isSelected}
                      aria-label={`${formatDayLabel(dateKey)}${dayEvents.length ? `, событий: ${dayEvents.length}` : ''}`}
                    >
                      <span className="calendar-day-number">{date.getDate()}</span>
                      {dayEvents.length > 0 && (
                        <span className="calendar-day-dots" aria-hidden="true">
                          {dayEvents.slice(0, 4).map((item) => (
                            <i
                              key={item.id}
                              className={`calendar-day-dot ${item.kind === 'olympiad' ? 'is-olympiad' : item.kind === 'task' ? 'is-task' : item.reminderStatus === 'pending' ? 'is-reminder' : 'is-reminder-muted'}`}
                            />
                          ))}
                          {dayEvents.length > 4 && <small>+{dayEvents.length - 4}</small>}
                        </span>
                      )}
                    </button>

                    {isSelected && (
                      <div className="calendar-day-popover" onClick={(event) => event.stopPropagation()}>
                        <div className="calendar-day-popover-heading">
                          <strong>{formatDayLabel(dateKey)}</strong>
                          <button type="button" className="calendar-icon-button" onClick={() => setSelectedDate(null)} aria-label="Закрыть события даты">
                            <X size={15} />
                          </button>
                        </div>
                        <div className="calendar-day-popover-list">
                          {dayEvents.length === 0 ? (
                            <p className="calendar-day-empty">На эту дату пока нет событий.</p>
                          ) : dayEvents.map((item) => (
                            <article className={`calendar-popover-event is-${item.kind}`} key={item.id}>
                              <span className="calendar-popover-kind">{item.kind === 'olympiad' ? `Олимпиада · ${item.stageLabel}` : item.kind === 'task' ? 'Личная задача' : `Напоминание · ${REMINDER_LABELS[item.reminderType ?? 'personal']}`}</span>
                              {item.kind === 'olympiad' && item.olympiadId ? (
                                <Link className="calendar-popover-title" to={`/olympiads/${encodeURIComponent(item.olympiadId)}`}>{item.title}</Link>
                              ) : (
                                <strong className="calendar-popover-title">{item.title}</strong>
                              )}
                              {item.subjectLabels && item.subjectLabels.length > 0 && (
                                <span className="calendar-popover-detail">Предметы: {item.subjectLabels.join(', ')}</span>
                              )}
                              <span className="calendar-popover-detail">{item.dateLabel}</span>
                              <span className="calendar-popover-detail">{item.timeLabel}</span>
                              {item.description && <p>{item.description}</p>}
                              {item.kind === 'olympiad' && item.olympiadId && (
                                <Link className="calendar-popover-more" to={`/olympiads/${encodeURIComponent(item.olympiadId)}`}>Подробнее</Link>
                              )}
                              {item.kind !== 'olympiad' && item.reminderStatus && (
                                <span className={`calendar-popover-status status-${item.reminderStatus}`}>{STATUS_LABELS[item.reminderStatus]}</span>
                              )}
                            </article>
                          ))}
                        </div>
                        <button type="button" className="calendar-popover-add" onClick={() => openCreateForm(dateKey)}>
                          <Plus size={14} /> Добавить напоминание на эту дату
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </section>

      <section className="panel calendar-events-panel">
        <div className="panel-heading calendar-list-heading">
          <div>
            <div className="section-kicker">ТВОИ СОБЫТИЯ</div>
            <h2>Мои напоминания</h2>
            <p>Создавай, редактируй и отмечай выполненные задачи.</p>
          </div>
          <CalendarDays size={21} className="muted-icon" />
        </div>

        <div className="calendar-filter-row" role="group" aria-label="Фильтр напоминаний">
          {(Object.keys(FILTER_LABELS) as Array<ReminderStatus | 'all'>).map((value) => (
            <button type="button" key={value} className={`calendar-filter-button${filter === value ? ' is-active' : ''}`} onClick={() => setFilter(value)} aria-pressed={filter === value}>
              {FILTER_LABELS[value]} <span>{counts[value]}</span>
            </button>
          ))}
        </div>

        {actionError && !formOpen && <p className="calendar-action-error" role="alert">{actionError}</p>}

        {sortedReminders.length === 0 ? (
          <EmptyState
            icon={<Bell size={25} />}
            title={filter === 'pending' ? 'Нет активных напоминаний' : 'Событий не найдено'}
            description={filter === 'pending' ? 'Создай напоминание, чтобы не пропустить важную дату.' : 'Для выбранного фильтра пока нет событий.'}
            action={<button type="button" className="primary-button" onClick={() => openCreateForm()}><Plus size={16} /> Добавить событие</button>}
          />
        ) : (
          <div className="calendar-reminder-list">
            {sortedReminders.map((reminder) => {
              const overdue = reminder.status === 'pending' && new Date(reminder.dueAt).getTime() < Date.now()
              const isBusy = busyId === reminder.id

              return (
                <article className={`calendar-reminder-card${overdue ? ' is-overdue' : ''}${reminder.status !== 'pending' ? ' is-inactive' : ''}`} key={reminder.id}>
                  <div className="calendar-reminder-icon">{reminder.status === 'completed' ? <Check size={19} /> : <Clock3 size={19} />}</div>
                  <div className="calendar-reminder-content">
                    <div className="calendar-reminder-meta">
                      <span className="calendar-reminder-type">{REMINDER_LABELS[reminder.type]}</span>
                      {overdue && <span className="calendar-overdue-label">Срок прошёл</span>}
                    </div>
                    <h3>{reminder.title}</h3>
                    {reminder.description && <p>{reminder.description}</p>}
                    <span className="calendar-reminder-date"><CalendarDays size={14} /> {formatDate(reminder.dueAt)}</span>
                    {reminder.notifyAt && <span className="calendar-reminder-notify-date"><Bell size={13} /> Время будущего уведомления: {formatDate(reminder.notifyAt)}</span>}
                    <span className={`calendar-status-pill status-${reminder.status}`}>{STATUS_LABELS[reminder.status]}</span>
                  </div>
                  <div className="calendar-reminder-actions">
                    {reminder.status === 'pending' ? (
                      <>
                        <button type="button" className="calendar-action-button is-success" onClick={() => void changeStatus(reminder.id, 'completed')} disabled={isBusy} title="Отметить выполненным" aria-label={`Выполнить: ${reminder.title}`}><CircleCheck size={16} /></button>
                        <button type="button" className="calendar-action-button" onClick={() => startEditing(reminder)} disabled={isBusy} title="Редактировать" aria-label={`Редактировать: ${reminder.title}`}><Pencil size={16} /></button>
                        <button type="button" className="calendar-action-button is-muted" onClick={() => void changeStatus(reminder.id, 'dismissed')} disabled={isBusy} title="Отметить пропущенным" aria-label={`Пропустить: ${reminder.title}`}><X size={16} /></button>
                      </>
                    ) : (
                      <button type="button" className="calendar-action-button" onClick={() => void changeStatus(reminder.id, 'pending')} disabled={isBusy} title="Вернуть в активные" aria-label={`Вернуть: ${reminder.title}`}><RotateCcw size={16} /></button>
                    )}
                    <button type="button" className="calendar-action-button is-danger" onClick={() => void removeReminder(reminder)} disabled={isBusy} title="Удалить" aria-label={`Удалить: ${reminder.title}`}><Trash2 size={16} /></button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
