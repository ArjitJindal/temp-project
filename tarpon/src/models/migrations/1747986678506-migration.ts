export const diff = [
  {
    changes: {
      type: 'UPDATE',
      tableName: 'flat_files_records',
      add: [
        {
          name: 'initialRecord',
          type: 'String',
        },
        {
          name: 'parsedRecord',
          type: 'String',
        },
        {
          name: 'stage',
          type: "Enum8('PARSE' = 1, 'VALIDATE' = 2, 'RUNNER' = 3)",
        },
      ],
      remove: ['record'],
      update: [
        {
          name: 'error',
          type: "Array(Tuple(instancePath String, keyword String, message String, params String, stage Enum8('PARSE' = 1, 'VALIDATE' = 2, 'PARSE_STORE' = 3, 'RUNNER' = 4, 'VALIDATE_STORE' = 5)))",
        },
      ],
    },
  },
]

export const dependencies = ['1747929216549-migration.ts']
