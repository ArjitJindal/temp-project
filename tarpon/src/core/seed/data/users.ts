import {
  S3Client,
  ListObjectsV2Command,
  _Object,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3'
import { memoize, compact, uniq } from 'lodash'
import { getDemoDataS3Prefix } from '@lib/constants'
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

const businessUsers: (
  tenantId: string
) => Promise<InternalBusinessUser[]> = async (tenantId: string) => {
  const sampler = new BusinessUserSampler()
  const userPromises = companies.map(async (c) => {
    let uploadAttachments = true
    if (envIs('local')) {
      uploadAttachments = false
    }
    const user = await sampler.getSample(
      undefined,
      tenantId,
      uploadAttachments,
      c
    )
    return user
  })

  return Promise.all(userPromises)
}

const consumerUsers: (
  tenantId: string
) => Promise<InternalConsumerUser[]> = async (tenantId: string) => {
  const startCounter = companies.length
  const sampler = new ConsumerUserSampler(undefined, startCounter)
  let uploadAttachments = true
  if (process.env.DISABLE_UPLOAD_ATTACHMENTS) {
    uploadAttachments = false
  }
  const userPromises = [...new Array(200)].map(async () => {
    const user = await sampler.getSample(undefined, tenantId, uploadAttachments)
    return user
  })

  return Promise.all(userPromises)
}

const deleteOldAttachment = async (tenantId: string) => {
  const s3Client = new S3Client({
    region: process.env.AWS_REGION,
  })
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

    console.log(`Successfully deleted ${totalDeleted} objects from ${prefix}`)
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
  // clearing old uploaded attachment file
  try {
    if (envIsNot('local')) {
      await deleteOldAttachment(tenantId)
    }
  } catch (error) {
    logger.error('Failed to delete old attachment', error)
  }
  const mockedBusinessUsers: InternalBusinessUser[] = await businessUsers(
    tenantId
  )
  const mockedConsumerUsers: InternalConsumerUser[] = await consumerUsers(
    tenantId
  )
  users = [...mockedBusinessUsers, ...mockedConsumerUsers]
  return users
}

export const getUserUniqueTags = memoize(() => {
  return compact(uniq(users.flatMap((u) => u.tags?.map((t) => t.key))))
})
