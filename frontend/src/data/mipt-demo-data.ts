import type { UniversityBenefit, UniversityProgram } from '@trajectory/shared'
import type { AdmissionCampaign, AdmissionProgramsResponse, AdmissionExam, AdmissionAchievement, AdmissionOption } from '@/services/admissions.service'

export const MIPT_UNIVERSITY_ID = '55d657a4-a6d5-46c1-8ca6-93adf3f4da80'
export const SIBERIAN_OLYMPIAD_ID = '8035eaca-dcef-4d7a-8a7f-0ce74040429f'
export const MIPT_DEMO_CAMPAIGN_ID = 'demo-mipt-admission-2027'

export function getMiptDemoProgramRows(universityId: string): UniversityProgram[] {
  if (universityId !== MIPT_UNIVERSITY_ID) return []
  return [
    { id: 'demo-mipt-software', universityId, name: 'Программная инженерия · демо-пример', direction: '09.03.01', catalogStatus: 'needs_review' },
    { id: 'demo-mipt-applied-math', universityId, name: 'Прикладная математика и информатика · демо-пример', direction: '01.03.02', catalogStatus: 'needs_review' },
    { id: 'demo-mipt-physics', universityId, name: 'Прикладная физика · демо-пример', direction: '03.03.01', catalogStatus: 'needs_review' }
  ]
}

export function getMiptDemoBenefits(universityId: string): UniversityBenefit[] {
  if (universityId !== MIPT_UNIVERSITY_ID) return []
  const common = {
    universityId,
    universityName: 'Московский физико-технический институт',
    universityShortName: 'МФТИ',
    olympiadId: SIBERIAN_OLYMPIAD_ID,
    olympiadName: 'Всесибирская открытая олимпиада школьников · демо-связка',
    olympiadOrganizer: 'Учебный пример, не подтверждённое условие',
    validYear: 2027,
    sourceUrl: '',
    verificationStatus: 'draft' as const
  }
  return [
    {
      ...common,
      id: 'demo-mipt-benefit-bvi',
      programId: 'demo-mipt-software',
      programName: 'Программная инженерия · демо-пример',
      programDirection: '09.03.01',
      rightType: 'BVI',
      forStatus: 'winner',
      levelRequired: 1,
      resultClassRequired: 11,
      confirmExamSubject: 'Информатика',
      confirmExamThreshold: 75
    },
    {
      ...common,
      id: 'demo-mipt-benefit-100',
      programId: 'demo-mipt-applied-math',
      programName: 'Прикладная математика и информатика · демо-пример',
      programDirection: '01.03.02',
      rightType: '100_points',
      forStatus: 'prize',
      levelRequired: 2,
      resultClassRequired: 11,
      confirmExamSubject: 'Математика',
      confirmExamThreshold: 75
    },
    {
      ...common,
      id: 'demo-mipt-benefit-extra',
      programId: 'demo-mipt-physics',
      programName: 'Прикладная физика · демо-пример',
      programDirection: '03.03.01',
      rightType: 'extra_points',
      forStatus: 'both',
      levelRequired: 3,
      resultClassRequired: 11,
      pointsAwarded: 5
    }
  ]
}

export const MIPT_DEMO_CAMPAIGN: AdmissionCampaign = {
  id: MIPT_DEMO_CAMPAIGN_ID,
  universityId: MIPT_UNIVERSITY_ID,
  admissionYear: 2027,
  status: 'collecting',
  sourceStatus: 'needs_review'
}

const DEMO_EXAMS: AdmissionExam[] = [
  { id: 'demo-mipt-exam-math', slotNumber: 1, subjectName: 'Математика', examType: 'ege', minimumScore: 85, maximumScore: 100, evidenceUrl: null, evidenceCheckedAt: null },
  { id: 'demo-mipt-exam-physics', slotNumber: 2, subjectName: 'Физика', examType: 'ege', minimumScore: 80, maximumScore: 100, evidenceUrl: null, evidenceCheckedAt: null },
  { id: 'demo-mipt-exam-informatics', slotNumber: 2, subjectName: 'Информатика', examType: 'ege', minimumScore: 80, maximumScore: 100, evidenceUrl: null, evidenceCheckedAt: null },
  { id: 'demo-mipt-exam-russian', slotNumber: 3, subjectName: 'Русский язык', examType: 'ege', minimumScore: 70, maximumScore: 100, evidenceUrl: null, evidenceCheckedAt: null }
]

