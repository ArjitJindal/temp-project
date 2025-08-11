export const diff = [
  {
    changes: {
      type: 'UPDATE',
      tableName: 'flat_files_records',
      update: [
        {
          name: 'error',
          type: "Array(Tuple(instancePath String, keyword String, message String, params String, stage Enum8('PARSE' = 1, 'VALIDATE' = 2, 'PARSE_STORE' = 3, 'RUNNER' = 4, 'VALIDATE_STORE' = 5, 'DUPLICATE' = 6)))",
        },
      ],
    },
  },
]

export const dependencies = ['1752225623208-migration.ts']
