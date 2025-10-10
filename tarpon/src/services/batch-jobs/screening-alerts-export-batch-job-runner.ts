import { PassThrough } from 'stream'
import archiver from 'archiver'
import { Upload } from '@aws-sdk/lib-storage'
import { S3Client } from '@aws-sdk/client-s3'
import { WebClient } from '@slack/web-api'
import { BatchJobRunner } from './batch-job-runner-base'
import dayjs from '@/utils/dayjs'
import { DATE_TIME_FORMAT_JS } from '@/core/constants'
import { ScreeningAlertsExportBatchJob } from '@/@types/batch-job'
import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import {
  CASES_COLLECTION,
  SANCTIONS_HITS_COLLECTION,
  SANCTIONS_SEARCHES_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongo-table-names'
import { Case } from '@/@types/openapi-internal/Case'
import { SanctionsSearchHistory } from '@/@types/openapi-internal/SanctionsSearchHistory'
import { SanctionsHit } from '@/@types/openapi-internal/SanctionsHit'
import { RuleHitMeta } from '@/@types/openapi-internal/RuleHitMeta'
import { SanctionsDetails } from '@/@types/openapi-internal/SanctionsDetails'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { ConsumerName } from '@/@types/openapi-internal/ConsumerName'
import { getSecret } from '@/utils/secrets-manager'
import { ENGINEERING_HELP_CHANNEL_ID } from '@/utils/slack'
import { formatCountry } from '@/utils/countries'

type UserDoc = InternalConsumerUser | InternalBusinessUser

function formatConsumerName(name: ConsumerName | undefined): string {
  const result = [name?.firstName, name?.middleName, name?.lastName]
    .filter(Boolean)
    .join(' ')
  return result === '' ? '(No name)' : result
}

export class ScreeningAlertsExportBatchJobRunner extends BatchJobRunner {
  private s3Client: S3Client

  constructor(jobId: string) {
    super(jobId)
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
    })
  }

  protected async run(job: ScreeningAlertsExportBatchJob): Promise<void> {
    const mongoClient = await getMongoDbClient()
    const tenantId = job.tenantId
    const db = mongoClient.db()

    const bucket = process.env.DOCUMENT_BUCKET
    if (!bucket) {
      throw new Error('DOCUMENT_BUCKET is not set')
    }

    const timestampSafe = dayjs().format(DATE_TIME_FORMAT_JS)
    const fileBaseName = `screening-alerts-${tenantId}-${timestampSafe}-${this.jobId}.zip`
    const key = `exports/${tenantId}/${fileBaseName}`

    const zipStream = new PassThrough()
    const upload = new Upload({
      client: this.s3Client,
      params: {
        Bucket: bucket,
        Key: key,
        Body: zipStream,
        ContentType: 'application/zip',
        ServerSideEncryption: 'AES256',
        ContentDisposition: `attachment; filename="${fileBaseName}"`,
      },
      queueSize: 10,
      partSize: 5 * 1024 * 1024,
    })

    const archive = archiver('zip', { zlib: { level: 9 } })
    archive.on('error', (err) => {
      throw err
    })
    archive.pipe(zipStream)

    const MAX_ROWS_PER_PART = 100000
    let partIndex = 1
    let rowsInCurrentPart = 0
    let currentCsvStream: PassThrough | null = null

    const startNewCsvPart = () => {
      if (currentCsvStream !== null) {
        currentCsvStream.end()
      }
      const filename = `screening-alerts-part-${partIndex}.csv`
      partIndex += 1
      rowsInCurrentPart = 0
      currentCsvStream = new PassThrough()
      archive.append(currentCsvStream, { name: filename })
      currentCsvStream.write(header)
    }

    const header =
      [
        'User ID',
        'User name',
        'Type',
        'Rule instance ID',
        'Alert ID',
        'Alert creation date',
        'Case ID',
        'Case creation date',
        'Search term',
        'Name (matched entity)',
        'Alias (matched entity)',
        'Hit ID',
        'Relevance',
        'Matched type',
        'Date of birth (matched entity, individuals)',
        'Nationality (matched entity, individuals)',
        'Country of incorporation (matched entity, business)',
        'Country of operation (matched entity, business)',
      ]
        .map((s) =>
          s.includes(',') || s.includes('\n') || s.includes('"')
            ? '"' + s.replace(/"/g, '""') + '"'
            : s
        )
        .join(',') + '\n'

    startNewCsvPart()

    const basePipeline: Record<string, unknown>[] = [
      { $unwind: { path: '$alerts' } },
      {
        $match: {
          'alerts.ruleId': {
            $in: ['R-16', 'R-17', 'R-18', 'R-32', 'R-128', 'R-169', 'R-170'],
          },
        },
      },
      {
        $project: {
          alertId: '$alerts.alertId',
          ruleInstanceId: '$alerts.ruleInstanceId',
          ruleHitMeta: '$alerts.ruleHitMeta',
          alertCreatedTimestamp: '$alerts.createdTimestamp',
          caseCreatedTimestamp: '$createdTimestamp',
          caseId: 1,
          caseUsers: {
            origin: { userId: '$caseUsers.origin.userId' },
            destination: { userId: '$caseUsers.destination.userId' },
          },
        },
      },
    ]

    const casesCol = db.collection<Case>(CASES_COLLECTION(tenantId))
    const searchesCol = db.collection<SanctionsSearchHistory>(
      SANCTIONS_SEARCHES_COLLECTION(tenantId)
    )
    const usersCol = db.collection<UserDoc>(USERS_COLLECTION(tenantId))

    await processCursorInBatch(
      casesCol.aggregate(basePipeline),
      async (rows) => {
        const userIds: string[] = []
        const searchIds: string[] = []

        type PartialRow = {
          userId?: string
          alertId?: string
          ruleInstanceId?: string
          caseId?: string
          alertCreatedAt?: string
          caseCreatedAt?: string
          isHit?: boolean
          searchId?: string
          hitIds?: string[]
        }
        const partialRows: PartialRow[] = []

        for (const row of rows as Array<{
          alertId: string
          ruleInstanceId: string
          caseId: string
          alertCreatedTimestamp?: number
          caseCreatedTimestamp?: number
          caseUsers?: {
            origin?: { userId?: string }
            destination?: { userId?: string }
          }
          ruleHitMeta?: RuleHitMeta
        }>) {
          const pr: PartialRow = {
            alertId: row.alertId,
            ruleInstanceId: row.ruleInstanceId,
            caseId: row.caseId,
            alertCreatedAt: row.alertCreatedTimestamp
              ? dayjs(row.alertCreatedTimestamp).format(DATE_TIME_FORMAT_JS)
              : '-',
            caseCreatedAt: row.caseCreatedTimestamp
              ? dayjs(row.caseCreatedTimestamp).format(DATE_TIME_FORMAT_JS)
              : '-',
          }

          const uid =
            row.caseUsers?.origin?.userId ?? row.caseUsers?.destination?.userId
          if (uid) {
            pr.userId = uid
            userIds.push(uid)
          }

          const sanctionsDetails: SanctionsDetails[] | undefined =
            row.ruleHitMeta?.sanctionsDetails
          if (sanctionsDetails?.length) {
            pr.isHit = true
            for (const sd of sanctionsDetails) {
              if (sd.searchId) {
                partialRows.push({
                  ...pr,
                  searchId: sd.searchId,
                  hitIds: Array.isArray(sd.sanctionHitIds)
                    ? sd.sanctionHitIds
                    : [],
                })
                searchIds.push(sd.searchId)
              }
            }
          } else {
            pr.isHit = false
            partialRows.push(pr)
          }
        }

        const usersMap = new Map<string, { name: string; type: string }>()
        if (userIds.length) {
          const uniqueUserIds = Array.from(new Set(userIds))
          const cursor = usersCol
            .find({ userId: { $in: uniqueUserIds } })
            .project({
              userId: 1,
              type: 1,
              'userDetails.name': 1,
              'legalEntity.companyGeneralDetails.legalName': 1,
            })
          for await (const u of cursor) {
            const type = u.type
            const name =
              type === 'CONSUMER'
                ? formatConsumerName(
                    (u as InternalConsumerUser).userDetails?.name
                  )
                : (u as InternalBusinessUser).legalEntity?.companyGeneralDetails
                    ?.legalName ?? '(No name)'
            usersMap.set(u.userId, {
              name: name || '(No name)',
              type: type || '-',
            })
          }
        }

        const searchTermMap = new Map<string, string>()
        if (searchIds.length) {
          const uniqueSearchIds = Array.from(new Set(searchIds))
          const cursor = searchesCol
            .find({ _id: { $in: uniqueSearchIds } })
            .project({ _id: 1, 'request.searchTerm': 1 })
          for await (const s of cursor) {
            const h = s as unknown as SanctionsSearchHistory
            searchTermMap.set(h._id, h.request?.searchTerm ?? '')
          }
        }

        // Build hits by searchId map so we can generate exact rows per hit/entity
        const hitsBySearchId = new Map<string, SanctionsHit[]>()
        if (searchIds.length) {
          const uniqueSearchIdsForHits = Array.from(new Set(searchIds))
          const hitsCol = db.collection<SanctionsHit>(
            SANCTIONS_HITS_COLLECTION(tenantId)
          )
          const hCursor = hitsCol
            .find({ searchId: { $in: uniqueSearchIdsForHits } })
            .project({
              sanctionsHitId: 1,
              searchId: 1,
              'entity.entityType': 1,
              'entity.name': 1,
              'entity.matchTypes': 1,
              'entity.types': 1,
              'entity.dateOfBirths': 1,
              'entity.yearOfBirth': 1,
              'entity.nationality': 1,
              'entity.countryCodes': 1,
              'entity.countries': 1,
              'entity.aka': 1,
              'entity.normalizedAka': 1,
            })
          for await (const h of hCursor as unknown as AsyncIterable<SanctionsHit>) {
            const sid = h.searchId
            if (!sid) {
              continue
            }
            const list = hitsBySearchId.get(sid) ?? []
            list.push(h)
            hitsBySearchId.set(sid, list)
          }
        }

        for (const pr of partialRows as Array<{
          userId?: string
          alertId?: string
          ruleInstanceId?: string
          caseId?: string
          alertCreatedAt?: string
          caseCreatedAt?: string
          isHit?: boolean
          searchId?: string
        }>) {
          const user = pr.userId ? usersMap.get(pr.userId) : undefined
          if (pr.isHit && pr.searchId) {
            const searchTerm = searchTermMap.get(pr.searchId) ?? ''
            const hits = hitsBySearchId.get(pr.searchId) ?? []
            if (hits.length === 0) {
              const row = [
                pr.userId ?? '',
                user?.name ?? '',
                user?.type ?? '',
                pr.ruleInstanceId ?? '',
                pr.alertId ?? '',
                pr.alertCreatedAt ?? '',
                pr.caseId ?? '',
                pr.caseCreatedAt ?? '',
                searchTerm,
                '',
                '',
                '',
                '',
                '',
                '',
                '',
              ]
                .map((v) => {
                  const s = String(v ?? '')
                  return s.includes(',') || s.includes('\n') || s.includes('"')
                    ? `"${s.replace(/"/g, '""')}"`
                    : s
                })
                .join(',')
              if (rowsInCurrentPart >= MAX_ROWS_PER_PART) {
                startNewCsvPart()
              }
              currentCsvStream?.write(row + '\n')
              rowsInCurrentPart += 1
              continue
            }
            for (const hit of hits) {
              const entity = hit.entity
              const isPerson = entity?.entityType === 'PERSON'
              const name = entity?.name ?? ''
              const relevance = (entity?.matchTypes ?? []).join('; ')
              const matchedType = (entity?.types ?? []).join('; ')
              const dob = (entity?.dateOfBirths ?? entity?.yearOfBirth ?? [])
                .map((d) => String(d))
                .join('; ')
              const nationality = (entity?.nationality ?? [])
                .map((c) => formatCountry(c) || c)
                .join('; ')
              const incorp = (entity?.countryCodes ?? [])
                .map((c) => formatCountry(c) || c)
                .join('; ')
              const ops = (entity?.countries ?? [])
                .map((c) => formatCountry(c) || c)
                .join('; ')
              const aliases = Array.from(
                new Set([
                  ...(entity?.normalizedAka ?? []),
                  ...(entity?.aka ?? []),
                ])
              )
                .filter(Boolean)
                .join('; ')
              const hitIdJoined = hit.sanctionsHitId ?? ''

              const row = [
                pr.userId ?? '',
                user?.name ?? '',
                user?.type ?? '',
                pr.ruleInstanceId ?? '',
                pr.alertId ?? '',
                pr.alertCreatedAt ?? '',
                pr.caseId ?? '',
                pr.caseCreatedAt ?? '',
                searchTerm,
                name.split('#')[0],
                aliases,
                hitIdJoined,
                relevance,
                matchedType,
                isPerson ? dob : '',
                isPerson ? nationality : '',
                !isPerson ? incorp : '',
                !isPerson ? ops : '',
              ]
                .map((v) => {
                  const s = String(v ?? '')
                  return s.includes(',') || s.includes('\n') || s.includes('"')
                    ? `"${s.replace(/"/g, '""')}"`
                    : s
                })
                .join(',')
              if (rowsInCurrentPart >= MAX_ROWS_PER_PART) {
                startNewCsvPart()
              }
              currentCsvStream?.write(row + '\n')
              rowsInCurrentPart += 1
            }
          } else {
            const row = [
              pr.userId ?? '',
              user?.name ?? '',
              user?.type ?? '',
              pr.ruleInstanceId ?? '',
              pr.alertId ?? '',
              pr.alertCreatedAt ?? '',
              pr.caseId ?? '',
              pr.caseCreatedAt ?? '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
            ]
              .map((v) => {
                const s = String(v ?? '')
                return s.includes(',') || s.includes('\n') || s.includes('"')
                  ? `"${s.replace(/"/g, '""')}"`
                  : s
              })
              .join(',')

            if (rowsInCurrentPart >= MAX_ROWS_PER_PART) {
              startNewCsvPart()
            }
            currentCsvStream?.write(row + '\n')
            rowsInCurrentPart += 1
          }
        }
      }
    )

    if (currentCsvStream !== null) {
      ;(currentCsvStream as PassThrough).end()
    }
    archive.finalize()
    await upload.done()

    const slackCreds = await getSecret<{ token: string }>('slackCreds')
    const slackClient = new WebClient(slackCreds.token)
    await slackClient.chat.postMessage({
      channel: ENGINEERING_HELP_CHANNEL_ID,
      text: `Screening alerts export completed for tenant ${tenantId}. File: s3://${bucket}/${key}`,
    })
  }
}
