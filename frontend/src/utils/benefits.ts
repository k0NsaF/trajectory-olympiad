import type {
  BenefitVerificationFilter,
  UniversityBenefit
} from '@trajectory/shared'

export function getTargetAdmissionYear(date = new Date()): number {
  const year = date.getFullYear()
  const month = date.getMonth()

  // Осенью открывается подготовка к следующей приёмной кампании.
  return month >= 6 ? year + 1 : year
}

function hasHttpSource(value: string | null | undefined): boolean {
  if (!value?.trim()) return false

  try {
    const url = new URL(value.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function hasCompleteOfficialEvidence(
  benefit: UniversityBenefit
): boolean {
  return (
    benefit.verificationStatus === 'official' &&
    hasHttpSource(benefit.sourceUrl) &&
    Boolean(benefit.lastCheckedAt)
  )
}

export function matchesBenefitVerificationFilter(
  benefit: UniversityBenefit,
  filter: BenefitVerificationFilter
): boolean {
  if (filter === 'all') return true

  if (filter === 'official') {
    return hasCompleteOfficialEvidence(benefit)
  }

  if (filter === 'draft') {
    return (
      benefit.verificationStatus === 'draft' ||
      (benefit.verificationStatus === 'official' &&
        !hasCompleteOfficialEvidence(benefit))
    )
  }

  return benefit.verificationStatus === 'archived'
}

export function getBenefitVerificationLabel(
  benefit: UniversityBenefit
): string {
  if (hasCompleteOfficialEvidence(benefit)) {
    return 'Официально подтверждено'
  }

  if (benefit.verificationStatus === 'archived') {
    return 'Архивные условия'
  }

  if (benefit.verificationStatus === 'official') {
    return 'Нужна проверка источника'
  }

  return 'Предварительные данные'
}

export function getBenefitVerificationClass(
  benefit: UniversityBenefit
): string {
  if (hasCompleteOfficialEvidence(benefit)) {
    return 'verification-official'
  }

  if (benefit.verificationStatus === 'archived') {
    return 'verification-archived'
  }

  if (benefit.verificationStatus === 'official') {
    return 'verification-incomplete'
  }

  return 'verification-draft'
}
