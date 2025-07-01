import {
  Model,
  TableDefinition,
  Engine,
  StringField,
  FieldsOf,
  NumberField,
  NumberFieldTypes,
  TupleField,
  TupleFieldTypes,
  ArrayField,
  ArrayFieldTypes,
} from 'thunder-schema'
import { RiskClassificationHistory } from '@/@types/openapi-internal/RiskClassificationHistory'

class RiskClassificationHistoryTable extends Model<RiskClassificationHistory> {
  static tableDefinition: TableDefinition<RiskClassificationHistory> = {
    tableName: 'risk_classification_history',
    engine: Engine.REPLACING_MERGE_TREE,
    orderBy: ['createdAt', 'id'],
    primaryKey: ['createdAt', 'id'],
  }

  static fields: FieldsOf<RiskClassificationHistory> = {
    id: new StringField({}),
    createdAt: new NumberField({ type: NumberFieldTypes.Int64 }),
    scores: new ArrayField({
      type: ArrayFieldTypes.Array,
      elementType: new TupleField<{
        riskLevel: string
        lowerBoundRiskScore: number
        upperBoundRiskScore: number
      }>({
        type: TupleFieldTypes.Tuple,
        fields: {
          riskLevel: new StringField({}),
          lowerBoundRiskScore: new NumberField({
            type: NumberFieldTypes.Int64,
          }),
          upperBoundRiskScore: new NumberField({
            type: NumberFieldTypes.Int64,
          }),
        },
      }),
      defaultValue: [],
    }),
    comment: new StringField({}),
    updatedAt: new NumberField({ type: NumberFieldTypes.Int64 }),
    createdBy: new StringField({}),
  }
}

RiskClassificationHistoryTable.init()

export { RiskClassificationHistoryTable }
