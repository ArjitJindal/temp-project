import { Collection, Filter } from 'mongodb'
import { uniq, maxBy, max, compact, isEmpty } from 'lodash'
import { UserRepository } from '../users/repositories/user-repository'
import { getMongoDbClient, lookupPipelineStage } from '@/utils/mongodb-utils'
import {
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { getUserName } from '@/utils/helpers'
import { ContactDetails } from '@/@types/openapi-internal/ContactDetails'
import { GraphNodes } from '@/@types/openapi-internal/GraphNodes'
import { GraphEdges } from '@/@types/openapi-internal/GraphEdges'
import { Address } from '@/@types/openapi-internal/Address'
import { traceable } from '@/core/xray'
import dayjs from '@/utils/dayjs'
import {
  executeClickhouseQuery,
  getClickhouseClient,
  isClickhouseEnabled,
} from '@/utils/clickhouse/utils'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'

type UsersProjectedData = Pick<
  InternalUser,
  | 'userId'
  | 'legalEntity'
  | 'contactDetails'
  | 'directors'
  | 'shareHolders'
  | 'userDetails'
  | 'type'
  | 'linkedEntities'
>

export type EntityGraph = {
  nodes: GraphNodes[]
  edges: GraphEdges[]
}

@traceable
export class LinkerService {
  tenantId!: string

  public constructor(tenantId: string) {
    this.tenantId = tenantId
  }

  public async entityGraph(
    userId: string,
    afterTimestamp?: number,
    beforeTimestamp?: number
  ): Promise<EntityGraph> {
    const {
      linkedUsers,
      emailLinked,
      addressLinked,
      phoneLinked,
      paymentMethodLinked,
      childrenLinked,
      parentLinked,
    } = await this.entity(userId, afterTimestamp, beforeTimestamp)

    const nodeMap: Map<string, string> = new Map()
    const linkedEdges: GraphEdges[] = []
    const links: [string, Map<string, string[]>][] = [
      ['emailAddress', emailLinked],
      ['paymentIdentifier', paymentMethodLinked],
      ['address', addressLinked],
      ['contactNumber', phoneLinked],
      ['parent', parentLinked],
      ['children', childrenLinked],
    ]

    for (const [userId, label] of linkedUsers) {
      nodeMap.set(`user:${userId}`, label)
    }
    links.forEach(([prefix, linked]) => {
      for (const [link, users] of linked.entries()) {
        nodeMap.set(`${prefix}:${link}`, '')
        linkedEdges.push(
          ...users.map((userId) => ({
            id: `user:${userId}-${prefix}:${link}`,
            source: `user:${userId}`,
            target: `${prefix}:${link}`,
          }))
        )
      }
    })

    for (const [nodeId] of nodeMap.entries()) {
      if (
        !linkedEdges.some((e) => e.source === nodeId || e.target === nodeId) &&
        nodeId !== `user:${userId}`
      ) {
        nodeMap.delete(nodeId)
      }
    }

    const nodes: GraphNodes[] = [...nodeMap.entries()].map(([id, label]) => ({
      id,
      label,
    }))

    return {
      nodes,
      edges: linkedEdges,
    }
  }

  public async entityGraphNodesOnly(
    userId: string
  ): Promise<{ childUserIds: string[]; parentUserIds: string[] }> {
    if (isClickhouseEnabled()) {
      const client = await getClickhouseClient(this.tenantId)
      const usersTable = CLICKHOUSE_DEFINITIONS.USERS.tableName
      const query = `
      SELECT
          'childUser' AS type,
          id,
          NULL AS parentUserId
      FROM ${usersTable} FINAL
      WHERE JSONExtractString(data, 'linkedEntities', 'parentUserId') = '${userId}'

      UNION ALL

      SELECT
          'currentUser' AS type,
          NULL AS userId,
          JSONExtractString(data, 'linkedEntities', 'parentUserId') AS parentUserId
      FROM ${usersTable} FINAL
      WHERE id = '${userId}'`
      const result = await executeClickhouseQuery<
        {
          type: 'childUser' | 'currentUser'
          id: string | null
          parentUserId: string | null
        }[]
      >(client, query)

      const childUserIds = result
        .filter((row) => row.type === 'childUser' && row.id)
        .map((row) => row.id as string)

      const parentUserId = result.find(
        (row) => row.type === 'currentUser'
      )?.parentUserId
      const parentUserIds = parentUserId ? [parentUserId] : []

      return {
        childUserIds,
        parentUserIds,
      }
    }
    const mongoClient = await getMongoDbClient()
    const db = mongoClient.db()
    const userCollection = db.collection<InternalUser>(
      USERS_COLLECTION(this.tenantId)
    )

    const [result] = await userCollection
      .aggregate([
        {
          $facet: {
            childUsers: [
              { $match: { 'linkedEntities.parentUserId': userId } },
              { $project: { userId: 1 } },
            ],
            currentUser: [
              { $match: { userId } },
              { $project: { 'linkedEntities.parentUserId': 1 } },
            ],
          },
        },
      ])
      .toArray()

    const childUserIds = result.childUsers.map((child: any) => child.userId)
    const parentUserId = result.currentUser[0]?.linkedEntities?.parentUserId
    const parentUserIds = parentUserId ? [parentUserId] : []

    return {
      childUserIds,
      parentUserIds,
    }
  }

  public async getChildUsers(userId: string): Promise<string[]> {
    if (isClickhouseEnabled()) {
      const client = await getClickhouseClient(this.tenantId)
      const usersTable = CLICKHOUSE_DEFINITIONS.USERS.tableName
      const query = `
      SELECT id
      FROM ${usersTable} FINAL
      WHERE linkedEntities_parentUserId = '${userId}'`

      const result = await executeClickhouseQuery<{ id: string }[]>(
        client,
        query
      )

      return result.length > 0 ? result.map((row) => row.id) : []
    }

    const mongoClient = await getMongoDbClient()
    const db = mongoClient.db()
    const userCollection = db.collection<InternalUser>(
      USERS_COLLECTION(this.tenantId)
    )

    const childUsers = await userCollection
      .find({ 'linkedEntities.parentUserId': userId })
      .project({ userId: 1 })
      .toArray()

    return childUsers.length > 0
      ? childUsers.map((child: any) => child.userId)
      : []
  }

  private getAllContactDetails(user: UsersProjectedData): ContactDetails[] {
    const sharedHolders = user.shareHolders || []
    const directors = user.directors || []
    const contactDetails = user.contactDetails ? [user.contactDetails] : []
    const legalEntityContact = user.legalEntity?.contactDetails || {}
    return [
      ...contactDetails,
      legalEntityContact,
      ...sharedHolders.map((s) => s.contactDetails),
      ...directors.map((s) => s.contactDetails),
    ].filter((c): c is ContactDetails => !!c)
  }

  private processLink(
    user: UsersProjectedData,
    link: string,
    map: Map<string, string[]>
  ) {
    const existingLinks = map.get(link)
    if (existingLinks) {
      map.set(link, uniq([user.userId, ...existingLinks]))
    } else {
      map.set(link, uniq([user.userId]))
    }
  }

  public async transactions(
    userId: string,
    afterTimestamp?: number,
    beforeTimestamp?: number
  ): Promise<EntityGraph> {
    const mongoClient = await getMongoDbClient()
    const db = mongoClient.db()
    const txnCollection = db.collection<InternalTransaction>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )
    const userCollection = db.collection<InternalUser>(
      USERS_COLLECTION(this.tenantId)
    )

    const isPaymentId = userId.startsWith('payment:')
    userId = userId.replace('payment:', '')

    const projectPipelineStage = {
      $project: {
        _id: 1,
        count: 1,
        users: { legalEntity: 1, userDetails: 1, userId: 1, type: 1 },
        actualIds: 1,
      },
    }

    const [credit, debit, user] = await Promise.all([
      txnCollection
        .aggregate<{
          _id: string
          count: number
          users: InternalUser[]
          actualIds: string[]
        }>([
          {
            $match: {
              ...(!isPaymentId
                ? { originUserId: userId }
                : { originPaymentMethodId: userId }),
              timestamp: {
                $gte: afterTimestamp || dayjs().subtract(30, 'days').valueOf(),
                $lte: beforeTimestamp || dayjs().valueOf(),
              },
            },
          },
          { $limit: 10000 },
          {
            $group: {
              _id: {
                $ifNull: ['$destinationUserId', '$destinationPaymentMethodId'],
              },
              count: { $sum: 1 },
              actualIds: {
                $addToSet: { $ifNull: ['$destinationUserId', null] },
              },
            },
          },
          lookupPipelineStage({
            from: USERS_COLLECTION(this.tenantId),
            localField: '_id',
            foreignField: 'userId',
            as: 'users',
          }),
          projectPipelineStage,
        ])
        .toArray(),
      txnCollection
        .aggregate<{
          _id: string
          count: number
          users: InternalUser[]
          actualIds: string[]
        }>([
          {
            $match: {
              ...(!isPaymentId
                ? { destinationUserId: userId }
                : { destinationPaymentMethodId: userId }),
              timestamp: {
                $gte: afterTimestamp || dayjs().subtract(30, 'days').valueOf(),
                $lte: beforeTimestamp || dayjs().valueOf(),
              },
            },
          },
          { $limit: 10000 },
          {
            $group: {
              _id: { $ifNull: ['$originUserId', '$originPaymentMethodId'] },
              count: { $sum: 1 },
              actualIds: { $addToSet: { $ifNull: ['$originUserId', null] } },
            },
          },
          lookupPipelineStage({
            from: USERS_COLLECTION(this.tenantId),
            localField: '_id',
            foreignField: 'userId',
            as: 'users',
          }),
          projectPipelineStage,
        ])
        .toArray(),
      userCollection.findOne({ userId }),
    ])

    const allUserIds = compact([
      ...credit.flatMap((c) => c.actualIds),
      ...debit.flatMap((d) => d.actualIds),
      ...(isPaymentId ? [userId] : []),
    ])

    const userUpdatedId = `${isPaymentId ? 'payment' : 'user'}:${userId}`

    const nodes: GraphNodes[] = [
      {
        id: userUpdatedId,
        label: isPaymentId ? '' : getUserName(user),
      },
    ]

    const edges: GraphEdges[] = []

    const SCALE = 3 // How thick should our thickest line be for transaction volume
    const maxCount =
      max([maxBy(credit, 'count')?.count, maxBy(debit, 'count')?.count]) || 10

    credit.forEach((userTxns) => {
      const userSourceId = `${
        allUserIds.includes(userTxns._id) ? 'user' : 'payment'
      }:${userTxns._id}`

      nodes.push({
        id: userSourceId,
        label: allUserIds.includes(userTxns._id)
          ? getUserName(userTxns.users[0])
          : '',
      })

      edges.push({
        id: `${userTxns._id}-${userId}`,
        source: userSourceId,
        target: userUpdatedId,
        size: (userTxns.count / maxCount) * SCALE,
        label: `${userTxns.count}`,
      })
    })

    debit.forEach((userTxns) => {
      const userTargetId = `${
        allUserIds.includes(userTxns._id) ? 'user' : 'payment'
      }:${userTxns._id}`

      nodes.push({
        id: userTargetId,
        label: allUserIds.includes(userTxns._id)
          ? getUserName(userTxns.users[0])
          : '',
      })

      edges.push({
        id: `${userId}-${userTxns._id}`,
        source: userUpdatedId,
        target: userTargetId,
        size: (userTxns.count / maxCount) * SCALE,
        label: `${userTxns.count}`,
      })
    })

    // Remove any nodes that don't have any edges
    const nodeIds = uniq(edges.flatMap((e) => [e.source, e.target]))
    nodes.filter((n) => nodeIds.includes(n.id))

    return {
      nodes,
      edges,
    }
  }

  public async linkedUsers(
    userId: string,
    afterTimestamp?: number,
    beforeTimestamp?: number
  ): Promise<string[]> {
    const entity = await this.entity(userId, afterTimestamp, beforeTimestamp)
    entity.linkedUsers.delete(userId)
    return [...entity.linkedUsers.keys()]
  }

  public async getLinkedChildUsers(parentUserId: string): Promise<string[]> {
    const entity = await this.entity(parentUserId)
    const linkedChildrenKeysIterator = entity.childrenLinked.keys()
    const linkedChildrenKeysArray = Array.from(linkedChildrenKeysIterator)

    if (linkedChildrenKeysArray.length === 0) {
      return []
    }

    const childrenKeysString = linkedChildrenKeysArray[0]

    if (!childrenKeysString || childrenKeysString.trim() === '') {
      return []
    }

    const linkedChildrenUserIds = childrenKeysString
      ?.split(',')
      ?.map((id) => id.trim())
      .filter((id) => id !== '')

    return linkedChildrenUserIds
  }

  public async entity(
    userId: string,
    afterTimestamp?: number,
    beforeTimestamp?: number
  ): Promise<{
    emailLinked: Map<string, string[]>
    addressLinked: Map<string, string[]>
    phoneLinked: Map<string, string[]>
    paymentMethodLinked: Map<string, string[]>
    linkedUsers: Map<string, string>
    childrenLinked: Map<string, string[]>
    parentLinked: Map<string, string[]>
  }> {
    const mongoClient = await getMongoDbClient()
    const db = mongoClient.db()
    const txnCollection = db.collection<InternalTransaction>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )
    const userCollection = db.collection<InternalUser>(
      USERS_COLLECTION(this.tenantId)
    )
    const userRepository = new UserRepository(this.tenantId, {
      mongoDb: mongoClient,
    })

    const originAccountNumbersPromise = txnCollection.distinct(
      'originPaymentMethodId',
      {
        originUserId: userId,
        originPaymentMethodId: { $ne: undefined },
        timestamp: {
          $gte: afterTimestamp || dayjs().subtract(30, 'days').valueOf(),
          $lte: beforeTimestamp || dayjs().valueOf(),
        },
      }
    )

    const destinationAccountNumbersPromise = txnCollection.distinct(
      'destinationPaymentMethodId',
      {
        destinationUserId: userId,
        destinationPaymentMethodId: { $ne: undefined },
        timestamp: {
          $gte: afterTimestamp || dayjs().subtract(30, 'days').valueOf(),
          $lte: beforeTimestamp || dayjs().valueOf(),
        },
      }
    )

    const prefixes = ['', 'legalEntity.', 'directors.', 'shareHolders.']
    const [
      [user, legalEntity, directors, shareHolders],
      [originAccountNumbers, destinationAccountNumbers],
    ] = await Promise.all([
      Promise.all([
        ...prefixes.map((prefix) => {
          return linkingElements(prefix, userCollection, userId)
        }),
      ]),
      Promise.all([
        originAccountNumbersPromise,
        destinationAccountNumbersPromise,
      ]),
    ])

    // Group together linking elements
    const emailIds = [
      ...user[0],
      ...legalEntity[0],
      ...directors[0],
      ...shareHolders[0],
    ]
    const contactNumbers = [
      ...user[1],
      ...directors[1],
      ...shareHolders[1],
      ...legalEntity[1],
    ]
    const addresses = [
      ...user[2],
      ...directors[2],
      ...shareHolders[2],
      ...legalEntity[2],
    ]

    const paymentMethodIds = [
      ...originAccountNumbers,
      ...destinationAccountNumbers,
    ]
    const [originPaymentMethodLinks, destinationPaymentMethodLinks] =
      await Promise.all([
        txnCollection
          .aggregate<{ _id: string; users: InternalUser[] }>([
            { $match: { originPaymentMethodId: { $in: paymentMethodIds } } },
            {
              $group: {
                _id: '$originPaymentMethodId',
                userIds: { $push: '$originUserId' },
              },
            },
            lookupPipelineStage({
              from: USERS_COLLECTION(this.tenantId),
              localField: 'userIds',
              foreignField: 'userId',
              as: 'users',
            }),
          ])
          .toArray(),
        txnCollection
          .aggregate<{ _id: string; users: InternalUser[] }>([
            {
              $match: { destinationPaymentMethodId: { $in: paymentMethodIds } },
            },
            {
              $group: {
                _id: '$destinationPaymentMethodId',
                userIds: { $push: '$destinationUserId' },
              },
            },
            lookupPipelineStage({
              from: USERS_COLLECTION(this.tenantId),
              localField: 'userIds',
              foreignField: 'userId',
              as: 'users',
            }),
          ])
          .toArray(),
      ])
    const query: Filter<InternalUser> = {
      $or: [
        ...prefixes.flatMap((prefix) => {
          return [
            { [`${prefix}contactDetails.emailIds`]: { $in: emailIds } },
            {
              [`${prefix}contactDetails.contactNumbers`]: {
                $in: contactNumbers,
              },
            },
            ...addresses.map((addressCombined) => {
              const [address, postcode] = addressCombined.split(',')
              return {
                [`${prefix}contactDetails.addresses.postcode`]: postcode,
                [`${prefix}contactDetails.addresses.addressLines.0`]: address,
              }
            }),
          ]
        }),
        { userId },
        {
          'linkedEntities.parentUserId': userId,
        },
      ],
    }
    const [users, currentUser] = await Promise.all([
      userCollection
        .find(query)
        .project<UsersProjectedData>({
          shareHolders: 1,
          directors: 1,
          userId: 1,
          legalEntity: 1,
          contactDetails: 1,
          userDetails: 1,
          type: 1,
          linkedEntities: 1,
        })
        .toArray(),
      userRepository.getMongoUser(userId),
    ])

    const emailLinked = new Map<string, string[]>()
    const addressLinked = new Map<string, string[]>()
    const phoneLinked = new Map<string, string[]>()
    const childrenLinked = new Map<string, string[]>()
    const parentLinked = new Map<string, string[]>()

    for (const user of users) {
      const contactDetails = this.getAllContactDetails(user)
      contactDetails.forEach((contactDetail) => {
        if (isEmpty(contactDetail)) {
          return
        }
        contactDetail.emailIds?.forEach((emailId) =>
          this.processLink(user, emailId, emailLinked)
        )
        contactDetail.addresses?.forEach((address) =>
          this.processLink(user, addressLink(address), addressLinked)
        )
        contactDetail.contactNumbers?.forEach((contactNumber) =>
          this.processLink(user, contactNumber, phoneLinked)
        )
      })
    }

    const childUsers = users.filter(
      (user) => user.linkedEntities?.parentUserId === userId
    )
    const link = currentUser?.linkedEntities
    if (link?.parentUserId) {
      parentLinked.set(link.parentUserId, [link.parentUserId, userId])
    }
    if (childUsers.length) {
      const childUserIds = childUsers.map((user) => user.userId)
      childrenLinked.set(childUserIds.join(', '), [...childUserIds, userId])
    }

    // Merge origin and destination payment method links
    const paymentMethodLinked = new Map<string, string[]>()
    ;[originPaymentMethodLinks, destinationPaymentMethodLinks].forEach(
      (links) => {
        for (const link of links) {
          if (link._id) {
            const existingLinks = paymentMethodLinked.get(link._id)
            if (existingLinks) {
              paymentMethodLinked.set(link._id, [
                ...link.users.map((u) => u.userId),
                ...existingLinks,
              ])
            } else {
              paymentMethodLinked.set(
                link._id,
                link.users.map((u) => u.userId)
              )
            }
          }
        }
      }
    )

    const maps = [emailLinked, addressLinked, phoneLinked, paymentMethodLinked]
    maps.forEach((map) => {
      for (const [key, entry] of map.entries()) {
        if (!key) {
          map.delete(key)
        }

        if (
          !entry.some((thisUserId) => thisUserId === userId) ||
          entry.length <= 1
        ) {
          map.delete(key)
        }
      }
    })

    const linkedUsers = new Map<string, string>()
    const allUsers: UsersProjectedData[] = [
      ...users,
      ...originPaymentMethodLinks.flatMap((pl) => pl.users),
      ...destinationPaymentMethodLinks.flatMap((pl) => pl.users),
    ]

    allUsers.forEach((user) => {
      linkedUsers.set(user.userId, getUserName(user))
    })

    return {
      emailLinked,
      phoneLinked,
      addressLinked,
      paymentMethodLinked,
      linkedUsers,
      childrenLinked,
      parentLinked,
    }
  }
}

