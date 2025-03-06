import { compact, isEmpty, isNil, omitBy, uniqBy } from 'lodash'
import { ruleNarratives } from '../rule-narratives'
import { AttributeBuilder, BuilderKey, InputData } from './builder'
import { AttributeSet, RuleAttribute } from './attribute-set'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { getUserName } from '@/utils/helpers'
import { calculateLevenshteinDistancePercentage } from '@/utils/search'
import { RULES_LIBRARY } from '@/services/rules-engine/transaction-rules/library'

export class AlertAttributeBuilder implements AttributeBuilder {
  dependencies(): BuilderKey[] {
    return ['_alerts']
  }

  build(attributes: AttributeSet, inputData: InputData) {
    const alerts = inputData._alerts || []

    if (!alerts?.length) {
      return
    }

    attributes.setAttribute(
      'alertComments',
      compact(alerts.map((a) => a.comments?.map((c) => c.body)).flat()) || []
    )

    if (!attributes.getAttribute('reasons')) {
      attributes.setAttribute('reasons', inputData.reasons)
    }

    if (inputData._alerts?.[0]) {
      attributes.setAttribute(
        'alertGenerationDate',
        new Date(alerts?.[0]?.createdTimestamp || 0).toLocaleDateString()
      )
    }

    attributes.setAttribute('alertActionDate', new Date().toLocaleDateString())

    const rules: RuleAttribute[] = alerts.map((a) => {
      const ruleInstance = inputData.ruleInstances?.find(
        (ri) => ri.id === a.ruleInstanceId
      )
      const rule = RULES_LIBRARY.find((r) => r.id === ruleInstance?.ruleId)

      return omitBy(
        {
          id: ruleInstance?.ruleId || a.ruleId,
          checksFor: ruleInstance?.checksFor,
          types: rule?.types,
          typologies: rule?.typologies,
          sampleUseCases: rule?.sampleUseCases,
          logic: ruleInstance?.logic,
          logicAggregationVariables: ruleInstance?.logicAggregationVariables,
          name: ruleInstance?.ruleNameAlias || a.ruleName,
          narrative:
            ruleNarratives.find((rn) => rn.id === ruleInstance?.ruleId)
              ?.narrative || '',
          nature: ruleInstance?.nature || a.ruleNature,
        },
        (value) => isNil(value) || isEmpty(value)
      )
    })

    attributes.setAttribute('rules', uniqBy(rules, 'id'))

    if (inputData.sanctionsHits?.length) {
      const name = getUserName(inputData.user)
      const data: Partial<
        SanctionsEntity & { sanctionsHitId: string; score: number }
      >[] = inputData.sanctionsHits?.map((sh) => ({
        sanctionsHitId: sh.sanctionsHitId,
        score:
          sh.score ||
          calculateLevenshteinDistancePercentage(name, sh.entity.name),
        name: sh.entity.name,
        entityType: sh.entity.entityType,
        matchTypes: sh.entity.matchTypes,
        matchTypeDetails: sh.entity.matchTypeDetails,
        mediaSources: sh.entity.mediaSources?.map((ms) => ({
          name: ms.name,
        })),
      }))

      const uniqById = uniqBy(data, 'sanctionsHitId')

      uniqById.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 10)

      attributes.setAttribute(
        'sanctionsHitDetails',
        uniqById.map((sh) => {
          delete sh.score
          delete sh.sanctionsHitId
          return sh
        })
      )
    }
  }
}
