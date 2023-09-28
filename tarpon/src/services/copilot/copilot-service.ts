import { MongoClient } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { Credentials } from '@aws-sdk/client-sts'
import { TenantRepository } from '../tenants/repositories/tenant-repository'
import {
  AttributeGenerator,
  DefaultAttributeBuilders,
} from './attributes/builder'
import { NarrativeResponse } from '@/@types/openapi-internal/NarrativeResponse'
import { Case } from '@/@types/openapi-internal/Case'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { CaseReasons } from '@/@types/openapi-internal/CaseReasons'
import { traceable } from '@/core/xray'
import { logger } from '@/core/logger'
import { DefaultApiFormatNarrativeRequest } from '@/@types/openapi-internal/RequestParameters'
import { ruleNarratives } from '@/services/copilot/rule-narratives'
import { reasonNarratives } from '@/services/copilot/reason-narratives'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { AIAttribute } from '@/@types/openapi-internal/AIAttribute'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { ask } from '@/utils/openapi'

type GenerateCaseNarrative = {
  _case: Case
  user: InternalBusinessUser | InternalConsumerUser
  reasons: CaseReasons[]
  transactions: InternalTransaction[]
}
type GenerateSarNarrative = {
  _case: Case
  transactions: InternalTransaction[]
  user: InternalBusinessUser | InternalConsumerUser
  reasons: CaseReasons[]
}

const PROMPT = `Please provide the same text but use placeholders or data from the JSON blob below to replace all the numerical data and qualitative decisions in the given format above. Please keep the exact same format for the text, without headers, explanations, or any additional content`
const PLACEHOLDER_NARRATIVE = `OVERVIEW
User: [user]
Date of Case Generation: [caseGenerationDate]
Reason for Case Generation: [ruleHitNames]
Investigation Period: [caseGenerationDate] - [caseClosureDate]
Closure Date: [caseClosureDate]

BACKGROUND
[This section should contain general details about the user in question.]

INVESTIGATION
[This section should detail the method of the investigation and the user's activities that took place during the investigation.]

FINDINGS AND ASSESSMENT
[This section should contain an analysis of the user's transactions and behaviors.]

SCREENING DETAILS
[This section should contain information about sanctions, politically exposed persons (PEP), or adverse media screening results. If there is no information like this it can be neglected.]

CONCLUSION`
const MAX_TOKEN_OUTPUT = 4096

@traceable
export class CopilotService {
  private readonly tenantId: string
  private mongoDb: MongoClient
  private dynamoDb: DynamoDBDocumentClient

  public static async new(
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<Credentials>
    >
  ) {
    const tenantId = event.requestContext.authorizer.principalId
    const connections = {
      mongoDb: await getMongoDbClient(),
      dynamoDb: await getDynamoDbClientByEvent(event),
    }
    return new this(tenantId, connections)
  }

  constructor(
    tenantId: string,
    connections: { mongoDb: MongoClient; dynamoDb: DynamoDBDocumentClient }
  ) {
    this.tenantId = tenantId
    this.mongoDb = connections.mongoDb
    this.dynamoDb = connections.dynamoDb
  }

  async getSarNarrative(
    request: GenerateSarNarrative
  ): Promise<NarrativeResponse> {
    const attributeBuilder = new AttributeGenerator(DefaultAttributeBuilders)
    const attributes = attributeBuilder.getAttributes({
      transactions: request.transactions || [],
      user: request.user,
      _case: request._case,
    })
    const ruleNarrs =
      request._case.alerts?.map(
        (a) => ruleNarratives.find((rn) => rn.id === a.ruleId)?.narrative
      ) || []

    if (ruleNarrs.length === 0) {
      throw new Error('Unable to generate narrative for this SAR')
    }

    const aiFieldsEnabled = await this.getAllEnabledAttribues()

    const content = `
    The following is a template for suspicious activity report written by bank staff to justify why they are reporting a customer to the financial authorities.
    
    Example:
    ${ruleNarrs.join(',')}"
    
    Please fill in the template above with relevant data from the following JSON blob maintaining the exact same structure and correct any spelling mistakes or grammatical errors:
    
    ${JSON.stringify([...attributes.entries()])}
    `.slice(0, MAX_TOKEN_OUTPUT)

    const response = await this.gpt(content)

    return {
      narrative: response.replace(PROMPT, ''),
      attributes: [...attributes.entries()].map((f) => {
        const [attribute, { value, secret }] = f
        return {
          attribute,
          value,
          secret:
            secret ?? !aiFieldsEnabled?.includes(attribute as AIAttribute),
        }
      }),
    }
  }

  private async getAllEnabledAttribues(): Promise<AIAttribute[]> {
    const tenantRepository = new TenantRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })

    const tenantSettings = await tenantRepository.getTenantSettings([
      'aiFieldsEnabled',
    ])

    return tenantSettings?.aiFieldsEnabled || []
  }

  async getCaseNarrative(
    request: GenerateCaseNarrative
  ): Promise<NarrativeResponse> {
    const attributeBuilder = new AttributeGenerator(DefaultAttributeBuilders)
    const attributes = attributeBuilder.getAttributes({
      transactions: request.transactions || [],
      user: request.user,
      _case: request._case,
    })

    const reasonNarrs = request.reasons.map(
      (reason) => reasonNarratives.find((rn) => rn.reason === reason)?.narrative
    )
    const aiFieldsEnabled = await this.getAllEnabledAttribues()

    const content = `
    The following is a template for document written by bank staff to justify why they have or have not reported a customer to the financial authorities.
    
    Example:
    "${PLACEHOLDER_NARRATIVE}
    ${reasonNarrs.join(',')}"
    
    The following text and data are various pieces of information relevant to a single customer who is under investigation by the bank staff, please rewrite this information so that it conforms to the template above and correct any spelling mistakes or grammatical errors.
    
    ${JSON.stringify([...attributes.entries()])}
    `.slice(0, MAX_TOKEN_OUTPUT)

    const response = await this.gpt(content)
    return {
      narrative: response.replace(PROMPT, ''),
      attributes: [...attributes.entries()].map((f) => {
        const [attribute, entry] = f
        return {
          attribute,
          value: entry.value,
          secret:
            entry.secret ??
            !aiFieldsEnabled?.includes(attribute as AIAttribute),
        }
      }),
    }
  }

  async formatNarrative(
    request: DefaultApiFormatNarrativeRequest
  ): Promise<NarrativeResponse> {
    const narrative = await this.gpt(
      `Please correct any spelling or grammatical errors in the following text and make it sound professional: "${request.FormatRequest.narrative}"`
    )
    return {
      narrative,
      attributes: [],
    }
  }

  private async gpt(prompt: string): Promise<string> {
    logger.info(prompt)
    try {
      return ask(prompt)
    } catch (e) {
      logger.error(e)
      throw e
    }
  }
}
