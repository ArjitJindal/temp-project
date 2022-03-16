import { ACHDetails } from './ACHDetails'
import { Address } from './Address'
import { CardDetails } from './CardDetails'
import { ConsumerName } from './ConsumerName'
import { DeviceData } from './DeviceData'
import { IBANDetails } from './IBANDetails'
import { ImportRequest } from './ImportRequest'
import { ImportResponse } from './ImportResponse'
import { ListImportRequest } from './ListImportRequest'
import { PresignedUrlResponse } from './PresignedUrlResponse'
import { RuleInstance } from './RuleInstance'
import { Tag } from './Tag'
import { Transaction } from './Transaction'
import { TransactionAmountDetails } from './TransactionAmountDetails'
import { TransactionsListResponse } from './TransactionsListResponse'
import { UPIDetails } from './UPIDetails'

export interface DefaultApiDeleteRuleInstancesRuleInstanceIdRequest {
  /**
   *
   * @type string
   * @memberof DefaultApideleteRuleInstancesRuleInstanceId
   */
  ruleInstanceId: string
}

export interface DefaultApiGetTransactionsListRequest {
  /**
   *
   * @type number
   * @memberof DefaultApigetTransactionsList
   */
  limit: number
  /**
   *
   * @type number
   * @memberof DefaultApigetTransactionsList
   */
  skip: number
  /**
   *
   * @type number
   * @memberof DefaultApigetTransactionsList
   */
  beforeTimestamp: number
}

export interface DefaultApiPostApikeyRequest {
  /**
   * Tenant ID
   * @type string
   * @memberof DefaultApipostApikey
   */
  tenantId?: string
  /**
   * AWS Gateway usage plan ID
   * @type string
   * @memberof DefaultApipostApikey
   */
  usagePlanId?: string
}

export interface DefaultApiPostGetPresignedUrlRequest {}

export interface DefaultApiPostImportRequest {
  /**
   *
   * @type ImportRequest
   * @memberof DefaultApipostImport
   */
  ImportRequest?: ImportRequest
}

export interface DefaultApiPostListsRequest {
  /**
   *
   * @type ListImportRequest
   * @memberof DefaultApipostLists
   */
  ListImportRequest?: ListImportRequest
}

export interface DefaultApiPostRuleInstancesRequest {
  /**
   *
   * @type RuleInstance
   * @memberof DefaultApipostRuleInstances
   */
  RuleInstance?: RuleInstance
}

export interface DefaultApiPutRuleInstancesRuleInstanceIdRequest {
  /**
   *
   * @type string
   * @memberof DefaultApiputRuleInstancesRuleInstanceId
   */
  ruleInstanceId: string
  /**
   *
   * @type RuleInstance
   * @memberof DefaultApiputRuleInstancesRuleInstanceId
   */
  RuleInstance?: RuleInstance
}
