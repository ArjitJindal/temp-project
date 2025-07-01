export const diff = [
  {
    changes: {
      type: 'CREATE',
      schema: {
        tableName: 'risk_classification_history',
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
            name: 'scores',
            type: 'Array(Tuple(riskLevel String, lowerBoundRiskScore Int64, upperBoundRiskScore Int64))',
            default: '[]',
          },
          {
            name: 'comment',
            type: 'String',
          },
          {
            name: 'updatedAt',
            type: 'Int64',
          },
          {
            name: 'createdBy',
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

export const dependencies = ['1747986678506-migration.ts']
