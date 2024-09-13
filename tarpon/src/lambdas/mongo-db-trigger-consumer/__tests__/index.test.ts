import { fetchTableDetails, segregateMessages as handleMessages } from '../app'

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
          documentKey: {
            _id: '666666666666666666666666',
          },
          operationType: 'delete',
          clusterTime: 0,
          collectionName: 'cases',
        },
        {
          documentKey: {
            _id: '666666666666666666666666',
          },
          operationType: 'update',
          clusterTime: 1,
          collectionName: 'cases',
        },
      ])
    ).toMatchObject({
      messagesToReplace: {
        cases: [
          {
            documentKey: {
              _id: '666666666666666666666666',
            },
            operationType: 'update',
            clusterTime: 1,
            collectionName: 'cases',
          },
        ],
      },
      messagesToDelete: {},
    })
  })

  it('should return correct messages to delete and replace', () => {
    expect(
      handleMessages([
        {
          documentKey: {
            _id: '666666666666666666666666',
          },
          operationType: 'delete',
          clusterTime: 0,
          collectionName: 'cases',
        },
      ])
    ).toMatchObject({
      messagesToDelete: {
        cases: [
          {
            documentKey: {
              _id: '666666666666666666666666',
            },
            operationType: 'delete',
            clusterTime: 0,
            collectionName: 'cases',
          },
        ],
      },
      messagesToReplace: {},
    })
  })
})
