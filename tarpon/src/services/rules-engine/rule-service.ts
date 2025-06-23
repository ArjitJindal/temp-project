import Ajv, { ValidateFunction } from 'ajv'
import createHttpError, { BadRequest } from 'http-errors'
import { removeStopwords, eng } from 'stopword'
import { cloneDeep, compact, concat, isEmpty, set, uniq, unset } from 'lodash'
import { replaceMagicKeyword } from '@flagright/lib/utils/object'
import { DEFAULT_CURRENCY_KEYWORD } from '@flagright/lib/constants/currency'
import { singular } from 'pluralize'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { AsyncLogicEngine } from 'json-logic-engine'
import { MongoClient } from 'mongodb'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { MachineLearningRepository } from '../machine-learning/machine-learning-repository'
import { getLogicVariableByKey } from '../logic-evaluator/variables'
import { getJsonLogicEngine, LogicEvaluator } from '../logic-evaluator/engine'
import {
  canAggregate,
  getVariableKeysFromLogic,
} from '../logic-evaluator/engine/utils'
import {
  RuleChecksForField,
  RuleNature,
  RULES_LIBRARY,
  RuleTypeField,
  RuleTypology,
} from './transaction-rules/library'
import {
  TRANSACTION_FILTER_DEFAULT_VALUES,
  TRANSACTION_FILTERS,
  TRANSACTION_HISTORICAL_FILTERS,
  USER_FILTERS,
} from './filters'
import { assertValidRiskLevelParameters, isV8Rule } from './utils'
import { TRANSACTION_RULES } from './transaction-rules'
import { USER_ONGOING_SCREENING_RULES, USER_RULES } from './user-rules'
import { getTimeRangeByTimeWindows } from './utils/time-utils'
import { TimeWindow } from './utils/rule-parameter-schemas'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { Rule } from '@/@types/openapi-internal/Rule'
import { RuleRepository } from '@/services/rules-engine/repositories/rule-repository'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { RiskLevelRuleParameters } from '@/@types/openapi-internal/RiskLevelRuleParameters'
import { RiskLevel } from '@/@types/openapi-internal/RiskLevel'
import { mergeObjects } from '@/utils/object'
import { hasFeature, tenantSettings } from '@/core/utils/context'
import { traceable } from '@/core/xray'
import { RuleFilters } from '@/@types/openapi-internal/RuleFilters'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { FLAGRIGHT_TENANT_ID } from '@/core/constants'
import { RuleSearchFilter } from '@/@types/rule/rule-actions'
import { removePunctuation } from '@/utils/regex'
import { ask } from '@/utils/llms'
import { RulesSearchResponse } from '@/@types/openapi-internal/RulesSearchResponse'
import { scoreObjects } from '@/utils/search'
import { logger } from '@/core/logger'
import { getErrorMessage } from '@/utils/lang'
import { LogicAggregationVariable } from '@/@types/openapi-internal/LogicAggregationVariable'
import { notNullish } from '@/utils/array'
import { getS3Client } from '@/utils/s3'
import { envIs } from '@/utils/env'
import dayjs from '@/utils/dayjs'
import {
  DefaultApiGetRuleMlModelsRequest,
  DefaultApiGetRulesRequest,
  DefaultApiUpdateRuleMlModelModelIdRequest,
} from '@/@types/openapi-internal/RequestParameters'
import { LogicEntityVariableInUse } from '@/@types/openapi-internal/LogicEntityVariableInUse'
import { Feature } from '@/@types/openapi-internal/Feature'
import { auditLog, AuditLogReturnData } from '@/utils/audit-log'
import { ModelTier } from '@/utils/llms/base-service'

export const RULE_LOGIC_CONFIG_S3_KEY = 'rule-logic-config.json'

type AIFilters = {
  ruleTypes?: string[]
  checksFor?: string[]
  typologies?: string[]
  nature?: string[]
}
type FeatureRuleMapping = {
  feature: string
  rulesToRemove: string[]
}

const ALL_RULES = {
  ...TRANSACTION_RULES,
  ...USER_RULES,
  ...USER_ONGOING_SCREENING_RULES,
}

const RISK_LEVELS = RiskLevelRuleParameters.attributeTypeMap.map(
  (attribute) => attribute.name
) as Array<RiskLevel>

