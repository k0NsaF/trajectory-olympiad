$ErrorActionPreference = 'Stop'

if (-not (Test-Path '.\frontend\src\pages\Profile\ProfilePage.tsx') -or
    -not (Test-Path '.\backend\src\modules\universities\universities.service.ts')) {
    throw 'Запусти скрипт из корня trajectory-olympiad-v2-git.'
}

$patchCode = @'
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')

const root = process.cwd()
const backupRoot = path.join(os.tmpdir(), `trajectory-profile-autocomplete-${Date.now()}`)
fs.mkdirSync(backupRoot, { recursive: true })
const changed = []
const pendingWrites = []

// Prepare every transformation first. No project file is written until all
// expected source fragments have been found exactly once.
function patchFile(relativePath, transform) {
  const absolutePath = path.join(root, relativePath)
  const exists = fs.existsSync(absolutePath)
  if (!exists && !relativePath.startsWith('frontend/src/components/universities/')) {
    throw new Error(`Не найден файл: ${relativePath}`)
  }
  const originalRaw = exists ? fs.readFileSync(absolutePath, 'utf8') : ''
  const eol = originalRaw.includes('\r\n') ? '\r\n' : '\n'
  let content = originalRaw.replace(/\r\n/g, '\n')
  content = transform(content)
  if (exists && content === originalRaw.replace(/\r\n/g, '\n')) return
  pendingWrites.push({ relativePath, absolutePath, exists, originalRaw, content, eol })
}

function applyPendingWrites() {
  const applied = []
  try {
    for (const item of pendingWrites) {
      if (item.exists) {
        const backupPath = path.join(backupRoot, item.relativePath.replace(/[\\/]/g, '__'))
        fs.writeFileSync(backupPath, item.originalRaw, 'utf8')
      }
      fs.mkdirSync(path.dirname(item.absolutePath), { recursive: true })
      const temporaryPath = `${item.absolutePath}.trajectory-${process.pid}.tmp`
      fs.writeFileSync(temporaryPath, item.content.replace(/\n/g, item.eol), 'utf8')
      fs.renameSync(temporaryPath, item.absolutePath)
      applied.push(item)
      changed.push(item.relativePath)
    }
  } catch (error) {
    for (const item of applied.reverse()) {
      if (item.exists) fs.writeFileSync(item.absolutePath, item.originalRaw, 'utf8')
      else fs.rmSync(item.absolutePath, { force: true })
    }
    throw error
  }
}

function replaceOnce(source, oldText, newText, label) {
  const count = source.split(oldText).length - 1
  if (count !== 1) throw new Error(`${label}: ожидался один точный фрагмент, найдено ${count}. Файл не изменён.`)
  return source.replace(oldText, newText)
}

const regions = [
  'Амурская область', 'Архангельская область', 'Астраханская область', 'Белгородская область',
  'Брянская область', 'Владимирская область', 'Волгоградская область', 'Вологодская область',
  'Воронежская область', 'Запорожская область', 'Ивановская область', 'Иркутская область',
  'Калининградская область', 'Калужская область', 'Кемеровская область — Кузбасс',
  'Кировская область', 'Костромская область', 'Курганская область', 'Курская область',
  'Ленинградская область', 'Липецкая область', 'Магаданская область', 'Московская область',
  'Мурманская область', 'Нижегородская область', 'Новгородская область', 'Новосибирская область',
  'Омская область', 'Оренбургская область', 'Орловская область', 'Пензенская область',
  'Пермский край', 'Приморский край', 'Псковская область', 'Республика Адыгея (Адыгея)',
  'Республика Алтай', 'Республика Башкортостан', 'Республика Бурятия', 'Республика Дагестан',
  'Республика Ингушетия', 'Республика Калмыкия', 'Республика Карелия', 'Республика Коми',
  'Республика Крым', 'Республика Марий Эл', 'Республика Мордовия', 'Республика Саха (Якутия)',
  'Республика Северная Осетия — Алания', 'Республика Татарстан (Татарстан)', 'Республика Тыва',
  'Республика Хакасия', 'Ростовская область', 'Рязанская область', 'Самарская область',
  'Санкт-Петербург', 'Саратовская область', 'Сахалинская область', 'Свердловская область',
  'Севастополь', 'Смоленская область', 'Ставропольский край', 'Тамбовская область',
  'Тверская область', 'Томская область', 'Тульская область', 'Тюменская область',
  'Удмуртская Республика', 'Ульяновская область', 'Хабаровский край',
  'Ханты-Мансийский автономный округ — Югра', 'Челябинская область', 'Чеченская Республика',
  'Чувашская Республика — Чувашия', 'Чукотский автономный округ', 'Ямало-Ненецкий автономный округ',
  'Ярославская область', 'Алтайский край', 'Забайкальский край', 'Кабардино-Балкарская Республика',
  'Камчатский край', 'Карачаево-Черкесская Республика',
  'Краснодарский край', 'Красноярский край', 'Луганская Народная Республика', 'Москва',
  'Ненецкий автономный округ', 'Донецкая Народная Республика', 'Еврейская автономная область',
  'Херсонская область'
]

