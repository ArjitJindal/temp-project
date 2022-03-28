import { ResponseContext, RequestContext, HttpFile } from '../http/http';
import * as models from '../models/all';
import { Configuration } from '../configuration';

import { ACHDetails } from '../models/ACHDetails';
import { Address } from '../models/Address';
import { Address1 } from '../models/Address1';
import { Address2 } from '../models/Address2';
import { Amount } from '../models/Amount';
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
import { RuleFailureException } from '../models/RuleFailureException';
import { RuleInstance } from '../models/RuleInstance';
import { Tag } from '../models/Tag';
import { Transaction } from '../models/Transaction';
import { TransactionAmountDetails } from '../models/TransactionAmountDetails';
import { TransactionCaseManagement } from '../models/TransactionCaseManagement';
import { TransactionCaseManagementAllOf } from '../models/TransactionCaseManagementAllOf';
import { TransactionLimits } from '../models/TransactionLimits';
import { TransactionWithRulesResult } from '../models/TransactionWithRulesResult';
import { TransactionWithRulesResultAllOf } from '../models/TransactionWithRulesResultAllOf';
import { TransactionsListResponse } from '../models/TransactionsListResponse';
import { UPIDetails } from '../models/UPIDetails';
import { User } from '../models/User';
import { UserDetails } from '../models/UserDetails';
import { UserDetails1 } from '../models/UserDetails1';
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
   * Business Users - List
   * @param limit
   * @param skip
   * @param beforeTimestamp
   */
  public getBusinessUsersList(
    limit: number,
    skip: number,
    beforeTimestamp: number,
    _options?: Configuration,
  ): Promise<BusinessUsersListResponse> {
    const result = this.api.getBusinessUsersList(limit, skip, beforeTimestamp, _options);
    return result.toPromise();
  }

  /**
   * Consumer Users - List
   * @param limit
   * @param skip
   * @param beforeTimestamp
   */
  public getConsumerUsersList(
    limit: number,
    skip: number,
    beforeTimestamp: number,
    _options?: Configuration,
  ): Promise<ConsumerUsersListResponse> {
    const result = this.api.getConsumerUsersList(limit, skip, beforeTimestamp, _options);
    return result.toPromise();
  }

  /**
   * DashboardStats - Transactions
   * @param category
   * @param timeframe
   * @param fromTimestamp
   * @param body
   */
  public getDashboardStatsTransactions(
    category: number,
    timeframe: number,
    fromTimestamp?: string,
    body?: any,
    _options?: Configuration,
  ): Promise<Set<any>> {
    const result = this.api.getDashboardStatsTransactions(
      category,
      timeframe,
      fromTimestamp,
      body,
      _options,
    );
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
   */
  public getRules(_options?: Configuration): Promise<Array<Rule>> {
    const result = this.api.getRules(_options);
    return result.toPromise();
  }

  /**
   * Transaction - List
   * @param limit
   * @param skip
   * @param beforeTimestamp
   */
  public getTransactionsList(
    limit: number,
    skip: number,
    beforeTimestamp: number,
    _options?: Configuration,
  ): Promise<TransactionsListResponse> {
    const result = this.api.getTransactionsList(limit, skip, beforeTimestamp, _options);
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
   * Get a presigned URL for uploading a file
   * Files - Get Presigned URL
   */
  public postGetPresignedUrl(_options?: Configuration): Promise<PresignedUrlResponse> {
    const result = this.api.postGetPresignedUrl(_options);
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
