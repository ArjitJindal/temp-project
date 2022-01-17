import { PolicyDocument, Statement } from 'aws-lambda'

export default class PolicyBuilder {
  tenantId: string
  statements: Array<Statement>

  constructor(tenantId: string) {
    if (!tenantId) {
      throw new Error('tenantId cannot be empty!')
    }
    this.tenantId = tenantId
    this.statements = []
  }

  dynamoDb(table: string) {
    this.statements.push({
      Effect: 'Allow',
      Action: ['dynamodb:*'],
      Resource: [`arn:aws:dynamodb:*:*:table/${table}`],
      Condition: {
        'ForAllValues:StringLike': {
          'dynamodb:LeadingKeys': [`${this.tenantId}*`],
        },
      },
    })
    return this
  }

  build(): PolicyDocument {
    return {
      Version: '2012-10-17',
      Statement: this.statements,
    }
  }
}
