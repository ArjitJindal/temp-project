import { PolicyDocument, Statement } from 'aws-lambda'
import { StackConstants } from '@lib/constants'
import { stageAndRegion } from '@flagright/lib/utils'
import { FLAGRIGHT_TENANT_ID } from '../constants'
import {
  SHARED_AUTH0_PARTITION_KEY_PREFIX,
  SHARED_PARTITION_KEY_PREFIX,
} from '../dynamodb/dynamodb-keys'
import { getNonDemoTenantId } from '@/utils/tenant'

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
            `${SHARED_AUTH0_PARTITION_KEY_PREFIX}*`,
            `${getNonDemoTenantId(this.tenantId)}*`,
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
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
      ],
      Resource: ['arn:aws:dynamodb:*:*:table/*'],
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
        `arn:aws:s3:::${StackConstants.S3_TMP_BUCKET_PREFIX}*/acuris*/*`,
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

  opensearch() {
    const [stage, region] = stageAndRegion()
    this.statements.push({
      Action: [
        'es:ESHttpGet',
        'es:ESHttpPost',
        'es:ESHttpPut',
        'es:ESHttpDelete',
        'es:ESHttpHead',
        'es:ESHttpPatch',
      ],
      Effect: 'Allow',
      Resource: `arn:aws:es:*:*:domain/${stage}-${region}-opensearch*`,
    })
    this.statements.push({
      Action: ['es:DescribeDomains', 'es:DescribeElasticsearchDomains'],
      Effect: 'Allow',
      Resource: `arn:aws:es:*:*:domain/${stage}-${region}-opensearch*`,
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
