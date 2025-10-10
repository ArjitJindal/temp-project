import { JSONSchemaType } from 'ajv';
import { ColumnHelper } from '../Table/columnHelper';
import { STRING } from '../Table/standardDataTypes';
import { CrudEntitiesTable } from '.';
import { UseCase } from '@/pages/storybook/components';

type Entity = {
  id: string;
  foo?: string;
};

export default function (): JSX.Element {
  const tableHelper = new ColumnHelper<Entity>();
  const jsonSchema: JSONSchemaType<Entity> = {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        title: 'ID',
      },
      foo: {
        type: 'string',
        title: 'Foo',
        nullable: true,
      },
    },
    required: ['id'],
  };
  return (
    <>
      <UseCase title={'CRUD table'}>
        <CrudEntitiesTable<any, Entity>
          tableId="crud-entities-table"
          entityName="entity"
          entityIdField="id"
          apiOperations={{
            GET: async (_params) => ({
              total: 2,
              data: [
                { id: '1', foo: 'bar1' },
                { id: '2', foo: 'bar2' },
              ],
            }),
            CREATE: async (_entity) => ({ id: '3', foo: 'bar1' }),
            UPDATE: async (_entityId, _entity) => ({ id: '1', foo: 'bar1' }),
            DELETE: async (_entityId) => undefined,
          }}
          columns={[
            tableHelper.simple({
              title: 'ID',
              key: 'id',
              defaultWidth: 100,
              type: STRING,
            }),
            tableHelper.simple({
              title: 'Foo',
              key: 'foo',
              defaultWidth: 200,
              type: STRING,
            }),
          ]}
          formWidth="600px"
          formSteps={[
            {
              step: {
                key: '1',
                title: '',
                description: '',
              },
              jsonSchema,
            },
          ]}
        />
      </UseCase>
    </>
  );
}
