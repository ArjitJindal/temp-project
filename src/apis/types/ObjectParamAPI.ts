import { ResponseContext, RequestContext, HttpFile } from '../http/http';
import * as models from '../models/all';
import { Configuration } from '../configuration';

import { ACHDetails } from '../models/ACHDetails';
import { ACHPaymentMethod } from '../models/ACHPaymentMethod';
import { Account } from '../models/Account';
import { AccountInvitePayload } from '../models/AccountInvitePayload';
import { AccountRole } from '../models/AccountRole';
import { Address } from '../models/Address';
import { Address1 } from '../models/Address1';
import { Address2 } from '../models/Address2';
import { Amount } from '../models/Amount';
import { Assignment } from '../models/Assignment';
import { Business } from '../models/Business';
import { BusinessUsersListResponse } from '../models/BusinessUsersListResponse';
import { CardDetails } from '../models/CardDetails';
import { CardPaymentMethod } from '../models/CardPaymentMethod';
import { ChangeTenantPayload } from '../models/ChangeTenantPayload';
import { Comment } from '../models/Comment';
import { CompanyFinancialDetails } from '../models/CompanyFinancialDetails';
import { CompanyGeneralDetails } from '../models/CompanyGeneralDetails';
import { CompanyRegistrationDetails } from '../models/CompanyRegistrationDetails';
import { ConsumerName } from '../models/ConsumerName';
import { ConsumerUsersListResponse } from '../models/ConsumerUsersListResponse';
import { ContactDetails } from '../models/ContactDetails';
import { ContactDetails1 } from '../models/ContactDetails1';
import { DashboardStatsHitsPerUser } from '../models/DashboardStatsHitsPerUser';
import { DashboardStatsHitsPerUserData } from '../models/DashboardStatsHitsPerUserData';
import { DashboardStatsRulesCount } from '../models/DashboardStatsRulesCount';
import { DashboardStatsRulesCountData } from '../models/DashboardStatsRulesCountData';
import { DashboardStatsTransactionsCount } from '../models/DashboardStatsTransactionsCount';
import { DashboardStatsTransactionsCountData } from '../models/DashboardStatsTransactionsCountData';
import { DeviceData } from '../models/DeviceData';
import { ExecutedRulesResult } from '../models/ExecutedRulesResult';
import { Feature } from '../models/Feature';
import { FileImport } from '../models/FileImport';
import { FileImportStatusChange } from '../models/FileImportStatusChange';
import { FileInfo } from '../models/FileInfo';
import { GeneralBankAccountPaymentMethod } from '../models/GeneralBankAccountPaymentMethod';
import { GenericBankAccountDetails } from '../models/GenericBankAccountDetails';
import { HitRulesResult } from '../models/HitRulesResult';
import { IBANDetails } from '../models/IBANDetails';
import { IBANPaymentMethod } from '../models/IBANPaymentMethod';
import { ImportRequest } from '../models/ImportRequest';
import { ImportResponse } from '../models/ImportResponse';
import { InlineResponse200 } from '../models/InlineResponse200';
import { InlineResponse400 } from '../models/InlineResponse400';
import { InternalBusinessUser } from '../models/InternalBusinessUser';
import { InternalBusinessUserAllOf } from '../models/InternalBusinessUserAllOf';
import { InternalConsumerUser } from '../models/InternalConsumerUser';
import { InternalConsumerUserAllOf } from '../models/InternalConsumerUserAllOf';
import { LegalDocument } from '../models/LegalDocument';
import { LegalDocument1 } from '../models/LegalDocument1';
import { LegalEntity } from '../models/LegalEntity';
import { ListImportRequest } from '../models/ListImportRequest';
import { ManualRiskAssignmentPayload } from '../models/ManualRiskAssignmentPayload';
import { ManualRiskAssignmentUserState } from '../models/ManualRiskAssignmentUserState';
import { Person } from '../models/Person';
import { PresignedUrlResponse } from '../models/PresignedUrlResponse';
import { RiskClassificationScore } from '../models/RiskClassificationScore';
import { RiskLevel } from '../models/RiskLevel';
import { RiskLevelRuleActions } from '../models/RiskLevelRuleActions';
import { RiskLevelRuleParameters } from '../models/RiskLevelRuleParameters';
import { Rule } from '../models/Rule';
import { RuleAction } from '../models/RuleAction';
import { RuleAction1 } from '../models/RuleAction1';
import { RuleActionAlias } from '../models/RuleActionAlias';
import { RuleImplementation } from '../models/RuleImplementation';
import { RuleInstance } from '../models/RuleInstance';
import { SWIFTDetails } from '../models/SWIFTDetails';
import { SWIFTPaymentMethod } from '../models/SWIFTPaymentMethod';
import { Tag } from '../models/Tag';
import { Tenant } from '../models/Tenant';
import { TenantSettings } from '../models/TenantSettings';
import { Transaction } from '../models/Transaction';
import { TransactionAmountDetails } from '../models/TransactionAmountDetails';
import { TransactionCaseManagement } from '../models/TransactionCaseManagement';
import { TransactionCaseManagementAllOf } from '../models/TransactionCaseManagementAllOf';
import { TransactionLimits } from '../models/TransactionLimits';
import { TransactionLimits1 } from '../models/TransactionLimits1';
import { TransactionState } from '../models/TransactionState';
import { TransactionStatusChange } from '../models/TransactionStatusChange';
import { TransactionUpdateRequest } from '../models/TransactionUpdateRequest';
import { TransactionWithRulesResult } from '../models/TransactionWithRulesResult';
import { TransactionWithRulesResultAllOf } from '../models/TransactionWithRulesResultAllOf';
import { TransactionsListResponse } from '../models/TransactionsListResponse';
import { UPIDetails } from '../models/UPIDetails';
import { UPIPaymentMethod } from '../models/UPIPaymentMethod';
import { User } from '../models/User';
import { UserDetails } from '../models/UserDetails';
import { UserDetails1 } from '../models/UserDetails1';
import { WalletDetails } from '../models/WalletDetails';
import { WalletPaymentMethod } from '../models/WalletPaymentMethod';

