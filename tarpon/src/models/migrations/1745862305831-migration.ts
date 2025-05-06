export const diff = [
  {
    changes: {
      type: 'CREATE',
      schema: {
        tableName: 'narrative_templates',
        columns: [
          {
            name: 'name',
            type: 'String',
          },
          {
            name: 'description',
            type: 'String',
          },
          {
            name: 'id',
            type: 'String',
          },
          {
            name: 'createdAt',
            type: 'Int64',
          },
          {
            name: 'updatedAt',
            type: 'Int64',
          },
        ],
        engine: 'ReplacingMergeTree',
        orderBy: ['id', 'createdAt'],
      },
    },
  },
]

export const dependencies = []
