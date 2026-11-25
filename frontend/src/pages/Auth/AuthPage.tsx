
import { useState, type FormEvent } from 'react'

import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  UserRound
} from 'lucide-react'

import { useAuth } from '@/app/providers'
import { TRAJECTORY_LOGO_URL, TRAJECTORY_LOGO_MODE } from '@/app/brandAssets'
import { authService } from '@/services/auth.service'

type AuthMode = 'login' | 'register' | 'reset' | 'new-password'

export function AuthPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, isConfigured } = useAuth()

  const [mode, setMode] = useState<AuthMode>(
    searchParams.get('mode') === 'recovery'
      ? 'new-password'
      : searchParams.get('mode') === 'register'
        ? 'register'
        : 'login'
  )

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)

  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [canResendConfirmation, setCanResendConfirmation] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const clearMessages = () => {
    setError(null)
    setNotice(null)
  }

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    clearMessages()
    setCanResendConfirmation(false)
    setPassword('')
    setConfirmPassword('')
  }

  const handleResendConfirmation = async () => {
    if (!email.trim()) {
      setError('Сначала укажи электронную почту.')
      return
    }

    if (!isConfigured) {
      setError('Supabase не настроен. Проверь переменные окружения.')
      return
    }

    setResending(true)
    clearMessages()

    try {
      await authService.resendSignupConfirmation(email.trim())

      setNotice(
        'Письмо отправлено, если для этого адреса есть неподтверждённая регистрация. Проверь почту, включая папку «Спам».'
      )
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Не удалось отправить письмо повторно.'
      )
    } finally {
      setResending(false)
    }
  }

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()

    clearMessages()

    if (!isConfigured) {
      setError(
        'Supabase не настроен. Проверь переменные окружения Frontend.'
      )
      return
    }

    if (
      mode !== 'reset' &&
      mode !== 'new-password' &&
      password.length < 8
    ) {
      setError('Пароль должен содержать не менее 8 символов.')
      return
    }

    if (
      mode === 'register' &&
      fullName.trim().length < 2
    ) {
      setError('Укажи своё имя.')
      return
    }

    if (
      mode === 'register' ||
      mode === 'new-password'
    ) {
      if (password !== confirmPassword) {
        setError('Пароли не совпадают.')
        return
      }
    }

    setLoading(true)

    try {
      if (mode === 'register') {
        const data = await authService.signUp({
          fullName,
          email,
          password
        })

        if (data.session) {
          navigate('/', { replace: true })
        } else {
          setNotice(
            'Аккаунт создан. Проверь электронную почту и перейди по ссылке подтверждения для завершения регистрации.'
          )

          setCanResendConfirmation(true)
        }

        return
      }

      if (mode === 'login') {
        const data = await authService.signIn({
          email,
          password
        })

        if (data.session) {
          navigate('/', { replace: true })
        }

        return
      }

      if (mode === 'reset') {
        await authService.requestPasswordReset(email)

        setNotice(
          'Письмо для восстановления пароля отправлено, если аккаунт с таким адресом существует. Проверь почту.'
        )

        return
      }

      if (mode === 'new-password') {
        await authService.updatePassword(password)

        setPassword('')
        setConfirmPassword('')

        setNotice('Пароль успешно изменён. Теперь можно продолжить работу.')

        setMode('login')
      }
    } catch (cause) {
      const message = cause instanceof Error
        ? cause.message
        : 'Произошла ошибка. Попробуй ещё раз.'

      setError(message)

      const normalizedMessage = message.toLowerCase()

      if (
        normalizedMessage.includes('email not confirmed') ||
        normalizedMessage.includes('email_not_confirmed')
      ) {
        setCanResendConfirmation(true)
      }
    } finally {
      setLoading(false)
    }
  }

  const pageTitle =
    mode === 'register'
      ? 'Создание аккаунта'
      : mode === 'reset'
        ? 'Восстановление пароля'
        : mode === 'new-password'
          ? 'Новый пароль'
          : 'С возвращением!'

  const pageDescription =
    mode === 'register'
      ? 'Создай аккаунт, чтобы сохранять выбранные варианты и результаты.'
      : mode === 'reset'
        ? 'Укажи электронную почту, и мы отправим ссылку для восстановления доступа.'
        : mode === 'new-password'
          ? 'Придумай новый пароль для своего аккаунта.'
          : 'Войди в аккаунт и продолжи свой путь к поступлению.'

  if (user && mode !== 'new-password') {
    return (
      <main className="auth-page app-shell theme-light">
        <section className="auth-card">
          <div className="auth-logo">
            <GraduationCap size={27} />
          </div>

          <div className="auth-success-icon">
            <CheckCircle2 size={28} />
          </div>

          <h1>Ты уже вошёл в аккаунт</h1>

          <p className="auth-description">
            {user.email}
          </p>

          <button
            type="button"
            className="primary-button auth-submit"
            onClick={() => navigate('/')}
          >
            Вернуться на сайт
            <ArrowRight size={17} />
          </button>

          <button
            type="button"
            className="auth-back-button"
            onClick={async () => {
              setLoading(true)

              try {
                await authService.signOut()
                navigate('/auth', { replace: true })
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : 'Не удалось выйти из аккаунта.'
                )
              } finally {
                setLoading(false)
              }
            }}
            disabled={loading}
          >
            Выйти из аккаунта
          </button>

          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
        </section>
      </main>
    )
  }

  return (
    <main className="auth-page app-shell theme-light">
      <section className="auth-card">
        <div className={`auth-logo auth-logo-${TRAJECTORY_LOGO_MODE}`}>
          {TRAJECTORY_LOGO_URL ? <img src={TRAJECTORY_LOGO_URL} alt="Trajectory" /> : <GraduationCap size={27} />}
        </div>

        <div className="auth-eyebrow">
          ТРАЕКТОРИЯ В ОЛИМПИАДУ
        </div>

        <h1>{pageTitle}</h1>
        <p className="auth-description">{pageDescription}</p>

        {!isConfigured && (
          <div className="auth-config-warning" role="alert">
            Supabase ещё не настроен. Заполни переменные
            окружения `frontend/.env`, чтобы включить авторизацию.
          </div>
        )}

        {mode !== 'new-password' && mode !== 'reset' && (
          <div className="auth-tabs">
            <button
              type="button"
              className={mode === 'login' ? 'auth-tab-active' : ''}
              onClick={() => changeMode('login')}
            >
              Вход
            </button>

            <button
              type="button"
              className={mode === 'register' ? 'auth-tab-active' : ''}
              onClick={() => changeMode('register')}
            >
              Регистрация
            </button>
          </div>
        )}

        {mode === 'reset' && (
          <button
            type="button"
            className="auth-back-button"
            onClick={() => changeMode('login')}
          >
            <ArrowLeft size={15} />
            Вернуться ко входу
          </button>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <label className="auth-field">
              <span>Имя</span>
              <div className="auth-input">
                <UserRound size={17} />
                <input
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Как тебя зовут?"
                  autoComplete="name"
                  maxLength={100}
                  required
                />
              </div>
            </label>
          )}

          {mode !== 'new-password' && (
            <label className="auth-field">
              <span>Электронная почта</span>
              <div className="auth-input">
                <Mail size={17} />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="example@mail.ru"
                  autoComplete="email"
                  maxLength={254}
                  required
                />
              </div>
            </label>
          )}

          {mode !== 'reset' && (
            <label className="auth-field">
              <span>
                {mode === 'new-password'
                  ? 'Новый пароль'
                  : 'Пароль'}
              </span>

              <div className="auth-input">
                <LockKeyhole size={17} />
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Не менее 8 символов"
                  autoComplete={
                    mode === 'register'
                      ? 'new-password'
                      : 'current-password'
                  }
                  minLength={8}
                  maxLength={128}
                  required
                />
                <button type="button" className="auth-password-toggle" onClick={() => setShowPasswords((value) => !value)} aria-label={showPasswords ? 'Скрыть пароль' : 'Показать пароль'} aria-pressed={showPasswords}>
                  {showPasswords ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>
          )}

          {(mode === 'register' || mode === 'new-password') && (
            <label className="auth-field">
              <span>Повтори пароль</span>
              <div className="auth-input">
                <LockKeyhole size={17} />
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Повтори пароль"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                />
                <button type="button" className="auth-password-toggle" onClick={() => setShowPasswords((value) => !value)} aria-label={showPasswords ? 'Скрыть пароль' : 'Показать пароль'} aria-pressed={showPasswords}>
                  {showPasswords ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>
          )}

          {mode === 'login' && (
            <button
              type="button"
              className="auth-forgot"
              onClick={() => changeMode('reset')}
            >
              Забыли пароль?
            </button>
          )}

          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}

          {notice && (
            <div className="auth-notice" role="status">
              {notice}
            </div>
          )}

          {canResendConfirmation && (
            <button
              type="button"
              className="auth-resend-button"
              onClick={handleResendConfirmation}
              disabled={resending || loading || !email.trim() || !isConfigured}
            >
              {resending
                ? 'Отправляем письмо...'
                : 'Отправить письмо подтверждения повторно'}
            </button>
          )}

          <button
            type="submit"
            className="primary-button auth-submit"
            disabled={loading || resending || !isConfigured}
          >
            {loading
              ? 'Подождите...'
              : mode === 'register'
                ? 'Создать аккаунт'
                : mode === 'reset'
                  ? 'Отправить письмо'
                  : mode === 'new-password'
                    ? 'Сохранить пароль'
                    : 'Войти в аккаунт'}

            {!loading && <ArrowRight size={17} />}
          </button>
        </form>

        {mode === 'login' && (
          <button
            type="button"
            className="auth-register-cta"
            onClick={() => changeMode('register')}
          >
            <UserRound size={17} />
            Нет аккаунта? Зарегистрироваться
            <ArrowRight size={16} />
          </button>
        )}

        <div className="auth-footer">
          <span>
            Продолжая, ты соглашаешься использовать сервис
            в соответствии с его правилами.
          </span>
          <Link to="/privacy" className="auth-privacy-link">Политика конфиденциальности</Link>
        </div>
      </section>
    </main>
  )
}
