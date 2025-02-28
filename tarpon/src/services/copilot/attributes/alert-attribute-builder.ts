import { compact, uniq, uniqBy } from 'lodash'
import {
  AttributeBuilder,
  AttributeSet,
  BuilderKey,
  InputData,
} from './builder'

import { mapRuleAttributes } from './utils/ruleAttributeMapper'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { getUserName } from '@/utils/helpers'
import { calculateLevenshteinDistancePercentage } from '@/utils/search'

export class AlertAttributeBuilder implements AttributeBuilder {
  dependencies(): BuilderKey[] {
    return ['_alerts']
  }

  build(attributes: AttributeSet, inputData: InputData) {
    if (!inputData._alerts?.length) {
      return
    }

    attributes.setAttribute(
      'alertComments',
      compact(
        (inputData._alerts || [])
          .map((a) => a.comments?.map((c) => c.body))
          .flat()
      ) || []
    )

    if (!attributes.getAttribute('reasons')) {
      attributes.setAttribute('reasons', inputData.reasons)
    }

    if (inputData._alerts?.[0]) {
      attributes.setAttribute(
        'alertGenerationDate',
        new Date(
          inputData._alerts?.[0]?.createdTimestamp || 0
        ).toLocaleDateString()
      )
    }

    attributes.setAttribute('alertActionDate', new Date().toLocaleDateString())

    attributes.setAttribute(
      'rules',
      mapRuleAttributes(inputData.ruleInstances || [])
    )

    const alertRuleHitNames = inputData._alerts?.map((a) => a.ruleName || '')

    alertRuleHitNames.push(
      ...(inputData.ruleInstances?.map((ri) => ri.ruleNameAlias || '') || [])
    )

    if (alertRuleHitNames.length) {
      attributes.setAttribute('ruleHitNames', uniq(alertRuleHitNames))
    }

    const alertRuleHitDescriptions = inputData._alerts?.map(
      (a) => a.ruleDescription || ''
    )

    alertRuleHitDescriptions.push(
      ...(inputData.ruleInstances?.map((ri) => ri.ruleDescriptionAlias || '') ||
        [])
    )

    if (alertRuleHitDescriptions.length) {
      attributes.setAttribute(
        'ruleHitDescriptions',
        uniq(alertRuleHitDescriptions)
      )
    }

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
          media: ms.media?.map((m) => ({ title: m.title })),
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
