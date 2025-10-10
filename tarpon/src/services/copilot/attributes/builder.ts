import { AlertAttributeBuilder } from './alert-attribute-builder'
import { CurrentTransactionBuilder } from './transaction-attribute-builder'
import { AttributeSet } from './attribute-set'
import { InputData, AttributeBuilders } from '@/@types/copilot/attributeBuilder'
import { TransactionsBuilder } from '@/services/copilot/attributes/transactions-attribute-builder'
import { UserAttributeBuilder } from '@/services/copilot/attributes/user-attribute-builder'
import { CaseAttributeBuilder } from '@/services/copilot/attributes/case-attribute-builder'
import { AIAttribute } from '@/@types/openapi-internal/AIAttribute'

export const DefaultAttributeBuilders: AttributeBuilders = {
  transactions: new TransactionsBuilder(),
  user: new UserAttributeBuilder(),
  _case: new CaseAttributeBuilder(),
  _alerts: new AlertAttributeBuilder(),
  currentTransaction: new CurrentTransactionBuilder(),
}

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
