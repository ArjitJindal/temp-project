import { Model } from 'thunder-schema'
import { Narratives } from './narrative-template'
import { FlatFilesRecords } from './flat-files-records'
import { VersionHistoryTable } from './version-history'
import { BatchJobTable } from './batch-job'

const models: (typeof Model<any, any>)[] = [
  Narratives,
  FlatFilesRecords,
  VersionHistoryTable,
  BatchJobTable,
]

export default models
