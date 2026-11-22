
import type { ReactNode } from 'react'

interface PageHeaderProps {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action
}: PageHeaderProps) {
  return (
    <section className="page-header">
      <div className="page-header-content">
        {eyebrow && (
          <div className="section-kicker">{eyebrow}</div>
        )}

        <h1>{title}</h1>

        {description && <p>{description}</p>}
      </div>

      {action && (
        <div className="page-header-action">
          {action}
        </div>
      )}
    </section>
  )
}
