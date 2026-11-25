import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Compass,
  GitCompareArrows,
  Landmark,
  Medal,
  MessageCircle,
  type LucideIcon
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { PublicMedia } from '@/components/public/PublicMedia'
import { PublicSectionHeading } from '@/components/public/PublicSectionHeading'
import { useAuth } from '@/app/providers'

import './home-page.css'

interface StepItem {
  imageSrc?: string
  imageClass: string
  title: string
  description: string
  href: string
  action: string
}

interface FeatureItem {
  imageSrc?: string
  title: string
  description: string
  href: string
  action: string
  icon: LucideIcon
  artClass: string
  featured?: boolean
}

const STEPS: StepItem[] = [
  { imageClass: 'profile', imageSrc: '/images/home/step-start.jpg', title: 'Начни с регистрации', description: 'Создай аккаунт, чтобы сохранять выбранные варианты и результаты.', href: '/auth?mode=register', action: 'Зарегистрироваться' },
  { imageClass: 'professions', imageSrc: '/images/professions/architect.webp', title: 'Изучи профессии', description: 'Посмотри, чем занимаются специалисты и какие навыки им нужны.', href: '/professions', action: 'Открыть профессии' },
  { imageClass: 'directions', imageSrc: '/images/professions/software-developer.webp', title: 'Выбери направления', description: 'Разберись в областях обучения и связанных с ними программах.', href: '/directions', action: 'Изучить направления' },
  { imageClass: 'olympiads', imageSrc: '/images/home/step-olympiad.jpg', title: 'Открой олимпиады', description: 'Подбирай соревнования по предметам, классу и официальным условиям.', href: '/olympiads', action: 'Найти олимпиаду' },
  { imageClass: 'universities', imageSrc: '/images/home/step-university.jpg', title: 'Изучай университеты', description: 'Знакомься с вузами и проверяй информацию о поступлении.', href: '/universities', action: 'Открыть каталог вузов' },
  { imageClass: 'calendar', imageSrc: '/images/home/step-planning.jpg', title: 'Планируй в календаре', description: 'Собирай даты выбранных олимпиад, задачи и напоминания в одном месте.', href: '/calendar', action: 'Открыть календарь' },
  { imageClass: 'assistant', imageSrc: '/images/home/step-trajectory.jpg', title: 'Общайся с ИИ-помощником', description: 'Задавай вопросы, уточняй информацию и получай подсказки с учётом профиля.', href: '/ai', action: 'Задать вопрос' }
]

const FEATURES: FeatureItem[] = [
  {
    title: 'Олимпиады',
    description: 'Подбирай соревнования по своим предметам и классам, следи за регистрацией и этапами.',
    href: '/olympiads',
    action: 'Открыть олимпиады',
    icon: Medal,
    artClass: 'public-feature-art-olympiads',
    imageSrc: '/images/home/step-olympiad.jpg',
    featured: true
  },
  {
    title: 'Университеты',
    description: 'Исследуй вузы, смотри доступную информацию и сравнивай варианты.',
    href: '/universities',
    action: 'Перейти к вузам',
    icon: Landmark,
    artClass: 'public-feature-art-universities'
  },
  {
    title: 'Сравнение вузов',
    description: 'Сопоставляй доступные характеристики университетов в одном месте.',
    href: '/universities/compare',
    action: 'Сравнить варианты',
    icon: GitCompareArrows,
    artClass: 'public-feature-art-compare'
  },
  {
    title: 'ИИ-помощник',
    description: 'Задавай вопросы об обучении, олимпиадах и следующих шагах.',
    href: '/ai',
    action: 'Задать вопрос',
    icon: MessageCircle,
    artClass: 'public-feature-art-ai'
  }
]