const DEMO_ACHIEVEMENTS: AdmissionAchievement[] = [
  { id: 'demo-mipt-achievement-medal', code: 'school_medal', title: 'Аттестат с отличием', pointsAwarded: 5, pointsCap: 5, sourceUrl: '', description: 'Пример отображения индивидуального достижения.' },
  { id: 'demo-mipt-achievement-project', code: 'project', title: 'Научный или инженерный проект', pointsAwarded: 3, pointsCap: 3, sourceUrl: '', description: 'Условный пример; реальные критерии задаёт вуз.' },
  { id: 'demo-mipt-achievement-contest', code: 'contest', title: 'Профильный конкурс', pointsAwarded: 2, pointsCap: 10, sourceUrl: '', description: 'Условный пример начисления баллов.' }
]

function makeOption(
  id: string,
  programCode: string,
  admissionBasis: 'budget' | 'paid',
  budgetPlaces: number | null,
  paidPlaces: number | null,
  tuitionRubPerYear: number | null
): AdmissionOption {
  return {
    id,
    programCode,
    competitionGroup: 'Общий конкурс · демо',
    campusName: 'Москва · демонстрационный сценарий',
    educationLevel: 'bachelor',
    admissionBasis,
    studyForm: 'full_time',
    studyDurationYears: 4,
    budgetPlaces,
    paidPlaces,
    tuitionRubPerYear,
    instructionLanguage: 'Русский',
    officialProgramUrl: null,
    sourceUrl: '',
    sourceTitle: 'Демонстрационные сведения Trajectory',
    sourceCheckedAt: null,
    verificationStatus: 'needs_review',
    exams: DEMO_EXAMS.map((exam) => ({ ...exam, id: `${id}-${exam.id}` })),
    achievements: DEMO_ACHIEVEMENTS.map((item) => ({ ...item, id: `${id}-${item.id}` }))
  }
}

export const MIPT_DEMO_ADMISSION_PROGRAMS: AdmissionProgramsResponse = {
  campaign: {
    id: MIPT_DEMO_CAMPAIGN_ID,
    universityId: MIPT_UNIVERSITY_ID,
    admissionYear: 2027,
    status: 'collecting'
  },
  programs: [
    {
      id: 'demo-mipt-software',
      name: 'Программная инженерия · демо-пример',
      direction: '09.03.01',
      description: 'Учебный пример карточки программы. Все числовые показатели и условия вымышлены.',
      admissionOptions: [
        makeOption('demo-mipt-software-budget', '09.03.01', 'budget', 52, null, null),
        makeOption('demo-mipt-software-paid', '09.03.01', 'paid', null, 18, 590000)
      ]
    },
    {
      id: 'demo-mipt-applied-math',
      name: 'Прикладная математика и информатика · демо-пример',
      direction: '01.03.02',
      description: 'Учебный пример карточки программы. Не является опубликованным предложением МФТИ.',
      admissionOptions: [
        makeOption('demo-mipt-applied-math-budget', '01.03.02', 'budget', 44, null, null),
        makeOption('demo-mipt-applied-math-paid', '01.03.02', 'paid', null, 12, 610000)
      ]
    },
    {
      id: 'demo-mipt-physics',
      name: 'Прикладная физика · демо-пример',
      direction: '03.03.01',
      description: 'Учебный пример карточки программы. Не является опубликованным предложением МФТИ.',
      admissionOptions: [
        makeOption('demo-mipt-physics-budget', '03.03.01', 'budget', 35, null, null),
        makeOption('demo-mipt-physics-paid', '03.03.01', 'paid', null, 10, 620000)
      ]
    }
  ]
}