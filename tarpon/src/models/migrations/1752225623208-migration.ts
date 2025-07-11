export const diff = [
  {
    changes: {
      type: 'CREATE',
      schema: {
        tableName: 'version_history',
        columns: [
          {
            name: 'createdAt',
            type: 'Int64',
          },
          {
            name: 'comment',
            type: 'String',
          },
          {
            name: 'createdBy',
            type: 'String',
          },
          {
            name: 'updatedAt',
            type: 'Int32',
          },
          {
            name: 'id',
            type: 'String',
          },
          {
            name: 'data',
            type: 'String',
          },
          {
            name: 'type',
            type: "Enum16('RiskClassification' = 0, 'RiskFactors' = 1)",
          },
        ],
        engine: 'ReplacingMergeTree',
        orderBy: ['type', 'id'],
        primaryKey: ['type', 'id'],
      },
    },
  },
]

export const dependencies = ['1751404694752-migration.ts']
