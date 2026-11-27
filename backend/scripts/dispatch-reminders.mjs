import 'dotenv/config'

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL?.trim() ?? ''
const supabaseKey = process.env.SUPABASE_SECRET_KEY?.trim()
  || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  || ''
const resendApiKey = process.env.RESEND_API_KEY?.trim() ?? ''
const fromEmail = process.env.REMINDER_FROM_EMAIL?.trim() ?? ''
const timeZone = process.env.REMINDER_TIME_ZONE?.trim() || 'Europe/Moscow'
const batchSize = Math.min(Math.max(Number(process.env.REMINDER_BATCH_SIZE ?? 50), 1), 100)
const maxAttempts = 5

function assertConfiguration() {
  const missing = []
  if (!supabaseUrl) missing.push('SUPABASE_URL')
  if (!supabaseKey) missing.push('SUPABASE_SECRET_KEY')
  if (!resendApiKey) missing.push('RESEND_API_KEY')
  if (!fromEmail) missing.push('REMINDER_FROM_EMAIL')
  if (missing.length > 0) {
    throw new Error(`Не заданы переменные окружения: ${missing.join(', ')}`)
  }
  if (!supabaseUrl.includes('uzsossytdoysravlbgcp.supabase.co') && process.env.ALLOW_NON_STAGING_REMINDERS !== 'true') {
    throw new Error('Безопасная остановка: планировщик разрешён только для staging Trajectory. Для production нужен отдельный явный запуск и отдельная конфигурация.')
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character])
}

function formatDate(value, reminderTimeZone) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'в указанное время'
  const selectedTimeZone = reminderTimeZone || timeZone
  try {
    const formatted = new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: selectedTimeZone
    }).format(date)
    return `${formatted} (${selectedTimeZone})`
  } catch {
    const formatted = new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone
    }).format(date)
    return `${formatted} (${timeZone})`
  }
}

async function getRecipient(supabase, userId, reminderType) {
  const { data: authData, error: authError } = await supabase.auth.admin.getUserById(userId)
  if (authError) throw new Error(`Не удалось получить адрес пользователя ${userId}: ${authError.message}`)
  const email = authData?.user?.email?.trim()
  const emailConfirmed = Boolean(authData?.user?.email_confirmed_at)

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('notification_preferences')
    .eq('id', userId)
    .maybeSingle()
  if (profileError) throw new Error(`Не удалось проверить настройки уведомлений пользователя ${userId}: ${profileError.message}`)

  const preferenceKey = reminderType === 'registration_deadline'
    ? 'registrationReminders'
    : reminderType === 'stage_start' || reminderType === 'stage_end'
      ? 'stageDeadlines'
      : 'personalReminders'
  const preferences = profile?.notification_preferences ?? {}
  const enabled = emailConfirmed && Boolean(email) && preferences[preferenceKey] === true

  return { email: email ?? '', enabled, preferenceKey, emailConfirmed }
}

function buildEmail(reminder) {
  const title = String(reminder.title ?? 'Напоминание Trajectory')
  const dueAt = formatDate(reminder.due_at, reminder.time_zone)
  const description = reminder.description ? String(reminder.description) : ''
  const safeTitle = escapeHtml(title)
  const safeDescription = escapeHtml(description)
  const text = [
    title,
    `Срок: ${dueAt}`,
    description,
    'Это напоминание из Trajectory. Изменить его можно в календаре приложения.'
  ].filter(Boolean).join('\n\n')
  const html = `<!doctype html><html lang="ru"><body style="font-family:Arial,sans-serif;color:#302b29;line-height:1.5"><h2>${safeTitle}</h2><p><strong>Срок:</strong> ${escapeHtml(dueAt)}</p>${safeDescription ? `<p>${safeDescription}</p>` : ''}<p>Это напоминание из Trajectory. Изменить его можно в календаре приложения.</p></body></html>`
  return { subject: `Trajectory: ${title}`, text, html }
}