const ajv = new Ajv()
ajv.addKeyword('ui:schema')
ajv.addKeyword('enumNames')
ajv.addKeyword('labelProps')

@traceable
export class RuleService {
  tenantId: string
  dynamoDb: DynamoDBDocumentClient
  ruleRepository: RuleRepository
  ruleInstanceRepository: RuleInstanceRepository

  constructor(
    tenantId: string,
    connections: { dynamoDb: DynamoDBDocumentClient; mongoDb: MongoClient }
  ) {
    this.ruleRepository = new RuleRepository(tenantId, connections)
    this.ruleInstanceRepository = new RuleInstanceRepository(
      tenantId,
      connections
    )
    this.tenantId = tenantId
    this.dynamoDb = connections.dynamoDb
  }

  public static async syncRulesLibrary() {
    const dynamoDb = getDynamoDbClient()
    const mongoDb = await getMongoDbClient()
    const ruleRepository = new RuleRepository(FLAGRIGHT_TENANT_ID, {
      dynamoDb,
      mongoDb,
    })
    for (const rule of RULES_LIBRARY) {
      // If ui:order is not defined, set the order to be the order defined in each rule
      if (!rule.parametersSchema?.['ui:schema']?.['ui:order']) {
        set(
          rule.parametersSchema,
          `ui:schema.ui:order`,
          Object.keys(rule.parametersSchema.properties)
        )
      }
      await ruleRepository.createOrUpdateRule(rule)
    }
    console.info(`Synced ${RULES_LIBRARY.length} rules`)

    if (!envIs('local')) {
      const s3Client = getS3Client()
      const logicEvaluator = new LogicEvaluator(FLAGRIGHT_TENANT_ID, dynamoDb)
      // Upload v8Config in JSON format to S3 using s3Client
      await s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.SHARED_ASSETS_BUCKET,
          Key: RULE_LOGIC_CONFIG_S3_KEY,
          Body: JSON.stringify(logicEvaluator.getLogicConfig()),
        })
      )
    }
  }

  async getAllRuleFilters(): Promise<RuleFilters> {
    const mongoDb = await getMongoDbClient()
    const tenantRepository = new TenantRepository(
      this.ruleRepository.tenantId,
      { mongoDb, dynamoDb: this.ruleRepository.dynamoDb }
    )

    const filters = [
      ...Object.values(USER_FILTERS),
      ...Object.values(TRANSACTION_FILTERS),
      ...Object.values(TRANSACTION_HISTORICAL_FILTERS),
    ].map((filterClass) => (filterClass.getSchema() as any)?.properties || {})

    const defaultValues = [
      ...Object.values(TRANSACTION_FILTER_DEFAULT_VALUES),
    ].map((defaultValue) => {
      if (defaultValue && defaultValue?.getDefaultValues instanceof Function) {
        return defaultValue.getDefaultValues()
      }
    })
    const tenantSettings = await tenantRepository.getTenantSettings()
    const defaultCurrency = tenantSettings?.defaultValues?.currency
    const mergedFilters = mergeObjects({}, ...filters)

    return {
      schema: {
        type: 'object',
        properties: mergedFilters,
        'ui:schema': {
          'ui:order': Object.keys(mergedFilters),
        },
      },
      defaultValues: replaceMagicKeyword(
        mergeObjects({}, ...defaultValues),
        DEFAULT_CURRENCY_KEYWORD,
        defaultCurrency ?? 'USD'
      ),
    } as RuleFilters
  }

  private async getTenantSpecificRule(rule: Rule): Promise<Rule> {
    const updatedRule = cloneDeep(rule)
    const settings = await tenantSettings(this.ruleInstanceRepository.tenantId)

    // If custom CA search profile is set, we don't allow user to set the screening types
    if (settings.sanctions?.customSearchProfileId) {
      unset(updatedRule.parametersSchema, 'properties.screeningTypes')
    }
    return replaceMagicKeyword(
      updatedRule,
      DEFAULT_CURRENCY_KEYWORD,
      settings?.defaultValues?.currency ?? 'USD'
    ) as Rule
  }

  async getRuleById(ruleId: string): Promise<Rule | null> {
    const rule = await this.ruleRepository.getRuleById(ruleId)
    return rule ? this.getTenantSpecificRule(rule) : null
  }

  private hasRequiredFeaturesForRule(rule: Rule): boolean {
    return (
      !rule.requiredFeatures ||
      rule.requiredFeatures.some((feature) => hasFeature(feature))
    )
  }

  private shouldRemoveRuleBasedOnFeatures(
    rule: Rule,
    featureRuleMappings: FeatureRuleMapping[]
  ): boolean {
    // Check each feature-rule mapping
    for (const { feature, rulesToRemove } of featureRuleMappings) {
      // If tenant has this feature and rule ID is in rulesToRemove list
      if (
        hasFeature(feature as Feature) &&
        rulesToRemove.includes((rule as any).id)
      ) {
        return true // Rule should be removed
      }
    }
    return false // Rule should be kept
  }

  private featureRuleMappings: FeatureRuleMapping[] = [
    { feature: 'ACURIS', rulesToRemove: ['R-16'] },
    { feature: 'DOW_JONES', rulesToRemove: ['R-16'] },
    { feature: 'OPEN_SANCTIONS', rulesToRemove: ['R-16'] },
  ]

  @auditLog('RULE', 'RULE_LIBRARY', 'DOWNLOAD')
  async getAllRules(
    params: DefaultApiGetRulesRequest
  ): Promise<AuditLogReturnData<Array<Rule>>> {
    let rules = await this.ruleRepository.getAllRules()
    rules = await Promise.all(
      rules.map((rule) => this.getTenantSpecificRule(rule))
    )

    const data = rules.filter(
      (rule) =>
        !this.shouldRemoveRuleBasedOnFeatures(rule, this.featureRuleMappings) &&
        (isEmpty(rule.requiredFeatures) ||
          this.hasRequiredFeaturesForRule(rule))
    )
    return {
      result: data,
      entities:
        params.view === 'DOWNLOAD'
          ? [{ entityId: 'RULE_LIBRARY', entityAction: 'DOWNLOAD' }]
          : [],
      publishAuditLog: () => params.view === 'DOWNLOAD',
    }
  }

  public async searchRules(
    queryStr: string,
    filters: RuleSearchFilter
  ): Promise<RulesSearchResponse> {
    const isAISearch = filters?.isAISearch ?? false

    const cleanedQueryStr = removePunctuation(
      compact(
        removeStopwords(queryStr.split(' '), [...eng, 'rule', 'rules'])
      ).join(' ')
    )

    if (isAISearch) {
      const directMatch = filters.disableGptSearch
        ? {}
        : this.checkDirectMatch(queryStr)
      const isDirectMatch = Object.values(directMatch).some(
        (value) => value.length > 0
      )
      if (isDirectMatch && !filters.disableGptSearch) {
        filters.filterTypes = directMatch.ruleTypes
        filters.filterChecksFor = directMatch.checksFor
        filters.filterTypology = directMatch.typologies
        filters.filterNature = directMatch.nature as RuleNature[]
      }

      const aiSearchResult =
        isDirectMatch || filters.disableGptSearch
          ? directMatch
          : await this.aiSearchRuleFilters(queryStr)

      const processFilters = (
        field: keyof AIFilters,
        enumValues?: any,
        regularFilter?: string[]
      ): string[] => {
        return compact(
          uniq(
            concat(
              aiSearchResult[field]?.map((value) => enumValues?.[value]),
              regularFilter
            )
          )
        )
      }

      const { filterTypes, filterChecksFor, filterTypology, filterNature } =
        filters

      filters.filterTypes = processFilters(
        'ruleTypes',
        RuleTypeField,
        filterTypes || []
      )
      filters.filterChecksFor = processFilters(
        'checksFor',
        RuleChecksForField,
        filterChecksFor || []
      )
      filters.filterTypology = processFilters(
        'typologies',
        RuleTypology,
        filterTypology || []
      )
      filters.filterNature = processFilters(
        'nature',
        RuleNature,
        filterNature || []
      ) as RuleNature[]
    }

    const { bestSearches, otherSearches, filtersApplied } =
      await this.ruleRepository.searchRules(queryStr, cleanedQueryStr, filters)

    const bestSearchesCount = bestSearches.length

    const {
      bestSearches: bestSearchesResult,
      otherSearches: otherSearchesResult,
    } = this.rankRules(
      cleanedQueryStr,
      { bestSearches, otherSearches },
      isAISearch
    )

    /**
     * 1. If bestSearchesCount >= 3, return all bestSearches and otherSearches is 2 only
     * 2. If bestSearchesCount < 3, return all bestSearches and otherSearches is 8 - bestSearchesCount
     */
    const filteredBestSearches = bestSearchesResult.filter(
      (rule) =>
        !this.shouldRemoveRuleBasedOnFeatures(rule, this.featureRuleMappings)
    )

    const filteredOtherSearches = otherSearchesResult
      .filter(
        (rule) =>
          !this.shouldRemoveRuleBasedOnFeatures(rule, this.featureRuleMappings)
      )
      .slice(0, 10 - bestSearchesCount)

    return {
      bestSearches: filteredBestSearches,
      otherSearches: filteredOtherSearches,
      filtersApplied,
    }
  }

  private filterRules(rules: Rule[]): Rule[] {
    return rules.filter(
      (rule) =>
        isEmpty(rule.requiredFeatures) || this.hasRequiredFeaturesForRule(rule)
    )
  }

  private rankRules(
    queryStr: string,
    results: { bestSearches: Rule[]; otherSearches: Rule[] },
    isAI: boolean
  ): { bestSearches: Rule[]; otherSearches: Rule[] } {
    // Check if the query string is empty or too short
    if (isEmpty(queryStr) || queryStr.length < 5) {
      return results
    }

    // Define weights for each attribute
    const weightsObject: Partial<Record<keyof Rule, number>> = {
      id: 200,
      name: 120,
      description: 80,
      checksFor: 30,
      typologies: 30,
      defaultNature: 30,
      types: 30,
      sampleUseCases: 50,
    }

    // Determine the threshold based on the query length and whether it's AI
    const threshold = isAI ? 20 : Math.min(queryStr.length * 1.5, 35)

    // Score and filter the best searches
    const bestSearches = this.scoreAndFilter(
      this.filterRules(results.bestSearches),
      queryStr,
      weightsObject,
      threshold
    )

    // Score and filter other searches
    let otherSearches = this.scoreAndFilter(
      this.filterRules(results.otherSearches),
      queryStr,
      weightsObject,
      threshold
    )

    // If there are not enough best searches, supplement with high-scoring other searches
    if (bestSearches.length < 3) {
      const otherSearchesToMove = otherSearches.filter(
        (result) => result.percentage > threshold * 2
      )
      bestSearches.push(
        ...otherSearchesToMove.slice(0, 3 - bestSearches.length)
      )
      otherSearches = otherSearches.filter(
        (result) => !otherSearchesToMove.includes(result)
      )
    }

    // Sort and return the results
    return {
      bestSearches: this.sortAndMap(bestSearches),
      otherSearches: this.sortAndMap(otherSearches),
    }
  }

  private scoreAndFilter(
    rules: Rule[],
    queryStr: string,
    weights: Partial<Record<keyof Rule, number>>,
    threshold: number
  ): { object: Rule; percentage: number }[] {
    return scoreObjects(rules, queryStr, weights, {
      minimumThreshold: threshold,
    }).filter((result) => result.percentage > threshold)
  }

  private sortAndMap(results: { object: Rule; percentage: number }[]): Rule[] {
    return results
      .sort((a, b) => b.percentage - a.percentage)
      .map((result) => result.object)
  }

  async createOrUpdateRule(rule: Rule): Promise<Rule> {
    if (!isV8Rule(rule)) {
      assertValidRiskLevelParameters(
        rule.defaultRiskLevelActions,
        rule.defaultRiskLevelParameters
      )
      RuleService.validateRuleParametersSchema(
        ALL_RULES[rule.ruleImplementationName ?? ''].getSchema(),
        rule.defaultParameters,
        rule.defaultRiskLevelParameters
      )
    } else {
      await RuleService.validateRuleLogic(
        rule.defaultLogic,
        rule.defaultRiskLevelLogic,
        rule.defaultLogicAggregationVariables
      )
    }
    return this.ruleRepository.createOrUpdateRule(rule)
  }

  private async aiSearchRuleFilters(queryStr: string): Promise<AIFilters> {
    const checksFor = Object.keys(RuleChecksForField).map((key) => key)
    const ruleTypes = Object.keys(RuleTypeField).map((key) => key)
    const typologies = Object.keys(RuleTypology).map((key) => key)
    const nature = Object.keys(RuleNature).map((key) => key)

    const prompt = `
  You are expert in suggesting rule filters for a transaction monitoring system. You have been asked to suggest filters for a new rule. You have been given below information about the filters that can be used for a rule.
  ChecksFor: ${JSON.stringify(checksFor)}
  RuleTypes: ${JSON.stringify(ruleTypes)}
  Typology: ${JSON.stringify(typologies)}
  Nature: ${JSON.stringify(nature)}
  Please only give what options are provided above for each field.
  Suggest me as less as possible filters for below query. You also don't need to fill all the keys. Just fill the keys that you think are relevant for the query.
  If there is a direct match don't suggest other filter options. And please don't suggest any filter options that are not provided for each key.
  For example, if the query is "Give me Structuring and Layering FRAUD rules", you can suggest below filters
  {
    "nature": ["FRAUD"],
    "typologies": ["Structuring", "Layering"]
  }
  Or if the query is "Give me all rules that are for FRAUD", you can suggest below filters
 {
    nature: ["FRAUD"]   
 }
 It should be flexible enough to handle above mention keys like "nature", "typologies", "checksFor" and "ruleTypes". Please answer very precisely. If you don't know any field, just leave it an empty array
 Now your query is "${queryStr}"
You have to answer in below format as string. If you don't know any field, just leave it an empty array
  Your answer should be in below format
  {
    "ruleTypes"?: Array<string>,
    "checksFor"?: Array<string>,
    "typologies"?: Array<string>,
    "nature"?: Array<string>
  }
  `

    const response = await ask(this.ruleRepository.tenantId, prompt, {
      tier: ModelTier.ECONOMY,
    }) // Above prompt is optimized for GPT-3.5-turbo model
    let json: AIFilters = {}

    try {
      json = JSON.parse(response) as AIFilters
    } catch (error) {
      logger.error(
        `Error parsing response from GPT: ${response}: query: ${queryStr}: error: ${
          (error as Error).message
        }`
      )
      return {}
    }

    return json
  }

  private checkDirectMatch(queryStr: string): AIFilters {
    const checksForValues = Object.values(RuleChecksForField)
    const ruleTypesValues = Object.values(RuleTypeField)
    const typologiesValues = Object.values(RuleTypology)
    const natureValues = Object.values(RuleNature)
    const queryStrArr = queryStr.split(' ')

    const getFilters = (values: string[]) => {
      return values.filter((value) =>
        queryStrArr.some((word) => {
          const singularWord = singular(word)
          const singularValue = singular(value)

          if (word.length < 5) {
            return singularValue.toLowerCase() === singularWord.toLowerCase()
          }

          return (
            singularValue
              .toLowerCase()
              .startsWith(singularWord.toLowerCase()) ||
            singularWord.toLowerCase().startsWith(singularValue.toLowerCase())
          )
        })
      )
    }

    const ruleTypes = getFilters(ruleTypesValues)
    const checksFor = getFilters(checksForValues)
    const typologies = getFilters(typologiesValues)
    const nature = getFilters(natureValues)

    return { ruleTypes, checksFor, typologies, nature }
  }

  async deleteRule(ruleId: string): Promise<void> {
    // TODO: Forbid deleting a rule if there're rule instances associating with it
    await this.ruleRepository.deleteRule(ruleId)
  }

  public static validateRuleParametersSchema(
    schema: object,
    parameters: object,
    riskLevelParameters?: RiskLevelRuleParameters
  ) {
    if (riskLevelParameters) {
      for (const riskLevel of RISK_LEVELS) {
        const validate: ValidateFunction = ajv.compile(schema)
        if (!validate(riskLevelParameters[riskLevel])) {
          throw new createHttpError.BadRequest(
            `Invalid ${riskLevel} risk-level parameters: ${validate.errors
              ?.map((error) => error.message)
              .join(', ')}`
          )
        }
      }
      return
    } else {
      const validate: ValidateFunction = ajv.compile(schema)
      if (validate(parameters)) {
        return
      } else {
        throw new createHttpError.BadRequest(
          `Invalid parameters: ${validate.errors
            ?.map((error) => error.message)
            .join(', ')}`
        )
      }
    }
  }

  private static logicEngine: AsyncLogicEngine = getJsonLogicEngine()

  public static async validateRuleLogic(
    ruleLogic: unknown,
    riskLevelRuleLogic?: RuleInstance['riskLevelLogic'],
    logicAggregationVariables?: Array<LogicAggregationVariable>,
    logicEntityVariables?: LogicEntityVariableInUse[]
  ) {
    if (!isEmpty(riskLevelRuleLogic)) {
      // all keys in riskLevelRuleLogic should be in RISK_LEVELS
      const logic = riskLevelRuleLogic as RuleInstance['riskLevelLogic']
      const riskLevelKeys = Object.keys(logic ?? {}).filter(
        (key) => !RISK_LEVELS.includes(key as RiskLevel)
      )

      if (riskLevelKeys.length > 0) {
        throw new BadRequest(
          `Invalid risk-level logic: unknown risk-levels: ${riskLevelKeys.join(
            ', '
          )}`
        )
      }
    }
    const logicToCheck = [
      ...(!isEmpty(riskLevelRuleLogic)
        ? [...Object.values(riskLevelRuleLogic as Record<RiskLevel, unknown>)]
        : [ruleLogic]),
      ...(logicAggregationVariables ?? []).map((x) => x.filtersLogic),
    ].filter(notNullish)

    const entityVarKeys = logicEntityVariables?.map((x) => x.key) ?? []
    const aggVarKeys = logicAggregationVariables?.map((x) => x.key) ?? []
    logicEntityVariables?.forEach((v) => {
      if (!getLogicVariableByKey(v.entityKey)) {
        throw new BadRequest(`Unknown entity variable '${v}'`)
      }
    })
    logicAggregationVariables?.forEach((v) => {
      if (
        v.aggregationFunc === 'UNIQUE_VALUES' &&
        !v.key.endsWith('$1') &&
        !v.key.endsWith('$2')
      ) {
        throw new BadRequest(
          `Invalid aggregation variable (UNIQUE_VALUES): ${v.key}`
        )
      }
      if (!getLogicVariableByKey(v.aggregationFieldKey)) {
        throw new BadRequest(
          `Unknown aggregate field: '${v.aggregationFieldKey}'`
        )
      }
      if (
        v.aggregationGroupByFieldKey &&
        !getLogicVariableByKey(v.aggregationGroupByFieldKey)
      ) {
        throw new BadRequest(
          `Unknown aggregate group by field: '${v.aggregationGroupByFieldKey}'`
        )
      }
      const { afterTimestamp, beforeTimestamp } = getTimeRangeByTimeWindows(
        Date.now(),
        v.timeWindow.start as TimeWindow,
        v.timeWindow.end as TimeWindow
      )
      if (
        afterTimestamp > beforeTimestamp ||
        (!canAggregate(v.timeWindow) &&
          dayjs(beforeTimestamp).diff(afterTimestamp, 'minute') > 60)
      ) {
        throw new BadRequest('Invalid aggregation time window')
      }
    })

    await Promise.all(
      logicToCheck.map(async (logic) => {
        try {
          // Check that logic is valid JSON logic
          await this.logicEngine.build(logic)
          // Check that all used variables are known variables
          const { entityVariableKeys, aggVariableKeys } =
            getVariableKeysFromLogic(logic)
          entityVariableKeys.forEach((entityVar) => {
            if (
              !entityVarKeys.includes(entityVar) &&
              !getLogicVariableByKey(entityVar)
            ) {
              throw new BadRequest(`Unknown entity variable '${entityVar}'`)
            }
          })
          aggVariableKeys.forEach((aggVar) => {
            if (!aggVarKeys.includes(aggVar)) {
              logger.error(`Unknown aggregate variable '${aggVar}'`)
            }
          })
        } catch (e) {
          throw new BadRequest(
            `Passed value is not a valid JsonLogic tree:

        ${JSON.stringify(logic, null, 4)}".

        Message: ${getErrorMessage(e)}`
          )
        }
      })
    )
  }

  public async getAllRuleMlModels(params: DefaultApiGetRuleMlModelsRequest) {
    const machineLearningRepository = new MachineLearningRepository()
    return machineLearningRepository.getAllMLModels(params)
  }

  public async updateRuleMlModel(
    params: DefaultApiUpdateRuleMlModelModelIdRequest
  ) {
    const machineLearningRepository = new MachineLearningRepository()
    return machineLearningRepository.updateMLModel(
      params.modelId,
      params.RuleMLModel
    )
  }
}
