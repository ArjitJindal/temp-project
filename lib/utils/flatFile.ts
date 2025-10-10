export const getFlatFileErrorRecordS3Key = (s3Key: string) => {
  return s3Key + 'error' + '.csv'
}