import { ObservableDefaultApi } from './ObservableAPI';
import { DefaultApiRequestFactory, DefaultApiResponseProcessor } from '../apis/DefaultApi';

export interface DefaultApiAccountsChangeTenantRequest {
  /**
   *
   * @type string
   * @memberof DefaultApiaccountsChangeTenant
   */
  userId: string;
  /**
   *
   * @type ChangeTenantPayload
   * @memberof DefaultApiaccountsChangeTenant
   */
  ChangeTenantPayload?: ChangeTenantPayload;
}

export interface DefaultApiAccountsDeleteRequest {
  /**
   *
   * @type string
   * @memberof DefaultApiaccountsDelete
   */
  userId: string;
}

export interface DefaultApiAccountsInviteRequest {
  /**
   *
   * @type AccountInvitePayload
   * @memberof DefaultApiaccountsInvite
   */
  AccountInvitePayload?: AccountInvitePayload;
}

export interface DefaultApiDeleteBusinessUsersUserIdFilesFileIdRequest {
  /**
   *
   * @type string
   * @memberof DefaultApideleteBusinessUsersUserIdFilesFileId
   */
  userId: string;
  /**
   *
   * @type string
   * @memberof DefaultApideleteBusinessUsersUserIdFilesFileId
   */
  fileId: string;
}

export interface DefaultApiDeleteConsumerUsersUserIdFilesFileIdRequest {
  /**
   *
   * @type string
   * @memberof DefaultApideleteConsumerUsersUserIdFilesFileId
   */
  userId: string;
  /**
   *
   * @type string
   * @memberof DefaultApideleteConsumerUsersUserIdFilesFileId
   */
  fileId: string;
}

export interface DefaultApiDeleteRuleInstancesRuleInstanceIdRequest {
  /**
   *
   * @type string
   * @memberof DefaultApideleteRuleInstancesRuleInstanceId
   */
  ruleInstanceId: string;
}

export interface DefaultApiDeleteRulesRuleIdRequest {
  /**
   *
   * @type string
   * @memberof DefaultApideleteRulesRuleId
   */
  ruleId: string;
}

export interface DefaultApiDeleteTransactionsTransactionIdCommentsCommentIdRequest {
  /**
   *
   * @type string
   * @memberof DefaultApideleteTransactionsTransactionIdCommentsCommentId
   */
  transactionId: string;
  /**
   *
   * @type string
   * @memberof DefaultApideleteTransactionsTransactionIdCommentsCommentId
   */
  commentId: string;
}

export interface DefaultApiGetAccountsRequest {}

export interface DefaultApiGetBusinessUsersItemRequest {
  /**
   *
   * @type string
   * @memberof DefaultApigetBusinessUsersItem
   */
  userId: string;
}

