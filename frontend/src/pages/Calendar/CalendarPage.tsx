
import { useCallback } from 'react'
import {
  Bell,
  CalendarDays,
  Clock3
} from 'lucide-react'

import type { Reminder } from '@trajectory/shared'

import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { LoadingState } from '@/components/common/LoadingState'
import { PageHeader } from '@/components/common/PageHeader'
import { useAsyncData } from '@/hooks/useAsyncData'
import { reminderService } from '@/services/reminder.service'

const REMINDER_LABELS: Record<Reminder['type'], string> = {
  registration_deadline: 'Завершение регистрации',
  stage_start: 'Начало этапа',
  stage_end: 'Окончание этапа',
  personal: 'Личное напоминание'
}

const STATUS_LABELS: Record<Reminder['status'], string> = {
  pending: 'Предстоит',
  completed: 'Выполнено',
  dismissed: 'Пропущено'
}

function formatDate(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
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

  const sortedReminders = [...(reminders ?? [])].sort(
    (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
  )

  return (
    <div className="dashboard-container">
      <PageHeader
        eyebrow="ПЛАНИРУЙ СВОЁ ВРЕМЯ"
        title="Календарь"
        description="Следи за сроками регистрации, этапами олимпиад и личными задачами."
      />

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="section-kicker">ТВОИ СОБЫТИЯ</div>
            <h2>Напоминания</h2>
            <p>Все важные даты в одном месте.</p>
          </div>
          <CalendarDays size={21} className="muted-icon" />
        </div>

        {loading ? (
          <LoadingState message="Загружаем календарь..." />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : sortedReminders.length === 0 ? (
          <EmptyState
            icon={<Bell size={25} />}
            title="Пока нет напоминаний"
            description="Когда появятся события и сроки олимпиад, они будут отображаться здесь."
          />
        ) : (
          <div className="reminder-list">
            {sortedReminders.map((reminder) => (
              <article className="reminder-card" key={reminder.id}>
                <div className="reminder-icon">
                  <Clock3 size={20} />
                </div>

                <div className="reminder-content">
                  <span className="reminder-type">
                    {REMINDER_LABELS[reminder.type]}
                  </span>
                  <h3>{reminder.title}</h3>
                  {reminder.description && (
                    <p>{reminder.description}</p>
                  )}
                  <span className="reminder-date">
                    <CalendarDays size={14} />
                    {formatDate(reminder.dueAt)}
                  </span>
                </div>

                <span className={`status-pill status-${reminder.status}`}>
                  {STATUS_LABELS[reminder.status]}
                </span>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
