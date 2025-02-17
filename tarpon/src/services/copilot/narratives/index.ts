import { AttributeSet } from '../attributes/builder'
import { NarrativeType } from '@/@types/openapi-internal/NarrativeType'

export type ReasonNarrative<T extends string = string> = {
  reason: T
  narrative: string
}

export abstract class BaseNarrativeService<T extends object> {
  protected readonly additionalInfo: T
  protected readonly attributes: AttributeSet

  constructor(additionalInfo: T, attributes: AttributeSet) {
    this.additionalInfo = additionalInfo
    this.attributes = attributes
  }

  public abstract readonly type: NarrativeType
  public abstract readonly textType: 'PLAIN' | 'MARKDOWN'
  public abstract reasonNarratives(): ReasonNarrative<string>[]
  public abstract placeholderNarrative(): string
  public abstract introductoryNarrative(): string
  public abstract closingNarrative(): string
}
