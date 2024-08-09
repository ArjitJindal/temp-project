import { memoize } from 'lodash'
import { getMlModelsSample } from '../samplers/ml-models'
import { RuleMLModel } from '@/@types/openapi-internal/RuleMLModel'

export const getMlModels: () => RuleMLModel[] = memoize(() =>
  getMlModelsSample()
)
