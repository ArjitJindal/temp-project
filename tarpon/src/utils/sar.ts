import SftpClient from 'ssh2-sftp-client'
import { getSecretByName } from './secrets-manager'

export async function connectToSFTP(): Promise<SftpClient> {
  const creds = await getSecretByName('fincenCreds')
  return new Promise((resolve, reject) => {
    const sftp = new SftpClient()
    const timeout = setTimeout(() => {
      sftp.end().catch(() => {})
      reject(new Error('Connection attempt timed out after 30 seconds'))
    }, 30000)
    sftp
      .connect({
        host: process.env.FINCEN_SFTP_IP,
        port: Number(process.env.FINCEN_SFTP_PORT),
        username: creds.username,
        password: creds.password,
        readyTimeout: 10000,
      })
      .then(() => {
        clearTimeout(timeout)
        resolve(sftp)
      })
      .catch((e) => {
        clearTimeout(timeout)
        reject(e)
      })
  })
}
