import { v4 as uuid4 } from 'uuid'
import { BaseSampler } from './base'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalConsumerUserEvent } from '@/@types/openapi-internal/InternalConsumerUserEvent'
import { InternalBusinessUserEvent } from '@/@types/openapi-internal/InternalBusinessUserEvent'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'

export class ConsumerUserEventSampler extends BaseSampler<
  InternalConsumerUserEvent[]
> {
  consumerUserEvents = [
    {
      eventDescription: 'New consumer user created',
      reason: 'New user created',
      properties: [
        'userId',
        'type',
        'acquisitionChannel',
        'userSegment',
        'reasonForAccountOpening',
        'createdAt',
        'createdTimestamp',
      ],
    },
    {
      eventDescription:
        "Updated user's risk level, state, kyc status and source of funds",
      reason: 'Added user risk level, state, kyc status and source of funds',
      properties: [
        'riskLevel',
        'userStateDetails',
        'kycStatusDetails',
        'sourceOfFunds',
      ],
    },
    {
      eventDescription: 'Updated user details',
      reason: 'Added user details',
      properties: ['userDetails'],
    },
    {
      eventDescription: 'Updated user legal documents and attachments',
      reason: 'Added user legal documents and attachments',
      properties: [],
    },
    {
      eventDescription: 'Updated user contact details',
      reason: 'Added user contact details',
      properties: ['contactDetails'],
    },
    {
      eventDescription: 'Updated user employment details',
      reason: 'Added user employment details',
      properties: ['employmentDetails', 'employmentStatus', 'occupation'],
    },
    {
      eventDescription:
        'Updated user transaction limits and saved payment details',
      reason: 'Added user transaction limits and saved payment details',
      properties: ['transactionLimits', 'savedPaymentDetails'],
    },
    {
      eventDescription: 'Updated user tags and peps',
      reason: 'Added user tags and peps',
      properties: ['tags', 'pepStatus'],
    },
    {
      eventDescription: 'Updated user KRS and DRS scores based on rule hits',
      reason: 'Added user KRS and DRS scores',
      properties: [],
    },
  ]
  generateSample = (user: InternalConsumerUser) => {
    // Consumer user will have 7 events, which will populate different data regarding them
    const events: InternalConsumerUserEvent[] = []
    let eventCreationTimestamp = user.createdAt ?? this.rng.randomTimestamp()
    for (let i = 0; i < this.consumerUserEvents.length; i++) {
      const metadata = this.consumerUserEvents[i]
      const updatedProperties = {}
      metadata.properties.map((property) => {
        if (user[property] !== undefined) {
          updatedProperties[property] = user[property]
        }
      })
      const isLast = i === this.consumerUserEvents.length - 1
      events.push({
        eventId: uuid4(),
        userId: user.userId,
        reason: metadata.reason,
        eventDescription: metadata.eventDescription,
        updatedConsumerUserAttributes:
          Object.keys(updatedProperties).length > 0
            ? updatedProperties
            : undefined,
        riskScoreDetails: {
          kycRiskScore: isLast
            ? user.krsScore?.krsScore
            : this.rng.randomIntInclusive(1, 100),
          craRiskScore: isLast
            ? user.drsScore?.drsScore
            : this.rng.randomIntInclusive(1, 100),
        },
        timestamp: eventCreationTimestamp,
      })

      eventCreationTimestamp = !isLast
        ? eventCreationTimestamp +
          this.rng.randomIntInclusive(60 * 1000, 60 * 60 * 1000)
        : user.updatedAt ?? eventCreationTimestamp + 60 * 60 * 1000
    }
    return events
  }
}
export class BusinessUserEventSampler extends BaseSampler<
  InternalBusinessUserEvent[]
> {
  businessUserEvents = [
    {
      eventDescription: 'New consumer user created',
      reason: 'New user created',
      properties: [
        'userId',
        'type',
        'acquisitionChannel',
        'userSegment',
        'reasonForAccountOpening',
        'createdAt',
        'createdTimestamp',
      ],
    },
    {
      eventDescription: "Updated user's tags, state and kyc status",
      reason: 'Added user tags, state and kyc status',
      properties: ['tags', 'userStateDetails', 'kycStatusDetails'],
    },
    {
      eventDescription: 'Updated user details',
      reason: 'Added user details',
      properties: ['legalEntity'],
    },
    {
      eventDescription: 'Updated user share holders and directors',
      reason: 'Added user share holders and directors',
      properties: ['shareHolders', 'directors'],
    },
    {
      eventDescription:
        'Updated user transaction limits, saved payment details and allowed payment methods',
      reason:
        'Added user transaction limits, saved payment details and allowed payment methods',
      properties: [
        'transactionLimits',
        'savedPaymentDetails',
        'allowedPaymentMethods',
      ],
    },
    {
      eventDescription: 'Updated user KRS and DRS scores based on rule hits',
      reason: 'Added user KRS and DRS scores',
      properties: [],
    },
  ]
  generateSample = (user: InternalBusinessUser) => {
    // Consumer user will have 7 events, which will populate different data regarding them
    const events: InternalBusinessUserEvent[] = []
    let eventCreationTimestamp = user.createdAt ?? this.rng.randomTimestamp()
    for (let i = 0; i < this.businessUserEvents.length; i++) {
      const metadata = this.businessUserEvents[i]
      const updatedProperties = {}
      metadata.properties.map((property) => {
        if (user[property] !== undefined) {
          updatedProperties[property] = user[property]
        }
      })
      const isLast = i === this.businessUserEvents.length - 1
      events.push({
        eventId: uuid4(),
        userId: user.userId,
        reason: metadata.reason,
        eventDescription: metadata.eventDescription,
        updatedBusinessUserAttributes:
          Object.keys(updatedProperties).length > 0
            ? updatedProperties
            : undefined,
        riskScoreDetails: {
          kycRiskScore: isLast
            ? user.krsScore?.krsScore
            : this.rng.randomIntInclusive(1, 100),
          craRiskScore: isLast
            ? user.drsScore?.drsScore
            : this.rng.randomIntInclusive(1, 100),
        },
        timestamp: eventCreationTimestamp,
      })

      eventCreationTimestamp = !isLast
        ? eventCreationTimestamp +
          this.rng.randomIntInclusive(60 * 1000, 60 * 60 * 1000)
        : user.updatedAt ?? eventCreationTimestamp + 60 * 60 * 1000
    }
    return events
  }
}