patchFile('backend/src/modules/universities/universities.schema.ts', (s) => {
  s = replaceOnce(s,
`export const universityQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional()
})`,
`export const universityQuerySchema = z.object({
  search: z.string().trim().min(1).max(100).optional(),
  city: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional()
})`, 'Схема фильтров университета')
  return s
})

patchFile('backend/src/modules/universities/universities.service.ts', (s) => {
  s = replaceOnce(s,
`  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase
      .from('universities')
      .select(UNIVERSITY_SELECT)
      .order('name', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (filters.search) {
      query = query.ilike('name', \`%${'${filters.search}'}%\`)
    }

    if (filters.city) {
      query = query.ilike('city', \`%${'${filters.city}'}%\`)
    }

    let { data, error } = await query

    if (error && /cover_image_(url|source_url|license|alt)|column .* does not exist|schema cache/i.test(error.message)) {
      let legacyQuery = supabase
        .from('universities')
        .select(LEGACY_UNIVERSITY_SELECT)
        .order('name', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
      if (filters.search) legacyQuery = legacyQuery.ilike('name', \`%${'${filters.search}'}%\`)
      if (filters.city) legacyQuery = legacyQuery.ilike('city', \`%${'${filters.city}'}%\`)
      const legacyResult = await legacyQuery
      data = legacyResult.data
      error = legacyResult.error
    }`,
`  const pageSize = filters.limit ?? PAGE_SIZE
  const searchTerm = filters.search?.replace(/[^\\p{L}\\p{N}\\s.-]/gu, ' ').replace(/\\s+/gu, ' ').trim()
  if (filters.search && !searchTerm) return []

  for (let from = 0; ; from += pageSize) {
    let query = supabase
      .from('universities')
      .select(UNIVERSITY_SELECT)
      .order('name', { ascending: true })
      .range(from, from + pageSize - 1)

    if (searchTerm) {
      query = query.or(\`name.ilike.%${'${searchTerm}'}%,short_name.ilike.%${'${searchTerm}'}%\`)
    }

    if (filters.city) {
      query = query.ilike('city', \`%${'${filters.city}'}%\`)
    }

    let { data, error } = await query

    if (error && /cover_image_(url|source_url|license|alt)|column .* does not exist|schema cache/i.test(error.message)) {
      let legacyQuery = supabase
        .from('universities')
        .select(LEGACY_UNIVERSITY_SELECT)
        .order('name', { ascending: true })
        .range(from, from + pageSize - 1)
      if (searchTerm) legacyQuery = legacyQuery.or(\`name.ilike.%${'${searchTerm}'}%,short_name.ilike.%${'${searchTerm}'}%\`)
      if (filters.city) legacyQuery = legacyQuery.ilike('city', \`%${'${filters.city}'}%\`)
      const legacyResult = await legacyQuery
      data = legacyResult.data
      error = legacyResult.error
    }`, 'Постраничный поиск университетов')
  s = replaceOnce(s,
`    const page = (data ?? []) as unknown as UniversityRow[]
    universities.push(...page)
    if (page.length < PAGE_SIZE) break`,
`    const page = (data ?? []) as unknown as UniversityRow[]
    universities.push(...page)
    if (filters.limit !== undefined || page.length < pageSize) break`, 'Ограничение результатов поиска')
  return s
})

