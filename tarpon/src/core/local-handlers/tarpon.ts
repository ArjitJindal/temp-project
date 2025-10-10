export const handleLocalTarponChangeCapture = async (
  tenantId: string,
  primaryKey: { PartitionKeyID: string; SortKeyID?: string }[]
) => {
  const { localTarponChangeCaptureHandler } = await import(
    '@/utils/local-dynamodb-change-handler'
  )
  for (const key of primaryKey) {
    await localTarponChangeCaptureHandler(tenantId, key, 'TARPON')
  }
}

export const handleLocalHammerheadChangeCapture = async (
  tenantId: string,
  primaryKey: { PartitionKeyID: string; SortKeyID?: string }
) => {
  const { localTarponChangeCaptureHandler } = await import(
    '@/utils/local-dynamodb-change-handler'
  )

  await localTarponChangeCaptureHandler(tenantId, primaryKey, 'HAMMERHEAD')
}
