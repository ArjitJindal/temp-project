import { Model } from 'thunder-schema'
import { MigrationTrackerTable } from '@/models/migration-tracker'

const models: (typeof Model<any, any>)[] = [MigrationTrackerTable]

export default models
