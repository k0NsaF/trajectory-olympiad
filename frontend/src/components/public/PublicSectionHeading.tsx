import './public-components.css'

export interface PublicSectionHeadingProps {
  kicker: string
  title: string
  description?: string
  variant?: 'centered' | 'split'
  className?: string
}

/** Shared heading for sections on the public-facing part of Trajectory. */
export function PublicSectionHeading({
  kicker,
  title,
  description,
  variant = 'centered',
  className = ''
}: PublicSectionHeadingProps) {
  const classes = [
    'public-section-heading',
    variant === 'centered' ? 'public-section-heading-centered' : 'public-section-heading-split',
    className
  ].filter(Boolean).join(' ')

  return (
    <div className={classes}>
      <div className="public-section-heading-copy">
        <span className="public-section-kicker">{kicker}</span>
        <h2>{title}</h2>
      </div>
      {description && <p>{description}</p>}
    </div>
  )
}
