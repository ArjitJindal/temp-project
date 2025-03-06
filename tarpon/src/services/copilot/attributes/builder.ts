import { CurrencyExchangeUSDType } from '../../currency'
import { AlertAttributeBuilder } from './alert-attribute-builder'
import { CurrentTransactionBuilder } from './transaction-attribute-builder'
import { AttributeSet } from './attribute-set'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { TransactionsBuilder } from '@/services/copilot/attributes/transactions-attribute-builder'
import { UserAttributeBuilder } from '@/services/copilot/attributes/user-attribute-builder'
import { Case } from '@/@types/openapi-internal/Case'
import { CaseAttributeBuilder } from '@/services/copilot/attributes/case-attribute-builder'
import { AIAttribute } from '@/@types/openapi-internal/AIAttribute'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { Alert } from '@/@types/openapi-internal/Alert'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { SanctionsHit } from '@/@types/openapi-internal/SanctionsHit'

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

type AttributeBuilders = {
  transactions: AttributeBuilder
  user: AttributeBuilder
  _case: AttributeBuilder
  _alerts: AttributeBuilder
  currentTransaction: AttributeBuilder
}

export const DefaultAttributeBuilders: AttributeBuilders = {
  transactions: new TransactionsBuilder(),
  user: new UserAttributeBuilder(),
  _case: new CaseAttributeBuilder(),
  _alerts: new AlertAttributeBuilder(),
  currentTransaction: new CurrentTransactionBuilder(),
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
    this.builders.transactions.build(attributes, inputData)
    this.builders.currentTransaction.build(attributes, inputData)
    this.builders._alerts.build(attributes, inputData)

    return attributes
  }
}
