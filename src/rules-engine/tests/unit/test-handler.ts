'use strict'

import chai from 'chai'
import { verifyTransactionHandler } from '../../app'

const expect = chai.expect

describe('Tests index', function () {
  it('verifies successful response', async () => {
    const result: any = await verifyTransactionHandler(
      {} as any,
      {} as any,
      () => undefined
    )

    expect(result).to.be.an('object')
    expect(result.statusCode).to.equal(500)
  })
})
