export const ENGINEERING_HELP_CHANNEL_ID = 'C03BN4GQALA'
export const ENGINEERING_GROUP_ID = 'S03EY0EMJQN'
export const ENGINEERING_ON_CALL_GROUP_ID = 'S063WMNMSCD'
export const INCIDENTS_BUGS_CHANNEL_ID = 'C03AE1RQM88'
export const CUSTOMER_ON_CALL_GROUP_ID = 'S08J78SSR2Q'
export const QA_GROUP_ID = 'C063WQ5Q50K'
export const TEST_SLACK_CHANNEL_ID = 'C08GFV27YR0'

export const splitSlackMessage = (
  message: string,
  textLengthLimit = 3000
): string[] => {
  const lines = message.split('\n')
  const chunks: string[] = []
  let currentChunk = ''
  for (const line of lines) {
    if (currentChunk.length + line.length > textLengthLimit) {
      chunks.push(currentChunk)
      currentChunk = ''
    }
    currentChunk += `${line}\n`
  }

  if (currentChunk) {
    chunks.push(currentChunk)
  }

  return chunks
}
