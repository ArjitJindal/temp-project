import {
  Engine,
  FieldsOf,
  Model,
  NumberField,
  NumberFieldTypes,
  StringField,
  StringFieldTypes,
  TableDefinition,
} from 'thunder-schema'
import { VersionHistory } from '@/@types/openapi-internal/VersionHistory'

export interface VersionHistoryTableSchema
  extends Omit<VersionHistory, 'data'> {
  data: string
}

class VersionHistoryTable extends Model<VersionHistoryTableSchema> {
  static tableDefinition: TableDefinition<VersionHistoryTableSchema> = {
    tableName: 'version_history',
    engine: Engine.REPLACING_MERGE_TREE,
    orderBy: ['type', 'id'],
    primaryKey: ['type', 'id'],
  }

  static fields: FieldsOf<VersionHistoryTableSchema> = {
    createdAt: new NumberField({
      type: NumberFieldTypes.Int64,
    }),
    comment: new StringField({}),
    createdBy: new StringField({}),
    updatedAt: new NumberField({}),
    id: new StringField({}),
    data: new StringField({}),
    type: new StringField({
      type: StringFieldTypes.Enum16,
      enumValues: { RiskClassification: 0, RiskFactors: 1 },
    }),
  }
}

VersionHistoryTable.init()

export { VersionHistoryTable }
