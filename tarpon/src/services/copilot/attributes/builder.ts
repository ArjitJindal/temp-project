import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { TransactionsBuilder } from '@/services/copilot/attributes/transactions-attribute-builder'
import { UserAttributeBuilder } from '@/services/copilot/attributes/user-attribute-builder'
import { Case } from '@/@types/openapi-internal/Case'
import { CaseAttributeBuilder } from '@/services/copilot/attributes/case-attribute-builder'
import { AIAttribute } from '@/@types/openapi-internal/AIAttribute'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'

export type InputData = {
  transactions: InternalTransaction[]
  user: InternalConsumerUser | InternalBusinessUser
  _case?: Case
  ruleInstances?: RuleInstance[]
}

export interface AttributeBuilder {
  dependencies(): BuilderKey[]

  build(attributes: AttributeSet, inputData: InputData): void
}

export type AttributeValue = string | number | undefined | Array<AttributeValue>

export class AttributeSet extends Map<AIAttribute, AttributeValue> {
  getAttribute(key: AIAttribute) {
    if (!this.has(key)) {
      return undefined
    }
    return this.get(key)
  }
  setAttribute(key: AIAttribute, value: AttributeValue) {
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
  constructor(builders: AttributeBuilders) {
    this.builders = builders
  }

  public getAttributes(inputData: InputData): AttributeSet {
    const attributes = new AttributeSet()

    // Currently just running attribute builders in the correct order.
    // As we add more we could traverse the dependency tree
    // automatically using some DAG algorithm like Kahn's algorithm.
    this.builders.user.build(attributes, inputData)
    this.builders._case.build(attributes, inputData)
    this.builders.transaction.build(attributes, inputData)
    return attributes
  }
}
