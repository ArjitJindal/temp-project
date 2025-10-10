import {
  Model,
  TableDefinition,
  Engine,
  StringField,
  StringFieldTypes,
  FieldsOf,
  NumberField,
  NumberFieldTypes,
} from 'thunder-schema'
import { NarrativeTemplate } from '@/@types/openapi-internal/NarrativeTemplate'

class Narratives extends Model<NarrativeTemplate> {
  static tableDefinition: TableDefinition<NarrativeTemplate> = {
    tableName: 'narrative_templates',
    engine: Engine.REPLACING_MERGE_TREE,
    orderBy: ['id', 'createdAt'],
  }

  static fields: FieldsOf<NarrativeTemplate> = {
    name: new StringField({
      type: StringFieldTypes.String,
    }),
    description: new StringField({
      type: StringFieldTypes.String,
    }),
    id: new StringField({
      type: StringFieldTypes.String,
    }),
    createdAt: new NumberField({
      type: NumberFieldTypes.Int64,
    }),
    updatedAt: new NumberField({
      type: NumberFieldTypes.Int64,
    }),
  }
}

Narratives.init()

export { Narratives }