function addressLink(address: Address): string {
  const firstPart =
    address.addressLines.length > 0 ? address.addressLines[0] : ''
  return `${firstPart}, ${address.postcode}`
}

async function linkingElements(
  prefix: string,
  userCollection: Collection<InternalUser>,
  userId: string
): Promise<[string[], string[], string[]]> {
  const [emailIds, contactNumbers, address] = await Promise.all([
    userCollection.distinct(`${prefix}contactDetails.emailIds`, { userId }),
    userCollection.distinct(`${prefix}contactDetails.contactNumbers`, {
      userId,
    }),
    userCollection
      .aggregate<{ address: string }>([
        {
          $match: {
            userId,
            [`${prefix}contactDetails.addresses.postcode`]: { $exists: true },
            [`${prefix}contactDetails.addresses.addressLines.0`]: {
              $exists: true,
            },
          },
        },
        { $project: { address: `$${prefix}contactDetails.addresses` } },
        { $unwind: { path: '$address' } },
        { $unwind: { path: '$address' } },
        {
          $match: {
            'address.postcode': { $exists: true },
            'address.addressLines.0': { $exists: true },
          },
        },
        {
          $addFields: {
            adddressLine1: { $arrayElemAt: ['$address.addressLines', 0] },
          },
        },
        {
          $project: {
            address: { $concat: ['$adddressLine1', ',', '$address.postcode'] },
          },
        },
        { $group: { _id: '$address' } },
        { $project: { _id: 0, address: '$_id' } },
      ])
      .toArray(),
  ])

  return [emailIds, contactNumbers, address.map((a) => a.address)]
}
