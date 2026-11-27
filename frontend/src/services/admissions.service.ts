import { api } from '@/services/api'

export interface AdmissionCampaign {
  id: string
  universityId: string
  admissionYear: number
  status: string
  sourceStatus: string
  admissionPageUrl?: string
  rulesUrl?: string
  rulesTitle?: string
  examListUrl?: string
  placesUrl?: string
  tuitionUrl?: string
  rulesPublishedAt?: string
  sourceCheckedAt?: string
}

export interface AdmissionExam {
  id: string
  slotNumber: number
  subjectName: string
  examType: string
  minimumScore: number | null
  maximumScore: number
  evidenceUrl: string | null
  evidenceCheckedAt: string | null
}

export interface AdmissionAchievement {
  id: string
  code: string
  title: string
  description?: string
  pointsAwarded: number
  pointsCap: number | null
  sourceUrl: string
  sourceTitle?: string
  sourceCheckedAt?: string
}

export interface AdmissionOption {
  id: string
  programCode: string | null
  competitionGroup: string | null
  campusName: string | null
  educationLevel: string
  admissionBasis: string
  studyForm: string
  studyDurationYears: number | null
  budgetPlaces: number | null
  paidPlaces: number | null
  tuitionRubPerYear: number | null
  instructionLanguage: string | null
  officialProgramUrl: string | null
  sourceUrl: string
  sourceTitle: string | null
  sourceCheckedAt: string | null
  verificationStatus: string
  exams: AdmissionExam[]
  achievements: AdmissionAchievement[]
}

export interface AdmissionProgram {
  id: string
  name: string
  direction?: string
  description?: string
  officialUrl?: string
  sourceUrl?: string
  sourceTitle?: string
  sourceCheckedAt?: string
  admissionOptions: AdmissionOption[]
}

export interface AdmissionProgramsResponse {
  campaign: {
    id: string
    universityId: string
    admissionYear: number
    status: string
  }
  programs: AdmissionProgram[]
}

export const admissionsService = {
  getCampaigns(universityId: string): Promise<AdmissionCampaign[]> {
    return api.get(
      `/api/admissions/universities/${encodeURIComponent(universityId)}/campaigns`
    )
  },

  getPrograms(
    universityId: string,
    campaignId: string
  ): Promise<AdmissionProgramsResponse> {
    return api.get(
      `/api/admissions/universities/${encodeURIComponent(universityId)}/campaigns/${encodeURIComponent(campaignId)}/programs`
    )
  }
}