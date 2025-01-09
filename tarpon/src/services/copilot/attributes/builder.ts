import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { TransactionsBuilder } from '@/services/copilot/attributes/transactions-attribute-builder'
import { UserAttributeBuilder } from '@/services/copilot/attributes/user-attribute-builder'
import { Case } from '@/@types/openapi-internal/Case'
import { CaseAttributeBuilder } from '@/services/copilot/attributes/case-attribute-builder'
import { AIAttribute } from '@/@types/openapi-internal/AIAttribute'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { RuleNature } from '@/@types/openapi-public/RuleNature'
import { NarrativeResponseAttributes } from '@/@types/openapi-internal/NarrativeResponseAttributes'

export type InputData = {
  transactions: InternalTransaction[]
  user: InternalConsumerUser | InternalBusinessUser
  _case?: Case
  ruleInstances?: RuleInstance[]
  reasons: Array<string>
}

export interface AttributeBuilder {
  dependencies(): BuilderKey[]

  build(attributes: AttributeSet, inputData: InputData): void
}

// Obfuscatable attributes are ones that we can safely search and replace in the prompt. An example of one that isn't would be
// transaction amount - we can't search and replace for a transaction amount of "1" for example, because it will replace all "1"'s
// with a placeholder, leading to a jargon prompt. Fields like this are instead removed from the prompt.
const ObfuscatableAttributePlaceholders: Partial<Record<AIAttribute, string>> =
  {
    name: 'Robert Marsh',
    websites: 'www.google.com',
  }

interface AttributeTypes extends Record<AIAttribute, any> {
  userType: string
  country: string
  rules: {
    name?: string
    checksFor?: any
    types?: any
    typologies?: any
    sampleUseCases?: any
    logic?: any
    logicAggregationVariables?: any
    nature?: RuleNature
    narrative?: string
  }[]
  caseComments: string[]
  alertComments: string[]
  userComments: string[]
  caseGenerationDate: string
  firstPaymentAmount: string
  transactionsCount: number
  minAmount: string
  maxAmount: string
  totalTransactionAmount: string
  averageTransactionAmount: string
  name: string
  websites: string[]
  closureDate: string
  industry: string[]
  productsSold: string[]
  transactionIds: string[]
  ruleHitNames: string[]
}
type AttributeValue<T extends AIAttribute> = T extends keyof AttributeTypes
  ? AttributeTypes[T]
  : never

export class AttributeSet extends Map<
  AIAttribute,
  AttributeValue<AIAttribute>
> {
  private enabledAttributes: AIAttribute[]
  constructor(enabledAttributes: AIAttribute[], attributes?: AttributeSet) {
    super(attributes)
    this.enabledAttributes = enabledAttributes
  }

  getAttribute<K extends AIAttribute>(key: K): AttributeValue<K> | undefined {
    if (!this.has(key)) {
      return undefined
    }
    return this.get(key) as AttributeValue<K>
  }
  setAttribute<K extends AIAttribute>(
    key: K,
    value: AttributeValue<K> | undefined
  ) {
    if (this.has(key)) {
      throw new Error(
        `Value already set for ${key}. Dependencies mapped incorrectly.`
      )
    }
    return this.set(key, value)
  }
  deleteAttribute(key: AIAttribute) {
    this.delete(key)
  }
  async serialise(): Promise<string> {
    const attributes = new AttributeSet(this.enabledAttributes, this)
    const originalAttributes = [...this.entries()]

    // For disabled attributes that we can't obfuscate, remove them before sending result to GPT.
    originalAttributes.forEach(([attributeName]) => {
      const placeholder = ObfuscatableAttributePlaceholders[attributeName]
      if (
        !this.enabledAttributes.includes(attributeName) &&
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

    return serialisedAttributes
  }

  async inject(response: string) {
    const originalAttributes = [...this.entries()]

    // Add back the obfuscated values and try and search & replace any attribute value placeholders that are in the response.
    originalAttributes.forEach(([attributeName, value]) => {
      if (!value) {
        return
      }
      const placeholder = ObfuscatableAttributePlaceholders[attributeName]
      if (!this.enabledAttributes.includes(attributeName) && placeholder) {
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

    return response
  }

  async present(
    attributes: AttributeSet
  ): Promise<Array<NarrativeResponseAttributes>> {
    return [...attributes.entries()].map((f) => {
      const [attribute, value] = f
      let v = ''
      if (typeof value === 'object') {
        v = JSON.stringify(value)
      } else if (value) {
        v = value.toString()
      }
      return {
        attribute,
        value: v.length === 0 ? '-' : v,
        secret: !this.enabledAttributes.includes(attribute),
      }
    })
  }
}

type AttributeBuilders = {
  transaction: AttributeBuilder
  user: AttributeBuilder
  _case: AttributeBuilder
}

export const DefaultAttributeBuilders: AttributeBuilders = {
  transaction: new TransactionsBuilder(),
  user: new UserAttributeBuilder(),
  _case: new CaseAttributeBuilder(),
}

export type BuilderKey = keyof AttributeBuilders

export class AttributeGenerator {
  builders: AttributeBuilders
  private enabledAttributes: AIAttribute[]
  constructor(builders: AttributeBuilders, enabledAttributes: AIAttribute[]) {
    this.builders = builders
    this.enabledAttributes = enabledAttributes
  }

  public async getAttributes(inputData: InputData): Promise<AttributeSet> {
    const attributes = new AttributeSet(this.enabledAttributes)

    // Currently just running attribute builders in the correct order.
    // As we add more we could traverse the dependency tree
    // automatically using some DAG algorithm like Kahn's algorithm.
    this.builders.user.build(attributes, inputData)
    this.builders._case.build(attributes, inputData)
    this.builders.transaction.build(attributes, inputData)
    return attributes
  }
}
