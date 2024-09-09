import { Binary, Long, ObjectId, Timestamp } from 'mongodb'
import { fetchTableDetails, handleMessages } from '../app'

describe('Fetch Table Details', () => {
  it('should return correct table details', () => {
    expect(fetchTableDetails('flagright-cases')).toMatchObject({
      tenantId: 'flagright',
      collectionName: 'flagright-cases',
      clickhouseTable: {
        table: 'cases',
      },
    })
  })

  it('should return null if the table is not found', () => {
    expect(fetchTableDetails('flagright-cases123')).toBeFalsy()
  })
})

describe('Handle Messages', () => {
  it('should return correct messages to delete and replace', () => {
    expect(
      handleMessages([
        {
          detail: {
            _id: new ObjectId('666666666666666666666666'),
            collectionUUID: new Binary('666666666666666666666666', 4),
            documentKey: {
              _id: new ObjectId('666666666666666666666666'),
            },
            ns: {
              db: 'tarpon',
              coll: 'cases',
            },
            operationType: 'delete',
            clusterTime: new Timestamp(new Long(0, 0)),
          },
        } as any,
        {
          detail: {
            _id: new ObjectId('666666666666666666666666'),
            collectionUUID: new Binary('666666666666666666666666', 4),
            documentKey: {
              _id: new ObjectId('666666666666666666666666'),
            },
            ns: {
              db: 'tarpon',
              coll: 'cases',
            },
            operationType: 'update',
            clusterTime: new Timestamp(new Long(1, 1)),
            updateDescription: {
              updatedFields: {
                $case: {
                  caseId: '123',
                },
              },
            },
          },
        } as any,
      ])
    ).toMatchObject({
      messagesToReplace: {
        '666666666666666666666666': {
          _id: new ObjectId('666666666666666666666666'),
          collectionUUID: new Binary('666666666666666666666666', 4),
          documentKey: {
            _id: new ObjectId('666666666666666666666666'),
          },
        },
      },
      messagesToDelete: {},
    })
  })

  it('should return correct messages to delete and replace', () => {
    expect(
      handleMessages([
        {
          detail: {
            _id: new ObjectId('666666666666666666666666'),
            collectionUUID: new Binary('666666666666666666666666', 4),
            documentKey: {
              _id: new ObjectId('666666666666666666666666'),
            },
            ns: {
              db: 'tarpon',
              coll: 'cases',
            },
            operationType: 'delete',
            clusterTime: new Timestamp(new Long(0, 0)),
          },
        } as any,
      ])
    ).toMatchObject({
      messagesToDelete: {
        '666666666666666666666666': {
          _id: new ObjectId('666666666666666666666666'),
          collectionUUID: new Binary('666666666666666666666666', 4),
          documentKey: {
            _id: new ObjectId('666666666666666666666666'),
          },
        },
      },
      messagesToReplace: {},
    })
  })
})
