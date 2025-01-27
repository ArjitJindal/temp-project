import { PolicyDocument, Statement } from 'aws-lambda'
import { StackConstants } from '@lib/constants'
import { FLAGRIGHT_TENANT_ID } from '../constants'
import { SHARED_PARTITION_KEY_PREFIX } from '../dynamodb/dynamodb-keys'

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
          'athena:queryPartitionValue': `tenant=${this.tenantId.toLowerCase()}`,
        },
      },
    })
    return this
  }

  dynamoDb() {
    this.statements.push({
      Effect: 'Allow',
      Action: ['dynamodb:*'],
      Resource: ['arn:aws:dynamodb:*:*:table/*'],
      Condition: {
        'ForAllValues:StringLike': {
          'dynamodb:LeadingKeys': [
            `${this.tenantId}*`,
            `${SHARED_PARTITION_KEY_PREFIX}*`,
          ],
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
      Resource: ['arn:aws:dynamodb:*:*:table/*'],
      Condition: {
        'ForAllValues:StringLike': {
          'dynamodb:LeadingKeys': [`${FLAGRIGHT_TENANT_ID}*`],
        },
      },
    })
    this.statements.push({
      Effect: 'Allow',
      Action: ['dynamodb:*'],
      Resource: ['*'],
      Condition: {
        'ForAllValues:StringLike': {
          'dynamodb:LeadingKeys': [
            `${FLAGRIGHT_TENANT_ID}#accounts-id`,
            `${FLAGRIGHT_TENANT_ID}#accounts-email`,
          ],
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
