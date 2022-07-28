import { ResponseContext, RequestContext, HttpFile } from '../http/http';
import * as models from '../models/all';
import { Configuration } from '../configuration';
import { Observable, of, from } from '../rxjsStub';
import { mergeMap, map } from '../rxjsStub';
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

import { DefaultApiRequestFactory, DefaultApiResponseProcessor } from '../apis/DefaultApi';
export class ObservableDefaultApi {
  private requestFactory: DefaultApiRequestFactory;
  private responseProcessor: DefaultApiResponseProcessor;
  private configuration: Configuration;

  public constructor(
    configuration: Configuration,
    requestFactory?: DefaultApiRequestFactory,
    responseProcessor?: DefaultApiResponseProcessor,
  ) {
    this.configuration = configuration;
    this.requestFactory = requestFactory || new DefaultApiRequestFactory(configuration);
    this.responseProcessor = responseProcessor || new DefaultApiResponseProcessor();
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
  ): Observable<void> {
    const requestContextPromise = this.requestFactory.accountsChangeTenant(
      userId,
      ChangeTenantPayload,
      _options,
    );

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) => this.responseProcessor.accountsChangeTenant(rsp)),
          );
        }),
      );
  }

  /**
   * Account - Delete
   * @param userId
   */
  public accountsDelete(userId: string, _options?: Configuration): Observable<void> {
    const requestContextPromise = this.requestFactory.accountsDelete(userId, _options);

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) => this.responseProcessor.accountsDelete(rsp)),
          );
        }),
      );
  }

  /**
   * Account - Invite
   * @param AccountInvitePayload
   */
  public accountsInvite(
    AccountInvitePayload?: AccountInvitePayload,
    _options?: Configuration,
  ): Observable<Account> {
    const requestContextPromise = this.requestFactory.accountsInvite(
      AccountInvitePayload,
      _options,
    );

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) => this.responseProcessor.accountsInvite(rsp)),
          );
        }),
      );
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
  ): Observable<void> {
    const requestContextPromise = this.requestFactory.deleteBusinessUsersUserIdFilesFileId(
      userId,
      fileId,
      _options,
    );

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) =>
              this.responseProcessor.deleteBusinessUsersUserIdFilesFileId(rsp),
            ),
          );
        }),
      );
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
  ): Observable<void> {
    const requestContextPromise = this.requestFactory.deleteConsumerUsersUserIdFilesFileId(
      userId,
      fileId,
      _options,
    );

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) =>
              this.responseProcessor.deleteConsumerUsersUserIdFilesFileId(rsp),
            ),
          );
        }),
      );
  }

  /**
   * Rule Instance - Delete
   * @param ruleInstanceId
   */
  public deleteRuleInstancesRuleInstanceId(
    ruleInstanceId: string,
    _options?: Configuration,
  ): Observable<void> {
    const requestContextPromise = this.requestFactory.deleteRuleInstancesRuleInstanceId(
      ruleInstanceId,
      _options,
    );

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) =>
              this.responseProcessor.deleteRuleInstancesRuleInstanceId(rsp),
            ),
          );
        }),
      );
  }

  /**
   * Rule - Delete
   * @param ruleId
   */
  public deleteRulesRuleId(ruleId: string, _options?: Configuration): Observable<void> {
    const requestContextPromise = this.requestFactory.deleteRulesRuleId(ruleId, _options);

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) => this.responseProcessor.deleteRulesRuleId(rsp)),
          );
        }),
      );
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
  ): Observable<void> {
    const requestContextPromise =
      this.requestFactory.deleteTransactionsTransactionIdCommentsCommentId(
        transactionId,
        commentId,
        _options,
      );

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) =>
              this.responseProcessor.deleteTransactionsTransactionIdCommentsCommentId(rsp),
            ),
          );
        }),
      );
  }

  /**
   * Account - List
   */
  public getAccounts(_options?: Configuration): Observable<Array<Account>> {
    const requestContextPromise = this.requestFactory.getAccounts(_options);

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) => this.responseProcessor.getAccounts(rsp)),
          );
        }),
      );
  }

  /**
   * Business Users - Item - Get
   * @param userId
   */
  public getBusinessUsersItem(
    userId: string,
    _options?: Configuration,
  ): Observable<InternalBusinessUser> {
    const requestContextPromise = this.requestFactory.getBusinessUsersItem(userId, _options);

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) => this.responseProcessor.getBusinessUsersItem(rsp)),
          );
        }),
      );
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
  ): Observable<BusinessUsersListResponse> {
    const requestContextPromise = this.requestFactory.getBusinessUsersList(
      limit,
      skip,
      beforeTimestamp,
      afterTimestamp,
      filterId,
      _options,
    );

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) => this.responseProcessor.getBusinessUsersList(rsp)),
          );
        }),
      );
  }

  /**
   * Consumer Users - Item - Get
   * @param userId
   */
  public getConsumerUsersItem(
    userId: string,
    _options?: Configuration,
  ): Observable<InternalConsumerUser> {
    const requestContextPromise = this.requestFactory.getConsumerUsersItem(userId, _options);

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) => this.responseProcessor.getConsumerUsersItem(rsp)),
          );
        }),
      );
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
  ): Observable<ConsumerUsersListResponse> {
    const requestContextPromise = this.requestFactory.getConsumerUsersList(
      limit,
      skip,
      beforeTimestamp,
      afterTimestamp,
      filterId,
      _options,
    );

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) => this.responseProcessor.getConsumerUsersList(rsp)),
          );
        }),
      );
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
  ): Observable<DashboardStatsHitsPerUser> {
    const requestContextPromise = this.requestFactory.getDashboardStatsHitsPerUser(
      startTimestamp,
      endTimestamp,
      _options,
    );

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) => this.responseProcessor.getDashboardStatsHitsPerUser(rsp)),
          );
        }),
      );
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
  ): Observable<DashboardStatsRulesCount> {
    const requestContextPromise = this.requestFactory.getDashboardStatsRuleHit(
      startTimestamp,
      endTimestamp,
      _options,
    );

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) => this.responseProcessor.getDashboardStatsRuleHit(rsp)),
          );
        }),
      );
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
  ): Observable<DashboardStatsTransactionsCount> {
    const requestContextPromise = this.requestFactory.getDashboardStatsTransactions(
      startTimestamp,
      endTimestamp,
      granularity,
      _options,
    );

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) =>
              this.responseProcessor.getDashboardStatsTransactions(rsp),
            ),
          );
        }),
      );
  }

  /**
   * Import - Get Import Info
   * @param importId
   */
  public getImportImportId(importId: string, _options?: Configuration): Observable<FileImport> {
    const requestContextPromise = this.requestFactory.getImportImportId(importId, _options);

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) => this.responseProcessor.getImportImportId(rsp)),
          );
        }),
      );
  }

  /**
   * Risk Level - Get Manual Assignment
   * @param userId UserID of the user to get manual risk assignment settings
   */
  public getPulseManualRiskAssignment(
    userId: string,
    _options?: Configuration,
  ): Observable<ManualRiskAssignmentUserState> {
    const requestContextPromise = this.requestFactory.getPulseManualRiskAssignment(
      userId,
      _options,
    );

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) => this.responseProcessor.getPulseManualRiskAssignment(rsp)),
          );
        }),
      );
  }

  /**
   * Risk classification - GET
   */
  public getPulseRiskClassification(
    _options?: Configuration,
  ): Observable<Array<RiskClassificationScore>> {
    const requestContextPromise = this.requestFactory.getPulseRiskClassification(_options);

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) => this.responseProcessor.getPulseRiskClassification(rsp)),
          );
        }),
      );
  }

  /**
   * Rule Implementations - List
   */
  public getRuleImplementations(_options?: Configuration): Observable<Array<RuleImplementation>> {
    const requestContextPromise = this.requestFactory.getRuleImplementations(_options);

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) => this.responseProcessor.getRuleImplementations(rsp)),
          );
        }),
      );
  }

  /**
   * Rule Instance - List
   */
  public getRuleInstances(_options?: Configuration): Observable<Array<RuleInstance>> {
    const requestContextPromise = this.requestFactory.getRuleInstances(_options);

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) => this.responseProcessor.getRuleInstances(rsp)),
          );
        }),
      );
  }

  /**
   * Rules - List
   * @param ruleId
   */
  public getRules(ruleId?: string, _options?: Configuration): Observable<Array<Rule>> {
    const requestContextPromise = this.requestFactory.getRules(ruleId, _options);

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) => this.responseProcessor.getRules(rsp)),
          );
        }),
      );
  }

  /**
   * Tenant - List
   */
  public getTenantsList(_options?: Configuration): Observable<Array<Tenant>> {
    const requestContextPromise = this.requestFactory.getTenantsList(_options);

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) => this.responseProcessor.getTenantsList(rsp)),
          );
        }),
      );
  }

  /**
   * Tenant - Get Settings
   */
  public getTenantsSettings(_options?: Configuration): Observable<TenantSettings> {
    const requestContextPromise = this.requestFactory.getTenantsSettings(_options);

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) => this.responseProcessor.getTenantsSettings(rsp)),
          );
        }),
      );
  }

  /**
   * Transaction - Get
   * @param transactionId
   */
  public getTransaction(
    transactionId: string,
    _options?: Configuration,
  ): Observable<TransactionCaseManagement> {
    const requestContextPromise = this.requestFactory.getTransaction(transactionId, _options);

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) => this.responseProcessor.getTransaction(rsp)),
          );
        }),
      );
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
  ): Observable<TransactionsListResponse> {
    const requestContextPromise = this.requestFactory.getTransactionsList(
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

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) => this.responseProcessor.getTransactionsList(rsp)),
          );
        }),
      );
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
  ): Observable<InlineResponse200> {
    const requestContextPromise = this.requestFactory.getTransactionsListExport(
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

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) => this.responseProcessor.getTransactionsListExport(rsp)),
          );
        }),
      );
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
  ): Observable<void> {
    const requestContextPromise = this.requestFactory.postApikey(tenantId, usagePlanId, _options);

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) => this.responseProcessor.postApikey(rsp)),
          );
        }),
      );
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
  ): Observable<void> {
    const requestContextPromise = this.requestFactory.postBusinessUsersUserIdFiles(
      userId,
      FileInfo,
      _options,
    );

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) => this.responseProcessor.postBusinessUsersUserIdFiles(rsp)),
          );
        }),
      );
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
  ): Observable<void> {
    const requestContextPromise = this.requestFactory.postConsumerUsersUserIdFiles(
      userId,
      FileInfo,
      _options,
    );

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) => this.responseProcessor.postConsumerUsersUserIdFiles(rsp)),
          );
        }),
      );
  }

  /**
   * Get a presigned URL for uploading a file
   * Files - Get Presigned URL
   */
  public postGetPresignedUrl(_options?: Configuration): Observable<PresignedUrlResponse> {
    const requestContextPromise = this.requestFactory.postGetPresignedUrl(_options);

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) => this.responseProcessor.postGetPresignedUrl(rsp)),
          );
        }),
      );
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
  ): Observable<RuleInstance> {
    const requestContextPromise = this.requestFactory.postIamRuleInstances(
      tenantId,
      RuleInstance,
      _options,
    );

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) => this.responseProcessor.postIamRuleInstances(rsp)),
          );
        }),
      );
  }

  /**
   * Rules - Create
   * @param tenantId Tenant ID
   * @param Rule
   */
  public postIamRules(tenantId?: string, Rule?: Rule, _options?: Configuration): Observable<Rule> {
    const requestContextPromise = this.requestFactory.postIamRules(tenantId, Rule, _options);

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) => this.responseProcessor.postIamRules(rsp)),
          );
        }),
      );
  }

  /**
   * Import - Start to Import
   * @param ImportRequest
   */
  public postImport(
    ImportRequest?: ImportRequest,
    _options?: Configuration,
  ): Observable<ImportResponse> {
    const requestContextPromise = this.requestFactory.postImport(ImportRequest, _options);

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) => this.responseProcessor.postImport(rsp)),
          );
        }),
      );
  }

  /**
   * List Import
   * @param ListImportRequest
   */
  public postLists(
    ListImportRequest?: ListImportRequest,
    _options?: Configuration,
  ): Observable<void> {
    const requestContextPromise = this.requestFactory.postLists(ListImportRequest, _options);

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) => this.responseProcessor.postLists(rsp)),
          );
        }),
      );
  }

  /**
   * Risk classification - POST
   * @param RiskClassificationScore
   */
  public postPulseRiskClassification(
    RiskClassificationScore?: Array<RiskClassificationScore>,
    _options?: Configuration,
  ): Observable<Array<RiskClassificationScore>> {
    const requestContextPromise = this.requestFactory.postPulseRiskClassification(
      RiskClassificationScore,
      _options,
    );

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) => this.responseProcessor.postPulseRiskClassification(rsp)),
          );
        }),
      );
  }

  /**
   * Rule Instance - Create
   * @param RuleInstance
   */
  public postRuleInstances(
    RuleInstance?: RuleInstance,
    _options?: Configuration,
  ): Observable<RuleInstance> {
    const requestContextPromise = this.requestFactory.postRuleInstances(RuleInstance, _options);

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) => this.responseProcessor.postRuleInstances(rsp)),
          );
        }),
      );
  }

  /**
   * Rules - Create
   * @param Rule
   */
  public postRules(Rule?: Rule, _options?: Configuration): Observable<Rule> {
    const requestContextPromise = this.requestFactory.postRules(Rule, _options);

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) => this.responseProcessor.postRules(rsp)),
          );
        }),
      );
  }

  /**
   * Tenant - POST Settings
   * @param TenantSettings
   */
  public postTenantsSettings(
    TenantSettings?: TenantSettings,
    _options?: Configuration,
  ): Observable<TenantSettings> {
    const requestContextPromise = this.requestFactory.postTenantsSettings(TenantSettings, _options);

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) => this.responseProcessor.postTenantsSettings(rsp)),
          );
        }),
      );
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
  ): Observable<Comment> {
    const requestContextPromise = this.requestFactory.postTransactionsComments(
      transactionId,
      Comment,
      _options,
    );

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) => this.responseProcessor.postTransactionsComments(rsp)),
          );
        }),
      );
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
  ): Observable<void> {
    const requestContextPromise = this.requestFactory.postTransactionsTransactionId(
      transactionId,
      TransactionUpdateRequest,
      _options,
    );

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) =>
              this.responseProcessor.postTransactionsTransactionId(rsp),
            ),
          );
        }),
      );
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
  ): Observable<ManualRiskAssignmentUserState> {
    const requestContextPromise = this.requestFactory.pulseManualRiskAssignment(
      userId,
      ManualRiskAssignmentPayload,
      _options,
    );

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) => this.responseProcessor.pulseManualRiskAssignment(rsp)),
          );
        }),
      );
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
  ): Observable<RuleInstance | any> {
    const requestContextPromise = this.requestFactory.putRuleInstancesRuleInstanceId(
      ruleInstanceId,
      RuleInstance,
      _options,
    );

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) =>
              this.responseProcessor.putRuleInstancesRuleInstanceId(rsp),
            ),
          );
        }),
      );
  }

  /**
   * Rule - Update
   * @param ruleId
   * @param Rule
   */
  public putRuleRuleId(ruleId: string, Rule?: Rule, _options?: Configuration): Observable<void> {
    const requestContextPromise = this.requestFactory.putRuleRuleId(ruleId, Rule, _options);

    // build promise chain
    let middlewarePreObservable = from<RequestContext>(requestContextPromise);
    for (let middleware of this.configuration.middleware) {
      middlewarePreObservable = middlewarePreObservable.pipe(
        mergeMap((ctx: RequestContext) => middleware.pre(ctx)),
      );
    }

    return middlewarePreObservable
      .pipe(mergeMap((ctx: RequestContext) => this.configuration.httpApi.send(ctx)))
      .pipe(
        mergeMap((response: ResponseContext) => {
          let middlewarePostObservable = of(response);
          for (let middleware of this.configuration.middleware) {
            middlewarePostObservable = middlewarePostObservable.pipe(
              mergeMap((rsp: ResponseContext) => middleware.post(rsp)),
            );
          }
          return middlewarePostObservable.pipe(
            map((rsp: ResponseContext) => this.responseProcessor.putRuleRuleId(rsp)),
          );
        }),
      );
  }
}
