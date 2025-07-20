const BASE_URL = 'https://api.acuris.com/compliance-datafeed'

export const getSourceUrl = (
  entityTypeKey: 'businesses' | 'individuals',
  resourceId: string,
  evidenceId: string
) => {
  return `${BASE_URL}/${entityTypeKey}/${resourceId}/evidences/copyrighted/${evidenceId}`
}
