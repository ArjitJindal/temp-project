import { Upload } from '@aws-sdk/lib-storage'
import { S3Client } from '@aws-sdk/client-s3'
import pMap from 'p-map'
import { AnyBulkWriteOperation } from 'mongodb'
import { migrateAllTenants } from '../utils/tenant'
import { REPORT_COLLECTION } from '@/utils/mongodb-definitions'
import { Tenant } from '@/services/accounts/repository'
import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import { Report } from '@/@types/openapi-internal/Report'

// This script removes the `schema` field and updates the `revisions` field in the reports collection.
// The changes are needed to resolve ClickHouse sync issues.
// For each revision:
// - Uploads XML content to S3 if not already there
// - Updates revision.output to store the S3 key
// This migration precedes the ClickHouse sync update.
const { DOCUMENT_BUCKET, AWS_REGION } = process.env as {
  DOCUMENT_BUCKET: string
  AWS_REGION: string
}
async function uploadToS3(key: string, body: Buffer | string) {
  const parallelUploadS3 = new Upload({
    client: new S3Client({
      region: AWS_REGION,
    }),
    params: {
      Bucket: DOCUMENT_BUCKET,
      Key: key,
      Body: body,
    },
  })
  await parallelUploadS3.done()
}
async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const collection = db.collection<Report>(REPORT_COLLECTION(tenant.id))

  await processCursorInBatch(
    collection.find({}),
    async (reports) => {
      const bulkOps: AnyBulkWriteOperation<Report>[] = []
      await pMap(
        reports,
        async (report) => {
          for (const revision of report.revisions) {
            const match = revision.output.match(/^s3:(.+?):(.+)$/)
            if (!match) {
              const key = `${tenant.id}/${report.id}-report-${Date.now()}.xml`
              await uploadToS3(key, Buffer.from(revision.output))
              revision.output = `s3:document:${key}`
            }
          }
          if (report.rawStatusInfo) {
            const match = report.rawStatusInfo.match(/^s3:(.+?):(.+)$/)
            if (!match) {
              const key = `${tenant.id}/${
                report.id
              }-report-rawStatusInfo-${Date.now()}.xml`
              await uploadToS3(key, report.rawStatusInfo)
              report.rawStatusInfo = `s3:document:${key}`
            }
          }
          bulkOps.push({
            updateOne: {
              filter: { id: report.id },
              update: {
                $set: {
                  revisions: report.revisions,
                  rawStatusInfo: report.rawStatusInfo,
                },
                $unset: { schema: '' },
              },
            },
          })
        },
        { concurrency: 5 }
      )
      if (bulkOps.length > 0) {
        await collection.bulkWrite(bulkOps)
      }
    },
    { mongoBatchSize: 100, processBatchSize: 10, debug: true }
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
