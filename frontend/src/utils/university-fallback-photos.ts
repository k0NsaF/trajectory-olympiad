/**
 * TRAJECTORY_UNIVERSITY_PHOTO_POOL_V2
 * Deterministic CC0 campus-photo pool. These are generic fallback illustrations,
 * not photos matched to the identity of each university. Verified DB photos
 * and the small exact-domain campus map still take priority in UniversitiesPage.
 */
const PHOTO_FILES = [
  'University of Vaasa campus.jpg',
  'Macron Campus 2024.jpg',
  'Campus (39818306).jpeg',
  'Building on campus at Cornell University.jpg',
  'Campus building behind street at Cornell University.jpg',
  'Ivy Covered Building in the Princeton University Campus, New Jersey.jpg',
  'Campus view at the University of Rochester.jpg',
  'Campus view pathways buildings at Cornell University.jpg',
  'Comstock Hall at Cornell University.jpg',
  'University Main Building (Front).jpg',
  'HU-mainbuilding.jpg',
  'Former Helsinki Technical University main building.jpg',
  'Rantakatu 3 Oulu 20100227.jpg',
  'Architecture - Georgia Institute of Technology - DSC00804.JPG',
  'Blake R. Van Leer Building - Georgia Institute of Technology - DSC00796.JPG',
  'Blake R. Van Leer Building - Georgia Institute of Technology - DSC00792.JPG',
  'Building, Peking University, 2011042206.jpg',
  'Building, Peking University, 2011042214.jpg',
  'GallaudetUniv.jpg',
  'College of Architecture and Planning - University of Utah - DSC02426.JPG',
  'CSUEB CORE Building.jpg',
  'College Campus - 09-03-2025.jpg',
  'CAMPUS INSIDE.jpg',
] as const

function stableHash(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function toCommonsUrl(fileName: string): string {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=1280`
}

export function getUniversityFallbackPhotoCount(): number {
  return PHOTO_FILES.length
}

export function getUniversityFallbackPhoto(universityId: string, attempt = 0, cardIndex?: number): string {
  const baseIndex = Number.isInteger(cardIndex) ? Math.max(0, cardIndex as number) : stableHash(universityId)
  const index = (baseIndex + Math.max(0, attempt)) % PHOTO_FILES.length
  return toCommonsUrl(PHOTO_FILES[index])
}