export interface DefaultApiGetBusinessUsersListRequest {
  /**
   *
   * @type number
   * @memberof DefaultApigetBusinessUsersList
   */
  limit: number;
  /**
   *
   * @type number
   * @memberof DefaultApigetBusinessUsersList
   */
  skip: number;
  /**
   *
   * @type number
   * @memberof DefaultApigetBusinessUsersList
   */
  beforeTimestamp: number;
  /**
   *
   * @type number
   * @memberof DefaultApigetBusinessUsersList
   */
  afterTimestamp?: number;
  /**
   *
   * @type string
   * @memberof DefaultApigetBusinessUsersList
   */
  filterId?: string;
}

export interface DefaultApiGetConsumerUsersItemRequest {
  /**
   *
   * @type string
   * @memberof DefaultApigetConsumerUsersItem
   */
  userId: string;
}

export interface DefaultApiGetConsumerUsersListRequest {
  /**
   *
   * @type number
   * @memberof DefaultApigetConsumerUsersList
   */
  limit: number;
  /**
   *
   * @type number
   * @memberof DefaultApigetConsumerUsersList
   */
  skip: number;
  /**
   *
   * @type number
   * @memberof DefaultApigetConsumerUsersList
   */
  beforeTimestamp: number;
  /**
   *
   * @type number
   * @memberof DefaultApigetConsumerUsersList
   */
  afterTimestamp?: number;
  /**
   *
   * @type string
   * @memberof DefaultApigetConsumerUsersList
   */
  filterId?: string;
}

export interface DefaultApiGetDashboardStatsHitsPerUserRequest {
  /**
   *
   * @type number
   * @memberof DefaultApigetDashboardStatsHitsPerUser
   */
  startTimestamp?: number;
  /**
   *
   * @type number
   * @memberof DefaultApigetDashboardStatsHitsPerUser
   */
  endTimestamp?: number;
}

export interface DefaultApiGetDashboardStatsRuleHitRequest {
  /**
   *
   * @type number
   * @memberof DefaultApigetDashboardStatsRuleHit
   */
  startTimestamp?: number;
  /**
   *
   * @type number
   * @memberof DefaultApigetDashboardStatsRuleHit
   */
  endTimestamp?: number;
}

export interface DefaultApiGetDashboardStatsTransactionsRequest {
  /**
   *
   * @type number
   * @memberof DefaultApigetDashboardStatsTransactions
   */
  startTimestamp?: number;
  /**
   *
   * @type number
   * @memberof DefaultApigetDashboardStatsTransactions
   */
  endTimestamp?: number;
}

export interface DefaultApiGetImportImportIdRequest {
  /**
   *
   * @type string
   * @memberof DefaultApigetImportImportId
   */
  importId: string;
}

export interface DefaultApiGetPulseManualRiskAssignmentRequest {
  /**
   * UserID of the user to get manual risk assignment settings
   * @type string
   * @memberof DefaultApigetPulseManualRiskAssignment
   */
  userId: string;
}

export interface DefaultApiGetPulseRiskClassificationRequest {}

export interface DefaultApiGetRuleImplementationsRequest {}

export interface DefaultApiGetRuleInstancesRequest {}

export interface DefaultApiGetRulesRequest {
  /**
   *
   * @type string
   * @memberof DefaultApigetRules
   */
  ruleId?: string;
}

export interface DefaultApiGetTenantsListRequest {}

export interface DefaultApiGetTenantsSettingsRequest {}

export interface DefaultApiGetTransactionRequest {
  /**
   *
   * @type string
   * @memberof DefaultApigetTransaction
   */
  transactionId: string;
}

export interface DefaultApiGetTransactionsListRequest {
  /**
   *
   * @type number
   * @memberof DefaultApigetTransactionsList
   */
  limit: number;
  /**
   *
   * @type number
   * @memberof DefaultApigetTransactionsList
   */
  skip: number;
  /**
   *
   * @type number
   * @memberof DefaultApigetTransactionsList
   */
  beforeTimestamp: number;
  /**
   *
   * @type number
   * @memberof DefaultApigetTransactionsList
   */
  afterTimestamp?: number;
  /**
   *
   * @type string
   * @memberof DefaultApigetTransactionsList
   */
  filterId?: string;
  /**
   *
   * @type RuleAction
   * @memberof DefaultApigetTransactionsList
   */
  filterOutStatus?: RuleAction;
  /**
   *
   * @type Array&lt;string&gt;
   * @memberof DefaultApigetTransactionsList
   */
  filterRulesExecuted?: Array<string>;
  /**
   *
   * @type Array&lt;string&gt;
   * @memberof DefaultApigetTransactionsList
   */
  filterRulesHit?: Array<string>;
  /**
   *
   * @type string
   * @memberof DefaultApigetTransactionsList
   */
  transactionType?: string;
  /**
   *
   * @type Array&lt;string&gt;
   * @memberof DefaultApigetTransactionsList
   */
  filterOriginCurrencies?: Array<string>;
  /**
   *
   * @type Array&lt;string&gt;
   * @memberof DefaultApigetTransactionsList
   */
  filterDestinationCurrencies?: Array<string>;
  /**
   *
   * @type string
   * @memberof DefaultApigetTransactionsList
   */
  sortField?: string;
  /**
   *
   * @type string
   * @memberof DefaultApigetTransactionsList
   */
  sortOrder?: string;
  /**
   *
   * @type string
   * @memberof DefaultApigetTransactionsList
   */
  filterOriginUserId?: string;
  /**
   *
   * @type string
   * @memberof DefaultApigetTransactionsList
   */
  filterDestinationUserId?: string;
}

