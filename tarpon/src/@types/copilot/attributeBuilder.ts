import { AttributeSet } from '@/services/copilot/attributes/attribute-set'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { Case } from '@/@types/openapi-internal/Case'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { Alert } from '@/@types/openapi-internal/Alert'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { SanctionsHit } from '@/@types/openapi-internal/SanctionsHit'
import { CurrencyExchangeUSDType } from '@/services/currency'

export type InputData = {
  transactions?: InternalTransaction[]
  user: InternalConsumerUser | InternalBusinessUser
  _case?: Case
  ruleInstances?: RuleInstance[]
  reasons: Array<string>
  _alerts?: Alert[]
  exchangeRates: CurrencyExchangeUSDType['rates']
  currentTransaction?: InternalTransaction
  originUser?: InternalUser
  destinationUser?: InternalUser
  sanctionsHits?: SanctionsHit[]
}

export interface AttributeBuilder {
  dependencies(): BuilderKey[]

  build(attributes: AttributeSet, inputData: InputData): void
}

// Obfuscatable attributes are ones that we can safely search and replace in the prompt. An example of one that isn't would be
// transaction amount - we can't search and replace for a transaction amount of "1" for example, because it will replace all "1"'s
// with a placeholder, leading to a jargon prompt. Fields like this are instead removed from the prompt.

export type AttributeBuilders = {
  transactions: AttributeBuilder
  user: AttributeBuilder
  _case: AttributeBuilder
  _alerts: AttributeBuilder
  currentTransaction: AttributeBuilder
}

export type BuilderKey = keyof AttributeBuilders
