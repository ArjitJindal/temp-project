import {
  FieldsOf,
  Engine,
  Model,
  StringField,
  StringFieldTypes,
  TableDefinition,
  NumberField,
  NumberFieldTypes,
  TupleFieldTypes,
  TupleField,
  ArrayField,
  ArrayFieldTypes,
} from 'thunder-schema'
import { BatchJobInDb } from '@/@types/batch-job'

class BatchJobTable extends Model<BatchJobInDb> {
  static tableDefinition: TableDefinition<BatchJobInDb> = {
    tableName: 'batch_jobs',
    engine: Engine.REPLACING_MERGE_TREE,
    orderBy: ['jobId'],
    primaryKey: ['jobId'],
  }
  static fields: FieldsOf<BatchJobInDb> = {
    jobId: new StringField({
      type: StringFieldTypes.String,
    }),
    type: new StringField({
      type: StringFieldTypes.String,
    }),
    tenantId: new StringField({
      type: StringFieldTypes.String,
    }),
    latestStatus: new TupleField({
      type: TupleFieldTypes.Tuple,
      fields: {
        status: new StringField({
          type: StringFieldTypes.String,
        }),
        timestamp: new NumberField({
          type: NumberFieldTypes.Int64,
        }),
        scheduledAt: new NumberField({
          type: NumberFieldTypes.Int64,
        }),
      },
    }),
    statuses: new ArrayField({
      type: ArrayFieldTypes.Array,
      elementType: new TupleField({
        type: TupleFieldTypes.Tuple,
        fields: {
          status: new StringField({
            type: StringFieldTypes.String,
          }),
          timestamp: new NumberField({
            type: NumberFieldTypes.Int64,
          }),
          scheduledAt: new NumberField({
            type: NumberFieldTypes.Int64,
          }),
        },
      }),
    }),
    metadata: new TupleField({
      type: TupleFieldTypes.Tuple,
      fields: {
        tasksCount: new NumberField({
          type: NumberFieldTypes.Int64,
        }),
        completeTasksCount: new NumberField({
          type: NumberFieldTypes.Int64,
        }),
      },
    }),
    parameters: new TupleField({
      type: TupleFieldTypes.Tuple,
      fields: {
        sampling: new TupleField({
          type: TupleFieldTypes.Tuple,
          fields: {
            sample: new TupleField({
              type: TupleFieldTypes.Tuple,
              fields: {
                type: new StringField({
                  type: StringFieldTypes.String,
                }),
                sampleDetails: new TupleField({
                  type: TupleFieldTypes.Tuple,
                  fields: {
                    userCount: new NumberField({
                      type: NumberFieldTypes.Int64,
                    }),
                    userRiskRange: new TupleField({
                      type: TupleFieldTypes.Tuple,
                      fields: {
                        startScore: new NumberField({
                          type: NumberFieldTypes.Int64,
                        }),
                        endScore: new NumberField({
                          type: NumberFieldTypes.Int64,
                        }),
                      },
                    }),
                    userIds: new ArrayField({
                      type: ArrayFieldTypes.Array,
                      elementType: new StringField({
                        type: StringFieldTypes.String,
                      }),
                    }),
                    listIds: new ArrayField({
                      type: ArrayFieldTypes.Array,
                      elementType: new StringField({
                        type: StringFieldTypes.String,
                      }),
                    }),
                    transactionIds: new ArrayField({
                      type: ArrayFieldTypes.Array,
                      elementType: new StringField({
                        type: StringFieldTypes.String,
                      }),
                    }),
                  },
                }),
              },
            }),
          },
        }),
        ruleInstancesIds: new ArrayField({
          type: ArrayFieldTypes.Array,
          elementType: new StringField({}),
        }),
        userIds: new ArrayField({
          type: ArrayFieldTypes.Array,
          elementType: new StringField({}),
        }),
        clearedListIds: new StringField({}),
        s3Key: new StringField({}),
      },
    }),
  }
}
BatchJobTable.init()

export { BatchJobTable }
