import { ResponseContext, RequestContext, HttpFile } from '../http/http';
import * as models from '../models/all';
import { Configuration } from '../configuration';

import { ACHDetails } from '../models/ACHDetails';
import { Account } from '../models/Account';
import { AccountInvitePayload } from '../models/AccountInvitePayload';
import { Address } from '../models/Address';
import { Address1 } from '../models/Address1';
import { Address2 } from '../models/Address2';
import { Amount } from '../models/Amount';
import { Assignment } from '../models/Assignment';
import { Business } from '../models/Business';
import { BusinessUsersListResponse } from '../models/BusinessUsersListResponse';
import { CardDetails } from '../models/CardDetails';
import { Comment } from '../models/Comment';
import { CompanyFinancialDetails } from '../models/CompanyFinancialDetails';
import { CompanyGeneralDetails } from '../models/CompanyGeneralDetails';
import { CompanyRegistrationDetails } from '../models/CompanyRegistrationDetails';
import { ConsumerName } from '../models/ConsumerName';
import { ConsumerUsersListResponse } from '../models/ConsumerUsersListResponse';
import { ContactDetails } from '../models/ContactDetails';
import { ContactDetails1 } from '../models/ContactDetails1';
import { DeviceData } from '../models/DeviceData';
import { ExecutedRulesResult } from '../models/ExecutedRulesResult';
import { FailedRulesResult } from '../models/FailedRulesResult';
import { FileImport } from '../models/FileImport';
import { FileImportStatusChange } from '../models/FileImportStatusChange';
import { FileInfo } from '../models/FileInfo';
import { IBANDetails } from '../models/IBANDetails';
import { ImportRequest } from '../models/ImportRequest';
import { ImportResponse } from '../models/ImportResponse';
import { LegalDocument } from '../models/LegalDocument';
import { LegalDocument1 } from '../models/LegalDocument1';
import { LegalEntity } from '../models/LegalEntity';
import { ListImportRequest } from '../models/ListImportRequest';
import { Person } from '../models/Person';
import { PresignedUrlResponse } from '../models/PresignedUrlResponse';
import { Rule } from '../models/Rule';
import { RuleAction } from '../models/RuleAction';
import { RuleAction1 } from '../models/RuleAction1';
import { RuleFailureException } from '../models/RuleFailureException';
import { RuleImplementation } from '../models/RuleImplementation';
import { RuleInstance } from '../models/RuleInstance';
import { SWIFTDetails } from '../models/SWIFTDetails';
import { Tag } from '../models/Tag';
import { Transaction } from '../models/Transaction';
import { TransactionAmountDetails } from '../models/TransactionAmountDetails';
import { TransactionCaseManagement } from '../models/TransactionCaseManagement';
import { TransactionCaseManagementAllOf } from '../models/TransactionCaseManagementAllOf';
import { TransactionLimits } from '../models/TransactionLimits';
import { TransactionLimits1 } from '../models/TransactionLimits1';
import { TransactionStatusChange } from '../models/TransactionStatusChange';
import { TransactionUpdateRequest } from '../models/TransactionUpdateRequest';
import { TransactionWithRulesResult } from '../models/TransactionWithRulesResult';
import { TransactionWithRulesResultAllOf } from '../models/TransactionWithRulesResultAllOf';
import { TransactionsListResponse } from '../models/TransactionsListResponse';
import { UPIDetails } from '../models/UPIDetails';
import { User } from '../models/User';
import { UserDetails } from '../models/UserDetails';
import { UserDetails1 } from '../models/UserDetails1';
import { WalletDetails } from '../models/WalletDetails';

import { ObservableDefaultApi } from './ObservableAPI';
import { DefaultApiRequestFactory, DefaultApiResponseProcessor } from '../apis/DefaultApi';

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

export interface DefaultApiGetDashboardStatsTransactionsRequest {
  /**
   * MONTH, DAY or YEAR
   * @type &#39;MONTH&#39; | &#39;DAY&#39; | &#39;YEAR&#39;
   * @memberof DefaultApigetDashboardStatsTransactions
   */
  timeframe: 'MONTH' | 'DAY' | 'YEAR';
  /**
   *
   * @type string
   * @memberof DefaultApigetDashboardStatsTransactions
   */
  fromTimestamp?: string;
  /**
   *
   * @type any
   * @memberof DefaultApigetDashboardStatsTransactions
   */
  body?: any;
}

export interface DefaultApiGetImportImportIdRequest {
  /**
   *
   * @type string
   * @memberof DefaultApigetImportImportId
   */
  importId: string;
}

export interface DefaultApiGetRuleImplementationsRequest {}

export interface DefaultApiGetRuleInstancesRequest {}

export interface DefaultApiGetRulesRequest {}

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
   * @type RuleAction
   * @memberof DefaultApigetTransactionsList
   */
  filterOutStatus?: RuleAction;
}

export interface DefaultApiGetTransactionsPerUserListRequest {
  /**
   *
   * @type number
   * @memberof DefaultApigetTransactionsPerUserList
   */
  limit: number;
  /**
   *
   * @type number
   * @memberof DefaultApigetTransactionsPerUserList
   */
  skip: number;
  /**
   *
   * @type number
   * @memberof DefaultApigetTransactionsPerUserList
   */
  beforeTimestamp: number;
  /**
   *
   * @type string
   * @memberof DefaultApigetTransactionsPerUserList
   */
  userId: string;
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
   * DashboardStats - Transactions
   * @param param the request object
   */
  public getDashboardStatsTransactions(
    param: DefaultApiGetDashboardStatsTransactionsRequest,
    options?: Configuration,
  ): Promise<Set<any>> {
    return this.api
      .getDashboardStatsTransactions(param.timeframe, param.fromTimestamp, param.body, options)
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
    return this.api.getRules(options).toPromise();
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
        param.filterRulesExecuted,
        param.filterRulesHit,
        param.filterOutStatus,
        options,
      )
      .toPromise();
  }

  /**
   * Transaction Per User - List
   * @param param the request object
   */
  public getTransactionsPerUserList(
    param: DefaultApiGetTransactionsPerUserListRequest,
    options?: Configuration,
  ): Promise<TransactionsListResponse> {
    return this.api
      .getTransactionsPerUserList(
        param.limit,
        param.skip,
        param.beforeTimestamp,
        param.userId,
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
