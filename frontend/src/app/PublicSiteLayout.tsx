import { useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { ArrowUpRight, Menu, Route, X } from 'lucide-react'
import { TRAJECTORY_LOGO_URL, TRAJECTORY_LOGO_MODE } from '@/app/brandAssets'

export function PublicSiteLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const closeMobileMenu = () => setMobileMenuOpen(false)

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
              <Link to="/">Главная</Link>
              <Link to="/professions">Профессии</Link>
              <Link to="/directions">Направления</Link>
            </div>
            <Link to="/olympiads" className="public-nav-olympiads" aria-label="Перейти к каталогу олимпиад">
              Олимпиады
            </Link>
            <div className="public-nav-group public-nav-right">
              <Link to="/universities">Университеты</Link>
              <Link to="/ai">ИИ-помощник</Link>
            </div>
          </nav>

          <div className="public-header-actions">
            <Link to="/auth" className="public-login-link">
              Войти
            </Link>
            <Link to="/auth?mode=register" className="public-button public-button-compact">
              Начать путь
              <ArrowUpRight size={16} />
            </Link>
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
              <Link to="/" onClick={closeMobileMenu}>Главная</Link>
              <Link to="/professions" onClick={closeMobileMenu}>Профессии</Link>
              <Link to="/directions" onClick={closeMobileMenu}>Направления</Link>
              <Link to="/olympiads" className="public-mobile-olympiads" onClick={closeMobileMenu}>Олимпиады</Link>
              <Link to="/universities" onClick={closeMobileMenu}>Университеты</Link>
              <Link to="/ai" onClick={closeMobileMenu}>ИИ-помощник</Link>
              <div className="public-mobile-nav-actions">
                <Link to="/auth" className="public-login-link" onClick={closeMobileMenu}>
                  Войти
                </Link>
                <Link
                  to="/auth?mode=register"
                  className="public-button"
                  onClick={closeMobileMenu}
                >
                  Начать путь
                  <ArrowUpRight size={16} />
                </Link>
              </div>
            </nav>
          )}
        </div>
      </header>

      <main id="public-main" className="public-main">
        <Outlet />
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
          <p>Образовательный маршрут школьника — шаг за шагом.</p>
          <Link to="/privacy" className="public-footer-privacy">Политика конфиденциальности</Link>
          <span className="public-footer-note">
            Справочная информация не заменяет официальные документы вузов и организаторов олимпиад.
          </span>
        </div>
      </footer>
    </div>
  )
}