export interface DefaultApiGetTransactionsListExportRequest {
  /**
   *
   * @type number
   * @memberof DefaultApigetTransactionsListExport
   */
  limit: number;
  /**
   *
   * @type number
   * @memberof DefaultApigetTransactionsListExport
   */
  skip: number;
  /**
   *
   * @type number
   * @memberof DefaultApigetTransactionsListExport
   */
  beforeTimestamp: number;
  /**
   *
   * @type number
   * @memberof DefaultApigetTransactionsListExport
   */
  afterTimestamp?: number;
  /**
   *
   * @type string
   * @memberof DefaultApigetTransactionsListExport
   */
  filterId?: string;
  /**
   *
   * @type Array&lt;string&gt;
   * @memberof DefaultApigetTransactionsListExport
   */
  filterRulesExecuted?: Array<string>;
  /**
   *
   * @type Array&lt;string&gt;
   * @memberof DefaultApigetTransactionsListExport
   */
  filterRulesHit?: Array<string>;
  /**
   *
   * @type RuleAction
   * @memberof DefaultApigetTransactionsListExport
   */
  filterOutStatus?: RuleAction;
  /**
   *
   * @type string
   * @memberof DefaultApigetTransactionsListExport
   */
  sortField?: string;
  /**
   *
   * @type string
   * @memberof DefaultApigetTransactionsListExport
   */
  sortOrder?: string;
}

export interface DefaultApiPostApikeyRequest {
  /**
   * Tenant ID
   * @type string
   * @memberof DefaultApipostApikey
   */
  tenantId?: string;
  /**
   * AWS Gateway usage plan ID
   * @type string
   * @memberof DefaultApipostApikey
   */
  usagePlanId?: string;
}

export interface DefaultApiPostBusinessUsersUserIdFilesRequest {
  /**
   *
   * @type string
   * @memberof DefaultApipostBusinessUsersUserIdFiles
   */
  userId: string;
  /**
   *
   * @type FileInfo
   * @memberof DefaultApipostBusinessUsersUserIdFiles
   */
  FileInfo?: FileInfo;
}

export interface DefaultApiPostConsumerUsersUserIdFilesRequest {
  /**
   *
   * @type string
   * @memberof DefaultApipostConsumerUsersUserIdFiles
   */
  userId: string;
  /**
   *
   * @type FileInfo
   * @memberof DefaultApipostConsumerUsersUserIdFiles
   */
  FileInfo?: FileInfo;
}

export interface DefaultApiPostGetPresignedUrlRequest {}

export interface DefaultApiPostIamRuleInstancesRequest {
  /**
   * Tenant ID
   * @type string
   * @memberof DefaultApipostIamRuleInstances
   */
  tenantId?: string;
  /**
   *
   * @type RuleInstance
   * @memberof DefaultApipostIamRuleInstances
   */
  RuleInstance?: RuleInstance;
}

export interface DefaultApiPostIamRulesRequest {
  /**
   * Tenant ID
   * @type string
   * @memberof DefaultApipostIamRules
   */
  tenantId?: string;
  /**
   *
   * @type Rule
   * @memberof DefaultApipostIamRules
   */
  Rule?: Rule;
}

export interface DefaultApiPostImportRequest {
  /**
   *
   * @type ImportRequest
   * @memberof DefaultApipostImport
   */
  ImportRequest?: ImportRequest;
}

export interface DefaultApiPostListsRequest {
  /**
   *
   * @type ListImportRequest
   * @memberof DefaultApipostLists
   */
  ListImportRequest?: ListImportRequest;
}

export interface DefaultApiPostPulseRiskClassificationRequest {
  /**
   *
   * @type Array&lt;RiskClassificationScore&gt;
   * @memberof DefaultApipostPulseRiskClassification
   */
  RiskClassificationScore?: Array<RiskClassificationScore>;
}

