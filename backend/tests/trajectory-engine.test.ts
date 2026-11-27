import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  allocateWeeklyMinutes,
  buildTrajectoryPlanDraft,
  type TrajectoryOlympiadInput,
  type TrajectoryProfileInput,
  type TrajectoryUniversityInput
} from '../src/modules/trajectory/trajectory.engine.js'

const UNIVERSITY_ID = '10000000-0000-4000-8000-000000000001'
const PROGRAM_ID = '50000000-0000-4000-8000-000000000001'
const ALTERNATIVE_UNIVERSITY_ID = '20000000-0000-4000-8000-000000000002'
const REQUEST_ID = '30000000-0000-4000-8000-000000000003'
const OLYMPIAD_ID = '40000000-0000-4000-8000-000000000004'

function validProfile(overrides: Partial<TrajectoryProfileInput> = {}): TrajectoryProfileInput {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    updatedAt: '2026-11-25T10:00:00.000Z',
    grade: 10,
    region: 'Москва',
    subjects: ['mathematics', 'informatics'],
    weeklyStudyHours: 8,
    targetAdmissionYear: 2028,
    targetEducationLevel: 'bachelor',
    targetUniversityId: UNIVERSITY_ID,
    targetProgramId: PROGRAM_ID,
    subjectPreparation: [
      { subjectId: 'mathematics', preparationLevel: 'beginner' },
      { subjectId: 'informatics', preparationLevel: 'advanced' }
    ],
    alternativeUniversityIds: [ALTERNATIVE_UNIVERSITY_ID],
    ...overrides
  }
}

function officialBenefit(overrides: Partial<NonNullable<TrajectoryOlympiadInput['benefits']>[number]> = {}) {
  return {
    id: '70000000-0000-4000-8000-000000000007',
    universityId: UNIVERSITY_ID,
    universityName: 'Основной университет',
    universityShortName: 'Основной вуз',
    programId: PROGRAM_ID,
    rightType: '100_points' as const,
    forStatus: 'winner' as const,
    levelRequired: 2,
    confirmExamSubject: 'informatics',
    confirmExamThreshold: 75,
    resultClassRequired: 10,
    validYear: 2028,
    sourceUrl: 'https://main.example.org/admission/benefits.pdf',
    lastCheckedAt: '2026-11-20T10:00:00.000Z',
    ...overrides
  }
}

function officialOlympiad(overrides: Partial<TrajectoryOlympiadInput> = {}): TrajectoryOlympiadInput {
  return {
    id: OLYMPIAD_ID,
    name: 'Олимпиада по информатике',
    organizer: 'Организатор',
    listType: 'school_olympiad',
    sourceStatus: 'official',
    sourceDocumentUrl: 'https://example.org/official-list.pdf',
    sourceCheckedAt: '2026-11-20T10:00:00.000Z',
    subjects: ['informatics'],
    grades: [9, 10, 11],
    website: 'https://olympiad.example.org/',
    status: 'upcoming',
    season: {
      academicYear: '2026-2027',
      stages: [{
        id: '60000000-0000-4000-8000-000000000006',
        type: 'registration',
        startDate: '2026-12-01',
        endDate: '2026-12-20',
        format: 'online'
      }]
    },
    ...overrides
  }
}

const universities: TrajectoryUniversityInput[] = [
  {
    id: UNIVERSITY_ID,
    name: 'Основной университет',
    website: 'https://main.example.org/',
    minobrnauki_admission_url: 'https://main.example.org/admission'
  },
  {
    id: ALTERNATIVE_UNIVERSITY_ID,
    name: 'Альтернативный университет',
    website: 'https://alternative.example.org/'
  }
]

const NOW = new Date('2026-11-26T08:00:00.000Z')

