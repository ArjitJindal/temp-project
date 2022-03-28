import { ResponseContext, RequestContext, HttpFile } from '../http/http';
import * as models from '../models/all';
import { Configuration } from '../configuration';
import { Observable, of, from } from '../rxjsStub';
import { mergeMap, map } from '../rxjsStub';
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
  ): Observable<BusinessUsersListResponse> {
    const requestContextPromise = this.requestFactory.getBusinessUsersList(
      limit,
      skip,
      beforeTimestamp,
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
  ): Observable<ConsumerUsersListResponse> {
    const requestContextPromise = this.requestFactory.getConsumerUsersList(
      limit,
      skip,
      beforeTimestamp,
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
  ): Observable<Set<any>> {
    const requestContextPromise = this.requestFactory.getDashboardStatsTransactions(
      category,
      timeframe,
      fromTimestamp,
      body,
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
  ): Observable<TransactionsListResponse> {
    const requestContextPromise = this.requestFactory.getTransactionsList(
      limit,
      skip,
      beforeTimestamp,
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
