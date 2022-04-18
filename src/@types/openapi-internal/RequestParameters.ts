import { ACHDetails } from './ACHDetails'
import { Address } from './Address'
import { Address1 } from './Address1'
import { Address2 } from './Address2'
import { Amount } from './Amount'
import { Assignment } from './Assignment'
import { Business } from './Business'
import { BusinessUsersListResponse } from './BusinessUsersListResponse'
import { CardDetails } from './CardDetails'
import { Comment } from './Comment'
import { CompanyFinancialDetails } from './CompanyFinancialDetails'
import { CompanyGeneralDetails } from './CompanyGeneralDetails'
import { CompanyRegistrationDetails } from './CompanyRegistrationDetails'
import { ConsumerName } from './ConsumerName'
import { ConsumerUsersListResponse } from './ConsumerUsersListResponse'
import { ContactDetails } from './ContactDetails'
import { ContactDetails1 } from './ContactDetails1'
import { DeviceData } from './DeviceData'
import { ExecutedRulesResult } from './ExecutedRulesResult'
import { FailedRulesResult } from './FailedRulesResult'
import { FileImport } from './FileImport'
import { FileImportStatusChange } from './FileImportStatusChange'
import { FileInfo } from './FileInfo'
import { IBANDetails } from './IBANDetails'
import { ImportRequest } from './ImportRequest'
import { ImportResponse } from './ImportResponse'
import { LegalDocument } from './LegalDocument'
import { LegalDocument1 } from './LegalDocument1'
import { LegalEntity } from './LegalEntity'
import { ListImportRequest } from './ListImportRequest'
import { ModelDate } from './ModelDate'
import { Person } from './Person'
import { PresignedUrlResponse } from './PresignedUrlResponse'
import { Rule } from './Rule'
import { RuleAction } from './RuleAction'
import { RuleAction1 } from './RuleAction1'
import { RuleFailureException } from './RuleFailureException'
import { RuleInstance } from './RuleInstance'
import { Tag } from './Tag'
import { Transaction } from './Transaction'
import { TransactionAmountDetails } from './TransactionAmountDetails'
import { TransactionCaseManagement } from './TransactionCaseManagement'
import { TransactionCaseManagementAllOf } from './TransactionCaseManagementAllOf'
import { TransactionLimits } from './TransactionLimits'
import { TransactionStatusChange } from './TransactionStatusChange'
import { TransactionUpdateRequest } from './TransactionUpdateRequest'
import { TransactionWithRulesResult } from './TransactionWithRulesResult'
import { TransactionWithRulesResultAllOf } from './TransactionWithRulesResultAllOf'
import { TransactionsListResponse } from './TransactionsListResponse'
import { UPIDetails } from './UPIDetails'
import { User } from './User'
import { UserDetails } from './UserDetails'
import { UserDetails1 } from './UserDetails1'

export interface DefaultApiDeleteRuleInstancesRuleInstanceIdRequest {
  /**
   *
   * @type string
   * @memberof DefaultApideleteRuleInstancesRuleInstanceId
   */
  ruleInstanceId: string
}

export interface DefaultApiDeleteRulesRuleIdRequest {
  /**
   *
   * @type string
   * @memberof DefaultApideleteRulesRuleId
   */
  ruleId: string
}

export interface DefaultApiDeleteTransactionsTransactionIdCommentsCommentIdRequest {
  /**
   *
   * @type string
   * @memberof DefaultApideleteTransactionsTransactionIdCommentsCommentId
   */
  transactionId: string
  /**
   *
   * @type string
   * @memberof DefaultApideleteTransactionsTransactionIdCommentsCommentId
   */
  commentId: string
}

export interface DefaultApiGetAccountsRequest {}

export interface DefaultApiGetBusinessUsersListRequest {
  /**
   *
   * @type number
   * @memberof DefaultApigetBusinessUsersList
   */
  limit: number
  /**
   *
   * @type number
   * @memberof DefaultApigetBusinessUsersList
   */
  skip: number
  /**
   *
   * @type number
   * @memberof DefaultApigetBusinessUsersList
   */
  beforeTimestamp: number
}

export interface DefaultApiGetConsumerUsersListRequest {
  /**
   *
   * @type number
   * @memberof DefaultApigetConsumerUsersList
   */
  limit: number
  /**
   *
   * @type number
   * @memberof DefaultApigetConsumerUsersList
   */
  skip: number
  /**
   *
   * @type number
   * @memberof DefaultApigetConsumerUsersList
   */
  beforeTimestamp: number
}

export interface DefaultApiGetDashboardStatsTransactionsRequest {
  /**
   *
   * @type number
   * @memberof DefaultApigetDashboardStatsTransactions
   */
  category: number
  /**
   *
   * @type number
   * @memberof DefaultApigetDashboardStatsTransactions
   */
  timeframe: number
  /**
   *
   * @type string
   * @memberof DefaultApigetDashboardStatsTransactions
   */
  fromTimestamp?: string
  /**
   *
   * @type any
   * @memberof DefaultApigetDashboardStatsTransactions
   */
  body?: any
}

export interface DefaultApiGetImportImportIdRequest {
  /**
   *
   * @type string
   * @memberof DefaultApigetImportImportId
   */
  importId: string
}

export interface DefaultApiGetRuleInstancesRequest {}

export interface DefaultApiGetRulesRequest {}

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

export interface DefaultApiGetTransactionsPerUserListRequest {
  /**
   *
   * @type number
   * @memberof DefaultApigetTransactionsPerUserList
   */
  limit: number
  /**
   *
   * @type number
   * @memberof DefaultApigetTransactionsPerUserList
   */
  skip: number
  /**
   *
   * @type number
   * @memberof DefaultApigetTransactionsPerUserList
   */
  beforeTimestamp: number
  /**
   *
   * @type string
   * @memberof DefaultApigetTransactionsPerUserList
   */
  userId: string
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

export interface DefaultApiPostRulesRequest {
  /**
   *
   * @type Rule
   * @memberof DefaultApipostRules
   */
  Rule?: Rule
}

export interface DefaultApiPostTransactionsCommentsRequest {
  /**
   *
   * @type string
   * @memberof DefaultApipostTransactionsComments
   */
  transactionId: string
  /**
   *
   * @type Comment
   * @memberof DefaultApipostTransactionsComments
   */
  Comment?: Comment
}

export interface DefaultApiPostTransactionsTransactionIdRequest {
  /**
   *
   * @type string
   * @memberof DefaultApipostTransactionsTransactionId
   */
  transactionId: string
  /**
   *
   * @type TransactionUpdateRequest
   * @memberof DefaultApipostTransactionsTransactionId
   */
  TransactionUpdateRequest?: TransactionUpdateRequest
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

export interface DefaultApiPutRuleRuleIdRequest {
  /**
   *
   * @type string
   * @memberof DefaultApiputRuleRuleId
   */
  ruleId: string
  /**
   *
   * @type Rule
   * @memberof DefaultApiputRuleRuleId
   */
  Rule?: Rule
}