test('генератор персональной траектории', async (t) => {
  await t.test('отклоняет профиль без отметки времени последнего сохранения', () => {
    assert.throws(
      () => buildTrajectoryPlanDraft(validProfile({ updatedAt: '' }), [], universities, REQUEST_ID, NOW),
      /актуальность профиля/u
    )
  })

  await t.test('отклоняет профиль без обязательной недельной нагрузки', () => {
    assert.throws(
      () => buildTrajectoryPlanDraft(validProfile({ weeklyStudyHours: undefined }), [], universities, REQUEST_ID, NOW),
      /доступное время для занятий/u
    )
  })

  await t.test('отклоняет неизвестные или повторяющиеся предметы из повреждённого профиля', () => {
    assert.throws(
      () => buildTrajectoryPlanDraft(validProfile({ subjects: ['mathematics', 'unknown'] }), [], universities, REQUEST_ID, NOW),
      /неизвестные или повторяющиеся предметы/u
    )
    assert.throws(
      () => buildTrajectoryPlanDraft(validProfile({ subjects: ['mathematics', 'mathematics'] }), [], universities, REQUEST_ID, NOW),
      /неизвестные или повторяющиеся предметы/u
    )
  })

  await t.test('отклоняет уровни подготовки для невыбранных предметов', () => {
    assert.throws(
      () => buildTrajectoryPlanDraft(validProfile({
        subjectPreparation: [{ subjectId: 'physics', preparationLevel: 'advanced' }]
      }), [], universities, REQUEST_ID, NOW),
      /не соответствуют выбранным предметам/u
    )
  })

  await t.test('отклоняет год поступления, который уже прошёл', () => {
    assert.throws(
      () => buildTrajectoryPlanDraft(validProfile({ targetAdmissionYear: 2026 }), [], universities, REQUEST_ID, NOW),
      /Выбери 2027 год или позднее/u
    )
  })

  await t.test('не позволяет выбрать программу без основного университета', () => {
    assert.throws(
      () => buildTrajectoryPlanDraft(validProfile({ targetUniversityId: undefined, targetProgramId: PROGRAM_ID }), [], universities, REQUEST_ID, NOW),
      /необходимо указать основной университет/u
    )
  })

  await t.test('не предлагает магистратуру школьнику как прямое поступление', () => {
    assert.throws(
      () => buildTrajectoryPlanDraft(validProfile({ targetEducationLevel: 'master' }), [], universities, REQUEST_ID, NOW),
      /Магистратура является следующим этапом/u
    )
  })
  await t.test('принимает базовое высшее образование для школьной траектории', () => {
    const plan = buildTrajectoryPlanDraft(
      validProfile({ targetEducationLevel: 'basic_higher' }),
      [],
      universities,
      REQUEST_ID,
      NOW
    )

    assert.equal(plan.profileSnapshot.targetEducationLevel, 'basic_higher')
    assert.match(plan.summary, /Базовое высшее образование/u)
  })

  await t.test('распределяет ровно заданную недельную нагрузку', () => {
    const allocations = allocateWeeklyMinutes(
      ['mathematics', 'informatics', 'physics', 'russian'],
      7,
      [
        { subjectId: 'mathematics', preparationLevel: 'beginner' },
        { subjectId: 'informatics', preparationLevel: 'advanced' }
      ]
    )

    assert.equal(Object.values(allocations).reduce((sum, value) => sum + value, 0), 420)
    assert.ok(Object.values(allocations).every((value) => value >= 5))
    assert.ok(allocations.mathematics > allocations.informatics)

    const tenEqualSubjects = allocateWeeklyMinutes(
      Array.from({ length: 10 }, (_, index) => `subject-${index + 1}`),
      1,
      []
    )
    assert.deepEqual(Object.values(tenEqualSubjects), Array(10).fill(6))

    const levels = ['beginner', 'medium', 'advanced'] as const
    for (let hours = 1; hours <= 40; hours += 1) {
      for (let count = 1; count <= 10; count += 1) {
        const subjects = Array.from({ length: count }, (_, index) => `subject-${index + 1}`)
        const preparation = subjects.flatMap((subjectId, index) => index % 4 === 3
          ? []
          : [{ subjectId, preparationLevel: levels[index % levels.length] }])
        const allocation = allocateWeeklyMinutes(subjects, hours, preparation)
        assert.equal(Object.values(allocation).reduce((sum, value) => sum + value, 0), hours * 60)
        assert.ok(Object.values(allocation).every((value) => value >= 5))
      }
    }

    const subjectTask = buildTrajectoryPlanDraft(validProfile(), [], universities, REQUEST_ID, NOW)
      .stages.find((stage) => stage.stableKey === 'subject-preparation')?.tasks[0]
    assert.equal(subjectTask?.estimatedMinutes, Math.min(45, subjectTask?.weeklyMinutes ?? 0))
    assert.ok((subjectTask?.estimatedMinutes ?? 0) <= 480)

    const maximumLoadDraft = buildTrajectoryPlanDraft(
      validProfile({ subjects: ['mathematics'], subjectPreparation: [{ subjectId: 'mathematics', preparationLevel: 'beginner' }], weeklyStudyHours: 40 }),
      [],
      universities,
      REQUEST_ID,
      NOW
    )
    const maximumLoadTask = maximumLoadDraft.stages.find((stage) => stage.stableKey === 'subject-preparation')?.tasks[0]
    assert.equal(maximumLoadTask?.weeklyMinutes, 2_400)
    assert.equal(maximumLoadTask?.estimatedMinutes, 45)
  })

  await t.test('включает только официальную школьную олимпиаду с подходящими классом, предметом и датами', () => {
    const draft = buildTrajectoryPlanDraft(
      validProfile(),
      [
        officialOlympiad(),
        officialOlympiad({ id: '40000000-0000-4000-8000-000000000005', sourceStatus: 'needs_review', name: 'Непроверенная олимпиада' }),
        officialOlympiad({ id: '40000000-0000-4000-8000-000000000007', listType: 'intellectual_competition', name: 'Конкурс' }),
        officialOlympiad({ id: '40000000-0000-4000-8000-000000000008', grades: [7, 8], name: 'Для другого класса' }),
        officialOlympiad({ id: '40000000-0000-4000-8000-000000000009', subjects: ['biology'], name: 'По биологии' }),
        officialOlympiad({ id: '40000000-0000-4000-8000-000000000010', season: { academicYear: '2026-2027', stages: [{ id: 'x', type: 'final', startDate: '2026-12-01', endDate: '2026-12-20', format: 'online' }] }, name: 'Без регистрации' }),
        officialOlympiad({ id: '40000000-0000-4000-8000-000000000011', season: { academicYear: '2026-2027', stages: [{ id: 'y', type: 'registration', startDate: '2026-12-20', endDate: '2026-12-01', format: 'online' }] }, name: 'Ошибочные даты' }),
        officialOlympiad({ id: '40000000-0000-4000-8000-000000000012', season: { academicYear: '2026-2027', stages: [{ id: 'z', type: 'registration', startDate: '2026-10-01', endDate: '2026-10-10', format: 'online' }] }, name: 'Регистрация завершена', status: 'closed' })
      ],
      universities,
      REQUEST_ID,
      NOW
    )

    const olympiadStage = draft.stages.find((stage) => stage.stableKey === 'olympiads')
    assert.ok(olympiadStage)
    const registrationTasks = olympiadStage.tasks.filter((item) => item.taskType === 'olympiad')
    assert.equal(registrationTasks.length, 1)
    assert.equal(registrationTasks[0]?.relatedOlympiadId, OLYMPIAD_ID)
    assert.equal(registrationTasks[0]?.startDate, '2026-12-01')
    assert.equal(registrationTasks[0]?.dueDate, '2026-12-20')
    assert.equal(registrationTasks[0]?.sourceUrl, 'https://olympiad.example.org/')
  })

  await t.test('включает только подтверждённые льготы выбранной программы и года, не обещая право автоматически', () => {
    const draft = buildTrajectoryPlanDraft(
      validProfile(),
      [officialOlympiad({ benefits: [
        officialBenefit(),
        officialBenefit({ id: '70000000-0000-4000-8000-000000000008', programId: '50000000-0000-4000-8000-000000000098' }),
        officialBenefit({ id: '70000000-0000-4000-8000-000000000009', universityId: ALTERNATIVE_UNIVERSITY_ID, programId: undefined }),
        officialBenefit({ id: '70000000-0000-4000-8000-000000000010', validYear: 2027 }),
        officialBenefit({ id: '70000000-0000-4000-8000-000000000011', sourceUrl: 'http://main.example.org/benefits.pdf' })
      ] })],
      universities,
      REQUEST_ID,
      NOW
    )
    const olympiadStage = draft.stages.find((stage) => stage.stableKey === 'olympiads')
    const benefitTasks = olympiadStage?.tasks.filter((item) => item.stableKey.startsWith('olympiad-benefit:70000000-0000-4000-8000-000000000007:')) ?? []

    assert.equal(benefitTasks.length, 1)
    assert.equal(benefitTasks[0]?.relatedProgramId, PROGRAM_ID)
    assert.equal(benefitTasks[0]?.sourceUrl, 'https://main.example.org/admission/benefits.pdf')
    assert.match(benefitTasks[0]?.description ?? '', /не подтверждает право именно в твоём случае/u)
  })

  await t.test('не выводит, что льгот нет, если для выбранного вуза нет подтверждённых записей', () => {
    const draft = buildTrajectoryPlanDraft(validProfile(), [officialOlympiad()], universities, REQUEST_ID, NOW)
    const olympiadStage = draft.stages.find((stage) => stage.stableKey === 'olympiads')
    const checkTask = olympiadStage?.tasks.find((item) => item.stableKey.startsWith('olympiad-benefit:check-selected-universities:'))

    assert.ok(checkTask)
    assert.match(checkTask.description ?? '', /Это не означает, что льгот нет/u)
  })

  await t.test('не включает олимпиаду с устаревшей проверкой официального источника старше 90 дней', () => {
    const draft = buildTrajectoryPlanDraft(
      validProfile(),
      [officialOlympiad({ sourceCheckedAt: '2026-07-01T10:00:00.000Z' })],
      universities,
      REQUEST_ID,
      NOW
    )
    const olympiadStage = draft.stages.find((stage) => stage.stableKey === 'olympiads')
    assert.equal(olympiadStage?.tasks.some((item) => item.taskType === 'olympiad'), false)
  })

  await t.test('не принимает дату проверки олимпиады из будущего с большим расхождением часов', () => {
    const draft = buildTrajectoryPlanDraft(
      validProfile(),
      [officialOlympiad({ sourceCheckedAt: '2026-11-27T08:00:00.000Z' })],
      universities,
      REQUEST_ID,
      NOW
    )
    const olympiadStage = draft.stages.find((stage) => stage.stableKey === 'olympiads')
    assert.equal(olympiadStage?.tasks.some((item) => item.taskType === 'olympiad'), false)
  })

  await t.test('не включает льготу с проверкой источника старше 180 дней', () => {
    const draft = buildTrajectoryPlanDraft(
      validProfile(),
      [officialOlympiad({ benefits: [officialBenefit({ lastCheckedAt: '2025-11-20T10:00:00.000Z' })] })],
      universities,
      REQUEST_ID,
      NOW
    )
    const olympiadStage = draft.stages.find((stage) => stage.stableKey === 'olympiads')
    assert.equal(olympiadStage?.tasks.some((item) => item.stableKey === `olympiad-benefit:${'70000000-0000-4000-8000-000000000007'}:2028`), false)
  })

  await t.test('не включает олимпиаду без даты проверки официального источника', () => {
    const draft = buildTrajectoryPlanDraft(
      validProfile(),
      [officialOlympiad({ sourceCheckedAt: undefined })],
      universities,
      REQUEST_ID,
      NOW
    )
    const olympiadStage = draft.stages.find((stage) => stage.stableKey === 'olympiads')
    assert.equal(olympiadStage?.tasks.some((item) => item.taskType === 'olympiad'), false)
  })

  await t.test('не включает данные из другого учебного года', () => {
    const draft = buildTrajectoryPlanDraft(
      validProfile(),
      [officialOlympiad({ season: { academicYear: '2025-2026', stages: [{
        id: '60000000-0000-4000-8000-000000000006',
        type: 'registration',
        startDate: '2026-12-01',
        endDate: '2026-12-20',
        format: 'online'
      }] } })],
      universities,
      REQUEST_ID,
      NOW
    )
    const olympiadStage = draft.stages.find((stage) => stage.stableKey === 'olympiads')
    assert.equal(olympiadStage?.tasks.some((item) => item.taskType === 'olympiad'), false)
  })

  await t.test('не назначает срок, если в текущем сезоне нет подтверждённого подходящего события', () => {
    const draft = buildTrajectoryPlanDraft(
      validProfile(),
      [officialOlympiad({ sourceStatus: 'needs_review' })],
      universities,
      REQUEST_ID,
      NOW
    )
    const olympiadStage = draft.stages.find((stage) => stage.stableKey === 'olympiads')

    const fallbackTask = olympiadStage?.tasks.find((item) => item.stableKey === 'olympiads:check-official-calendar:2026-2027')
    assert.ok(fallbackTask)
    assert.equal(fallbackTask.dueDate, undefined)
    assert.match(fallbackTask.description ?? '', /нет мероприятий/u)
  })

  await t.test('уважает региональные ограничения этапа', () => {
    const draft = buildTrajectoryPlanDraft(
      validProfile(),
      [officialOlympiad({ season: { academicYear: '2026-2027', stages: [{
        id: '60000000-0000-4000-8000-000000000006',
        type: 'registration',
        startDate: '2026-12-01',
        endDate: '2026-12-20',
        format: 'online',
        regionScope: ['Санкт-Петербург']
      }] } })],
      universities,
      REQUEST_ID,
      NOW
    )
    const olympiadStage = draft.stages.find((stage) => stage.stableKey === 'olympiads')

    assert.equal(olympiadStage?.tasks.some((item) => item.taskType === 'olympiad'), false)
  })

  await t.test('меняет stable key задач, когда меняется целевая программа или недельная нагрузка', () => {
    const base = buildTrajectoryPlanDraft(validProfile(), [], universities, REQUEST_ID, NOW)
    const changedProgram = buildTrajectoryPlanDraft(
      validProfile({ targetProgramId: '50000000-0000-4000-8000-000000000099' }),
      [], universities, REQUEST_ID, NOW
    )
    const changedHours = buildTrajectoryPlanDraft(
      validProfile({ weeklyStudyHours: 9 }), [], universities, REQUEST_ID, NOW
    )

    const findTaskKey = (draft: ReturnType<typeof buildTrajectoryPlanDraft>, prefix: string) =>
      draft.stages.flatMap((stage) => stage.tasks).find((item) => item.stableKey.startsWith(prefix))?.stableKey

    assert.notEqual(findTaskKey(base, 'admission:university:'), findTaskKey(changedProgram, 'admission:university:'))
    assert.notEqual(findTaskKey(base, 'subject:mathematics:weekly-focus:'), findTaskKey(changedHours, 'subject:mathematics:weekly-focus:'))
    assert.notEqual(findTaskKey(base, 'goal:review-profile:'), findTaskKey(changedProgram, 'goal:review-profile:'))
  })


  await t.test('отклоняет слишком большой этап до попытки сохранения в БД', () => {
    const benefits = Array.from({ length: 101 }, (_, index) => officialBenefit({
      id: `70000000-0000-4000-8000-${String(index + 100).padStart(12, '0')}`
    }))
    assert.throws(
      () => buildTrajectoryPlanDraft(validProfile(), [officialOlympiad({ benefits })], universities, REQUEST_ID, NOW),
      /слишком много задач/u
    )
  })

  await t.test('сохраняет устойчивые ключи этапов и задач и снимок настроек профиля', () => {
    const draft = buildTrajectoryPlanDraft(validProfile(), [officialOlympiad()], universities, REQUEST_ID, NOW)
    const stageKeys = draft.stages.map((stage) => stage.stableKey)
    const taskKeys = draft.stages.flatMap((stage) => stage.tasks.map((item) => item.stableKey))

    assert.equal(new Set(stageKeys).size, stageKeys.length)
    assert.equal(new Set(taskKeys).size, taskKeys.length)
    assert.equal(draft.profileSnapshot.grade, 10)
    assert.equal(draft.profileUpdatedAt, '2026-11-25T10:00:00.000Z')
    assert.equal(draft.profileSnapshot.weeklyStudyHours, 8)
    assert.equal(draft.profileSnapshot.targetAdmissionYear, 2028)
    assert.equal(draft.academicYear, '2026-2027')
  })

  await t.test('не переносит незащищённые HTTP-ссылки в план', () => {
    const draft = buildTrajectoryPlanDraft(
      validProfile(),
      [officialOlympiad({ website: 'http://example.org/', sourceDocumentUrl: undefined })],
      [{ id: UNIVERSITY_ID, name: 'Основной университет', website: 'http://main.example.org/' }],
      REQUEST_ID,
      NOW
    )
    const olympiadTask = draft.stages.find((stage) => stage.stableKey === 'olympiads')?.tasks[0]
    const admissionTask = draft.stages.find((stage) => stage.stableKey === 'admission')?.tasks[0]

    assert.equal(olympiadTask?.sourceUrl, undefined)
    assert.equal(admissionTask?.sourceUrl, undefined)
  })

  await t.test('ограничивает длину текста из справочника лимитами таблиц', () => {
    const longName = 'Олимпиада '.repeat(80)
    const draft = buildTrajectoryPlanDraft(
      validProfile(),
      [officialOlympiad({ name: longName })],
      universities,
      REQUEST_ID,
      NOW
    )
    const tasks = draft.stages.flatMap((stage) => stage.tasks)
    const longTitleTask = tasks.find((item) => item.title.startsWith('Проверить регистрацию:'))
    assert.ok(longTitleTask)
    assert.ok(Array.from(longTitleTask.title).length <= 240)
    assert.ok(Array.from(longTitleTask.description ?? '').length <= 2_400)
  })

  await t.test('отбрасывает некорректные HTTPS-адреса без имени хоста', () => {
    const draft = buildTrajectoryPlanDraft(
      validProfile(),
      [officialOlympiad({ website: 'https://', sourceDocumentUrl: undefined })],
      [{ id: UNIVERSITY_ID, name: 'Основной университет', website: 'https://' }],
      REQUEST_ID,
      NOW
    )
    const tasks = draft.stages.flatMap((stage) => stage.tasks)
    assert.ok(tasks.every((item) => item.sourceUrl === undefined))
  })

  await t.test('выбирает первую доступную HTTPS-ссылку вуза, а не останавливается на HTTP', () => {
    const draft = buildTrajectoryPlanDraft(
      validProfile(),
      [],
      [{
        id: UNIVERSITY_ID,
        name: 'Основной университет',
        minobrnauki_admission_url: 'http://main.example.org/admission',
        minobrnauki_rules_url: 'https://main.example.org/rules',
        website: 'https://main.example.org/'
      }],
      REQUEST_ID,
      NOW
    )
    const admissionTask = draft.stages.find((stage) => stage.stableKey === 'admission')?.tasks[0]
    assert.equal(admissionTask?.sourceUrl, 'https://main.example.org/rules')
  })
})
