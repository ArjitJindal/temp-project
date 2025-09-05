import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3'
import { memoize } from 'lodash'
import { getDemoDataS3Prefix } from '@lib/constants'
import { BUSINESS_USER_SEED, CONSUMER_USER_SEED } from './seeds'
import {
  BusinessUserSampler,
  ConsumerUserSampler,
} from '@/core/seed/samplers/users'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { companies } from '@/core/seed/samplers/dictionary'
import { logger } from '@/core/logger'
import { envIs, envIsNot } from '@/utils/env'

// stores mocked user for once
export let users: (InternalBusinessUser | InternalConsumerUser)[] = []
const CONSUMER_USER_COUNT = 500

const businessUsers: (
  tenantId: string,
  s3Client: S3Client
) => Promise<InternalBusinessUser[]> = async (
  tenantId: string,
  s3Client: S3Client
) => {
  const sampler = new BusinessUserSampler(BUSINESS_USER_SEED, s3Client)
  const businessUser: InternalBusinessUser[] = []
  for (let i = 0; i < companies.length; i++) {
    let uploadAttachments = true
    if (envIs('local') || envIs('test')) {
      uploadAttachments = false
    }
    businessUser.push(
      await sampler.getSample(
        undefined,
        tenantId,
        uploadAttachments,
        companies[i]
      )
    )
  }
  return businessUser
}

const consumerUsers: (
  tenantId: string,
  s3Client: S3Client
) => Promise<InternalConsumerUser[]> = async (
  tenantId: string,
  s3Client: S3Client
) => {
  const startCounter = companies.length
  const sampler = new ConsumerUserSampler(
    CONSUMER_USER_SEED,
    s3Client,
    startCounter + 1
  )
  let uploadAttachments = true
  if (envIs('local') || envIs('test')) {
    uploadAttachments = false
  }
  const consumerUser: InternalConsumerUser[] = []
  for (let i = 0; i < CONSUMER_USER_COUNT; i++) {
    consumerUser.push(
      await sampler.getSample(undefined, tenantId, uploadAttachments)
    )
  }

  return consumerUser
}

const deleteOldAttachment = async (tenantId: string, s3Client: S3Client) => {
  const bucket = process.env.DOCUMENT_BUCKET
  const prefix = getDemoDataS3Prefix(tenantId)

  if (!bucket) {
    return
  }

  try {
    let isTruncated = true
    let continuationToken: string | undefined
    let totalDeleted = 0

    while (isTruncated) {
      const listCommand = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })

      const listedObjects = await s3Client.send(listCommand)

      if (!listedObjects.Contents?.length) {
        break
      }

      const deleteParams = {
        Bucket: bucket,
        Delete: {
          Objects: listedObjects.Contents.map(({ Key }) => ({ Key })),
          Quiet: true,
        },
      }

      await s3Client.send(new DeleteObjectsCommand(deleteParams))

      totalDeleted += listedObjects.Contents.length
      isTruncated = !!listedObjects.IsTruncated
      continuationToken = listedObjects.NextContinuationToken
    }

    logger.info(`Successfully deleted ${totalDeleted} objects from ${prefix}`)
  } catch (error) {
    logger.error('Error deleting old attachments:', error)
    throw error
  }
}

export const getUsers: (
  tenantId: string
) => Promise<(InternalBusinessUser | InternalConsumerUser)[]> = async (
  tenantId: string
) => {
  const s3Client = new S3Client({
    region: process.env.AWS_REGION,
  })
  // clearing old uploaded attachment file
  try {
    if (envIsNot('local')) {
      await deleteOldAttachment(tenantId, s3Client)
    }
  } catch (error) {
    logger.error('Failed to delete old attachment', error)
  }
  const mockedBusinessUsers: InternalBusinessUser[] = await businessUsers(
    tenantId,
    s3Client
  )
  logger.info(`Mocked ${mockedBusinessUsers.length} business users`)
  const mockedConsumerUsers: InternalConsumerUser[] = await consumerUsers(
    tenantId,
    s3Client
  )
  logger.info(`Mocked ${mockedConsumerUsers.length} consumer users`)
  users = [...mockedBusinessUsers, ...mockedConsumerUsers]
  return users
}

export const getUserUniqueTags: () => {
  key: string
  value: string
}[] = memoize(() => {
  const uniqueSet = new Set<string>()
  const result: { key: string; value: string }[] = []

  users.forEach((user) => {
    user.tags?.forEach((tag) => {
      const uniqueKey = `${tag.key}:${tag.value}`
      if (!uniqueSet.has(uniqueKey)) {
        uniqueSet.add(uniqueKey)
        result.push({ key: tag.key, value: tag.value })
      }
    })
  })

  return result
})
