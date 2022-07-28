import { ResponseContext, RequestContext, HttpFile } from '../http/http';
import * as models from '../models/all';
import { Configuration } from '../configuration';

import { ACHDetails } from '../models/ACHDetails';
import { ACHDetails1 } from '../models/ACHDetails1';
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
import { CardDetails1 } from '../models/CardDetails1';
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
import { GenericBankAccountDetails1 } from '../models/GenericBankAccountDetails1';
import { HitRulesResult } from '../models/HitRulesResult';
import { IBANDetails } from '../models/IBANDetails';
import { IBANDetails1 } from '../models/IBANDetails1';
import { IBANPaymentMethod } from '../models/IBANPaymentMethod';
import { ImportRequest } from '../models/ImportRequest';
import { ImportResponse } from '../models/ImportResponse';
import { InlineResponse200 } from '../models/InlineResponse200';
import { InlineResponse400 } from '../models/InlineResponse400';
import { InternalBusinessUser } from '../models/InternalBusinessUser';
import { InternalBusinessUserAllOf } from '../models/InternalBusinessUserAllOf';
import { InternalConsumerUser } from '../models/InternalConsumerUser';
import { InternalConsumerUserAllOf } from '../models/InternalConsumerUserAllOf';
import { InternalConsumerUserAllOfUserStatus } from '../models/InternalConsumerUserAllOfUserStatus';
import { KYCStatus } from '../models/KYCStatus';
import { KYCStatusDetails } from '../models/KYCStatusDetails';
import { KYCStatusDetails1 } from '../models/KYCStatusDetails1';
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
import { RiskLevel1 } from '../models/RiskLevel1';
import { RiskLevelRuleActions } from '../models/RiskLevelRuleActions';
import { RiskLevelRuleParameters } from '../models/RiskLevelRuleParameters';
import { Rule } from '../models/Rule';
import { RuleAction } from '../models/RuleAction';
import { RuleAction1 } from '../models/RuleAction1';
import { RuleActionAlias } from '../models/RuleActionAlias';
import { RuleImplementation } from '../models/RuleImplementation';
import { RuleInstance } from '../models/RuleInstance';
import { SWIFTDetails } from '../models/SWIFTDetails';
import { SWIFTDetails1 } from '../models/SWIFTDetails1';
import { SWIFTPaymentMethod } from '../models/SWIFTPaymentMethod';
import { Tag } from '../models/Tag';
import { Tenant } from '../models/Tenant';
import { TenantSettings } from '../models/TenantSettings';
import { Transaction } from '../models/Transaction';
import { Transaction1 } from '../models/Transaction1';
import { TransactionAmountDetails } from '../models/TransactionAmountDetails';
import { TransactionCaseManagement } from '../models/TransactionCaseManagement';
import { TransactionCaseManagementAllOf } from '../models/TransactionCaseManagementAllOf';
import { TransactionEvent } from '../models/TransactionEvent';
import { TransactionLimits } from '../models/TransactionLimits';
import { TransactionLimits1 } from '../models/TransactionLimits1';
import { TransactionState } from '../models/TransactionState';
import { TransactionStatusChange } from '../models/TransactionStatusChange';
import { TransactionUpdateRequest } from '../models/TransactionUpdateRequest';
import { TransactionWithRulesResult } from '../models/TransactionWithRulesResult';
import { TransactionWithRulesResultAllOf } from '../models/TransactionWithRulesResultAllOf';
import { TransactionsListResponse } from '../models/TransactionsListResponse';
import { UPIDetails } from '../models/UPIDetails';
import { UPIDetails1 } from '../models/UPIDetails1';
import { UPIPaymentMethod } from '../models/UPIPaymentMethod';
import { User } from '../models/User';
import { UserDetails } from '../models/UserDetails';
import { UserDetails1 } from '../models/UserDetails1';
import { UserStatus } from '../models/UserStatus';
import { UserStatusDetails } from '../models/UserStatusDetails';
import { UserStatusDetails1 } from '../models/UserStatusDetails1';
import { WalletDetails } from '../models/WalletDetails';
import { WalletDetails1 } from '../models/WalletDetails1';
import { WalletPaymentMethod } from '../models/WalletPaymentMethod';
import { ObservableDefaultApi } from './ObservableAPI';

