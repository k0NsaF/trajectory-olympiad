import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Compass,
  GitCompareArrows,
  Landmark,
  Medal,
  MessageCircle,
  Route,
  type LucideIcon
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { PublicMedia } from '@/components/public/PublicMedia'
import { PublicSectionHeading } from '@/components/public/PublicSectionHeading'

import './home-page.css'

interface JourneyPoint {
  title: string
  description: string
  icon: LucideIcon
}

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

const JOURNEY_POINTS: JourneyPoint[] = [
  {
    title: 'Интересы',
    description: 'С чего тебе хочется начать',
    icon: Compass
  },
  {
    title: 'Возможности',
    description: 'Что можно изучить и попробовать',
    icon: BookOpen
  },
  {
    title: 'Университеты',
    description: 'Где можно продолжить обучение',
    icon: Landmark
  },
  {
    title: 'Личный план',
    description: 'Какие шаги сделать дальше',
    icon: CalendarDays
  }
]

const STEPS: StepItem[] = [
  {
    imageClass: 'profile',
    imageSrc: '/images/home/step-start.jpg',
    title: 'Начни с себя',
    description: 'Укажи класс, регион и предметы, которые тебе интересны.',
    href: '/onboarding',
    action: 'Настроить ориентиры'
  },
  {
    imageClass: 'olympiads',
    imageSrc: '/images/home/step-olympiad.jpg',
    title: 'Открой олимпиады',
    description: 'Подбирай соревнования по своим предметам, классам и срокам.',
    href: '/olympiads',
    action: 'Найти олимпиаду'
  },
  {
    imageClass: 'universities',
    imageSrc: '/images/home/step-university.jpg',
    title: 'Изучай университеты',
    description: 'Знакомься с вузами и находи варианты для дальнейшего изучения.',
    href: '/universities',
    action: 'Открыть каталог вузов'
  },
  {
    imageClass: 'trajectory',
    imageSrc: '/images/home/step-trajectory.jpg',
    title: 'Собери траекторию',
    description: 'Возвращайся к персональным вариантам и выбранным целям.',
    href: '/trajectory',
    action: 'Перейти к траектории'
  },
  {
    imageClass: 'calendar',
    imageSrc: '/images/home/step-planning.jpg',
    title: 'Планируй вовремя',
    description: 'Добавляй события и напоминания, чтобы не терять важные даты.',
    href: '/calendar',
    action: 'Открыть календарь'
  }
]

const FEATURES: FeatureItem[] = [
  {
    title: 'Олимпиады',
    description: 'Подбирай соревнования по своим предметам, следи за регистрацией и этапами, отмечай важные даты в календаре.',
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
              Разбирайся в возможностях, находи олимпиады по своим предметам и университеты,
              собирай собственный образовательный маршрут — постепенно и в своём темпе.
            </p>

            <div className="public-hero-actions">
              <Link to="/onboarding" className="public-button public-button-large">
                Определить свой маршрут
                <ArrowRight size={18} />
              </Link>
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

          <div className="public-hero-visual" role="img" aria-label="Схема образовательного маршрута">
            <div className="public-hero-orbit public-hero-orbit-one" />
            <div className="public-hero-orbit public-hero-orbit-two" />
            <div className="public-route-card">
              <div className="public-route-card-head">
                <div>
                  <span className="public-route-kicker">ТВОЙ МАРШРУТ</span>
                  <strong>Большая цель — маленькими шагами</strong>
                </div>
                <span className="public-route-stamp" aria-hidden="true">
                  <Route size={20} />
                </span>
              </div>

              <div className="public-route-list">
                {JOURNEY_POINTS.map((point, index) => {
                  const Icon = point.icon

                  return (
                    <div className="public-route-item" key={point.title}>
                      <div className="public-route-marker-wrap">
                        <span className={`public-route-marker public-route-marker-${index + 1}`}>
                          <Icon size={18} strokeWidth={1.9} />
                        </span>
                        {index < JOURNEY_POINTS.length - 1 && (
                          <span className="public-route-connector" aria-hidden="true" />
                        )}
                      </div>
                      <div className="public-route-item-copy">
                        <strong>{point.title}</strong>
                        <span>{point.description}</span>
                      </div>
                      <span className="public-route-index">0{index + 1}</span>
                    </div>
                  )
                })}
              </div>

              <div className="public-route-card-foot">
                <span className="public-route-foot-line" />
                <span>ТВОЙ ТЕМП. ТВОЙ ВЫБОР.</span>
              </div>
            </div>
            <div className="public-hero-note-card">
              <span className="public-note-icon"><Compass size={16} /></span>
              <span>
                <strong>Не обязательно знать всё сразу</strong>
                <small>Начни с того, что тебе интересно</small>
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="public-steps-section" id="steps">
        <div className="public-container">
          <PublicSectionHeading
            kicker="ПОНЯТНЫЙ ПЛАН"
            title="Путь складывается из небольших шагов"
            description="Не нужно принимать все решения сегодня. Начни с простого и возвращайся к следующим шагам, когда будешь готов."
            variant="centered"
          />

          <div className="public-steps-grid">
            {STEPS.map((step) => (
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
            description="Начни с олимпиад: подбирай соревнования по своим предметам и следи за сроками. Затем изучай университеты и планируй следующие шаги."
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
            <Link to="/onboarding" className="public-button public-button-light">
              Начать с интересов
              <ArrowRight size={18} />
            </Link>
            <Link to="/auth?mode=register" className="public-cta-secondary">
              Создать аккаунт
              <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
