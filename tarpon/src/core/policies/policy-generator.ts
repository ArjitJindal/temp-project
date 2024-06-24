import { PolicyDocument, Statement } from 'aws-lambda'
import { StackConstants } from '@lib/constants'
import { FLAGRIGHT_TENANT_ID } from '../constants'

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

  athena() {
    this.statements.push({
      Effect: 'Allow',
      Action: ['athena:*'],
      Resource: ['*'],
      Condition: {
        StringEquals: {
          'athena:queryPartitionValue': `tenant=${this.tenantId}`,
        },
      },
    })
    return this
  }

  dynamoDb(tables: string[]) {
    this.statements.push({
      Effect: 'Allow',
      Action: ['dynamodb:*'],
      Resource: tables.map((table) => `arn:aws:dynamodb:*:*:table/${table}`),
      Condition: {
        'ForAllValues:StringLike': {
          'dynamodb:LeadingKeys': [`${this.tenantId}*`],
        },
      },
    })
    this.statements.push({
      Effect: 'Allow',
      Action: [
        'dynamodb:GetItem',
        'dynamodb:BatchGetItem',
        'dynamodb:Scan',
        'dynamodb:Query',
        'dynamodb:ConditionCheckItem',
      ],
      Resource: tables.map((table) => `arn:aws:dynamodb:*:*:table/${table}`),
      Condition: {
        'ForAllValues:StringLike': {
          'dynamodb:LeadingKeys': [`${FLAGRIGHT_TENANT_ID}*`],
        },
      },
    })
    return this
  }

  s3() {
    this.statements.push({
      Action: ['s3:*'],
      Effect: 'Allow',
      Resource: [
        `arn:aws:s3:::${StackConstants.S3_IMPORT_BUCKET_PREFIX}*/${this.tenantId}/*`,
        `arn:aws:s3:::${StackConstants.S3_DOCUMENT_BUCKET_PREFIX}*/${this.tenantId}/*`,
        `arn:aws:s3:::${StackConstants.S3_TMP_BUCKET_PREFIX}*/${this.tenantId}/*`,
        `arn:aws:s3:::${StackConstants.S3_SHARED_ASSETS_PREFIX}*/*`,
      ],
    })
    return this
  }

  secretsManager() {
    this.statements.push({
      Action: ['secretsmanager:*'],
      Effect: 'Allow',
      Resource: [`arn:aws:secretsmanager:*:*:secret:${this.tenantId}*`],
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