patchFile('frontend/src/services/university.service.ts', (s) => {
  s = replaceOnce(s,
`export interface UniversityFilters {
  search?: string
  city?: string
}`, 
`export interface UniversityFilters {
  search?: string
  city?: string
  limit?: number
}`, 'Параметры поиска в frontend')
  return s
})

const autocompleteComponent = `import { useEffect, useId, useRef, useState } from 'react'
import { LoaderCircle, Search, X } from 'lucide-react'

import type { University } from '@trajectory/shared'
import { universityService } from '@/services/university.service'

import './UniversityAutocomplete.css'

interface UniversityAutocompleteProps {
  selected: University | null
  onSelect: (university: University | null) => void
  placeholder?: string
  excludedIds?: string[]
  disabled?: boolean
}

function getLabel(university: University): string {
  return university.shortName && university.shortName !== university.name
    ? \`${'${university.shortName}'} — ${'${university.name}'}\`
    : university.name
}

export function UniversityAutocomplete({
  selected,
  onSelect,
  placeholder = 'Начни вводить название или аббревиатуру',
  excludedIds = [],
  disabled = false
}: UniversityAutocompleteProps) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const selectedLabel = selected ? getLabel(selected) : ''
  const [query, setQuery] = useState(selectedLabel)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<University[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setQuery(selectedLabel)
  }, [selectedLabel])

  useEffect(() => {
    const term = query.trim()
    if (!open || term.length < 2 || term === selectedLabel) {
      setResults([])
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError(null)
      void universityService.getAll({ search: term, limit: 12 })
        .then((items) => {
          if (!cancelled) setResults(items)
        })
        .catch(() => {
          if (!cancelled) {
            setResults([])
            setError('Не удалось выполнить поиск вузов. Проверь соединение и повтори попытку.')
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query, open, selectedLabel])

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setOpen(false)
        if (selected) setQuery(selectedLabel)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open, selected, selectedLabel])

  const availableResults = results.filter((item) => !excludedIds.includes(item.id))

  const choose = (university: University) => {
    onSelect(university)
    setQuery(getLabel(university))
    setOpen(false)
    setResults([])
    setError(null)
  }

  const clear = () => {
    onSelect(null)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div className="university-autocomplete" ref={rootRef}>
      <div className="university-autocomplete__control">
        <Search size={16} aria-hidden="true" />
        <input
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-label="Поиск университета"
          autoComplete="off"
          disabled={disabled}
          value={query}
          placeholder={placeholder}
          onFocus={() => {
            setOpen(true)
            if (selected && query === selectedLabel) setQuery('')
          }}
          onBlur={() => {
            window.setTimeout(() => {
              setOpen(false)
              if (selected) setQuery(selectedLabel)
            }, 120)
          }}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
        />
        {loading && <LoaderCircle className="university-autocomplete__spinner" size={16} aria-label="Поиск" />}
        {!loading && (query.length > 0 || selected) && (
          <button type="button" className="university-autocomplete__clear" onMouseDown={(event) => event.preventDefault()} onClick={clear} aria-label="Очистить выбранный вуз" disabled={disabled}>
            <X size={15} />
          </button>
        )}
      </div>

      {open && query.trim().length >= 2 && (
        <div className="university-autocomplete__menu" id={listId} role="listbox">
          {loading && <p className="university-autocomplete__message">Ищем университеты…</p>}
          {error && <p className="university-autocomplete__message is-error" role="alert">{error}</p>}
          {!loading && !error && availableResults.length === 0 && (
            <p className="university-autocomplete__message">Совпадений нет. Возможно, справочник вузов ещё не загружен.</p>
          )}
          {!loading && availableResults.map((university) => (
            <button
              type="button"
              role="option"
              aria-selected={university.id === selected?.id}
              className="university-autocomplete__option"
              key={university.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(university)}
            >
              <strong>{getLabel(university)}</strong>
              <span>{university.city}{university.region ? \` · ${'${university.region}'}\` : ''}</span>
            </button>
          ))}
        </div>
      )}
      <span className="university-autocomplete__hint">Введи минимум 2 символа. Поиск работает по названию и сокращению.</span>
    </div>
  )
}
`

