import { ACHDetails } from './ACHDetails'
import { ACHPaymentMethod } from './ACHPaymentMethod'
import { Account } from './Account'
import { AccountInvitePayload } from './AccountInvitePayload'
import { AccountRole } from './AccountRole'
import { Address } from './Address'
import { Address1 } from './Address1'
import { Address2 } from './Address2'
import { Amount } from './Amount'
import { Assignment } from './Assignment'
import { Business } from './Business'
import { BusinessUsersListResponse } from './BusinessUsersListResponse'
import { CardDetails } from './CardDetails'
import { CardPaymentMethod } from './CardPaymentMethod'
import { ChangeTenantPayload } from './ChangeTenantPayload'
import { ChangeTenantPayload1 } from './ChangeTenantPayload1'
import { ChangeTenantPayload2 } from './ChangeTenantPayload2'
import { Comment } from './Comment'
import { CompanyFinancialDetails } from './CompanyFinancialDetails'
import { CompanyGeneralDetails } from './CompanyGeneralDetails'
import { CompanyRegistrationDetails } from './CompanyRegistrationDetails'
import { ConsumerName } from './ConsumerName'
import { ConsumerUsersListResponse } from './ConsumerUsersListResponse'
import { ContactDetails } from './ContactDetails'
import { ContactDetails1 } from './ContactDetails1'
import { DashboardStatsHitsPerUser } from './DashboardStatsHitsPerUser'
import { DashboardStatsHitsPerUserData } from './DashboardStatsHitsPerUserData'
import { DashboardStatsRulesCount } from './DashboardStatsRulesCount'
import { DashboardStatsRulesCountData } from './DashboardStatsRulesCountData'
import { DashboardStatsTransactionsCount } from './DashboardStatsTransactionsCount'
import { DashboardStatsTransactionsCountData } from './DashboardStatsTransactionsCountData'
import { DeviceData } from './DeviceData'
import { ExecutedRulesResult } from './ExecutedRulesResult'
import { Feature } from './Feature'
import { FileImport } from './FileImport'
import { FileImportStatusChange } from './FileImportStatusChange'
import { FileInfo } from './FileInfo'
import { GeneralBankAccountPaymentMethod } from './GeneralBankAccountPaymentMethod'
import { GenericBankAccountDetails } from './GenericBankAccountDetails'
import { HitRulesResult } from './HitRulesResult'
import { IBANDetails } from './IBANDetails'
import { IBANPaymentMethod } from './IBANPaymentMethod'
import { ImportRequest } from './ImportRequest'
import { ImportResponse } from './ImportResponse'
import { InlineResponse200 } from './InlineResponse200'
import { InlineResponse400 } from './InlineResponse400'
import { InternalBusinessUser } from './InternalBusinessUser'
import { InternalBusinessUserAllOf } from './InternalBusinessUserAllOf'
import { InternalConsumerUser } from './InternalConsumerUser'
import { InternalConsumerUserAllOf } from './InternalConsumerUserAllOf'
import { LegalDocument } from './LegalDocument'
import { LegalDocument1 } from './LegalDocument1'
import { LegalEntity } from './LegalEntity'
import { ListImportRequest } from './ListImportRequest'
import { ManualRiskAssignmentUserState } from './ManualRiskAssignmentUserState'
import { ParameterAttributeRiskValues } from './ParameterAttributeRiskValues'
import { Person } from './Person'
import { PresignedUrlResponse } from './PresignedUrlResponse'
import { RiskClassificationScore } from './RiskClassificationScore'
import { RiskLevel } from './RiskLevel'
import { RiskLevelRuleActions } from './RiskLevelRuleActions'
import { RiskLevelRuleParameters } from './RiskLevelRuleParameters'
import { RiskParameterLevelKeyValue } from './RiskParameterLevelKeyValue'
import { Rule } from './Rule'
import { RuleAction } from './RuleAction'
import { RuleAction1 } from './RuleAction1'
import { RuleImplementation } from './RuleImplementation'
import { RuleInstance } from './RuleInstance'
import { SWIFTDetails } from './SWIFTDetails'
import { SWIFTPaymentMethod } from './SWIFTPaymentMethod'
import { Tag } from './Tag'
import { Tenant } from './Tenant'
import { TenantSettings } from './TenantSettings'
import { Transaction } from './Transaction'
import { TransactionAmountDetails } from './TransactionAmountDetails'
import { TransactionCaseManagement } from './TransactionCaseManagement'
import { TransactionCaseManagementAllOf } from './TransactionCaseManagementAllOf'
import { TransactionLimits } from './TransactionLimits'
import { TransactionLimits1 } from './TransactionLimits1'
import { TransactionState } from './TransactionState'
import { TransactionStatusChange } from './TransactionStatusChange'
import { TransactionUpdateRequest } from './TransactionUpdateRequest'
import { TransactionWithRulesResult } from './TransactionWithRulesResult'
import { TransactionWithRulesResultAllOf } from './TransactionWithRulesResultAllOf'
import { TransactionsListResponse } from './TransactionsListResponse'
import { UPIDetails } from './UPIDetails'
import { UPIPaymentMethod } from './UPIPaymentMethod'
import { User } from './User'
import { UserDetails } from './UserDetails'
import { UserDetails1 } from './UserDetails1'
import { WalletDetails } from './WalletDetails'
import { WalletPaymentMethod } from './WalletPaymentMethod'

