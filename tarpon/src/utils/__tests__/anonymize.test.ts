import { ObjectId, WithId } from 'mongodb'
import { anonymize } from '@/utils/anonymize'
import { Case } from '@/@types/openapi-internal/Case'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'
import { isValidEmail } from '@/utils/regex'

describe('Anonymizer', () => {
  test('Data is anonymized', () => {
    const anonymizedCase = anonymize<WithId<Case>>('cases', {
      _id: new ObjectId('734033c379f3c58f5d21f29d'),
      caseType: 'SYSTEM',
      caseTransactions: [
        {
          transactionId: '12345',
          timestamp: 1,
          executedRules: [],
          hitRules: [],
          status: 'ALLOW',
          destinationUser: {
            userId: '12345',
            createdTimestamp: 0,
            type: 'CONSUMER',
            legalDocuments: [
              {
                documentType: 'passport',
                documentNumber: '12345678',
                documentIssuedCountry: 'GB',
              },
              {
                documentType: 'visa',
                documentNumber: 'somevisathing',
                documentIssuedCountry: 'DE',
              },
              {
                documentType: 'visa',
                documentNumber: '12345678',
                documentIssuedCountry: 'DE',
              },
            ],
          },
        },
      ],
    })

    const user = anonymizedCase.caseTransactions?.shift()
      ?.destinationUser as InternalConsumerUser
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
        isEscalationContact: false,
      },
    })

    expect(isValidEmail(anonymizedCase.user?.email as string)).toBe(true)
  })
})
