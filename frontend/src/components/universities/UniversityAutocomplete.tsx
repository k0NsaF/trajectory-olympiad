import { useEffect, useId, useRef, useState } from 'react'
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
    ? `${university.shortName} — ${university.name}`
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
              <span>{university.city}{university.region ? ` · ${university.region}` : ''}</span>
            </button>
          ))}
        </div>
      )}
      <span className="university-autocomplete__hint">Введи минимум 2 символа. Поиск работает по названию и сокращению.</span>
    </div>
  )
}
