import { MongoClient } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { Credentials } from '@aws-sdk/client-sts'
import { isV8RuleInstance } from '../rules-engine/utils'
import { RULES_LIBRARY } from '../rules-engine/transaction-rules/library'
import {
  AttributeGenerator,
  AttributeSet,
  DefaultAttributeBuilders,
} from './attributes/builder'
import { AI_SOURCES } from './attributes/ai-sources'
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
import { ask, ModelVersion } from '@/utils/openai'
import { getContext, tenantSettings } from '@/core/utils/context'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { RuleNature } from '@/@types/openapi-internal/RuleNature'

type GenerateNarrative = {
  _case: Case
  user: InternalBusinessUser | InternalConsumerUser
  reasons: CaseReasons[]
  transactions: InternalTransaction[]
  ruleInstances?: RuleInstance[]
}

const SEPARATOR = '----'
const PROMPT = `Please provide the same text but use placeholders or data from the JSON blob below to replace all the numerical data and qualitative decisions in the given format above. Please keep the exact same format for the text, without headers, explanations, or any additional content`

const PLACEHOLDER_NARRATIVE = (
  type: string,
  ruleNatures: RuleNature[] = []
) => {
  const isScreening = ruleNatures.some((r) => r === 'SCREENING')
  const overview = `OVERVIEW \nName: [name] \nDate of Case Generation: [caseGenerationDate] \nReason for Case Generation: [ruleHitNames] \nInvestigation Period: [caseGenerationDate] - [closureDate] \nClosure Date: [closureDate] \n\n`
  const background = `BACKGROUND \n[This section should contain general details about the ${type} in question.] \n\n`
  const investigation = `INVESTIGATION \n[This section should detail the method of the investigation and the ${type}'s activities that took place during the investigation.] \n\n`
  const findings = `FINDINGS AND ASSESSMENT \n[This section should contain an analysis of the ${type}'s transactions and behaviors.] \n\n`
  const screening = `SCREENING DETAILS \n[This section should contain information about sanctions, politically exposed persons (PEP), or adverse media screening results. If there is no information like this it can be neglected.] \n\n`
  const conclusion = `CONCLUSION`

  if (isScreening) {
    return (
      overview + background + investigation + findings + screening + conclusion
    )
  }

  return overview + background + investigation + findings + conclusion
}

const MAX_TOKEN_OUTPUT = 4096

// Obfuscatable attributes are ones that we can safely search and replace in the prompt. An example of one that isn't would be
// transaction amount - we can't search and replace for a transaction amount of "1" for example, because it will replace all "1"'s
// with a placeholder, leading to a jargon prompt. Fields like this are instead removed from the prompt.
const ObfuscatableAttributePlaceholders: Partial<Record<AIAttribute, string>> =
  {
    name: 'Robert Marsh',
    websites: 'www.google.com',
  }

@traceable
export class CopilotService {
  private readonly tenantId: string
  private readonly mongoDb: MongoClient
  private readonly dynamoDb: DynamoDBDocumentClient

