import {
  Engine,
  FieldsOf,
  Model,
  NumberField,
  NumberFieldTypes,
  StringField,
  TableDefinition,
} from 'thunder-schema'

type MigrationTrackerTableSchema = {
  id: string
  createdAt: number
  data: string
}

class MigrationTrackerTable extends Model<MigrationTrackerTableSchema> {
  static readonly TABLE_NAME = 'migration_tracker'

  static tableDefinition: TableDefinition<MigrationTrackerTableSchema> = {
    tableName: MigrationTrackerTable.TABLE_NAME,
    engine: Engine.REPLACING_MERGE_TREE,
    orderBy: ['createdAt', 'id'],
    primaryKey: ['createdAt', 'id'],
  }

  static fields: FieldsOf<MigrationTrackerTableSchema> = {
    id: new StringField({}),
    createdAt: new NumberField({ type: NumberFieldTypes.Int64 }),
    data: new StringField({}),
  }
}

MigrationTrackerTable.init()

export { MigrationTrackerTable }