export interface DefaultApiAccountsChangeTenantRequest {
  /**
   *
   * @type string
   * @memberof DefaultApiaccountsChangeTenant
   */
  userId: string
  /**
   *
   * @type ChangeTenantPayload
   * @memberof DefaultApiaccountsChangeTenant
   */
  ChangeTenantPayload?: ChangeTenantPayload
}

export interface DefaultApiAccountsDeleteRequest {
  /**
   *
   * @type string
   * @memberof DefaultApiaccountsDelete
   */
  userId: string
}

export interface DefaultApiAccountsInviteRequest {
  /**
   *
   * @type AccountInvitePayload
   * @memberof DefaultApiaccountsInvite
   */
  AccountInvitePayload?: AccountInvitePayload
}

export interface DefaultApiDeleteBusinessUsersUserIdFilesFileIdRequest {
  /**
   *
   * @type string
   * @memberof DefaultApideleteBusinessUsersUserIdFilesFileId
   */
  userId: string
  /**
   *
   * @type string
   * @memberof DefaultApideleteBusinessUsersUserIdFilesFileId
   */
  fileId: string
}

export interface DefaultApiDeleteConsumerUsersUserIdFilesFileIdRequest {
  /**
   *
   * @type string
   * @memberof DefaultApideleteConsumerUsersUserIdFilesFileId
   */
  userId: string
  /**
   *
   * @type string
   * @memberof DefaultApideleteConsumerUsersUserIdFilesFileId
   */
  fileId: string
}

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

export interface DefaultApiGetBusinessUsersItemRequest {
  /**
   *
   * @type string
   * @memberof DefaultApigetBusinessUsersItem
   */
  userId: string
}

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
  /**
   *
   * @type number
   * @memberof DefaultApigetBusinessUsersList
   */
  afterTimestamp?: number
  /**
   *
   * @type string
   * @memberof DefaultApigetBusinessUsersList
   */
  filterId?: string
}

export interface DefaultApiGetConsumerUsersItemRequest {
  /**
   *
   * @type string
   * @memberof DefaultApigetConsumerUsersItem
   */
  userId: string
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
  /**
   *
   * @type number
   * @memberof DefaultApigetConsumerUsersList
   */
  afterTimestamp?: number
  /**
   *
   * @type string
   * @memberof DefaultApigetConsumerUsersList
   */
  filterId?: string
}

