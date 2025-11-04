export type FlatFileRecord = {
  index: number
  record: Record<string, any>
  initialRecord: string
}

export type FlatFilesErrorStage =
  | 'PARSE'
  | 'VALIDATE'
  | 'PARSE_STORE'
  | 'RUNNER'
  | 'VALIDATE_STORE'
  | 'DUPLICATE'

export type FlatFilesStage = 'PARSE' | 'VALIDATE' | 'RUNNER' | 'DONE'

export type FlatFilesRecordsError = {
  instancePath?: string
  keyword: string
  message: string
  params?: string
  stage: FlatFilesErrorStage
}

export type FlatFilesRecordsSchema = {
  row: number
  initialRecord: string // JSON String of the Record
  parsedRecord: string // JSON String of the Record
  isError: boolean
  createdAt: number
  updatedAt: number
  error: FlatFilesRecordsError[]
  fileId: string
  isProcessed: boolean
  stage: FlatFilesStage
}

export type FlatFileValidationResult = {
  valid: boolean
  errors: FlatFilesRecordsError[]
  record: FlatFileRecord
}
