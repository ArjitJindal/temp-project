import { Model } from 'thunder-schema'
import { Narratives } from './narrative-template'
import { FlatFilesRecords } from './flat-files-records'

const models: (typeof Model<any, any>)[] = [Narratives, FlatFilesRecords]

export default models
