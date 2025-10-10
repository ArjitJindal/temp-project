export const diff = [
  {
    changes: {
      type: 'CREATE',
      schema: {
        tableName: 'migration_tracker',
        columns: [
          {
            name: 'id',
            type: 'String',
          },
          {
            name: 'createdAt',
            type: 'Int64',
          },
          {
            name: 'data',
            type: 'String',
          },
        ],
        engine: 'ReplacingMergeTree',
        orderBy: ['createdAt', 'id'],
        primaryKey: ['createdAt', 'id'],
      },
    },
  },
]

export const dependencies = []
