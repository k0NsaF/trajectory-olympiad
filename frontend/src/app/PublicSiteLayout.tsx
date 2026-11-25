import { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ArrowUpRight, Bookmark, CalendarDays, ChevronDown, LogOut, Menu, Route, Settings, Trophy, UserRound, X } from 'lucide-react'
import { TRAJECTORY_LOGO_URL, TRAJECTORY_LOGO_MODE } from '@/app/brandAssets'
import { useAuth } from '@/app/providers'
import { authService } from '@/services/auth.service'

export function PublicSiteLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [accountOpen, setAccountOpen] = useState(false)
  const [signOutError, setSignOutError] = useState('')
  const { user, loading: authLoading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const closeMobileMenu = () => setMobileMenuOpen(false)
  const aiState = { state: { sourcePath: location.pathname } }
  const handleSignOut = async () => {
    setSignOutError('')
    try {
      await authService.signOut()
      setAccountOpen(false)
      closeMobileMenu()
      navigate('/', { replace: true })
    } catch (cause) {
      setSignOutError(cause instanceof Error ? cause.message : 'Не удалось выйти из аккаунта.')
    }
  }

  return (
    <div className="public-site">
      <a className="public-skip-link" href="#public-main">
        Перейти к содержимому
      </a>

      <header className="public-header">
        <div className="public-header-inner">
          <Link
            to="/"
            className={`public-brand public-brand-${TRAJECTORY_LOGO_MODE}`}
            aria-label="Trajectory — главная страница"
            onClick={closeMobileMenu}
          >
            {TRAJECTORY_LOGO_URL ? (
              <img className={`public-brand-image public-brand-image-${TRAJECTORY_LOGO_MODE}`} src={TRAJECTORY_LOGO_URL} alt="" aria-hidden="true" />
            ) : (
              <span className="public-brand-mark" aria-hidden="true">
                <Route size={21} strokeWidth={1.8} />
              </span>
            )}
            {(!TRAJECTORY_LOGO_URL || TRAJECTORY_LOGO_MODE === 'icon') && <span className="public-brand-copy">
              <strong>Trajectory</strong>
              <small>ТВОЙ ПУТЬ К ПОСТУПЛЕНИЮ</small>
            </span>}
          </Link>

          <nav className="public-nav" aria-label="Основная навигация">
            <div className="public-nav-group public-nav-left">
              <Link to="/professions">Профессии</Link>
              <Link to="/directions">Направления</Link>
            </div>
            <div className="public-nav-group public-nav-middle">
              <Link to="/olympiads" className="public-nav-olympiads">Олимпиады</Link>
              <Link to="/calendar">Календарь</Link>
            </div>
            <div className="public-nav-group public-nav-right">
              <Link to="/universities">Университеты</Link>
              <Link to="/ai" {...aiState}>ИИ-помощник</Link>
            </div>
          </nav>

          <div className="public-header-actions">
            {!authLoading && user ? (
              <div className="public-account-wrap">
                <button type="button" className="public-account-trigger" aria-expanded={accountOpen} onClick={() => setAccountOpen((value) => !value)}>
                  <span className="public-account-avatar"><UserRound size={17} /></span>
                  <span>Аккаунт</span><ChevronDown size={15} />
                </button>
                {accountOpen && <div className="public-account-menu">
                  <Link to="/profile" onClick={() => setAccountOpen(false)}><UserRound size={16} />Профиль</Link>
                  <Link to="/favorites" onClick={() => setAccountOpen(false)}><Bookmark size={16} />Избранное</Link>
                  <Link to="/calendar" onClick={() => setAccountOpen(false)}><CalendarDays size={16} />Календарь</Link>
                  <Link to="/achievements" onClick={() => setAccountOpen(false)}><Trophy size={16} />Достижения</Link>
                  <Link to="/settings" onClick={() => setAccountOpen(false)}><Settings size={16} />Настройки</Link>
                  <button type="button" onClick={() => void handleSignOut()}><LogOut size={16} />Выйти</button>
                  {signOutError && <small role="alert">{signOutError}</small>}
                </div>}
              </div>
            ) : !authLoading ? (
              <>
                <Link to="/auth" className="public-login-link">Войти</Link>
                <Link to="/auth?mode=register" className="public-button public-button-compact">Регистрация <ArrowUpRight size={16} /></Link>
              </>
            ) : null}
            <button
              type="button"
              className="public-menu-toggle"
              aria-label={mobileMenuOpen ? 'Закрыть меню' : 'Открыть меню'}
              aria-expanded={mobileMenuOpen}
              aria-controls="public-mobile-nav"
              onClick={() => setMobileMenuOpen((value) => !value)}
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>

          {mobileMenuOpen && (
            <nav
              id="public-mobile-nav"
              className="public-mobile-nav"
              aria-label="Мобильная навигация"
            >
              <Link to="/professions" onClick={closeMobileMenu}>Профессии</Link>
              <Link to="/directions" onClick={closeMobileMenu}>Направления</Link>
              <Link to="/olympiads" className="public-mobile-olympiads" onClick={closeMobileMenu}>Олимпиады</Link>
              <Link to="/calendar" onClick={closeMobileMenu}>Календарь</Link>
              <Link to="/universities" onClick={closeMobileMenu}>Университеты</Link>
              <Link to="/ai" state={{ sourcePath: location.pathname }} onClick={closeMobileMenu}>ИИ-помощник</Link>
              <div className="public-mobile-nav-actions">
                {user ? (<>
                  <Link to="/profile" onClick={closeMobileMenu}>Профиль</Link>
                  <Link to="/favorites" onClick={closeMobileMenu}>Избранное</Link>
                  <Link to="/calendar" onClick={closeMobileMenu}>Календарь</Link>
                  <Link to="/achievements" onClick={closeMobileMenu}>Достижения</Link>
                  <Link to="/settings" onClick={closeMobileMenu}>Настройки</Link>
                  <button type="button" className="public-login-link" onClick={() => void handleSignOut()}>Выйти из аккаунта</button>
                </>) : (<>
                  <Link to="/auth" className="public-login-link" onClick={closeMobileMenu}>Войти</Link>
                  <Link to="/auth?mode=register" className="public-button" onClick={closeMobileMenu}>Регистрация <ArrowUpRight size={16} /></Link>
                </>)}
              </div>
            </nav>
          )}
        </div>
      </header>

      <main id="public-main" className="public-main">
        <Outlet context={{ searchQuery, setSearchQuery }} />
      </main>

      <footer className="public-footer">
        <div className="public-footer-inner">
          <Link to="/" className={`public-footer-brand public-footer-brand-${TRAJECTORY_LOGO_MODE}`}>
            {TRAJECTORY_LOGO_URL ? (
              <img className={`public-footer-image public-footer-image-${TRAJECTORY_LOGO_MODE}`} src={TRAJECTORY_LOGO_URL} alt="Trajectory" />
            ) : (
              <>
                <span className="public-footer-mark" aria-hidden="true"><Route size={16} strokeWidth={1.8} /></span>
                <strong>Trajectory</strong>
              </>
            )}
          </Link>
          <p>Олимпиады, университеты и инструменты для планирования поступления.</p>
          <Link to="/privacy" className="public-footer-privacy">Политика конфиденциальности</Link>
          <span className="public-footer-note">
            Справочная информация не заменяет официальные документы вузов и организаторов олимпиад.
          </span>
        </div>
      </footer>
    </div>
  )
}