export interface DefaultApiGetDashboardStatsHitsPerUserRequest {
  /**
   *
   * @type number
   * @memberof DefaultApigetDashboardStatsHitsPerUser
   */
  startTimestamp?: number
  /**
   *
   * @type number
   * @memberof DefaultApigetDashboardStatsHitsPerUser
   */
  endTimestamp?: number
}

export interface DefaultApiGetDashboardStatsRuleHitRequest {
  /**
   *
   * @type number
   * @memberof DefaultApigetDashboardStatsRuleHit
   */
  startTimestamp?: number
  /**
   *
   * @type number
   * @memberof DefaultApigetDashboardStatsRuleHit
   */
  endTimestamp?: number
}

export interface DefaultApiGetDashboardStatsTransactionsRequest {
  /**
   * MONTH, DAY or YEAR
   * @type &#39;WEEK&#39; | &#39;MONTH&#39; | &#39;DAY&#39; | &#39;YEAR&#39;
   * @memberof DefaultApigetDashboardStatsTransactions
   */
  timeframe: 'WEEK' | 'MONTH' | 'DAY' | 'YEAR'
  /**
   *
   * @type number
   * @memberof DefaultApigetDashboardStatsTransactions
   */
  endTimestamp?: number
}

export interface DefaultApiGetImportImportIdRequest {
  /**
   *
   * @type string
   * @memberof DefaultApigetImportImportId
   */
  importId: string
}

export interface DefaultApiGetPulseRiskClassificationRequest {}

export interface DefaultApiGetPulseRiskParameterRequest {
  /**
   * Parameter you want to filter on
   * @type string
   * @memberof DefaultApigetPulseRiskParameter
   */
  parameter?: string
}

export interface DefaultApiGetRuleImplementationsRequest {}

export interface DefaultApiGetRuleInstancesRequest {}

export interface DefaultApiGetRulesRequest {
  /**
   *
   * @type string
   * @memberof DefaultApigetRules
   */
  ruleId?: string
}

export interface DefaultApiGetTenantsListRequest {}

export interface DefaultApiGetTenantsSettingsRequest {}

export interface DefaultApiGetTransactionRequest {
  /**
   *
   * @type string
   * @memberof DefaultApigetTransaction
   */
  transactionId: string
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
  /**
   *
   * @type number
   * @memberof DefaultApigetTransactionsList
   */
  afterTimestamp?: number
  /**
   *
   * @type string
   * @memberof DefaultApigetTransactionsList
   */
  filterId?: string
  /**
   *
   * @type RuleAction
   * @memberof DefaultApigetTransactionsList
   */
  filterOutStatus?: RuleAction
  /**
   *
   * @type Array&lt;string&gt;
   * @memberof DefaultApigetTransactionsList
   */
  filterRulesExecuted?: Array<string>
  /**
   *
   * @type Array&lt;string&gt;
   * @memberof DefaultApigetTransactionsList
   */
  filterRulesHit?: Array<string>
  /**
   *
   * @type string
   * @memberof DefaultApigetTransactionsList
   */
  transactionType?: string
  /**
   *
   * @type Array&lt;string&gt;
   * @memberof DefaultApigetTransactionsList
   */
  filterOriginCurrencies?: Array<string>
  /**
   *
   * @type Array&lt;string&gt;
   * @memberof DefaultApigetTransactionsList
   */
  filterDestinationCurrencies?: Array<string>
  /**
   *
   * @type string
   * @memberof DefaultApigetTransactionsList
   */
  sortField?: string
  /**
   *
   * @type string
   * @memberof DefaultApigetTransactionsList
   */
  sortOrder?: string
  /**
   *
   * @type string
   * @memberof DefaultApigetTransactionsList
   */
  filterOriginUserId?: string
  /**
   *
   * @type string
   * @memberof DefaultApigetTransactionsList
   */
  filterDestinationUserId?: string
}