export interface DefaultApiPostRuleInstancesRequest {
  /**
   *
   * @type RuleInstance
   * @memberof DefaultApipostRuleInstances
   */
  RuleInstance?: RuleInstance;
}

export interface DefaultApiPostRulesRequest {
  /**
   *
   * @type Rule
   * @memberof DefaultApipostRules
   */
  Rule?: Rule;
}

export interface DefaultApiPostTenantsSettingsRequest {
  /**
   *
   * @type TenantSettings
   * @memberof DefaultApipostTenantsSettings
   */
  TenantSettings?: TenantSettings;
}

export interface DefaultApiPostTransactionsCommentsRequest {
  /**
   *
   * @type string
   * @memberof DefaultApipostTransactionsComments
   */
  transactionId: string;
  /**
   *
   * @type Comment
   * @memberof DefaultApipostTransactionsComments
   */
  Comment?: Comment;
}

export interface DefaultApiPostTransactionsTransactionIdRequest {
  /**
   *
   * @type string
   * @memberof DefaultApipostTransactionsTransactionId
   */
  transactionId: string;
  /**
   *
   * @type TransactionUpdateRequest
   * @memberof DefaultApipostTransactionsTransactionId
   */
  TransactionUpdateRequest?: TransactionUpdateRequest;
}

export interface DefaultApiPulseManualRiskAssignmentRequest {
  /**
   * UserID of the user whose risk is being manually assigned
   * @type string
   * @memberof DefaultApipulseManualRiskAssignment
   */
  userId: string;
  /**
   *
   * @type ManualRiskAssignmentPayload
   * @memberof DefaultApipulseManualRiskAssignment
   */
  ManualRiskAssignmentPayload?: ManualRiskAssignmentPayload;
}

export interface DefaultApiPutRuleInstancesRuleInstanceIdRequest {
  /**
   *
   * @type string
   * @memberof DefaultApiputRuleInstancesRuleInstanceId
   */
  ruleInstanceId: string;
  /**
   *
   * @type RuleInstance
   * @memberof DefaultApiputRuleInstancesRuleInstanceId
   */
  RuleInstance?: RuleInstance;
}

export interface DefaultApiPutRuleRuleIdRequest {
  /**
   *
   * @type string
   * @memberof DefaultApiputRuleRuleId
   */
  ruleId: string;
  /**
   *
   * @type Rule
   * @memberof DefaultApiputRuleRuleId
   */
  Rule?: Rule;
}

export class ObjectDefaultApi {
  private api: ObservableDefaultApi;

  public constructor(
    configuration: Configuration,
    requestFactory?: DefaultApiRequestFactory,
    responseProcessor?: DefaultApiResponseProcessor,
  ) {
    this.api = new ObservableDefaultApi(configuration, requestFactory, responseProcessor);
  }

  /**
   * Account - Change Tenant
   * @param param the request object
   */
  public accountsChangeTenant(
    param: DefaultApiAccountsChangeTenantRequest,
    options?: Configuration,
  ): Promise<void> {
    return this.api
      .accountsChangeTenant(param.userId, param.ChangeTenantPayload, options)
      .toPromise();
  }

  /**
   * Account - Delete
   * @param param the request object
   */
  public accountsDelete(
    param: DefaultApiAccountsDeleteRequest,
    options?: Configuration,
  ): Promise<void> {
    return this.api.accountsDelete(param.userId, options).toPromise();
  }

  /**
   * Account - Invite
   * @param param the request object
   */
  public accountsInvite(
    param: DefaultApiAccountsInviteRequest = {},
    options?: Configuration,
  ): Promise<Account> {
    return this.api.accountsInvite(param.AccountInvitePayload, options).toPromise();
  }

  /**
   * Business User Files - Delete
   * @param param the request object
   */
  public deleteBusinessUsersUserIdFilesFileId(
    param: DefaultApiDeleteBusinessUsersUserIdFilesFileIdRequest,
    options?: Configuration,
  ): Promise<void> {
    return this.api
      .deleteBusinessUsersUserIdFilesFileId(param.userId, param.fileId, options)
      .toPromise();
  }

  /**
   * Consumer User Files - Delete
   * @param param the request object
   */
  public deleteConsumerUsersUserIdFilesFileId(
    param: DefaultApiDeleteConsumerUsersUserIdFilesFileIdRequest,
    options?: Configuration,
  ): Promise<void> {
    return this.api
      .deleteConsumerUsersUserIdFilesFileId(param.userId, param.fileId, options)
      .toPromise();
  }