import { DefaultApiRequestFactory, DefaultApiResponseProcessor } from '../apis/DefaultApi';
export class PromiseDefaultApi {
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
   * @param userId
   * @param ChangeTenantPayload
   */
  public accountsChangeTenant(
    userId: string,
    ChangeTenantPayload?: ChangeTenantPayload,
    _options?: Configuration,
  ): Promise<void> {
    const result = this.api.accountsChangeTenant(userId, ChangeTenantPayload, _options);
    return result.toPromise();
  }

  /**
   * Account - Delete
   * @param userId
   */
  public accountsDelete(userId: string, _options?: Configuration): Promise<void> {
    const result = this.api.accountsDelete(userId, _options);
    return result.toPromise();
  }

  /**
   * Account - Invite
   * @param AccountInvitePayload
   */
  public accountsInvite(
    AccountInvitePayload?: AccountInvitePayload,
    _options?: Configuration,
  ): Promise<Account> {
    const result = this.api.accountsInvite(AccountInvitePayload, _options);
    return result.toPromise();
  }

  /**
   * Business User Files - Delete
   * @param userId
   * @param fileId
   */
  public deleteBusinessUsersUserIdFilesFileId(
    userId: string,
    fileId: string,
    _options?: Configuration,
  ): Promise<void> {
    const result = this.api.deleteBusinessUsersUserIdFilesFileId(userId, fileId, _options);
    return result.toPromise();
  }

  /**
   * Consumer User Files - Delete
   * @param userId
   * @param fileId
   */
  public deleteConsumerUsersUserIdFilesFileId(
    userId: string,
    fileId: string,
    _options?: Configuration,
  ): Promise<void> {
    const result = this.api.deleteConsumerUsersUserIdFilesFileId(userId, fileId, _options);
    return result.toPromise();
  }

  /**
   * Rule Instance - Delete
   * @param ruleInstanceId
   */
  public deleteRuleInstancesRuleInstanceId(
    ruleInstanceId: string,
    _options?: Configuration,
  ): Promise<void> {
    const result = this.api.deleteRuleInstancesRuleInstanceId(ruleInstanceId, _options);
    return result.toPromise();
  }

  /**
   * Rule - Delete
   * @param ruleId
   */
  public deleteRulesRuleId(ruleId: string, _options?: Configuration): Promise<void> {
    const result = this.api.deleteRulesRuleId(ruleId, _options);
    return result.toPromise();
  }

  /**
   * Delete a Transaction Comment
   * @param transactionId
   * @param commentId
   */
  public deleteTransactionsTransactionIdCommentsCommentId(
    transactionId: string,
    commentId: string,
    _options?: Configuration,
  ): Promise<void> {
    const result = this.api.deleteTransactionsTransactionIdCommentsCommentId(
      transactionId,
      commentId,
      _options,
    );
    return result.toPromise();
  }

  /**
   * Account - List
   */
  public getAccounts(_options?: Configuration): Promise<Array<Account>> {
    const result = this.api.getAccounts(_options);
    return result.toPromise();
  }

  /**
   * Business Users - Item - Get
   * @param userId
   */
  public getBusinessUsersItem(
    userId: string,
    _options?: Configuration,
  ): Promise<InternalBusinessUser> {
    const result = this.api.getBusinessUsersItem(userId, _options);
    return result.toPromise();
  }

  /**
   * Business Users - List
   * @param limit
   * @param skip
   * @param beforeTimestamp
   * @param afterTimestamp
   * @param filterId
   */
  public getBusinessUsersList(
    limit: number,
    skip: number,
    beforeTimestamp: number,
    afterTimestamp?: number,
    filterId?: string,
    _options?: Configuration,
  ): Promise<BusinessUsersListResponse> {
    const result = this.api.getBusinessUsersList(
      limit,
      skip,
      beforeTimestamp,
      afterTimestamp,
      filterId,
      _options,
    );
    return result.toPromise();
  }

  /**
   * Consumer Users - Item - Get
   * @param userId
   */
  public getConsumerUsersItem(
    userId: string,
    _options?: Configuration,
  ): Promise<InternalConsumerUser> {
    const result = this.api.getConsumerUsersItem(userId, _options);
    return result.toPromise();
  }

