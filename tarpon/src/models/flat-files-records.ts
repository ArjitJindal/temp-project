import {
  ArrayField,
  ArrayFieldTypes,
  BooleanField,
  BooleanFieldTypes,
  Engine,
  FieldsOf,
  Model,
  NumberField,
  NumberFieldTypes,
  StringField,
  StringFieldTypes,
  TableDefinition,
  TupleField,
} from 'thunder-schema'
import {
  FlatFilesRecordsError,
  FlatFilesRecordsSchema,
} from '@/@types/flat-files'

class FlatFilesRecords extends Model<FlatFilesRecordsSchema> {
  static tableDefinition: TableDefinition<FlatFilesRecordsSchema> = {
    tableName: 'flat_files_records',
    engine: Engine.REPLACING_MERGE_TREE,
    orderBy: ['fileId', 'row'],
    primaryKey: ['fileId', 'row'],
  }

  static fields: FieldsOf<FlatFilesRecordsSchema> = {
    row: new NumberField({
      type: NumberFieldTypes.Int64,
    }),
    initialRecord: new StringField({
      type: StringFieldTypes.String,
    }),
    parsedRecord: new StringField({
      type: StringFieldTypes.String,
    }),
    isError: new BooleanField({
      type: BooleanFieldTypes.Boolean,
    }),
    createdAt: new NumberField({
      type: NumberFieldTypes.Int64,
    }),
    updatedAt: new NumberField({
      type: NumberFieldTypes.Int64,
    }),
    error: new ArrayField({
      type: ArrayFieldTypes.Array,
      elementType: new TupleField<FlatFilesRecordsError>({
        fields: {
          instancePath: new StringField({
            type: StringFieldTypes.String,
          }),
          keyword: new StringField({
            type: StringFieldTypes.String,
          }),
          message: new StringField({
            type: StringFieldTypes.String,
          }),
          params: new StringField({
            type: StringFieldTypes.String,
          }),
          stage: new StringField({
            type: StringFieldTypes.Enum8,
            enumValues: {
              PARSE: 1,
              VALIDATE: 2,
              PARSE_STORE: 3,
              RUNNER: 4,
              VALIDATE_STORE: 5,
              DUPLICATE: 6,
            },
          }),
        },
      }),
    }),
    fileId: new StringField({
      type: StringFieldTypes.String,
    }),
    isProcessed: new BooleanField({
      type: BooleanFieldTypes.Boolean,
    }),
    stage: new StringField({
      type: StringFieldTypes.Enum8,
      enumValues: {
        PARSE: 1,
        VALIDATE: 2,
        RUNNER: 3,
      },
    }),
  }
}

FlatFilesRecords.init()

export { FlatFilesRecords }