patchFile('frontend/src/components/universities/UniversityAutocomplete.tsx', (s) => {
  if (s.length > 0) throw new Error('Компонент UniversityAutocomplete.tsx уже существует. Проверь его вручную; повторный патч не выполняется.')
  return autocompleteComponent
})

const autocompleteCss = `.university-autocomplete {
  position: relative;
  width: 100%;
  min-width: 0;
}

.university-autocomplete__control {
  display: flex;
  min-height: 45px;
  align-items: center;
  gap: 9px;
  padding: 0 11px;
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text-muted);
  background: var(--input-bg);
  transition: border-color var(--transition);
}

.university-autocomplete__control:focus-within {
  border-color: var(--accent);
}

.university-autocomplete__control input {
  width: 100%;
  min-width: 0;
  min-height: 43px;
  padding: 0;
  border: 0;
  outline: 0;
  color: var(--text);
  background: transparent;
  font: inherit;
  font-size: 11px;
}

.university-autocomplete__control input:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.university-autocomplete__control input::placeholder {
  color: var(--text-muted);
}

.university-autocomplete__clear {
  display: grid;
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 7px;
  color: var(--text-muted);
  background: transparent;
  cursor: pointer;
}

.university-autocomplete__clear:hover:not(:disabled) {
  color: var(--accent);
  background: var(--accent-soft);
}

.university-autocomplete__spinner {
  flex: 0 0 auto;
  animation: university-autocomplete-spin 0.9s linear infinite;
}

@keyframes university-autocomplete-spin {
  to { transform: rotate(360deg); }
}

.university-autocomplete__menu {
  position: absolute;
  z-index: 40;
  top: calc(100% + 6px);
  right: 0;
  left: 0;
  max-height: 300px;
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 11px;
  background: var(--card);
}

.university-autocomplete__option {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 10px 12px;
  border: 0;
  border-bottom: 1px solid var(--border-soft);
  color: var(--text);
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.university-autocomplete__option:last-child {
  border-bottom: 0;
}

.university-autocomplete__option:hover,
.university-autocomplete__option[aria-selected="true"] {
  background: var(--bg-secondary);
}

.university-autocomplete__option strong {
  color: var(--text-heading);
  font-size: 11px;
  line-height: 1.45;
}

.university-autocomplete__option span {
  color: var(--text-muted);
  font-size: 10px;
}

.university-autocomplete__message {
  margin: 0;
  padding: 12px;
  color: var(--text-muted);
  font-size: 10px;
  line-height: 1.55;
}

.university-autocomplete__message.is-error {
  color: var(--danger);
}

.university-autocomplete__hint {
  display: block;
  margin-top: 6px;
  color: var(--text-muted);
  font-size: 9px;
  line-height: 1.4;
}
`

patchFile('frontend/src/components/universities/UniversityAutocomplete.css', (s) => {
  if (s.length > 0) throw new Error('CSS для UniversityAutocomplete уже существует. Проверь файл вручную.')
  return autocompleteCss
})

