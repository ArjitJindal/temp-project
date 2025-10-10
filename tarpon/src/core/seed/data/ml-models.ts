import memoize from 'lodash/memoize'
import { getMlModelsSample } from '../samplers/ml-models'
import { RuleMLModel } from '@/@types/openapi-internal/RuleMLModel'

export const getMlModels: () => RuleMLModel[] = memoize(() =>
  getMlModelsSample()
)
