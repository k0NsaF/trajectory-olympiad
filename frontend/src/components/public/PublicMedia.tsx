import type { ReactNode } from 'react'

import './public-components.css'

export interface PublicMediaProps {
  /** Optional local or hosted image. When omitted, the styled fallback is rendered. */
  src?: string
  /** Keep empty for decorative media when nearby text already names the subject. */
  alt?: string
  /** Shape and visual treatment are provided by the consuming card class. */
  className: string
  /** Optional content shown inside the placeholder, such as a quiet symbol. */
  children?: ReactNode
  loading?: 'eager' | 'lazy'
}

/**
 * Shared media frame for public pages.
 * The wrapper keeps the same geometry whether it displays a real image or a placeholder.
 */
export function PublicMedia({
  src,
  alt = '',
  className,
  children,
  loading = 'lazy'
}: PublicMediaProps) {
  const imageSource = src?.trim()

  return (
    <span
      className={[
        className,
        'public-media',
        imageSource ? 'public-media-has-image' : 'public-media-is-placeholder'
      ].join(' ')}
      aria-hidden={alt.length === 0 ? true : undefined}
    >
      {imageSource ? (
        <img
          className="public-media-image"
          src={imageSource}
          alt={alt}
          loading={loading}
          decoding="async"
        />
      ) : (
        <span className="public-media-fallback" aria-hidden="true">
          {children}
        </span>
      )}
    </span>
  )
}
