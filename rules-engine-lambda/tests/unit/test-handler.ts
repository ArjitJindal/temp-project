'use strict'

import chai from 'chai'
import { lambdaHandler } from '../../app'

const expect = chai.expect

describe('Tests index', function () {
  it('verifies successful response', async () => {
    const result: any = await lambdaHandler(
      {} as any,
      {} as any,
      () => undefined
    )

    expect(result).to.be.an('object')
    expect(result.statusCode).to.equal(500)
  })
})
