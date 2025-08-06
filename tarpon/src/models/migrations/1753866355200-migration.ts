export const diff = [
  {
    changes: {
      type: 'CREATE',
      schema: {
        tableName: 'batch_jobs',
        columns: [
          {
            name: 'jobId',
            type: 'String',
          },
          {
            name: 'type',
            type: 'String',
          },
          {
            name: 'tenantId',
            type: 'String',
          },
          {
            name: 'latestStatus',
            type: 'Tuple(status String, timestamp Int64, scheduledAt Int64)',
            default: '',
          },
          {
            name: 'statuses',
            type: 'Array(Tuple(status String, timestamp Int64, scheduledAt Int64))',
          },
          {
            name: 'metadata',
            type: 'Tuple(tasksCount Int64, completeTasksCount Int64)',
            default: '',
          },
          {
            name: 'parameters',
            type: 'Tuple(sampling Tuple(sample Tuple(type String, sampleDetails Tuple(userCount Int64, userRiskRange Tuple(startScore Int64, endScore Int64), userIds Array(String), listIds Array(String), transactionIds Array(String)))), ruleInstancesIds Array(String), userIds Array(String), clearedListIds String, s3Key String)',
            default: '',
          },
        ],
        engine: 'ReplacingMergeTree',
        orderBy: ['jobId'],
        primaryKey: ['jobId'],
      },
    },
  },
]

export const dependencies = ['1752225623208-migration.ts']