patchFile('frontend/src/pages/Profile/ProfilePage.tsx', (s) => {
  s = replaceOnce(s,
`import { universityService } from '@/services/university.service'

import './profile-settings.css'`,
`import { universityService } from '@/services/university.service'
import { UniversityAutocomplete } from '@/components/universities/UniversityAutocomplete'

import './profile-settings.css'`, 'Импорт поиска вузов')

  const educationAnchor = `const EDUCATION_LEVEL_OPTIONS: { value: EducationLevel; label: string }[] = [
  { value: 'bachelor', label: 'Бакалавриат' },
  { value: 'specialist', label: 'Специалитет' },
  { value: 'master', label: 'Магистратура' }
]`
  const regionBlock = `

const REGION_OPTIONS = ${JSON.stringify(regions, null, 2)}
  .slice()
  .sort((a, b) => a.localeCompare(b, 'ru'))`
  s = replaceOnce(s, educationAnchor, educationAnchor + regionBlock, 'Список регионов для автодополнения')

  s = replaceOnce(s,
`  const availableAlternativeUniversities = useMemo(() => {
    const selected = new Set(form.alternativeUniversityIds)
    return universities.filter((university) =>
      university.id !== form.targetUniversityId && !selected.has(university.id)
    )
  }, [universities, form.targetUniversityId, form.alternativeUniversityIds])

`, '', 'Удаление загрузки всего каталога для альтернативных вузов')

  const oldLoad = `      const universityRequest = universityService.getAll()
      const profileRequest = session?.access_token
        ? getProfileSnapshot(session.access_token)
        : Promise.resolve(null)

      const [universityResult, profileResult] = await Promise.allSettled([
        universityRequest,
        profileRequest
      ])

      if (cancelled) return

      if (universityResult.status === 'fulfilled') {
        setUniversities(universityResult.value)
      } else {
        setLoadWarning('Не удалось загрузить список вузов. Остальные данные профиля доступны для просмотра.')
      }

      if (profileResult.status === 'rejected') {
        setLoadWarning('Не удалось загрузить сохранённый профиль с сервера. Проверь соединение и повтори попытку.')
      }

      const remoteProfile = profileResult.status === 'fulfilled'
        ? toProfileInput(profileResult.value)
        : null
      const resolvedProfile = remoteProfile ?? getGuestProfile()

      setProfile(resolvedProfile)
      setForm(toForm(resolvedProfile))
      setEditing(!resolvedProfile)
      setLoading(false)`
  const newLoad = `      const profileRequest = session?.access_token
        ? getProfileSnapshot(session.access_token)
        : Promise.resolve(null)
      const [profileResult] = await Promise.allSettled([profileRequest])

      if (cancelled) return

      if (profileResult.status === 'rejected') {
        setLoadWarning('Не удалось загрузить сохранённый профиль с сервера. Проверь соединение и повтори попытку.')
      }

      const remoteProfile = profileResult.status === 'fulfilled'
        ? toProfileInput(profileResult.value)
        : null
      const resolvedProfile = remoteProfile ?? getGuestProfile()
      setProfile(resolvedProfile)
      setForm(toForm(resolvedProfile))

      const selectedIds = [...new Set([
        resolvedProfile?.targetUniversityId,
        ...(resolvedProfile?.alternativeUniversityIds ?? [])
      ].filter((id): id is string => Boolean(id)))]

      if (selectedIds.length > 0) {
        const universityResults = await Promise.allSettled(
          selectedIds.map((id) => universityService.getById(id))
        )
        if (cancelled) return
        const loadedUniversities = universityResults
          .filter((result): result is PromiseFulfilledResult<University> => result.status === 'fulfilled')
          .map((result) => result.value)
        setUniversities(loadedUniversities)
        if (loadedUniversities.length !== selectedIds.length) {
          setLoadWarning('Не удалось загрузить часть выбранных вузов. Проверь их наличие в справочнике.')
        }
      } else {
        setUniversities([])
      }

      setEditing(!resolvedProfile)
      setLoading(false)`
  s = replaceOnce(s, oldLoad, newLoad, 'Инициализация профиля без полной загрузки каталога')

  const oldTarget = `            <label className="profile-form-field">
              <span>Целевой вуз <small>Необязательно</small></span>
              <select
                value={form.targetUniversityId}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  targetUniversityId: event.target.value,
                  targetProgramId: '',
                  alternativeUniversityIds: current.alternativeUniversityIds.filter((id) => id !== event.target.value)
                }))}
              >
                <option value="">Пока не выбрал</option>
                {universities.map((university) => (
                  <option key={university.id} value={university.id}>
                    {university.shortName} — {university.name}
                  </option>
                ))}
              </select>
            </label>`
  const newTarget = `            <label className="profile-form-field">
              <span>Целевой вуз <small>Необязательно</small></span>
              <UniversityAutocomplete
                selected={selectedUniversity ?? null}
                placeholder="Найди вуз по названию или аббревиатуре"
                onSelect={(university) => {
                  if (university) {
                    setUniversities((current) => [
                      ...current.filter((item) => item.id !== university.id),
                      university
                    ])
                  }
                  setForm((current) => ({
                    ...current,
                    targetUniversityId: university?.id ?? '',
                    targetProgramId: '',
                    alternativeUniversityIds: current.alternativeUniversityIds.filter((id) => id !== university?.id)
                  }))
                  setError(null)
                  setMessage(null)
                }}
              />
            </label>`
  s = replaceOnce(s, oldTarget, newTarget, 'Поле целевого вуза')

  const oldRegion = `              <input
                value={form.region}
                onChange={(event) => updateForm('region', event.target.value)}
                placeholder="Например, Москва"
                maxLength={120}
                required
              />`
  const newRegion = `              <input
                value={form.region}
                onChange={(event) => updateForm('region', event.target.value)}
                placeholder="Начни вводить регион"
                list="trajectory-region-options"
                autoComplete="off"
                maxLength={120}
                required
              />
              <datalist id="trajectory-region-options">
                {REGION_OPTIONS.map((region) => <option key={region} value={region} />)}
              </datalist>`
  s = replaceOnce(s, oldRegion, newRegion, 'Поле региона с автодополнением')

  const oldAlt = `            <div className="profile-alternative-add">
              <label className="profile-form-field">
                <span>Добавить университет</span>
                <select
                  value={form.alternativeUniversityToAdd}
                  onChange={(event) => updateForm('alternativeUniversityToAdd', event.target.value)}
                  disabled={form.alternativeUniversityIds.length >= 3 || availableAlternativeUniversities.length === 0}
                >
                  <option value="">Выбери вуз из списка</option>
                  {availableAlternativeUniversities.map((university) => (
                    <option key={university.id} value={university.id}>
                      {university.shortName} — {university.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="secondary-button profile-alternative-add-button"
                onClick={addAlternativeUniversity}
                disabled={!form.alternativeUniversityToAdd || form.alternativeUniversityIds.length >= 3}
              >
                <Plus size={16} /> Добавить
              </button>
            </div>`
  const newAlt = `            <div className="profile-alternative-add">
              <label className="profile-form-field">
                <span>Добавить университет</span>
                <UniversityAutocomplete
                  selected={universities.find((item) => item.id === form.alternativeUniversityToAdd) ?? null}
                  placeholder="Найди запасной вуз"
                  excludedIds={[form.targetUniversityId, ...form.alternativeUniversityIds]}
                  disabled={form.alternativeUniversityIds.length >= 3}
                  onSelect={(university) => {
                    if (university) {
                      setUniversities((current) => [
                        ...current.filter((item) => item.id !== university.id),
                        university
                      ])
                    }
                    updateForm('alternativeUniversityToAdd', university?.id ?? '')
                  }}
                />
              </label>
              <button
                type="button"
                className="secondary-button profile-alternative-add-button"
                onClick={addAlternativeUniversity}
                disabled={!form.alternativeUniversityToAdd || form.alternativeUniversityIds.length >= 3}
              >
                <Plus size={16} /> Добавить
              </button>
            </div>`
  s = replaceOnce(s, oldAlt, newAlt, 'Поле альтернативного вуза')
  return s
})

applyPendingWrites()

console.log('Изменённые файлы:')
for (const file of changed) console.log(`  + ${file}`)
console.log(`Резервные копии: ${backupRoot}`)
console.log(`Регионов в автодополнении: ${regions.length}`)
'@

$nodeScriptPath = Join-Path $env:TEMP ("trajectory-profile-autocomplete-$([guid]::NewGuid().ToString('N')).cjs")
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($nodeScriptPath, $patchCode, $utf8NoBom)

try {
    & node $nodeScriptPath
    if ($LASTEXITCODE -ne 0) {
        throw 'Патч не применён. Node сообщил об ошибке; исходники не должны быть изменены, если ошибка возникла на этапе проверки фрагментов.'
    }
}
finally {
    if (Test-Path $nodeScriptPath) {
        Remove-Item $nodeScriptPath -Force
    }
}