async function sendEmail(reminder, recipient) {
  const payload = buildEmail(reminder)
  const idempotencyKey = `trajectory-reminder/${reminder.id}/${new Date(reminder.notify_at).getTime()}`
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [recipient],
      subject: payload.subject,
      text: payload.text,
      html: payload.html
    }),
    signal: AbortSignal.timeout(20_000)
  })
  const responseText = await response.text()
  let body = {}
  try { body = responseText ? JSON.parse(responseText) : {} } catch { body = { message: responseText } }
  if (!response.ok) {
    const detail = body.message ?? body.error ?? `HTTP ${response.status}`
    throw new Error(`Resend не принял письмо: ${String(detail).slice(0, 900)}`)
  }
  if (!body.id) throw new Error('Resend вернул успешный ответ без идентификатора письма.')
  return body.id
}

async function markSkipped(supabase, reminder, reason) {
  const { error } = await supabase.from('reminders').update({
    notification_status: 'skipped',
    notification_claimed_at: null,
    notification_next_attempt_at: null,
    notification_last_error: String(reason).slice(0, 1500)
  }).eq('id', reminder.id).eq('notification_status', 'processing')
  if (error) throw new Error(`Не удалось сохранить пропуск напоминания ${reminder.id}: ${error.message}`)
}

async function markSent(supabase, reminder, providerId) {
  const { error } = await supabase.from('reminders').update({
    notification_status: 'sent',
    notification_sent_at: new Date().toISOString(),
    notification_provider_id: providerId,
    notification_claimed_at: null,
    notification_next_attempt_at: null,
    notification_last_error: null
  }).eq('id', reminder.id).eq('notification_status', 'processing')
  if (error) throw new Error(`Письмо отправлено, но не удалось сохранить статус для напоминания ${reminder.id}: ${error.message}`)
}

async function markFailed(supabase, reminder, error) {
  const attempt = Number(reminder.notification_attempts ?? 0) + 1
  const permanentlyFailed = attempt >= maxAttempts
  const retryMinutes = Math.min(360, 5 * (2 ** Math.max(0, attempt - 1)))
  const nextAttemptAt = permanentlyFailed
    ? null
    : new Date(Date.now() + retryMinutes * 60_000).toISOString()
  const { error: updateError } = await supabase.from('reminders').update({
    notification_status: permanentlyFailed ? 'failed' : 'pending',
    notification_attempts: attempt,
    notification_claimed_at: null,
    notification_next_attempt_at: nextAttemptAt,
    notification_last_error: String(error?.message ?? error).slice(0, 1500)
  }).eq('id', reminder.id).eq('notification_status', 'processing')
  if (updateError) {
    console.error(`Не удалось записать ошибку доставки ${reminder.id}: ${updateError.message}`)
  }
}

async function main() {
  assertConfiguration()
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  })
  const { data: reminders, error } = await supabase.rpc('claim_due_reminders', { p_limit: batchSize })
  if (error) throw new Error(`Не удалось получить очередь напоминаний: ${error.message}`)

  const claimed = reminders ?? []
  console.log(`Получено напоминаний для отправки: ${claimed.length}`)
  let sent = 0
  let failed = 0

  let skipped = 0
  for (const reminder of claimed) {
    try {
      const recipient = await getRecipient(supabase, reminder.user_id, reminder.type)
      if (!recipient.enabled) {
        const reason = !recipient.emailConfirmed
          ? 'Письмо не отправлено: адрес электронной почты не подтверждён.'
          : `Письмо не отправлено: пользователь отключил настройку ${recipient.preferenceKey}.`
        await markSkipped(supabase, reminder, reason)
        skipped += 1
        console.log(`Пропущено по настройкам пользователя: ${reminder.id}`)
        continue
      }
      const providerId = await sendEmail(reminder, recipient.email)
      await markSent(supabase, reminder, providerId)
      sent += 1
      console.log(`Отправлено напоминание ${reminder.id}`)
    } catch (sendError) {
      failed += 1
      console.error(`Ошибка напоминания ${reminder.id}:`, sendError?.message ?? sendError)
      await markFailed(supabase, reminder, sendError)
    }
  }

  console.log(JSON.stringify({ claimed: claimed.length, sent, skipped, failed }))
  if (failed > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error('Планировщик напоминаний остановлен:', error?.message ?? error)
  process.exitCode = 1
})