  /**
   * Rule Instance - Delete
   * @param param the request object
   */
  public deleteRuleInstancesRuleInstanceId(
    param: DefaultApiDeleteRuleInstancesRuleInstanceIdRequest,
    options?: Configuration,
  ): Promise<void> {
    return this.api.deleteRuleInstancesRuleInstanceId(param.ruleInstanceId, options).toPromise();
  }

  /**
   * Rule - Delete
   * @param param the request object
   */
  public deleteRulesRuleId(
    param: DefaultApiDeleteRulesRuleIdRequest,
    options?: Configuration,
  ): Promise<void> {
    return this.api.deleteRulesRuleId(param.ruleId, options).toPromise();
  }

  /**
   * Delete a Transaction Comment
   * @param param the request object
   */
  public deleteTransactionsTransactionIdCommentsCommentId(
    param: DefaultApiDeleteTransactionsTransactionIdCommentsCommentIdRequest,
    options?: Configuration,
  ): Promise<void> {
    return this.api
      .deleteTransactionsTransactionIdCommentsCommentId(
        param.transactionId,
        param.commentId,
        options,
      )
      .toPromise();
  }

  /**
   * Account - List
   * @param param the request object
   */
  public getAccounts(
    param: DefaultApiGetAccountsRequest = {},
    options?: Configuration,
  ): Promise<Array<Account>> {
    return this.api.getAccounts(options).toPromise();
  }

  /**
   * Business Users - Item - Get
   * @param param the request object
   */
  public getBusinessUsersItem(
    param: DefaultApiGetBusinessUsersItemRequest,
    options?: Configuration,
  ): Promise<InternalBusinessUser> {
    return this.api.getBusinessUsersItem(param.userId, options).toPromise();
  }

  /**
   * Business Users - List
   * @param param the request object
   */
  public getBusinessUsersList(
    param: DefaultApiGetBusinessUsersListRequest,
    options?: Configuration,
  ): Promise<BusinessUsersListResponse> {
    return this.api
      .getBusinessUsersList(
        param.limit,
        param.skip,
        param.beforeTimestamp,
        param.afterTimestamp,
        param.filterId,
        options,
      )
      .toPromise();
  }

  /**
   * Consumer Users - Item - Get
   * @param param the request object
   */
  public getConsumerUsersItem(
    param: DefaultApiGetConsumerUsersItemRequest,
    options?: Configuration,
  ): Promise<InternalConsumerUser> {
    return this.api.getConsumerUsersItem(param.userId, options).toPromise();
  }

  /**
   * Consumer Users - List
   * @param param the request object
   */
  public getConsumerUsersList(
    param: DefaultApiGetConsumerUsersListRequest,
    options?: Configuration,
  ): Promise<ConsumerUsersListResponse> {
    return this.api
      .getConsumerUsersList(
        param.limit,
        param.skip,
        param.beforeTimestamp,
        param.afterTimestamp,
        param.filterId,
        options,
      )
      .toPromise();
  }

  /**
   * DashboardStats - Hits per user
   * @param param the request object
   */
  public getDashboardStatsHitsPerUser(
    param: DefaultApiGetDashboardStatsHitsPerUserRequest = {},
    options?: Configuration,
  ): Promise<DashboardStatsHitsPerUser> {
    return this.api
      .getDashboardStatsHitsPerUser(param.startTimestamp, param.endTimestamp, options)
      .toPromise();
  }

  /**
   * DashboardStats - Rule hit
   * @param param the request object
   */
  public getDashboardStatsRuleHit(
    param: DefaultApiGetDashboardStatsRuleHitRequest = {},
    options?: Configuration,
  ): Promise<DashboardStatsRulesCount> {
    return this.api
      .getDashboardStatsRuleHit(param.startTimestamp, param.endTimestamp, options)
      .toPromise();
  }

  /**
   * DashboardStats - Transactions
   * @param param the request object
   */
  public getDashboardStatsTransactions(
    param: DefaultApiGetDashboardStatsTransactionsRequest = {},
    options?: Configuration,
  ): Promise<DashboardStatsTransactionsCount> {
    return this.api
      .getDashboardStatsTransactions(param.startTimestamp, param.endTimestamp, options)
      .toPromise();
  }

  /**
   * Import - Get Import Info
   * @param param the request object
   */
  public getImportImportId(
    param: DefaultApiGetImportImportIdRequest,
    options?: Configuration,
  ): Promise<FileImport> {
    return this.api.getImportImportId(param.importId, options).toPromise();
  }

  /**
   * Risk Level - Get Manual Assignment
   * @param param the request object
   */
  public getPulseManualRiskAssignment(
    param: DefaultApiGetPulseManualRiskAssignmentRequest,
    options?: Configuration,
  ): Promise<ManualRiskAssignmentUserState> {
    return this.api.getPulseManualRiskAssignment(param.userId, options).toPromise();
  }