  public static async new(
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<Credentials>
    >
  ) {
    const tenantId = event.requestContext.authorizer.principalId
    const connections = {
      mongoDb: await getMongoDbClient(),
      dynamoDb: getDynamoDbClientByEvent(event),
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
    request: GenerateNarrative
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

    return this.generate(
      `
    The following is a template for suspicious activity report written by bank staff to justify why they are reporting a ${
      request.user.type === 'BUSINESS' ? 'business' : 'customer'
    } to the financial authorities.
    
    Example:
    ${ruleNarrs.join(',')}"
    
    Please fill in the template above with relevant data from the following JSON blob maintaining the exact same structure and correct any spelling mistakes or grammatical errors:
    `,
      attributes
    )
  }

  private async getEnabledAttributes(): Promise<AIAttribute[]> {
    const settings = await tenantSettings(this.tenantId)

    return AI_SOURCES.filter(
      (s) =>
        !s.isPii &&
        (settings.aiSourcesDisabled == undefined ||
          settings.aiSourcesDisabled.indexOf(s.sourceName) < 0)
    ).map((a) => a.sourceName)
  }

  async getCaseNarrative(
    request: GenerateNarrative
  ): Promise<NarrativeResponse> {
    const attributeBuilder = new AttributeGenerator(DefaultAttributeBuilders)
    const attributes = attributeBuilder.getAttributes({
      transactions: request.transactions || [],
      user: request.user,
      _case: request._case,
      ruleInstances: request.ruleInstances,
    })

    const prompt = this.generateNarrativePrompt(request)

    return this.generate(prompt, attributes)
  }

  private generateNarrativePrompt(request: GenerateNarrative) {
    const customerType =
      request.user.type === 'BUSINESS' ? 'business' : 'customer'

    const narrativeSize = getContext()?.settings?.narrativeMode ?? 'STANDARD'

    const reasonNarrs = request.reasons.map(
      (reason) => reasonNarratives.find((rn) => rn.reason === reason)?.narrative
    )

    const ruleNatures = request.ruleInstances?.map((r) => r.nature) || []

    let string = `The following is a template for a document written by bank staff to justify why they have or have not reported a suspicious ${customerType} to the financial authorities.`
    string += `\n\n${SEPARATOR}\n\n`

    if (narrativeSize === 'STANDARD') {
      string += PLACEHOLDER_NARRATIVE(customerType, ruleNatures)
      string += `\n\n${SEPARATOR}\n\n`
    }

    string += reasonNarrs.join(', ')

    string += `The following JSON blob is information relevant to a single ${customerType} who is under investigation by bank staff.\n\n`

    if (request.ruleInstances?.length) {
      string += `Here is information about the rules that were triggered`

      request.ruleInstances.forEach((ruleInstance) => {
        string += `\n\nRule: ${ruleInstance.ruleNameAlias}\n`
        string += `Description: ${ruleInstance.ruleDescriptionAlias}\n`
        string += `Rule nature: ${ruleInstance.nature}\n`

        if (!isV8RuleInstance(ruleInstance)) {
          const rule = RULES_LIBRARY.find((r) => r.id === r.id)
          if (rule) {
            string += `Checks for: ${rule.checksFor.join(', ')}\n`
            string += `Rule types: ${rule.types.join(', ')}\n`
            string += `Typologies: ${rule.typologies.join(', ')}\n`
            string += `Sample use cases: ${rule.sampleUseCases}\n`
          }
        } else {
          string += `Rule logic: ${JSON.stringify(ruleInstance.logic)}\n`
          string += `Logic aggregation variables: ${JSON.stringify(
            ruleInstance.logicAggregationVariables
          )}\n`
        }

        string += `\n`
      })

      string += `\n\n${SEPARATOR}\n\n`
    }

    if (narrativeSize === 'STANDARD') {
      string += `Please rewrite this information so that it conforms to the template above.`
    } else {
      string += `Please write a narrative strictly in a paragraph (no verbose) straightforward way that explains the ${customerType}'s activities and why they are being reported to the financial authorities.`
      string += `\n\n${SEPARATOR}\n\n`
      string += `No detailed information is required about rule, case or any transaction details accomodate everything in a single paragraph and in a very concise and professional manner.`
    }

    string += `\n\n${SEPARATOR}\n\n`

    string += `The following JSON blob is information relevant to a single ${customerType} who is under investigation by bank staff, please rewrite this information so that it conforms to the template above. This case is being closed for the following reasons: ${request.reasons.join(
      ', '
    )}.`

    return string
  }

  private async generate(prompt: string, attributes: AttributeSet) {
    const originalAttributes = [...attributes.entries()]
    const enabledAttributes = await this.getEnabledAttributes()

    // For disabled attributes that we can't obfuscate, remove them before sending result to GPT.
    originalAttributes.forEach(([attributeName]) => {
      const placeholder = ObfuscatableAttributePlaceholders[attributeName]
      if (
        !enabledAttributes.includes(attributeName) &&
        placeholder == undefined
      ) {
        attributes.deleteAttribute(attributeName)
      }
    })

    let serialisedAttributes = JSON.stringify(
      Object.fromEntries(attributes.entries())
    )

    // For disabled attributes that we can obfuscate, obfuscate.
    originalAttributes.forEach(([attributeName, value]) => {
      const placeholder = ObfuscatableAttributePlaceholders[attributeName]
      if (placeholder !== undefined) {
        if (Array.isArray(value)) {
          value.forEach((v) => {
            if (v) {
              serialisedAttributes = serialisedAttributes.replace(
                new RegExp(v.toString(), 'g'),
                placeholder
              )
            }
          })
        } else {
          if (value) {
            serialisedAttributes = serialisedAttributes.replace(
              new RegExp(value.toString(), 'g'),
              placeholder
            )
          }
        }
      }
    })

    const promptWithContext = `${prompt}\n\n${serialisedAttributes}`.slice(
      0,
      MAX_TOKEN_OUTPUT
    )

    let response = ''
    for (let i = 0; i < 3; i++) {
      try {
        response = await this.gpt(promptWithContext)
        break
      } catch (e) {
        console.log(e)
      }
    }

    // Add back the obfuscated values and try and search & replace any attribute value placeholders that are in the response.
    originalAttributes.forEach(([attributeName, value]) => {
      if (!value) {
        return
      }
      const placeholder = ObfuscatableAttributePlaceholders[attributeName]
      if (!enabledAttributes.includes(attributeName) && placeholder) {
        if (Array.isArray(value)) {
          value.forEach((v) => {
            if (v) {
              response = response.replace(
                new RegExp(placeholder, 'g'),
                v.toString()
              )
            }
          })
        } else {
          response = response.replace(
            new RegExp(placeholder, 'g'),
            value.toString()
          )
        }
      }

      response = response.replace(
        new RegExp(`\\[${attributeName}]`, 'g'),
        Array.isArray(value) ? value.join(', ') : value.toString()
      )
    })

    // Clean up response
    response = response
      .replace(new RegExp(SEPARATOR, 'g'), '')
      .replace(new RegExp(PROMPT, 'g'), '')
      .trim()

    return {
      narrative: response,
      attributes: originalAttributes.map((f) => {
        const [attribute, value] = f
        const v = value ? value.toString() : ''
        return {
          attribute,
          value: v.length === 0 ? '-' : v,
          secret: !enabledAttributes?.includes(attribute),
        }
      }),
    }
  }

  async formatNarrative(
    request: DefaultApiFormatNarrativeRequest
  ): Promise<NarrativeResponse> {
    return await this.generate(
      `Please correct any spelling or grammatical errors in the following text and make it sound professional: "${request.FormatRequest.narrative}"`,
      new AttributeSet()
    )
  }

  private async gpt(prompt: string): Promise<string> {
    logger.info(prompt)
    try {
      return ask(prompt, { temperature: 0.5, modelVersion: ModelVersion.GPT4O })
    } catch (e) {
      logger.error(e)
      throw e
    }
  }
}