  /**
   * Consumer Users - List
   * @param limit
   * @param skip
   * @param beforeTimestamp
   * @param afterTimestamp
   * @param filterId
   */
  public getConsumerUsersList(
    limit: number,
    skip: number,
    beforeTimestamp: number,
    afterTimestamp?: number,
    filterId?: string,
    _options?: Configuration,
  ): Promise<ConsumerUsersListResponse> {
    const result = this.api.getConsumerUsersList(
      limit,
      skip,
      beforeTimestamp,
      afterTimestamp,
      filterId,
      _options,
    );
    return result.toPromise();
  }

  /**
   * DashboardStats - Hits per user
   * @param startTimestamp
   * @param endTimestamp
   */
  public getDashboardStatsHitsPerUser(
    startTimestamp?: number,
    endTimestamp?: number,
    _options?: Configuration,
  ): Promise<DashboardStatsHitsPerUser> {
    const result = this.api.getDashboardStatsHitsPerUser(startTimestamp, endTimestamp, _options);
    return result.toPromise();
  }

  /**
   * DashboardStats - Rule hit
   * @param startTimestamp
   * @param endTimestamp
   */
  public getDashboardStatsRuleHit(
    startTimestamp?: number,
    endTimestamp?: number,
    _options?: Configuration,
  ): Promise<DashboardStatsRulesCount> {
    const result = this.api.getDashboardStatsRuleHit(startTimestamp, endTimestamp, _options);
    return result.toPromise();
  }

  /**
   * DashboardStats - Transactions
   * @param startTimestamp
   * @param endTimestamp
   * @param granularity
   */
  public getDashboardStatsTransactions(
    startTimestamp?: number,
    endTimestamp?: number,
    granularity?: 'HOUR' | 'MONTH' | 'DAY',
    _options?: Configuration,
  ): Promise<DashboardStatsTransactionsCount> {
    const result = this.api.getDashboardStatsTransactions(
      startTimestamp,
      endTimestamp,
      granularity,
      _options,
    );
    return result.toPromise();
  }

  /**
   * Import - Get Import Info
   * @param importId
   */
  public getImportImportId(importId: string, _options?: Configuration): Promise<FileImport> {
    const result = this.api.getImportImportId(importId, _options);
    return result.toPromise();
  }

  /**
   * Risk Level - Get Manual Assignment
   * @param userId UserID of the user to get manual risk assignment settings
   */
  public getPulseManualRiskAssignment(
    userId: string,
    _options?: Configuration,
  ): Promise<ManualRiskAssignmentUserState> {
    const result = this.api.getPulseManualRiskAssignment(userId, _options);
    return result.toPromise();
  }

  /**
   * Risk classification - GET
   */
  public getPulseRiskClassification(
    _options?: Configuration,
  ): Promise<Array<RiskClassificationScore>> {
    const result = this.api.getPulseRiskClassification(_options);
    return result.toPromise();
  }

  /**
   * Rule Implementations - List
   */
  public getRuleImplementations(_options?: Configuration): Promise<Array<RuleImplementation>> {
    const result = this.api.getRuleImplementations(_options);
    return result.toPromise();
  }

  /**
   * Rule Instance - List
   */
  public getRuleInstances(_options?: Configuration): Promise<Array<RuleInstance>> {
    const result = this.api.getRuleInstances(_options);
    return result.toPromise();
  }

  /**
   * Rules - List
   * @param ruleId
   */
  public getRules(ruleId?: string, _options?: Configuration): Promise<Array<Rule>> {
    const result = this.api.getRules(ruleId, _options);
    return result.toPromise();
  }

  /**
   * Tenant - List
   */
  public getTenantsList(_options?: Configuration): Promise<Array<Tenant>> {
    const result = this.api.getTenantsList(_options);
    return result.toPromise();
  }

  /**
   * Tenant - Get Settings
   */
  public getTenantsSettings(_options?: Configuration): Promise<TenantSettings> {
    const result = this.api.getTenantsSettings(_options);
    return result.toPromise();
  }

  /**
   * Transaction - Get
   * @param transactionId
   */
  public getTransaction(
    transactionId: string,
    _options?: Configuration,
  ): Promise<TransactionCaseManagement> {
    const result = this.api.getTransaction(transactionId, _options);
    return result.toPromise();
  }