  /**
   * Risk classification - GET
   * @param param the request object
   */
  public getPulseRiskClassification(
    param: DefaultApiGetPulseRiskClassificationRequest = {},
    options?: Configuration,
  ): Promise<Array<RiskClassificationScore>> {
    return this.api.getPulseRiskClassification(options).toPromise();
  }

  /**
   * Rule Implementations - List
   * @param param the request object
   */
  public getRuleImplementations(
    param: DefaultApiGetRuleImplementationsRequest = {},
    options?: Configuration,
  ): Promise<Array<RuleImplementation>> {
    return this.api.getRuleImplementations(options).toPromise();
  }

  /**
   * Rule Instance - List
   * @param param the request object
   */
  public getRuleInstances(
    param: DefaultApiGetRuleInstancesRequest = {},
    options?: Configuration,
  ): Promise<Array<RuleInstance>> {
    return this.api.getRuleInstances(options).toPromise();
  }

  /**
   * Rules - List
   * @param param the request object
   */
  public getRules(
    param: DefaultApiGetRulesRequest = {},
    options?: Configuration,
  ): Promise<Array<Rule>> {
    return this.api.getRules(param.ruleId, options).toPromise();
  }

  /**
   * Tenant - List
   * @param param the request object
   */
  public getTenantsList(
    param: DefaultApiGetTenantsListRequest = {},
    options?: Configuration,
  ): Promise<Array<Tenant>> {
    return this.api.getTenantsList(options).toPromise();
  }

  /**
   * Tenant - Get Settings
   * @param param the request object
   */
  public getTenantsSettings(
    param: DefaultApiGetTenantsSettingsRequest = {},
    options?: Configuration,
  ): Promise<TenantSettings> {
    return this.api.getTenantsSettings(options).toPromise();
  }

  /**
   * Transaction - Get
   * @param param the request object
   */
  public getTransaction(
    param: DefaultApiGetTransactionRequest,
    options?: Configuration,
  ): Promise<TransactionCaseManagement> {
    return this.api.getTransaction(param.transactionId, options).toPromise();
  }

  /**
   * Transaction - List
   * @param param the request object
   */
  public getTransactionsList(
    param: DefaultApiGetTransactionsListRequest,
    options?: Configuration,
  ): Promise<TransactionsListResponse> {
    return this.api
      .getTransactionsList(
        param.limit,
        param.skip,
        param.beforeTimestamp,
        param.afterTimestamp,
        param.filterId,
        param.filterOutStatus,
        param.filterRulesExecuted,
        param.filterRulesHit,
        param.transactionType,
        param.filterOriginCurrencies,
        param.filterDestinationCurrencies,
        param.sortField,
        param.sortOrder,
        param.filterOriginUserId,
        param.filterDestinationUserId,
        options,
      )
      .toPromise();
  }

  /**
   * Transaction - Export
   * @param param the request object
   */
  public getTransactionsListExport(
    param: DefaultApiGetTransactionsListExportRequest,
    options?: Configuration,
  ): Promise<InlineResponse200> {
    return this.api
      .getTransactionsListExport(
        param.limit,
        param.skip,
        param.beforeTimestamp,
        param.afterTimestamp,
        param.filterId,
        param.filterRulesExecuted,
        param.filterRulesHit,
        param.filterOutStatus,
        param.sortField,
        param.sortOrder,
        options,
      )
      .toPromise();
  }

  /**
   * Generate a new Tarpon API key for a tenant
   * Tarpon API Key - Create
   * @param param the request object
   */
  public postApikey(
    param: DefaultApiPostApikeyRequest = {},
    options?: Configuration,
  ): Promise<void> {
    return this.api.postApikey(param.tenantId, param.usagePlanId, options).toPromise();
  }

  /**
   * Business User Files - Create
   * @param param the request object
   */
  public postBusinessUsersUserIdFiles(
    param: DefaultApiPostBusinessUsersUserIdFilesRequest,
    options?: Configuration,
  ): Promise<void> {
    return this.api.postBusinessUsersUserIdFiles(param.userId, param.FileInfo, options).toPromise();
  }

  /**
   * Consumer User Files - Create
   * @param param the request object
   */
  public postConsumerUsersUserIdFiles(
    param: DefaultApiPostConsumerUsersUserIdFilesRequest,
    options?: Configuration,
  ): Promise<void> {
    return this.api.postConsumerUsersUserIdFiles(param.userId, param.FileInfo, options).toPromise();
  }

