/** Asesmen Psikologi — API_CONTRACT §13.5 (rute siswa) & §13.6 (payload hasil). */

export type InstrumentCode = 'TMB' | 'RIA' | 'PMK' | 'ADN'

export type SessionState = 'upcoming' | 'open' | 'closed'

export type InstrumentStatus =
  | 'not_started'
  | 'in_progress'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'

export type AttemptStatus = 'in_progress' | 'queued' | 'processing' | 'completed' | 'failed'

export type QuestionType = 'likert' | 'multiple_choice' | 'boolean'

/** Nilai jawaban: skala (angka), kunci opsi (A–E), atau ya/tidak. */
export type AnswerValue = number | string | boolean

export type AnswerMap = Record<string, AnswerValue>

export interface SessionInstrument {
  code: InstrumentCode
  name: string
  estimated_minutes: number
  total_questions: number
  status: InstrumentStatus
  attempt_id?: string | null
  result_id?: string | null
}

/** GET /assessment/student/sessions → { data: StudentSession[] } */
export interface StudentSession {
  id: string
  title: string
  description?: string | null
  opens_at: string
  closes_at: string
  state: SessionState
  instruments: SessionInstrument[]
}

export interface AssessmentSection {
  key: string
  title: string
  instruction?: string | null
  scale_labels?: string[] | null
  time_limit_seconds?: number | null
  /** Hanya pada AttemptState: kapan bagian berwaktu dimulai. */
  started_at?: string | null
}

export interface ChoiceOption {
  key: string
  text: string
}

/** Contoh interaktif onboarding; bentuk butir tidak dirinci kontrak, jadi field dibuat longgar. */
export interface InteractiveExample {
  type?: string
  title?: string
  instruction?: string
  sample_question?: string
  question?: string
  text?: string
  options?: Array<string | ChoiceOption>
  scale_labels?: string[]
  correct_option?: string
  hint?: string
  explanation?: string
}

/** GET /assessment/student/sessions/:id/onboarding?instrument= */
export interface OnboardingData {
  session: Partial<
    Pick<StudentSession, 'id' | 'title' | 'description' | 'opens_at' | 'closes_at' | 'state'>
  >
  instrument: {
    code: InstrumentCode
    name: string
    description?: string | null
    estimated_minutes: number
    total_questions: number
    sections: AssessmentSection[]
  }
  terms_and_conditions: { title: string; points: string[]; disclaimer: string }
  consent: { required: boolean; accepted_at?: string | null }
  interactive_examples: InteractiveExample[]
}

export interface AttemptQuestion {
  id: string
  section: string
  text: string
  type: QuestionType
  scale_min?: number | null
  scale_max?: number | null
  scale_labels?: string[] | null
  options?: ChoiceOption[] | null
}

/** POST /sessions/:id/start → { data } ; GET /attempts/:id */
export interface AttemptState {
  attempt: {
    id: string
    session_id: string
    instrument_code: InstrumentCode
    status: AttemptStatus
    started_at: string
    seed?: number | string
  }
  sections: AssessmentSection[]
  questions: AttemptQuestion[]
  answers: AnswerMap | null
  server_time: string
}

/** PUT /attempts/:id/answers */
export interface SaveAnswersPayload {
  answers: AnswerMap
  rt_ms?: Record<string, number>
  section_started?: string
}

export interface SaveAnswersResponse {
  saved: number | boolean
  server_time: string
}

/** POST /attempts/:id/submit → 202 */
export interface SubmitResponse {
  attempt_id: string
  status: AttemptStatus
}

/** GET /attempts/:id/status */
export interface AttemptStatusResponse {
  attempt_id: string
  status: AttemptStatus
  result_id?: string | null
}

export interface InterpretationSection {
  title: string
  body: string
  items?: string[] | null
}

export interface CareerSuggestion {
  title: string
  code: string
  c_index: number
}

/** §13.6 StudentResult (FLAG_KESEJAHTERAAN & catatan staf sudah dibuang server). */
export interface StudentResult {
  id: string
  attempt_id: string
  session_id: string
  instrument_code: InstrumentCode
  holland_code?: string | null
  vark_category?: string | null
  recommended_track?: string | null
  scores: Record<string, unknown> | null
  indices: Record<string, unknown> | null
  recommendations: unknown
  validity_flags: string[] | null
  flags: string[] | null
  report_summary?: string | null
  interpretation: {
    summary?: string | null
    sections?: InterpretationSection[] | null
    careers?: CareerSuggestion[] | null
    study_tips?: string[] | null
  } | null
  disclaimer: string
  wellbeing_message?: string | null
  instrument_version?: string
  config_version?: string
  created_at: string
}

/** GET /assessment/student/results — riwayat; bentuk baris tidak dirinci, minimal field ini. */
export type ResultHistoryItem = Pick<
  StudentResult,
  'id' | 'attempt_id' | 'instrument_code' | 'created_at'
> &
  Partial<
    Pick<
      StudentResult,
      'session_id' | 'holland_code' | 'vark_category' | 'recommended_track' | 'report_summary'
    >
  > & {
    session_title?: string | null
  }
