import { AIAttribute } from '@/@types/openapi-internal/AIAttribute'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { RuleNature } from '@/@types/openapi-internal/RuleNature'
import { NarrativeResponseAttributes } from '@/@types/openapi-internal/NarrativeResponseAttributes'

export type RuleAttribute = {
  id?: string
  name?: string
  checksFor?: any
  types?: any
  typologies?: any
  sampleUseCases?: any
  logic?: any
  logicAggregationVariables?: any
  nature?: RuleNature
  narrative?: string
}

interface AttributeTypes extends Record<AIAttribute, any> {
  userType: string
  country: string
  reasons: string[]
  rules: RuleAttribute[]
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
  alertGenerationDate: string
  originUser: InternalConsumerUser | InternalBusinessUser
  destinationUser: InternalConsumerUser | InternalBusinessUser
  originTransactionAmount: number
  destinationTransactionAmount: number
  originTransactionCurrency: string
  destinationTransactionCurrency: string
  originTransactionCountry: string
  destinationTransactionCountry: string
  originPaymentDetails: PaymentDetails
  destinationPaymentDetails: PaymentDetails
  timeOfTransaction: string
  sanctionsHitDetails: Partial<
    SanctionsEntity & { sanctionsHitId: string; score: number }
  >[]
}

const ObfuscatableAttributePlaceholders: Partial<Record<AIAttribute, string>> =
  {
    name: 'Robert',
    websites: 'www.google.com',
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

    const cleanAttributes = Object.fromEntries(
      Object.entries(attributes.entries()).filter(([_, value]) => {
        if (Array.isArray(value)) {
          return value.length > 0
        }

        if (typeof value === 'object') {
          return Object.keys(value).length > 0
        }

        if (typeof value === 'string') {
          return value?.trim()?.length > 0
        }

        return value !== undefined && value !== null
      })
    )

    let serialisedAttributes = JSON.stringify(cleanAttributes)

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

  async copy(): Promise<AttributeSet> {
    return new AttributeSet(this.enabledAttributes, this)
  }
}
