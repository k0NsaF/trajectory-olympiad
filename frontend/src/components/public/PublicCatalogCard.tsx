import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { PublicMedia } from '@/components/public/PublicMedia'

import './public-components.css'

export interface PublicCatalogCardProps {
  title: string
  description: string
  href: string
  imageSrc?: string
  imageAlt?: string
  eyebrow?: string
  meta?: string
  actionLabel?: string
}

/**
 * Standard image-first card for profession, direction, university and program catalogs.
 * The media frame preserves its aspect ratio when a real image is supplied later.
 */
export function PublicCatalogCard({
  title,
  description,
  href,
  imageSrc,
  imageAlt = '',
  eyebrow,
  meta,
  actionLabel = 'Подробнее'
}: PublicCatalogCardProps) {
  return (
    <Link className="public-catalog-card" to={href}>
      <PublicMedia
        src={imageSrc}
        alt={imageAlt}
        className="public-catalog-card-media"
      >
        <span className="public-catalog-placeholder-mark" aria-hidden="true" />
      </PublicMedia>

      <span className="public-catalog-card-content">
        {eyebrow && <span className="public-catalog-card-eyebrow">{eyebrow}</span>}
        <strong className="public-catalog-card-title">{title}</strong>
        <span className="public-catalog-card-description">{description}</span>
        {meta && <span className="public-catalog-card-meta">{meta}</span>}
        <span className="public-catalog-card-action">
          {actionLabel}
          <ArrowUpRight size={16} />
        </span>
      </span>
    </Link>
  )
}
