export const getFlatFileErrorRecordS3Key = (s3Key: string) => {
  return s3Key + 'error' // check if i can push file format to s3
}