  /**
   * Transaction - List
   * @param limit
   * @param skip
   * @param beforeTimestamp
   * @param afterTimestamp
   * @param filterId
   * @param filterOutStatus
   * @param filterRulesExecuted
   * @param filterRulesHit
   * @param transactionType
   * @param filterOriginCurrencies
   * @param filterDestinationCurrencies
   * @param sortField
   * @param sortOrder
   * @param filterUserId
   * @param filterOriginUserId
   * @param filterDestinationUserId
   * @param includeUsers
   * @param includeEvents
   */
  public getTransactionsList(
    limit: number,
    skip: number,
    beforeTimestamp: number,
    afterTimestamp?: number,
    filterId?: string,
    filterOutStatus?: RuleAction,
    filterRulesExecuted?: Array<string>,
    filterRulesHit?: Array<string>,
    transactionType?: string,
    filterOriginCurrencies?: Array<string>,
    filterDestinationCurrencies?: Array<string>,
    sortField?: string,
    sortOrder?: string,
    filterUserId?: string,
    filterOriginUserId?: string,
    filterDestinationUserId?: string,
    includeUsers?: boolean,
    includeEvents?: boolean,
    _options?: Configuration,
  ): Promise<TransactionsListResponse> {
    const result = this.api.getTransactionsList(
      limit,
      skip,
      beforeTimestamp,
      afterTimestamp,
      filterId,
      filterOutStatus,
      filterRulesExecuted,
      filterRulesHit,
      transactionType,
      filterOriginCurrencies,
      filterDestinationCurrencies,
      sortField,
      sortOrder,
      filterUserId,
      filterOriginUserId,
      filterDestinationUserId,
      includeUsers,
      includeEvents,
      _options,
    );
    return result.toPromise();
  }

  /**
   * Transaction - Export
   * @param limit
   * @param skip
   * @param beforeTimestamp
   * @param afterTimestamp
   * @param filterId
   * @param filterRulesExecuted
   * @param filterRulesHit
   * @param filterOutStatus
   * @param sortField
   * @param sortOrder
   */
  public getTransactionsListExport(
    limit: number,
    skip: number,
    beforeTimestamp: number,
    afterTimestamp?: number,
    filterId?: string,
    filterRulesExecuted?: Array<string>,
    filterRulesHit?: Array<string>,
    filterOutStatus?: RuleAction,
    sortField?: string,
    sortOrder?: string,
    _options?: Configuration,
  ): Promise<InlineResponse200> {
    const result = this.api.getTransactionsListExport(
      limit,
      skip,
      beforeTimestamp,
      afterTimestamp,
      filterId,
      filterRulesExecuted,
      filterRulesHit,
      filterOutStatus,
      sortField,
      sortOrder,
      _options,
    );
    return result.toPromise();
  }

  /**
   * Generate a new Tarpon API key for a tenant
   * Tarpon API Key - Create
   * @param tenantId Tenant ID
   * @param usagePlanId AWS Gateway usage plan ID
   */
  public postApikey(
    tenantId?: string,
    usagePlanId?: string,
    _options?: Configuration,
  ): Promise<void> {
    const result = this.api.postApikey(tenantId, usagePlanId, _options);
    return result.toPromise();
  }

  /**
   * Business User Files - Create
   * @param userId
   * @param FileInfo
   */
  public postBusinessUsersUserIdFiles(
    userId: string,
    FileInfo?: FileInfo,
    _options?: Configuration,
  ): Promise<void> {
    const result = this.api.postBusinessUsersUserIdFiles(userId, FileInfo, _options);
    return result.toPromise();
  }

  /**
   * Consumer User Files - Create
   * @param userId
   * @param FileInfo
   */
  public postConsumerUsersUserIdFiles(
    userId: string,
    FileInfo?: FileInfo,
    _options?: Configuration,
  ): Promise<void> {
    const result = this.api.postConsumerUsersUserIdFiles(userId, FileInfo, _options);
    return result.toPromise();
  }

  /**
   * Get a presigned URL for uploading a file
   * Files - Get Presigned URL
   */
  public postGetPresignedUrl(_options?: Configuration): Promise<PresignedUrlResponse> {
    const result = this.api.postGetPresignedUrl(_options);
    return result.toPromise();
  }

  /**
   * Rule Instance - Create
   * @param tenantId Tenant ID
   * @param RuleInstance
   */
  public postIamRuleInstances(
    tenantId?: string,
    RuleInstance?: RuleInstance,
    _options?: Configuration,
  ): Promise<RuleInstance> {
    const result = this.api.postIamRuleInstances(tenantId, RuleInstance, _options);
    return result.toPromise();
  }

