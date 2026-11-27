import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  olympiadDetailsQuerySchema,
  olympiadFiltersSchema
} from '../src/modules/olympiads/olympiads.schema.js'

describe('year filters for olympiad history', () => {
  it('accepts a valid academic year', () => {
    const result = olympiadFiltersSchema.parse({
      listType: 'school_olympiad',
      academicYear: '2025-2026'
    })

    assert.equal(result.academicYear, '2025-2026')
    assert.equal(result.calendarYear, undefined)
  })

  it('accepts a calendar year from a query string', () => {
    const result = olympiadFiltersSchema.parse({
      listType: 'school_olympiad',
      calendarYear: '2026'
    })

    assert.equal(result.calendarYear, 2026)
    assert.equal(result.academicYear, undefined)
  })

  it('rejects malformed or non-consecutive academic years', () => {
    assert.equal(olympiadFiltersSchema.safeParse({ academicYear: '2026' }).success, false)
    assert.equal(olympiadFiltersSchema.safeParse({ academicYear: '2025-2027' }).success, false)
  })

  it('rejects years outside the supported historical range', () => {
    assert.equal(olympiadFiltersSchema.safeParse({ calendarYear: '2019' }).success, false)
    assert.equal(olympiadFiltersSchema.safeParse({ calendarYear: '2201' }).success, false)
  })

  it('does not allow academic and calendar years at the same time', () => {
    const query = {
      academicYear: '2025-2026',
      calendarYear: '2026'
    }

    assert.equal(olympiadFiltersSchema.safeParse(query).success, false)
    assert.equal(olympiadDetailsQuerySchema.safeParse(query).success, false)
  })

  it('validates the year passed to an olympiad details route', () => {
    assert.equal(olympiadDetailsQuerySchema.safeParse({ calendarYear: '2026' }).success, true)
    assert.equal(olympiadDetailsQuerySchema.safeParse({ academicYear: '2025-2026' }).success, true)
    assert.equal(olympiadDetailsQuerySchema.safeParse({ academicYear: 'bad-year' }).success, false)
  })
})
