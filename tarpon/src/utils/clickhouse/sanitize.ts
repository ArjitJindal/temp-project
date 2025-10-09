export const sanitizeSqlName = (tableName: string) =>
  tableName.replace(/[^0-9a-zA-Z]/g, '_')
