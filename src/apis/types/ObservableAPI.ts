import { ResponseContext, RequestContext, HttpFile } from '../http/http';
import * as models from '../models/all';
import { Configuration } from '../configuration';
import { Observable, of, from } from '../rxjsStub';
import { mergeMap, map } from '../rxjsStub';
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
import { DashboardStatsHitsPerUser } from '../models/DashboardStatsHitsPerUser';
import { DashboardStatsHitsPerUserData } from '../models/DashboardStatsHitsPerUserData';
import { DashboardStatsTransactionsCount } from '../models/DashboardStatsTransactionsCount';
import { DashboardStatsTransactionsCountData } from '../models/DashboardStatsTransactionsCountData';
import { DeviceData } from '../models/DeviceData';
import { ExecutedRulesResult } from '../models/ExecutedRulesResult';
import { FailedRulesResult } from '../models/FailedRulesResult';
import { FileImport } from '../models/FileImport';
import { FileImportStatusChange } from '../models/FileImportStatusChange';
import { FileInfo } from '../models/FileInfo';
import { GenericBankAccountDetails } from '../models/GenericBankAccountDetails';
import { IBANDetails } from '../models/IBANDetails';
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
import { TransactionState } from '../models/TransactionState';
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
  public getBusinessUsersItem(userId: string, _options?: Configuration): Observable<Business> {
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
  public getConsumerUsersItem(userId: string, _options?: Configuration): Observable<User> {
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
   * DashboardStats - Transactions
   * @param timeframe MONTH, DAY or YEAR
   * @param endTimestamp
   */
  public getDashboardStatsTransactions(
    timeframe: 'WEEK' | 'MONTH' | 'DAY' | 'YEAR',
    endTimestamp?: number,
    _options?: Configuration,
  ): Observable<DashboardStatsTransactionsCount> {
    const requestContextPromise = this.requestFactory.getDashboardStatsTransactions(
      timeframe,
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
   */
  public getRules(_options?: Configuration): Observable<Array<Rule>> {
    const requestContextPromise = this.requestFactory.getRules(_options);

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
   * @param filterOriginUserId
   * @param filterDestinationUserId
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
    filterOriginUserId?: string,
    filterDestinationUserId?: string,
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
      filterOriginUserId,
      filterDestinationUserId,
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
