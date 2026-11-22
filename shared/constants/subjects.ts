
export const SUBJECTS = [
  { id: 'mathematics', label: 'Математика' },
  { id: 'informatics', label: 'Информатика' },
  { id: 'physics', label: 'Физика' },
  { id: 'biology', label: 'Биология' },
  { id: 'chemistry', label: 'Химия' },
  { id: 'economics', label: 'Экономика' },
  { id: 'russian', label: 'Русский язык' },
  { id: 'history', label: 'История' },
  { id: 'social_studies', label: 'Обществознание' },
  { id: 'foreign_language', label: 'Иностранный язык' }
] as const

export type SubjectId = typeof SUBJECTS[number]['id']