  /**
   * Get a presigned URL for uploading a file
   * Files - Get Presigned URL
   * @param param the request object
   */
  public postGetPresignedUrl(
    param: DefaultApiPostGetPresignedUrlRequest = {},
    options?: Configuration,
  ): Promise<PresignedUrlResponse> {
    return this.api.postGetPresignedUrl(options).toPromise();
  }

  /**
   * Rule Instance - Create
   * @param param the request object
   */
  public postIamRuleInstances(
    param: DefaultApiPostIamRuleInstancesRequest = {},
    options?: Configuration,
  ): Promise<RuleInstance> {
    return this.api.postIamRuleInstances(param.tenantId, param.RuleInstance, options).toPromise();
  }

  /**
   * Rules - Create
   * @param param the request object
   */
  public postIamRules(
    param: DefaultApiPostIamRulesRequest = {},
    options?: Configuration,
  ): Promise<Rule> {
    return this.api.postIamRules(param.tenantId, param.Rule, options).toPromise();
  }

  /**
   * Import - Start to Import
   * @param param the request object
   */
  public postImport(
    param: DefaultApiPostImportRequest = {},
    options?: Configuration,
  ): Promise<ImportResponse> {
    return this.api.postImport(param.ImportRequest, options).toPromise();
  }

  /**
   * List Import
   * @param param the request object
   */
  public postLists(param: DefaultApiPostListsRequest = {}, options?: Configuration): Promise<void> {
    return this.api.postLists(param.ListImportRequest, options).toPromise();
  }

  /**
   * Risk classification - POST
   * @param param the request object
   */
  public postPulseRiskClassification(
    param: DefaultApiPostPulseRiskClassificationRequest = {},
    options?: Configuration,
  ): Promise<Array<RiskClassificationScore>> {
    return this.api.postPulseRiskClassification(param.RiskClassificationScore, options).toPromise();
  }

  /**
   * Rule Instance - Create
   * @param param the request object
   */
  public postRuleInstances(
    param: DefaultApiPostRuleInstancesRequest = {},
    options?: Configuration,
  ): Promise<RuleInstance> {
    return this.api.postRuleInstances(param.RuleInstance, options).toPromise();
  }

  /**
   * Rules - Create
   * @param param the request object
   */
  public postRules(param: DefaultApiPostRulesRequest = {}, options?: Configuration): Promise<Rule> {
    return this.api.postRules(param.Rule, options).toPromise();
  }

  /**
   * Tenant - POST Settings
   * @param param the request object
   */
  public postTenantsSettings(
    param: DefaultApiPostTenantsSettingsRequest = {},
    options?: Configuration,
  ): Promise<TenantSettings> {
    return this.api.postTenantsSettings(param.TenantSettings, options).toPromise();
  }

  /**
   * Create a Transaction Comment
   * @param param the request object
   */
  public postTransactionsComments(
    param: DefaultApiPostTransactionsCommentsRequest,
    options?: Configuration,
  ): Promise<Comment> {
    return this.api
      .postTransactionsComments(param.transactionId, param.Comment, options)
      .toPromise();
  }

  /**
   * Transaction - Update
   * @param param the request object
   */
  public postTransactionsTransactionId(
    param: DefaultApiPostTransactionsTransactionIdRequest,
    options?: Configuration,
  ): Promise<void> {
    return this.api
      .postTransactionsTransactionId(param.transactionId, param.TransactionUpdateRequest, options)
      .toPromise();
  }

  /**
   * Risk Level - Manual Assignment
   * @param param the request object
   */
  public pulseManualRiskAssignment(
    param: DefaultApiPulseManualRiskAssignmentRequest,
    options?: Configuration,
  ): Promise<ManualRiskAssignmentUserState> {
    return this.api
      .pulseManualRiskAssignment(param.userId, param.ManualRiskAssignmentPayload, options)
      .toPromise();
  }

  /**
   * Rule Instance - Update
   * @param param the request object
   */
  public putRuleInstancesRuleInstanceId(
    param: DefaultApiPutRuleInstancesRuleInstanceIdRequest,
    options?: Configuration,
  ): Promise<RuleInstance | any> {
    return this.api
      .putRuleInstancesRuleInstanceId(param.ruleInstanceId, param.RuleInstance, options)
      .toPromise();
  }

  /**
   * Rule - Update
   * @param param the request object
   */
  public putRuleRuleId(
    param: DefaultApiPutRuleRuleIdRequest,
    options?: Configuration,
  ): Promise<void> {
    return this.api.putRuleRuleId(param.ruleId, param.Rule, options).toPromise();
  }
}
