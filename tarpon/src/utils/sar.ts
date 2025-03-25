import SftpClient from 'ssh2-sftp-client'
import { SFTP_CONNECTION_ERROR_PREFIX } from '@lib/constants'
import { getSecretByName } from './secrets-manager'
import { logger } from '@/core/logger'

export async function connectToSFTP() {
  const creds = await getSecretByName('fincenCreds')
  const sftp = new SftpClient()
  try {
    await sftp.connect({
      host: process.env.FINCEN_SFTP_IP,
      port: process.env.FINCEN_SFTP_PORT,
      username: creds.username,
      password: creds.password,
    })
    return sftp
  } catch (e) {
    logger.error(`${SFTP_CONNECTION_ERROR_PREFIX} ${e}`)
    throw e
  }
}
