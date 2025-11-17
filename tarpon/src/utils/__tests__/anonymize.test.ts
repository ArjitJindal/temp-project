import { ObjectId, WithId } from 'mongodb'
import { isValidEmail } from '@flagright/lib/utils'
import { DEFAULT_CASE_AGGREGATES } from '@/constants/case-creation'
import { anonymize } from '@/utils/anonymize'
import { Case } from '@/@types/openapi-internal/Case'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'

describe('Anonymizer', () => {
  test('Data is anonymized', () => {
    const anonymizedCase = anonymize<WithId<Case>>('cases', {
      _id: new ObjectId('734033c379f3c58f5d21f29d'),
      caseType: 'SYSTEM',
      caseAggregates: DEFAULT_CASE_AGGREGATES,
      caseTransactionsIds: ['12345'],
      caseUsers: {
        origin: {
          type: 'CONSUMER',
          userId: '123',
          createdTimestamp: 0,
          userDetails: {
            name: {
              firstName: 'John',
              lastName: 'Smith',
            },
          },
          legalDocuments: [
            {
              documentType: 'PASSPORT',
              documentNumber: '12345678',
              documentIssuedCountry: 'GB',
            },
            {
              documentType: 'VISA',
              documentNumber: 'somevisathing',
              documentIssuedCountry: 'GB',
            },
            {
              documentType: 'PASSPORT',
              documentNumber: '12345678',
              documentIssuedCountry: 'GB',
            },
          ],
        },
      },
    })

    const user = anonymizedCase.caseUsers?.origin as InternalConsumerUser
    const doc1 = user?.legalDocuments?.pop()?.documentNumber
    const doc2 = user?.legalDocuments?.pop()?.documentNumber
    const doc3 = user?.legalDocuments?.pop()?.documentNumber
    expect(doc1 !== '12345678' || doc2 !== '12345678').toBe(true)
    expect(doc1 !== 'somevisathing' || doc2 !== 'somevisathing').toBe(true)
    expect(doc1).toEqual(doc3)
  })
  test('Data is anonymized with valid email', () => {
    const anonymizedCase = anonymize<WithId<AuditLog>>('auditlog', {
      _id: new ObjectId('634033c379f3c58f5d21f29d'),
      type: 'ACCOUNT',
      action: 'CREATE',
      user: {
        id: '123',
        name: 'Tim Coulson',
        role: 'admin',
        email: 'tim@flagright.com',
        emailVerified: true,
        blocked: false,
        orgName: 'flagright',
        tenantId: 'flagright',
      },
    })

    expect(isValidEmail(anonymizedCase.user?.email as string)).toBe(true)
  })
})
