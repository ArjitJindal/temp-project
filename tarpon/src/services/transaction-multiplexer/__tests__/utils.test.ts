import { getUserKeyId } from '../../logic-evaluator/engine/utils'
import {
  getPrimaryRecordIdentifier,
  getConnectors,
  buildGroups,
} from '../multiplexer-utils'
import { AsyncMessage } from '@/@types/rule/async-rule-multiplexer'

jest.mock('uuid', () => ({ v4: jest.fn(() => 'mock-uuid') }))
jest.mock('../../logic-evaluator/engine/utils', () => ({
  getUserKeyId: jest.fn(),
}))

describe('transactionMultiplexerUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getPrimaryRecordIdentifier', () => {
    it('returns transactionId for TRANSACTION', () => {
      const record = {
        type: 'TRANSACTION',
        transaction: { transactionId: 'tx-123' },
      } as any
      expect(getPrimaryRecordIdentifier(record)).toBe('tx-123')
    })

    it('returns transactionEventId for TRANSACTION_EVENT', () => {
      const record = {
        type: 'TRANSACTION_EVENT',
        transactionEventId: 'event-456',
      } as any
      expect(getPrimaryRecordIdentifier(record)).toBe('event-456')
    })

    it('returns empty string for unknown type', () => {
      const record = { type: 'UNKNOWN' } as any
      expect(getPrimaryRecordIdentifier(record)).toBe('')
    })
  })

  describe('getConnectors', () => {
    it('uses senderUser and receiverUser for USER_TRANSACTIONS', () => {
      const record: AsyncMessage = {
        messageId: 'm1',
        record: {
          type: 'TRANSACTION',
          transaction: {},
          senderUser: { userId: 'sender-1' },
          receiverUser: { userId: 'receiver-1' },
        } as any,
      }

      const connectors = getConnectors(record, ['USER_TRANSACTIONS'])
      expect(connectors).toEqual(['sender-1', 'receiver-1'])
    })

    it('uses getUserKeyId for non-USER_TRANSACTIONS types', () => {
      ;(getUserKeyId as jest.Mock)
        .mockReturnValueOnce('origin-id')
        .mockReturnValueOnce('destination-id')

      const record: AsyncMessage = {
        messageId: 'm1',
        record: {
          type: 'TRANSACTION',
          transaction: {},
        } as any,
      }

      const connectors = getConnectors(record, ['PAYMENT_DETAILS_TRANSACTIONS'])
      expect(connectors).toEqual(['origin-id', 'destination-id'])
      expect(getUserKeyId).toHaveBeenCalledTimes(2)
    })

    it('filters out null or undefined connectors', () => {
      const record: AsyncMessage = {
        messageId: 'm1',
        record: {
          type: 'TRANSACTION',
          transaction: {},
          senderUser: { userId: null },
          receiverUser: {},
        } as any,
      }

      const connectors = getConnectors(record, ['USER_TRANSACTIONS'])
      expect(connectors).toEqual([]) // no valid IDs
    })
  })

  describe('buildGroups', () => {
    it('groups transactions with shared identifiers', () => {
      const record1: AsyncMessage = {
        messageId: 'm1',
        record: {
          type: 'TRANSACTION',
          senderUser: { userId: 'A1' },
          receiverUser: { userId: 'A2' },
          transaction: { transactionId: 't1' },
        } as any,
      }
      const record2: AsyncMessage = {
        messageId: 'm2',
        record: {
          type: 'TRANSACTION',
          senderUser: { userId: 'A2' },
          transaction: { transactionId: 't2' },
        } as any,
      }

      const { groups } = buildGroups([record1, record2], ['USER_TRANSACTIONS'])

      expect(groups.length).toBe(1)
      expect(groups[0].group).toEqual([record1, record2])
      expect(groups[0].identifiers).toEqual(
        expect.arrayContaining(['A1', 'A2'])
      )
    })

    it('creates separate groups for disconnected transactions', () => {
      const record1: AsyncMessage = {
        messageId: 'm1',
        record: {
          type: 'TRANSACTION',
          senderUser: { userId: 'B1' },
          transaction: { transactionId: 't1' },
        } as any,
      }
      const record2: AsyncMessage = {
        messageId: 'm2',
        record: {
          type: 'TRANSACTION',
          senderUser: { userId: 'A1' },
          transaction: { transactionId: 't2' },
        } as any,
      }

      const { groups } = buildGroups([record1, record2], ['USER_TRANSACTIONS'])
      expect(groups.length).toBe(2)
    })

    it('handles records with no connectors', () => {
      const record: AsyncMessage = {
        messageId: 'm1',
        record: {
          type: 'TRANSACTION',
          transaction: { transactionId: 't1' },
        } as any,
      }

      const { groups } = buildGroups([record], ['USER_TRANSACTIONS'])
      expect(groups.length).toBe(1)
      expect(groups[0].identifiers).toEqual([])
      expect(groups[0].group).toEqual([record])
    })
  })
})
