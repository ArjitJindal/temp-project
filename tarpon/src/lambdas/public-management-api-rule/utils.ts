import { Rule } from '@/@types/openapi-internal/Rule'
import { Rule as PublicRule } from '@/@types/openapi-public-management/Rule'

export function toPublicRule(rule: Rule): PublicRule {
  return {
    id: rule.id,
    type: rule.type,
    name: rule.name,
    description: rule.description,
    parametersSchema: rule.parametersSchema,
    defaultParameters: rule.defaultParameters,
    defaultRiskLevelParameters: rule.defaultRiskLevelParameters,
    defaultAction: rule.defaultAction,
    defaultRiskLevelActions: rule.defaultRiskLevelActions,
    labels: rule.labels,
    defaultCasePriority: rule.defaultCasePriority,
    defaultNature: rule.defaultNature,
    checksFor: rule.checksFor,
    types: rule.types,
    typologies: rule.typologies,
    sampleUseCases: rule.sampleUseCases,
  }
}