export function HomePage() {
  const { user, loading: authLoading } = useAuth()
  const displaySteps = user
    ? STEPS.map((step, index) => index === 0 ? { ...step, title: 'Твой профиль', description: 'Профиль уже создан. Продолжай изучать варианты и сохраняй подходящие университеты и олимпиады.', href: '/profile', action: 'Открыть профиль' } : step)
    : STEPS

  return (
    <>
      <section className="public-hero">
        <div className="public-container public-hero-grid">
          <div className="public-hero-copy">
            <div className="public-eyebrow">
              <span className="public-eyebrow-dot" />
              ДЛЯ ШКОЛЬНИКОВ 7–11 КЛАССОВ
            </div>

            <h1>
              От первого интереса
              <span>до своего университета.</span>
            </h1>

            <p className="public-hero-description">
              Разбирайся в возможностях, находи олимпиады по своим предметам и изучай университеты — постепенно и в своём темпе.
            </p>

            <div className="public-hero-actions">
              {user ? (
                <Link to="/profile" className="public-button public-button-large">
                  Мой профиль
                  <ArrowRight size={18} />
                </Link>
              ) : !authLoading ? (
                <Link to="/auth?mode=register" className="public-button public-button-large">
                  Создать аккаунт
                  <ArrowRight size={18} />
                </Link>
              ) : null}
              <Link to="/olympiads" className="public-text-link">
                Смотреть олимпиады
                <ArrowUpRight size={17} />
              </Link>
            </div>

            <div className="public-hero-footnote">
              <span className="public-footnote-mark" aria-hidden="true">
                <Compass size={16} />
              </span>
              Начать можно, даже если ты пока не решил, кем хочешь стать.
            </div>
          </div>

          <div className="public-hero-visual" aria-label="Школьники вместе изучают учебные материалы">
            <PublicMedia
              src="/images/home/step-trajectory.jpg"
              alt="Два школьника совместно занимаются за ноутбуком и учебными материалами"
              className="public-hero-student-photo"
              loading="eager"
            />
            <p className="public-hero-photo-caption">Учись. Исследуй. Выбирай.</p>
          </div>
        </div>
      </section>

      <section className="public-steps-section" id="steps">
        <div className="public-container">
          <PublicSectionHeading
            kicker="ПОНЯТНЫЙ ПЛАН"
            title="Всё необходимое — в понятных разделах"
            description="Не нужно принимать все решения сегодня. Выбирай подходящие инструменты и пользуйся ими в удобном порядке."
            variant="centered"
          />

          <div className="public-steps-grid">
            {displaySteps.map((step) => (
              <article className="public-step-card" key={step.title}>
                <PublicMedia
                  src={step.imageSrc}
                  alt=""
                  className={`public-step-image-slot public-step-image-slot-${step.imageClass}`}
                />
                <h3>{step.title}</h3>
                <p>{step.description}</p>
                <Link to={step.href} className="public-step-link">
                  {step.action}
                  <ArrowUpRight size={15} />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="public-discovery-section">
        <div className="public-container">
          <PublicSectionHeading
            kicker="ИНСТРУМЕНТЫ TRAJECTORY"
            title="Исследуй. Сравнивай. Планируй."
            description="Изучай профессии и направления, находи олимпиады, сравнивай университеты и собирай важные даты в календаре."
            variant="split"
            className="public-discovery-heading"
          />

          <div className="public-feature-grid">
            {FEATURES.map((feature) => {
              const Icon = feature.icon

              return (
                <Link
                  to={feature.href}
                  className={`public-feature-card${feature.featured ? ' is-featured' : ''}`}
                  key={feature.title}
                >
                  <PublicMedia
                    src={feature.imageSrc}
                    alt=""
                    className={`public-feature-art ${feature.artClass}`}
                  >
                    <span className="public-feature-icon">
                      <Icon size={21} strokeWidth={1.7} />
                    </span>
                  </PublicMedia>
                  <span className="public-feature-copy">
                    {feature.featured && <span className="public-feature-kicker">Главное направление</span>}
                    <strong>{feature.title}</strong>
                    <span>{feature.description}</span>
                    <span className="public-feature-action">
                      {feature.action}
                      <ArrowUpRight size={16} />
                    </span>
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      <section className="public-source-section">
        <div className="public-container public-source-panel">
          <div className="public-source-symbol" aria-hidden="true">
            <BookOpen size={26} />
          </div>
          <div className="public-source-copy">
            <span className="public-section-kicker">ВАЖНО ДЛЯ ПОСТУПЛЕНИЯ</span>
            <h2>Важные условия всегда сверяй с первоисточником</h2>
            <p>
              Правила приёма, проходные баллы, сроки и олимпиадные преимущества могут меняться.
              Перед важным решением сверяй условия с актуальными документами университета или организатора олимпиады.
            </p>
          </div>
          <Link to="/olympiads" className="public-source-link">
            Изучить олимпиады
            <ArrowUpRight size={17} />
          </Link>
        </div>
      </section>

      <section className="public-final-cta-section">
        <div className="public-container public-final-cta">
          <div>
            <span className="public-section-kicker">ТВОЯ ИСТОРИЯ НАЧИНАЕТСЯ ЗДЕСЬ</span>
            <h2>Первый шаг не обязан быть идеальным.</h2>
            <p>Достаточно начать задавать вопросы и изучать варианты.</p>
          </div>
          <div className="public-final-cta-actions">
            {user ? (
              <>
                <Link to="/profile" className="public-button public-button-light">Открыть профиль <ArrowRight size={18} /></Link>
                <Link to="/calendar" className="public-cta-secondary">Перейти в календарь <ArrowUpRight size={16} /></Link>
              </>
            ) : !authLoading ? (
              <>
                <Link to="/auth?mode=register" className="public-button public-button-light">Зарегистрироваться <ArrowRight size={18} /></Link>
                <Link to="/auth?mode=register" className="public-cta-secondary">Создать аккаунт <ArrowUpRight size={16} /></Link>
              </>
            ) : null}
          </div>
        </div>
      </section>
    </>
  )
}
