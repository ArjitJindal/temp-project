import { Collection } from 'mongodb'
import { uniq } from 'lodash'
import {
  getMongoDbClient,
  lookupPipelineStage,
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongoDBUtils'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { getUserName } from '@/utils/helpers'
import { ContactDetails } from '@/@types/openapi-internal/ContactDetails'
import { UserEntityNodes } from '@/@types/openapi-internal/UserEntityNodes'
import { UserEntityEdges } from '@/@types/openapi-internal/UserEntityEdges'

export class LinkerService {
  tenantId!: string

  public constructor(tenantId: string) {
    this.tenantId = tenantId
  }

  public visualisation(
    userId: string,
    userLabels: Map<string, string>,
    emailLinked: Map<string, string[]>,
    addressLinked: Map<string, string[]>,
    phoneLinked: Map<string, string[]>,
    paymentMethodLinked: Map<string, string[]>
  ): {
    nodes: UserEntityNodes[]
    edges: UserEntityEdges[]
  } {
    const nodeMap: Map<string, string> = new Map()
    const linkedEdges: UserEntityEdges[] = []
    const links: [string, Map<string, string[]>][] = [
      ['emailAddress', emailLinked],
      ['paymentIdentifier', paymentMethodLinked],
      ['address', addressLinked],
      ['contactNumber', phoneLinked],
    ]

    for (const [userId, label] of userLabels) {
      nodeMap.set(`user:${userId}`, label)
    }
    userLabels.get(userId)
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

    return {
      nodes: Array(...nodeMap.entries()).map(([id, label]) => ({
        id,
        label,
      })),
      edges: linkedEdges,
    }
  }

  private getAllContactDetails(user: InternalUser): ContactDetails[] {
    const sharedHolders = user.shareHolders || []
    const directors = user.directors || []
    const contactDetails = [user.contactDetails] ?? []
    const legalEntityContact = user.legalEntity?.contactDetails || {}
    return [
      ...contactDetails,
      legalEntityContact,
      ...sharedHolders.map((s) => s.contactDetails),
      ...directors.map((s) => s.contactDetails),
    ].filter((c): c is ContactDetails => !!c)
  }

  private processLink(
    user: InternalUser,
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

  public async entity(userId: string): Promise<{
    emailLinked: Map<string, string[]>
    addressLinked: Map<string, string[]>
    phoneLinked: Map<string, string[]>
    paymentMethodLinked: Map<string, string[]>
    userLabels: Map<string, string>
  }> {
    const mongoClient = await getMongoDbClient()
    const db = mongoClient.db()
    const txnCollection = db.collection<InternalTransaction>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )
    const userCollection = db.collection<InternalUser>(
      USERS_COLLECTION(this.tenantId)
    )

    const originAccountNumbersPromise = txnCollection.distinct(
      'originPaymentMethodId',
      { originUserId: userId }
    )

    const destinationAccountNumbersPromise = txnCollection.distinct(
      'destinationPaymentMethodId',
      { destinationUserId: userId }
    )

    const prefixes = ['', 'legalEntity.', 'directors.', 'shareHolders.']
    const [
      [user, directors, shareHolders],
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
    const emailIds = [...user[0], ...directors[0], ...shareHolders[0]]
    const contactNumbers = [...user[1], ...directors[1], ...shareHolders[1]]
    const postcodes = [...user[2], ...directors[2], ...shareHolders[2]]

    const paymentMethodIds = [
      ...originAccountNumbers,
      ...destinationAccountNumbers,
    ]
    const [originPaymentMethodLinks, destinationPaymentMethodLinks] =
      await Promise.all([
        txnCollection
          .aggregate<{
            _id: string
            users: InternalUser[]
          }>([
            {
              $match: {
                originPaymentMethodId: { $in: paymentMethodIds },
              },
            },
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
          .aggregate<{
            _id: string
            users: InternalUser[]
          }>([
            {
              $match: {
                destinationPaymentMethodId: { $in: paymentMethodIds },
              },
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

    const users = await userCollection
      .find({
        $or: [
          ...prefixes.flatMap((prefix) => {
            return [
              { [`${prefix}contactDetails.emailIds`]: { $in: emailIds } },
              {
                [`${prefix}contactDetails.contactNumbers`]: {
                  $in: contactNumbers,
                },
              },
              {
                [`${prefix}contactDetails.addresses.postcode`]: {
                  $in: postcodes,
                },
              },
            ]
          }),
          { userId },
        ],
      })
      .toArray()

    const emailLinked = new Map<string, string[]>()
    const addressLinked = new Map<string, string[]>()
    const phoneLinked = new Map<string, string[]>()

    for (const user of users) {
      const contactDetails = this.getAllContactDetails(user)
      contactDetails.forEach((contactDetail) => {
        contactDetail.emailIds?.forEach((emailId) =>
          this.processLink(user, emailId, emailLinked)
        )
        contactDetail.addresses?.forEach((address) =>
          this.processLink(user, address.postcode, addressLinked)
        )
        contactDetail.contactNumbers?.forEach((contactNumber) =>
          this.processLink(user, contactNumber, phoneLinked)
        )
      })
    }

    // Merge origin and destination payment method links
    const paymentMethodLinked = new Map<string, string[]>()
    //
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

    const userLabels = new Map<string, string>()
    const allUsers: InternalUser[] = [
      ...users,
      ...originPaymentMethodLinks.flatMap((pl) => pl.users),
      ...destinationPaymentMethodLinks.flatMap((pl) => pl.users),
    ]

    allUsers.forEach((user) => {
      userLabels.set(user.userId, getUserName(user))
    })

    return {
      emailLinked,
      phoneLinked,
      addressLinked,
      paymentMethodLinked,
      userLabels,
    }
  }
}

async function linkingElements(
  prefix: string,
  userCollection: Collection<InternalUser>,
  userId: string
): Promise<[string[], string[], string[]]> {
  const emailIds = userCollection.distinct(`${prefix}contactDetails.emailIds`, {
    userId,
  })
  const contactNumbers = userCollection.distinct(
    `${prefix}contactDetails.contactNumbers`,
    {
      userId,
    }
  )
  const postcodes = userCollection.distinct(
    `${prefix}contactDetails.addresses.postcode`,
    {
      userId,
    }
  )
  return [await emailIds, await contactNumbers, await postcodes]
}
