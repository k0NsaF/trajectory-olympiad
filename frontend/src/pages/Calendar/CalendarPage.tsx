import { useCallback, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Bell,
  CalendarDays,
  Check,
  CircleCheck,
  Clock3,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X
} from 'lucide-react'

import type { Reminder, ReminderStatus, ReminderType } from '@trajectory/shared'

import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { LoadingState } from '@/components/common/LoadingState'
import { PageHeader } from '@/components/common/PageHeader'
import { useAsyncData } from '@/hooks/useAsyncData'
import { reminderService } from '@/services/reminder.service'

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

export function CalendarPage() {
  const loadReminders = useCallback(
    () => reminderService.getAll(),
    []
  )

  const {
    data: reminders,
    loading,
    error,
    reload
  } = useAsyncData(loadReminders, [])

  const [filter, setFilter] = useState<ReminderStatus | 'all'>('pending')
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<ReminderType>('personal')
  const [dueAt, setDueAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const allReminders = reminders ?? []
  const sortedReminders = useMemo(() => {
    return [...allReminders]
      .filter((reminder) => filter === 'all' || reminder.status === filter)
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
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
    setFormOpen(false)
    setActionError(null)
  }

  const startEditing = (reminder: Reminder) => {
    setEditingId(reminder.id)
    setTitle(reminder.title)
    setDescription(reminder.description ?? '')
    setType(reminder.type)
    setDueAt(toLocalDateTime(reminder.dueAt))
    setFormOpen(true)
    setActionError(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setActionError(null)

    const parsedDate = new Date(dueAt)
    if (!dueAt || Number.isNaN(parsedDate.getTime())) {
      setActionError('Укажи корректные дату и время события.')
      return
    }

    try {
      setSubmitting(true)
      const payload = {
        title: title.trim(),
        description: description.trim(),
        type,
        dueAt: parsedDate.toISOString()
      }

      if (editingId) {
        await reminderService.update(editingId, payload)
      } else {
        await reminderService.create(payload)
      }

      resetForm()
      await reload()
    } catch (submitError) {
      setActionError(getErrorMessage(submitError))
    } finally {
      setSubmitting(false)
    }
  }

  const changeStatus = async (id: string, status: ReminderStatus) => {
    setActionError(null)
    try {
      setBusyId(id)
      await reminderService.updateStatus(id, status)
      await reload()
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
      await reload()
    } catch (deleteError) {
      setActionError(getErrorMessage(deleteError))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="dashboard-container calendar-page">
      <PageHeader
        eyebrow="ПЛАНИРУЙ СВОЁ ВРЕМЯ"
        title="Календарь"
        description="Управляй сроками регистрации, этапами олимпиад и личными задачами."
        action={(
          <button
            type="button"
            className="primary-button calendar-add-button"
            onClick={() => {
              if (formOpen && !editingId) resetForm()
              else {
                setEditingId(null)
                setTitle('')
                setDescription('')
                setType('personal')
                setDueAt('')
                setActionError(null)
                setFormOpen(true)
              }
            }}
          >
            <Plus size={17} /> Новое напоминание
          </button>
        )}
      />

      {formOpen && (
        <section className="panel calendar-form-panel">
          <div className="calendar-section-heading">
            <div>
              <span className="section-kicker">{editingId ? 'ИЗМЕНЕНИЕ СОБЫТИЯ' : 'НОВОЕ СОБЫТИЕ'}</span>
              <h2>{editingId ? 'Редактировать напоминание' : 'Создать напоминание'}</h2>
              <p>Дата и время сохраняются с учётом твоего часового пояса.</p>
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
                placeholder="Например, последний день регистрации"
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
              <span>Дата и время</span>
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
                required
              />
            </label>

            <label className="calendar-field calendar-field-wide">
              <span>Описание <small>(необязательно)</small></span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Добавь ссылку, аудиторию или важные детали"
              />
            </label>

            {actionError && <p className="calendar-form-error" role="alert">{actionError}</p>}

            <div className="calendar-form-actions">
              <button type="button" className="secondary-button" onClick={resetForm} disabled={submitting}>
                Отмена
              </button>
              <button type="submit" className="primary-button" disabled={submitting || title.trim().length < 2 || !dueAt}>
                {submitting ? 'Сохраняем...' : editingId ? 'Сохранить изменения' : 'Создать напоминание'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="panel calendar-events-panel">
        <div className="panel-heading calendar-list-heading">
          <div>
            <div className="section-kicker">ТВОИ СОБЫТИЯ</div>
            <h2>Напоминания</h2>
            <p>Все важные даты и задачи в одном месте.</p>
          </div>
          <CalendarDays size={21} className="muted-icon" />
        </div>

        <div className="calendar-filter-row" role="group" aria-label="Фильтр напоминаний">
          {(Object.keys(FILTER_LABELS) as Array<ReminderStatus | 'all'>).map((value) => (
            <button
              type="button"
              key={value}
              className={`calendar-filter-button${filter === value ? ' is-active' : ''}`}
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
            >
              {FILTER_LABELS[value]}
              <span>{counts[value]}</span>
            </button>
          ))}
        </div>

        {actionError && !formOpen && <p className="calendar-action-error" role="alert">{actionError}</p>}

        {loading ? (
          <LoadingState message="Загружаем календарь..." />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : sortedReminders.length === 0 ? (
          <EmptyState
            icon={<Bell size={25} />}
            title={filter === 'pending' ? 'Нет активных напоминаний' : 'Событий не найдено'}
            description={filter === 'pending'
              ? 'Создай напоминание, чтобы не пропустить регистрацию или важный этап олимпиады.'
              : 'Для выбранного фильтра пока нет событий.'}
            action={(
              <button type="button" className="primary-button" onClick={() => setFormOpen(true)}>
                <Plus size={16} /> Добавить событие
              </button>
            )}
          />
        ) : (
          <div className="calendar-reminder-list">
            {sortedReminders.map((reminder) => {
              const overdue = reminder.status === 'pending' && new Date(reminder.dueAt).getTime() < Date.now()
              const isBusy = busyId === reminder.id

              return (
                <article className={`calendar-reminder-card${overdue ? ' is-overdue' : ''}${reminder.status !== 'pending' ? ' is-inactive' : ''}`} key={reminder.id}>
                  <div className="calendar-reminder-icon">
                    {reminder.status === 'completed' ? <Check size={19} /> : <Clock3 size={19} />}
                  </div>

                  <div className="calendar-reminder-content">
                    <div className="calendar-reminder-meta">
                      <span className="calendar-reminder-type">{REMINDER_LABELS[reminder.type]}</span>
                      {overdue && <span className="calendar-overdue-label">Срок прошёл</span>}
                    </div>
                    <h3>{reminder.title}</h3>
                    {reminder.description && <p>{reminder.description}</p>}
                    <span className="calendar-reminder-date">
                      <CalendarDays size={14} /> {formatDate(reminder.dueAt)}
                    </span>
                    <span className={`calendar-status-pill status-${reminder.status}`}>
                      {STATUS_LABELS[reminder.status]}
                    </span>
                  </div>

                  <div className="calendar-reminder-actions">
                    {reminder.status === 'pending' ? (
                      <>
                        <button type="button" className="calendar-action-button is-success" onClick={() => void changeStatus(reminder.id, 'completed')} disabled={isBusy} title="Отметить выполненным" aria-label={`Выполнить: ${reminder.title}`}>
                          <CircleCheck size={16} />
                        </button>
                        <button type="button" className="calendar-action-button" onClick={() => startEditing(reminder)} disabled={isBusy} title="Редактировать" aria-label={`Редактировать: ${reminder.title}`}>
                          <Pencil size={16} />
                        </button>
                        <button type="button" className="calendar-action-button is-muted" onClick={() => void changeStatus(reminder.id, 'dismissed')} disabled={isBusy} title="Отметить пропущенным" aria-label={`Пропустить: ${reminder.title}`}>
                          <X size={16} />
                        </button>
                      </>
                    ) : (
                      <button type="button" className="calendar-action-button" onClick={() => void changeStatus(reminder.id, 'pending')} disabled={isBusy} title="Вернуть в активные" aria-label={`Вернуть: ${reminder.title}`}>
                        <RotateCcw size={16} />
                      </button>
                    )}
                    <button type="button" className="calendar-action-button is-danger" onClick={() => void removeReminder(reminder)} disabled={isBusy} title="Удалить" aria-label={`Удалить: ${reminder.title}`}>
                      <Trash2 size={16} />
                    </button>
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