  /**
   * Rules - Create
   * @param tenantId Tenant ID
   * @param Rule
   */
  public postIamRules(tenantId?: string, Rule?: Rule, _options?: Configuration): Promise<Rule> {
    const result = this.api.postIamRules(tenantId, Rule, _options);
    return result.toPromise();
  }

  /**
   * Import - Start to Import
   * @param ImportRequest
   */
  public postImport(
    ImportRequest?: ImportRequest,
    _options?: Configuration,
  ): Promise<ImportResponse> {
    const result = this.api.postImport(ImportRequest, _options);
    return result.toPromise();
  }

  /**
   * List Import
   * @param ListImportRequest
   */
  public postLists(ListImportRequest?: ListImportRequest, _options?: Configuration): Promise<void> {
    const result = this.api.postLists(ListImportRequest, _options);
    return result.toPromise();
  }

  /**
   * Risk classification - POST
   * @param RiskClassificationScore
   */
  public postPulseRiskClassification(
    RiskClassificationScore?: Array<RiskClassificationScore>,
    _options?: Configuration,
  ): Promise<Array<RiskClassificationScore>> {
    const result = this.api.postPulseRiskClassification(RiskClassificationScore, _options);
    return result.toPromise();
  }

  /**
   * Rule Instance - Create
   * @param RuleInstance
   */
  public postRuleInstances(
    RuleInstance?: RuleInstance,
    _options?: Configuration,
  ): Promise<RuleInstance> {
    const result = this.api.postRuleInstances(RuleInstance, _options);
    return result.toPromise();
  }

  /**
   * Rules - Create
   * @param Rule
   */
  public postRules(Rule?: Rule, _options?: Configuration): Promise<Rule> {
    const result = this.api.postRules(Rule, _options);
    return result.toPromise();
  }

  /**
   * Tenant - POST Settings
   * @param TenantSettings
   */
  public postTenantsSettings(
    TenantSettings?: TenantSettings,
    _options?: Configuration,
  ): Promise<TenantSettings> {
    const result = this.api.postTenantsSettings(TenantSettings, _options);
    return result.toPromise();
  }

  /**
   * Create a Transaction Comment
   * @param transactionId
   * @param Comment
   */
  public postTransactionsComments(
    transactionId: string,
    Comment?: Comment,
    _options?: Configuration,
  ): Promise<Comment> {
    const result = this.api.postTransactionsComments(transactionId, Comment, _options);
    return result.toPromise();
  }

  /**
   * Transaction - Update
   * @param transactionId
   * @param TransactionUpdateRequest
   */
  public postTransactionsTransactionId(
    transactionId: string,
    TransactionUpdateRequest?: TransactionUpdateRequest,
    _options?: Configuration,
  ): Promise<void> {
    const result = this.api.postTransactionsTransactionId(
      transactionId,
      TransactionUpdateRequest,
      _options,
    );
    return result.toPromise();
  }

  /**
   * Risk Level - Manual Assignment
   * @param userId UserID of the user whose risk is being manually assigned
   * @param ManualRiskAssignmentPayload
   */
  public pulseManualRiskAssignment(
    userId: string,
    ManualRiskAssignmentPayload?: ManualRiskAssignmentPayload,
    _options?: Configuration,
  ): Promise<ManualRiskAssignmentUserState> {
    const result = this.api.pulseManualRiskAssignment(
      userId,
      ManualRiskAssignmentPayload,
      _options,
    );
    return result.toPromise();
  }

  /**
   * Rule Instance - Update
   * @param ruleInstanceId
   * @param RuleInstance
   */
  public putRuleInstancesRuleInstanceId(
    ruleInstanceId: string,
    RuleInstance?: RuleInstance,
    _options?: Configuration,
  ): Promise<RuleInstance | any> {
    const result = this.api.putRuleInstancesRuleInstanceId(ruleInstanceId, RuleInstance, _options);
    return result.toPromise();
  }

  /**
   * Rule - Update
   * @param ruleId
   * @param Rule
   */
  public putRuleRuleId(ruleId: string, Rule?: Rule, _options?: Configuration): Promise<void> {
    const result = this.api.putRuleRuleId(ruleId, Rule, _options);
    return result.toPromise();
  }
}
