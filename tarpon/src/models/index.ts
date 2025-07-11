import { Model } from 'thunder-schema'
import { Narratives } from './narrative-template'
import { FlatFilesRecords } from './flat-files-records'
import { RiskClassificationHistoryTable } from './risk-classification-history'
import { VersionHistoryTable } from './version-history'

const models: (typeof Model<any, any>)[] = [
  Narratives,
  FlatFilesRecords,
  RiskClassificationHistoryTable,
  VersionHistoryTable,
]

export default models
