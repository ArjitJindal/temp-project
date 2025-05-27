export const diff = [
  {
    changes: {
      type: 'CREATE',
      schema: {
        tableName: 'flat_files_records',
        columns: [
          {
            name: 'row',
            type: 'Int64',
          },
          {
            name: 'record',
            type: 'String',
          },
          {
            name: 'isError',
            type: 'Boolean',
          },
          {
            name: 'createdAt',
            type: 'Int64',
          },
          {
            name: 'updatedAt',
            type: 'Int64',
          },
          {
            name: 'error',
            type: 'Array(Tuple(instancePath String, keyword String, message String, params String))',
          },
          {
            name: 'fileId',
            type: 'String',
          },
          {
            name: 'isProcessed',
            type: 'Boolean',
          },
        ],
        engine: 'ReplacingMergeTree',
        orderBy: ['fileId', 'row'],
        primaryKey: ['fileId', 'row'],
      },
    },
  },
]

export const dependencies = ['1745862305831-migration.ts']