export interface DefaultApiGetTransactionsListExportRequest {
  /**
   *
   * @type number
   * @memberof DefaultApigetTransactionsListExport
   */
  limit: number
  /**
   *
   * @type number
   * @memberof DefaultApigetTransactionsListExport
   */
  skip: number
  /**
   *
   * @type number
   * @memberof DefaultApigetTransactionsListExport
   */
  beforeTimestamp: number
  /**
   *
   * @type number
   * @memberof DefaultApigetTransactionsListExport
   */
  afterTimestamp?: number
  /**
   *
   * @type string
   * @memberof DefaultApigetTransactionsListExport
   */
  filterId?: string
  /**
   *
   * @type Array&lt;string&gt;
   * @memberof DefaultApigetTransactionsListExport
   */
  filterRulesExecuted?: Array<string>
  /**
   *
   * @type Array&lt;string&gt;
   * @memberof DefaultApigetTransactionsListExport
   */
  filterRulesHit?: Array<string>
  /**
   *
   * @type RuleAction
   * @memberof DefaultApigetTransactionsListExport
   */
  filterOutStatus?: RuleAction
  /**
   *
   * @type string
   * @memberof DefaultApigetTransactionsListExport
   */
  sortField?: string
  /**
   *
   * @type string
   * @memberof DefaultApigetTransactionsListExport
   */
  sortOrder?: string
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

export interface DefaultApiPostBusinessUsersUserIdFilesRequest {
  /**
   *
   * @type string
   * @memberof DefaultApipostBusinessUsersUserIdFiles
   */
  userId: string
  /**
   *
   * @type FileInfo
   * @memberof DefaultApipostBusinessUsersUserIdFiles
   */
  FileInfo?: FileInfo
}

export interface DefaultApiPostConsumerUsersUserIdFilesRequest {
  /**
   *
   * @type string
   * @memberof DefaultApipostConsumerUsersUserIdFiles
   */
  userId: string
  /**
   *
   * @type FileInfo
   * @memberof DefaultApipostConsumerUsersUserIdFiles
   */
  FileInfo?: FileInfo
}

export interface DefaultApiPostGetPresignedUrlRequest {}

export interface DefaultApiPostIamRuleInstancesRequest {
  /**
   * Tenant ID
   * @type string
   * @memberof DefaultApipostIamRuleInstances
   */
  tenantId?: string
  /**
   *
   * @type RuleInstance
   * @memberof DefaultApipostIamRuleInstances
   */
  RuleInstance?: RuleInstance
}

export interface DefaultApiPostIamRulesRequest {
  /**
   * Tenant ID
   * @type string
   * @memberof DefaultApipostIamRules
   */
  tenantId?: string
  /**
   *
   * @type Rule
   * @memberof DefaultApipostIamRules
   */
  Rule?: Rule
}

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

export interface DefaultApiPostPulseRiskClassificationRequest {
  /**
   *
   * @type Array&lt;RiskClassificationScore&gt;
   * @memberof DefaultApipostPulseRiskClassification
   */
  RiskClassificationScore?: Array<RiskClassificationScore>
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

export interface DefaultApiPostTenantsSettingsRequest {
  /**
   *
   * @type TenantSettings
   * @memberof DefaultApipostTenantsSettings
   */
  TenantSettings?: TenantSettings
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

export interface DefaultApiPulseManualRiskAssignmentRequest {
  /**
   * UserID of the user whose risk is being manually assigned
   * @type string
   * @memberof DefaultApipulseManualRiskAssignment
   */
  userId: string
  /**
   *
   * @type ChangeTenantPayload1
   * @memberof DefaultApipulseManualRiskAssignment
   */
  ChangeTenantPayload1?: ChangeTenantPayload1
}

export interface DefaultApiPulseRiskParameterRequest {
  /**
   *
   * @type ChangeTenantPayload2
   * @memberof DefaultApipulseRiskParameter
   */
  ChangeTenantPayload2?: ChangeTenantPayload2
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
