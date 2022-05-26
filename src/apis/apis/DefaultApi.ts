// TODO: better import syntax?
import { BaseAPIRequestFactory, RequiredError } from './baseapi';
import { Configuration } from '../configuration';
import { RequestContext, HttpMethod, ResponseContext, HttpFile } from '../http/http';
import { ObjectSerializer } from '../models/ObjectSerializer';
import { ApiException } from './exception';
import { canConsumeForm, isCodeInRange } from '../util';
import { SecurityAuthentication } from '../auth/auth';

import { Account } from '../models/Account';
import { AccountInvitePayload } from '../models/AccountInvitePayload';
import { Business } from '../models/Business';
import { BusinessUsersListResponse } from '../models/BusinessUsersListResponse';
import { Comment } from '../models/Comment';
import { ConsumerUsersListResponse } from '../models/ConsumerUsersListResponse';
import { DashboardStatsTransactionsCount } from '../models/DashboardStatsTransactionsCount';
import { FileImport } from '../models/FileImport';
import { ImportRequest } from '../models/ImportRequest';
import { ImportResponse } from '../models/ImportResponse';
import { ListImportRequest } from '../models/ListImportRequest';
import { PresignedUrlResponse } from '../models/PresignedUrlResponse';
import { Rule } from '../models/Rule';
import { RuleAction } from '../models/RuleAction';
import { RuleImplementation } from '../models/RuleImplementation';
import { RuleInstance } from '../models/RuleInstance';
import { TransactionCaseManagement } from '../models/TransactionCaseManagement';
import { TransactionUpdateRequest } from '../models/TransactionUpdateRequest';
import { TransactionsListResponse } from '../models/TransactionsListResponse';
import { User } from '../models/User';

/**
 * no description
 */
export class DefaultApiRequestFactory extends BaseAPIRequestFactory {
  /**
   * Account - Delete
   * @param userId
   */
  public async accountsDelete(userId: string, _options?: Configuration): Promise<RequestContext> {
    let _config = _options || this.configuration;

    // verify required parameter 'userId' is not null or undefined
    if (userId === null || userId === undefined) {
      throw new RequiredError('DefaultApi', 'accountsDelete', 'userId');
    }

    // Path Params
    const localVarPath = '/accounts/{userId}'.replace(
      '{' + 'userId' + '}',
      encodeURIComponent(String(userId)),
    );

    // Make Request Context
    const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.DELETE);
    requestContext.setHeaderParam('Accept', 'application/json, */*;q=0.8');

    const defaultAuth: SecurityAuthentication | undefined =
      _options?.authMethods?.default || this.configuration?.authMethods?.default;
    if (defaultAuth?.applySecurityAuthentication) {
      await defaultAuth?.applySecurityAuthentication(requestContext);
    }

    return requestContext;
  }

  /**
   * Account - Invite
   * @param AccountInvitePayload
   */
  public async accountsInvite(
    AccountInvitePayload?: AccountInvitePayload,
    _options?: Configuration,
  ): Promise<RequestContext> {
    let _config = _options || this.configuration;

    // Path Params
    const localVarPath = '/accounts';

    // Make Request Context
    const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.POST);
    requestContext.setHeaderParam('Accept', 'application/json, */*;q=0.8');

    // Body Params
    const contentType = ObjectSerializer.getPreferredMediaType(['application/json']);
    requestContext.setHeaderParam('Content-Type', contentType);
    const serializedBody = ObjectSerializer.stringify(
      ObjectSerializer.serialize(AccountInvitePayload, 'AccountInvitePayload', ''),
      contentType,
    );
    requestContext.setBody(serializedBody);

    const defaultAuth: SecurityAuthentication | undefined =
      _options?.authMethods?.default || this.configuration?.authMethods?.default;
    if (defaultAuth?.applySecurityAuthentication) {
      await defaultAuth?.applySecurityAuthentication(requestContext);
    }

    return requestContext;
  }

  /**
   * Rule Instance - Delete
   * @param ruleInstanceId
   */
  public async deleteRuleInstancesRuleInstanceId(
    ruleInstanceId: string,
    _options?: Configuration,
  ): Promise<RequestContext> {
    let _config = _options || this.configuration;

    // verify required parameter 'ruleInstanceId' is not null or undefined
    if (ruleInstanceId === null || ruleInstanceId === undefined) {
      throw new RequiredError('DefaultApi', 'deleteRuleInstancesRuleInstanceId', 'ruleInstanceId');
    }

    // Path Params
    const localVarPath = '/rule_instances/{ruleInstanceId}'.replace(
      '{' + 'ruleInstanceId' + '}',
      encodeURIComponent(String(ruleInstanceId)),
    );

    // Make Request Context
    const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.DELETE);
    requestContext.setHeaderParam('Accept', 'application/json, */*;q=0.8');

    const defaultAuth: SecurityAuthentication | undefined =
      _options?.authMethods?.default || this.configuration?.authMethods?.default;
    if (defaultAuth?.applySecurityAuthentication) {
      await defaultAuth?.applySecurityAuthentication(requestContext);
    }

    return requestContext;
  }

  /**
   * Rule - Delete
   * @param ruleId
   */
  public async deleteRulesRuleId(
    ruleId: string,
    _options?: Configuration,
  ): Promise<RequestContext> {
    let _config = _options || this.configuration;

    // verify required parameter 'ruleId' is not null or undefined
    if (ruleId === null || ruleId === undefined) {
      throw new RequiredError('DefaultApi', 'deleteRulesRuleId', 'ruleId');
    }

    // Path Params
    const localVarPath = '/rules/{ruleId}'.replace(
      '{' + 'ruleId' + '}',
      encodeURIComponent(String(ruleId)),
    );

    // Make Request Context
    const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.DELETE);
    requestContext.setHeaderParam('Accept', 'application/json, */*;q=0.8');

    const defaultAuth: SecurityAuthentication | undefined =
      _options?.authMethods?.default || this.configuration?.authMethods?.default;
    if (defaultAuth?.applySecurityAuthentication) {
      await defaultAuth?.applySecurityAuthentication(requestContext);
    }

    return requestContext;
  }

  /**
   * @param transactionId
   * @param commentId
   */
  public async deleteTransactionsTransactionIdCommentsCommentId(
    transactionId: string,
    commentId: string,
    _options?: Configuration,
  ): Promise<RequestContext> {
    let _config = _options || this.configuration;

    // verify required parameter 'transactionId' is not null or undefined
    if (transactionId === null || transactionId === undefined) {
      throw new RequiredError(
        'DefaultApi',
        'deleteTransactionsTransactionIdCommentsCommentId',
        'transactionId',
      );
    }

    // verify required parameter 'commentId' is not null or undefined
    if (commentId === null || commentId === undefined) {
      throw new RequiredError(
        'DefaultApi',
        'deleteTransactionsTransactionIdCommentsCommentId',
        'commentId',
      );
    }

    // Path Params
    const localVarPath = '/transactions/{transactionId}/comments/{commentId}'
      .replace('{' + 'transactionId' + '}', encodeURIComponent(String(transactionId)))
      .replace('{' + 'commentId' + '}', encodeURIComponent(String(commentId)));

    // Make Request Context
    const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.DELETE);
    requestContext.setHeaderParam('Accept', 'application/json, */*;q=0.8');

    const defaultAuth: SecurityAuthentication | undefined =
      _options?.authMethods?.default || this.configuration?.authMethods?.default;
    if (defaultAuth?.applySecurityAuthentication) {
      await defaultAuth?.applySecurityAuthentication(requestContext);
    }

    return requestContext;
  }

  /**
   * Account - List
   */
  public async getAccounts(_options?: Configuration): Promise<RequestContext> {
    let _config = _options || this.configuration;

    // Path Params
    const localVarPath = '/accounts';

    // Make Request Context
    const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.GET);
    requestContext.setHeaderParam('Accept', 'application/json, */*;q=0.8');

    const defaultAuth: SecurityAuthentication | undefined =
      _options?.authMethods?.default || this.configuration?.authMethods?.default;
    if (defaultAuth?.applySecurityAuthentication) {
      await defaultAuth?.applySecurityAuthentication(requestContext);
    }

    return requestContext;
  }

  /**
   * Business Users - Item - Get
   * @param userId
   */
  public async getBusinessUsersItem(
    userId: string,
    _options?: Configuration,
  ): Promise<RequestContext> {
    let _config = _options || this.configuration;

    // verify required parameter 'userId' is not null or undefined
    if (userId === null || userId === undefined) {
      throw new RequiredError('DefaultApi', 'getBusinessUsersItem', 'userId');
    }

    // Path Params
    const localVarPath = '/business/users/{userId}'.replace(
      '{' + 'userId' + '}',
      encodeURIComponent(String(userId)),
    );

    // Make Request Context
    const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.GET);
    requestContext.setHeaderParam('Accept', 'application/json, */*;q=0.8');

    const defaultAuth: SecurityAuthentication | undefined =
      _options?.authMethods?.default || this.configuration?.authMethods?.default;
    if (defaultAuth?.applySecurityAuthentication) {
      await defaultAuth?.applySecurityAuthentication(requestContext);
    }

    return requestContext;
  }

  /**
   * Business Users - List
   * @param limit
   * @param skip
   * @param beforeTimestamp
   * @param afterTimestamp
   * @param filterId
   */
  public async getBusinessUsersList(
    limit: number,
    skip: number,
    beforeTimestamp: number,
    afterTimestamp?: number,
    filterId?: string,
    _options?: Configuration,
  ): Promise<RequestContext> {
    let _config = _options || this.configuration;

    // verify required parameter 'limit' is not null or undefined
    if (limit === null || limit === undefined) {
      throw new RequiredError('DefaultApi', 'getBusinessUsersList', 'limit');
    }

    // verify required parameter 'skip' is not null or undefined
    if (skip === null || skip === undefined) {
      throw new RequiredError('DefaultApi', 'getBusinessUsersList', 'skip');
    }

    // verify required parameter 'beforeTimestamp' is not null or undefined
    if (beforeTimestamp === null || beforeTimestamp === undefined) {
      throw new RequiredError('DefaultApi', 'getBusinessUsersList', 'beforeTimestamp');
    }

    // Path Params
    const localVarPath = '/business/users';

    // Make Request Context
    const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.GET);
    requestContext.setHeaderParam('Accept', 'application/json, */*;q=0.8');

    // Query Params
    if (limit !== undefined) {
      requestContext.setQueryParam('limit', ObjectSerializer.serialize(limit, 'number', ''));
    }

    // Query Params
    if (skip !== undefined) {
      requestContext.setQueryParam('skip', ObjectSerializer.serialize(skip, 'number', ''));
    }

    // Query Params
    if (afterTimestamp !== undefined) {
      requestContext.setQueryParam(
        'afterTimestamp',
        ObjectSerializer.serialize(afterTimestamp, 'number', ''),
      );
    }

    // Query Params
    if (beforeTimestamp !== undefined) {
      requestContext.setQueryParam(
        'beforeTimestamp',
        ObjectSerializer.serialize(beforeTimestamp, 'number', ''),
      );
    }

    // Query Params
    if (filterId !== undefined) {
      requestContext.setQueryParam('filterId', ObjectSerializer.serialize(filterId, 'string', ''));
    }

    const defaultAuth: SecurityAuthentication | undefined =
      _options?.authMethods?.default || this.configuration?.authMethods?.default;
    if (defaultAuth?.applySecurityAuthentication) {
      await defaultAuth?.applySecurityAuthentication(requestContext);
    }

    return requestContext;
  }

  /**
   * Consumer Users - Item - Get
   * @param userId
   */
  public async getConsumerUsersItem(
    userId: string,
    _options?: Configuration,
  ): Promise<RequestContext> {
    let _config = _options || this.configuration;

    // verify required parameter 'userId' is not null or undefined
    if (userId === null || userId === undefined) {
      throw new RequiredError('DefaultApi', 'getConsumerUsersItem', 'userId');
    }

    // Path Params
    const localVarPath = '/consumer/users/{userId}'.replace(
      '{' + 'userId' + '}',
      encodeURIComponent(String(userId)),
    );

    // Make Request Context
    const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.GET);
    requestContext.setHeaderParam('Accept', 'application/json, */*;q=0.8');

    const defaultAuth: SecurityAuthentication | undefined =
      _options?.authMethods?.default || this.configuration?.authMethods?.default;
    if (defaultAuth?.applySecurityAuthentication) {
      await defaultAuth?.applySecurityAuthentication(requestContext);
    }

    return requestContext;
  }

  /**
   * Consumer Users - List
   * @param limit
   * @param skip
   * @param beforeTimestamp
   * @param afterTimestamp
   * @param filterId
   */
  public async getConsumerUsersList(
    limit: number,
    skip: number,
    beforeTimestamp: number,
    afterTimestamp?: number,
    filterId?: string,
    _options?: Configuration,
  ): Promise<RequestContext> {
    let _config = _options || this.configuration;

    // verify required parameter 'limit' is not null or undefined
    if (limit === null || limit === undefined) {
      throw new RequiredError('DefaultApi', 'getConsumerUsersList', 'limit');
    }

    // verify required parameter 'skip' is not null or undefined
    if (skip === null || skip === undefined) {
      throw new RequiredError('DefaultApi', 'getConsumerUsersList', 'skip');
    }

    // verify required parameter 'beforeTimestamp' is not null or undefined
    if (beforeTimestamp === null || beforeTimestamp === undefined) {
      throw new RequiredError('DefaultApi', 'getConsumerUsersList', 'beforeTimestamp');
    }

    // Path Params
    const localVarPath = '/consumer/users';

    // Make Request Context
    const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.GET);
    requestContext.setHeaderParam('Accept', 'application/json, */*;q=0.8');

    // Query Params
    if (limit !== undefined) {
      requestContext.setQueryParam('limit', ObjectSerializer.serialize(limit, 'number', ''));
    }

    // Query Params
    if (skip !== undefined) {
      requestContext.setQueryParam('skip', ObjectSerializer.serialize(skip, 'number', ''));
    }

    // Query Params
    if (afterTimestamp !== undefined) {
      requestContext.setQueryParam(
        'afterTimestamp',
        ObjectSerializer.serialize(afterTimestamp, 'number', ''),
      );
    }

    // Query Params
    if (beforeTimestamp !== undefined) {
      requestContext.setQueryParam(
        'beforeTimestamp',
        ObjectSerializer.serialize(beforeTimestamp, 'number', ''),
      );
    }

    // Query Params
    if (filterId !== undefined) {
      requestContext.setQueryParam('filterId', ObjectSerializer.serialize(filterId, 'string', ''));
    }

    const defaultAuth: SecurityAuthentication | undefined =
      _options?.authMethods?.default || this.configuration?.authMethods?.default;
    if (defaultAuth?.applySecurityAuthentication) {
      await defaultAuth?.applySecurityAuthentication(requestContext);
    }

    return requestContext;
  }

  /**
   * DashboardStats - Transactions
   * @param timeframe MONTH, DAY or YEAR
   * @param endTimestamp
   * @param body
   */
  public async getDashboardStatsTransactions(
    timeframe: 'WEEK' | 'MONTH' | 'DAY' | 'YEAR',
    endTimestamp?: number,
    body?: any,
    _options?: Configuration,
  ): Promise<RequestContext> {
    let _config = _options || this.configuration;

    // verify required parameter 'timeframe' is not null or undefined
    if (timeframe === null || timeframe === undefined) {
      throw new RequiredError('DefaultApi', 'getDashboardStatsTransactions', 'timeframe');
    }

    // Path Params
    const localVarPath = '/dashboard_stats/transactions';

    // Make Request Context
    const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.GET);
    requestContext.setHeaderParam('Accept', 'application/json, */*;q=0.8');

    // Query Params
    if (timeframe !== undefined) {
      requestContext.setQueryParam(
        'timeframe',
        ObjectSerializer.serialize(timeframe, "'WEEK' | 'MONTH' | 'DAY' | 'YEAR'", ''),
      );
    }

    // Query Params
    if (endTimestamp !== undefined) {
      requestContext.setQueryParam(
        'endTimestamp',
        ObjectSerializer.serialize(endTimestamp, 'number', ''),
      );
    }

    // Body Params
    const contentType = ObjectSerializer.getPreferredMediaType(['application/json']);
    requestContext.setHeaderParam('Content-Type', contentType);
    const serializedBody = ObjectSerializer.stringify(
      ObjectSerializer.serialize(body, 'any', ''),
      contentType,
    );
    requestContext.setBody(serializedBody);

    const defaultAuth: SecurityAuthentication | undefined =
      _options?.authMethods?.default || this.configuration?.authMethods?.default;
    if (defaultAuth?.applySecurityAuthentication) {
      await defaultAuth?.applySecurityAuthentication(requestContext);
    }

    return requestContext;
  }

  /**
   * Import - Get Import Info
   * @param importId
   */
  public async getImportImportId(
    importId: string,
    _options?: Configuration,
  ): Promise<RequestContext> {
    let _config = _options || this.configuration;

    // verify required parameter 'importId' is not null or undefined
    if (importId === null || importId === undefined) {
      throw new RequiredError('DefaultApi', 'getImportImportId', 'importId');
    }

    // Path Params
    const localVarPath = '/import/{importId}'.replace(
      '{' + 'importId' + '}',
      encodeURIComponent(String(importId)),
    );

    // Make Request Context
    const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.GET);
    requestContext.setHeaderParam('Accept', 'application/json, */*;q=0.8');

    const defaultAuth: SecurityAuthentication | undefined =
      _options?.authMethods?.default || this.configuration?.authMethods?.default;
    if (defaultAuth?.applySecurityAuthentication) {
      await defaultAuth?.applySecurityAuthentication(requestContext);
    }

    return requestContext;
  }

  /**
   * Rule Implementations - List
   */
  public async getRuleImplementations(_options?: Configuration): Promise<RequestContext> {
    let _config = _options || this.configuration;

    // Path Params
    const localVarPath = '/rule_implementations';

    // Make Request Context
    const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.GET);
    requestContext.setHeaderParam('Accept', 'application/json, */*;q=0.8');

    const defaultAuth: SecurityAuthentication | undefined =
      _options?.authMethods?.default || this.configuration?.authMethods?.default;
    if (defaultAuth?.applySecurityAuthentication) {
      await defaultAuth?.applySecurityAuthentication(requestContext);
    }

    return requestContext;
  }

  /**
   * Rule Instance - List
   */
  public async getRuleInstances(_options?: Configuration): Promise<RequestContext> {
    let _config = _options || this.configuration;

    // Path Params
    const localVarPath = '/rule_instances';

    // Make Request Context
    const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.GET);
    requestContext.setHeaderParam('Accept', 'application/json, */*;q=0.8');

    const defaultAuth: SecurityAuthentication | undefined =
      _options?.authMethods?.default || this.configuration?.authMethods?.default;
    if (defaultAuth?.applySecurityAuthentication) {
      await defaultAuth?.applySecurityAuthentication(requestContext);
    }

    return requestContext;
  }

  /**
   * Rules - List
   */
  public async getRules(_options?: Configuration): Promise<RequestContext> {
    let _config = _options || this.configuration;

    // Path Params
    const localVarPath = '/rules';

    // Make Request Context
    const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.GET);
    requestContext.setHeaderParam('Accept', 'application/json, */*;q=0.8');

    const defaultAuth: SecurityAuthentication | undefined =
      _options?.authMethods?.default || this.configuration?.authMethods?.default;
    if (defaultAuth?.applySecurityAuthentication) {
      await defaultAuth?.applySecurityAuthentication(requestContext);
    }

    return requestContext;
  }

  /**
   * Transaction - Get
   * @param transactionId
   */
  public async getTransaction(
    transactionId: string,
    _options?: Configuration,
  ): Promise<RequestContext> {
    let _config = _options || this.configuration;

    // verify required parameter 'transactionId' is not null or undefined
    if (transactionId === null || transactionId === undefined) {
      throw new RequiredError('DefaultApi', 'getTransaction', 'transactionId');
    }

    // Path Params
    const localVarPath = '/transactions/{transactionId}'.replace(
      '{' + 'transactionId' + '}',
      encodeURIComponent(String(transactionId)),
    );

    // Make Request Context
    const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.GET);
    requestContext.setHeaderParam('Accept', 'application/json, */*;q=0.8');

    const defaultAuth: SecurityAuthentication | undefined =
      _options?.authMethods?.default || this.configuration?.authMethods?.default;
    if (defaultAuth?.applySecurityAuthentication) {
      await defaultAuth?.applySecurityAuthentication(requestContext);
    }

    return requestContext;
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
   */
  public async getTransactionsList(
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
    _options?: Configuration,
  ): Promise<RequestContext> {
    let _config = _options || this.configuration;

    // verify required parameter 'limit' is not null or undefined
    if (limit === null || limit === undefined) {
      throw new RequiredError('DefaultApi', 'getTransactionsList', 'limit');
    }

    // verify required parameter 'skip' is not null or undefined
    if (skip === null || skip === undefined) {
      throw new RequiredError('DefaultApi', 'getTransactionsList', 'skip');
    }

    // verify required parameter 'beforeTimestamp' is not null or undefined
    if (beforeTimestamp === null || beforeTimestamp === undefined) {
      throw new RequiredError('DefaultApi', 'getTransactionsList', 'beforeTimestamp');
    }

    // Path Params
    const localVarPath = '/transactions';

    // Make Request Context
    const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.GET);
    requestContext.setHeaderParam('Accept', 'application/json, */*;q=0.8');

    // Query Params
    if (limit !== undefined) {
      requestContext.setQueryParam('limit', ObjectSerializer.serialize(limit, 'number', ''));
    }

    // Query Params
    if (skip !== undefined) {
      requestContext.setQueryParam('skip', ObjectSerializer.serialize(skip, 'number', ''));
    }

    // Query Params
    if (afterTimestamp !== undefined) {
      requestContext.setQueryParam(
        'afterTimestamp',
        ObjectSerializer.serialize(afterTimestamp, 'number', ''),
      );
    }

    // Query Params
    if (beforeTimestamp !== undefined) {
      requestContext.setQueryParam(
        'beforeTimestamp',
        ObjectSerializer.serialize(beforeTimestamp, 'number', ''),
      );
    }

    // Query Params
    if (filterId !== undefined) {
      requestContext.setQueryParam('filterId', ObjectSerializer.serialize(filterId, 'string', ''));
    }

    // Query Params
    if (filterOutStatus !== undefined) {
      requestContext.setQueryParam(
        'filterOutStatus',
        ObjectSerializer.serialize(filterOutStatus, 'RuleAction', ''),
      );
    }

    // Query Params
    if (filterRulesExecuted !== undefined) {
      requestContext.setQueryParam(
        'filterRulesExecuted',
        ObjectSerializer.serialize(filterRulesExecuted, 'Array<string>', ''),
      );
    }

    // Query Params
    if (filterRulesHit !== undefined) {
      requestContext.setQueryParam(
        'filterRulesHit',
        ObjectSerializer.serialize(filterRulesHit, 'Array<string>', ''),
      );
    }

    // Query Params
    if (transactionType !== undefined) {
      requestContext.setQueryParam(
        'transactionType',
        ObjectSerializer.serialize(transactionType, 'string', ''),
      );
    }

    // Query Params
    if (filterOriginCurrencies !== undefined) {
      requestContext.setQueryParam(
        'filterOriginCurrencies',
        ObjectSerializer.serialize(filterOriginCurrencies, 'Array<string>', ''),
      );
    }

    // Query Params
    if (filterDestinationCurrencies !== undefined) {
      requestContext.setQueryParam(
        'filterDestinationCurrencies',
        ObjectSerializer.serialize(filterDestinationCurrencies, 'Array<string>', ''),
      );
    }

    const defaultAuth: SecurityAuthentication | undefined =
      _options?.authMethods?.default || this.configuration?.authMethods?.default;
    if (defaultAuth?.applySecurityAuthentication) {
      await defaultAuth?.applySecurityAuthentication(requestContext);
    }

    return requestContext;
  }

  /**
   * Transaction Per User - List
   * @param limit
   * @param skip
   * @param beforeTimestamp
   * @param userId
   */
  public async getTransactionsPerUserList(
    limit: number,
    skip: number,
    beforeTimestamp: number,
    userId: string,
    _options?: Configuration,
  ): Promise<RequestContext> {
    let _config = _options || this.configuration;

    // verify required parameter 'limit' is not null or undefined
    if (limit === null || limit === undefined) {
      throw new RequiredError('DefaultApi', 'getTransactionsPerUserList', 'limit');
    }

    // verify required parameter 'skip' is not null or undefined
    if (skip === null || skip === undefined) {
      throw new RequiredError('DefaultApi', 'getTransactionsPerUserList', 'skip');
    }

    // verify required parameter 'beforeTimestamp' is not null or undefined
    if (beforeTimestamp === null || beforeTimestamp === undefined) {
      throw new RequiredError('DefaultApi', 'getTransactionsPerUserList', 'beforeTimestamp');
    }

    // verify required parameter 'userId' is not null or undefined
    if (userId === null || userId === undefined) {
      throw new RequiredError('DefaultApi', 'getTransactionsPerUserList', 'userId');
    }

    // Path Params
    const localVarPath = '/user/transactions';

    // Make Request Context
    const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.GET);
    requestContext.setHeaderParam('Accept', 'application/json, */*;q=0.8');

    // Query Params
    if (limit !== undefined) {
      requestContext.setQueryParam('limit', ObjectSerializer.serialize(limit, 'number', ''));
    }

    // Query Params
    if (skip !== undefined) {
      requestContext.setQueryParam('skip', ObjectSerializer.serialize(skip, 'number', ''));
    }

    // Query Params
    if (beforeTimestamp !== undefined) {
      requestContext.setQueryParam(
        'beforeTimestamp',
        ObjectSerializer.serialize(beforeTimestamp, 'number', ''),
      );
    }

    // Query Params
    if (userId !== undefined) {
      requestContext.setQueryParam('userId', ObjectSerializer.serialize(userId, 'string', ''));
    }

    const defaultAuth: SecurityAuthentication | undefined =
      _options?.authMethods?.default || this.configuration?.authMethods?.default;
    if (defaultAuth?.applySecurityAuthentication) {
      await defaultAuth?.applySecurityAuthentication(requestContext);
    }

    return requestContext;
  }

  /**
   * Generate a new Tarpon API key for a tenant
   * Tarpon API Key - Create
   * @param tenantId Tenant ID
   * @param usagePlanId AWS Gateway usage plan ID
   */
  public async postApikey(
    tenantId?: string,
    usagePlanId?: string,
    _options?: Configuration,
  ): Promise<RequestContext> {
    let _config = _options || this.configuration;

    // Path Params
    const localVarPath = '/apikey';

    // Make Request Context
    const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.POST);
    requestContext.setHeaderParam('Accept', 'application/json, */*;q=0.8');

    // Query Params
    if (tenantId !== undefined) {
      requestContext.setQueryParam('tenantId', ObjectSerializer.serialize(tenantId, 'string', ''));
    }

    // Query Params
    if (usagePlanId !== undefined) {
      requestContext.setQueryParam(
        'usagePlanId',
        ObjectSerializer.serialize(usagePlanId, 'string', ''),
      );
    }

    const defaultAuth: SecurityAuthentication | undefined =
      _options?.authMethods?.default || this.configuration?.authMethods?.default;
    if (defaultAuth?.applySecurityAuthentication) {
      await defaultAuth?.applySecurityAuthentication(requestContext);
    }

    return requestContext;
  }

  /**
   * Get a presigned URL for uploading a file
   * Files - Get Presigned URL
   */
  public async postGetPresignedUrl(_options?: Configuration): Promise<RequestContext> {
    let _config = _options || this.configuration;

    // Path Params
    const localVarPath = '/files/getPresignedUrl';

    // Make Request Context
    const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.POST);
    requestContext.setHeaderParam('Accept', 'application/json, */*;q=0.8');

    const defaultAuth: SecurityAuthentication | undefined =
      _options?.authMethods?.default || this.configuration?.authMethods?.default;
    if (defaultAuth?.applySecurityAuthentication) {
      await defaultAuth?.applySecurityAuthentication(requestContext);
    }

    return requestContext;
  }

  /**
   * Rule Instance - Create
   * @param tenantId Tenant ID
   * @param RuleInstance
   */
  public async postIamRuleInstances(
    tenantId?: string,
    RuleInstance?: RuleInstance,
    _options?: Configuration,
  ): Promise<RequestContext> {
    let _config = _options || this.configuration;

    // Path Params
    const localVarPath = '/iam/rule_instances';

    // Make Request Context
    const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.POST);
    requestContext.setHeaderParam('Accept', 'application/json, */*;q=0.8');

    // Query Params
    if (tenantId !== undefined) {
      requestContext.setQueryParam('tenantId', ObjectSerializer.serialize(tenantId, 'string', ''));
    }

    // Body Params
    const contentType = ObjectSerializer.getPreferredMediaType(['application/json']);
    requestContext.setHeaderParam('Content-Type', contentType);
    const serializedBody = ObjectSerializer.stringify(
      ObjectSerializer.serialize(RuleInstance, 'RuleInstance', ''),
      contentType,
    );
    requestContext.setBody(serializedBody);

    const defaultAuth: SecurityAuthentication | undefined =
      _options?.authMethods?.default || this.configuration?.authMethods?.default;
    if (defaultAuth?.applySecurityAuthentication) {
      await defaultAuth?.applySecurityAuthentication(requestContext);
    }

    return requestContext;
  }

  /**
   * Rules - Create
   * @param tenantId Tenant ID
   * @param Rule
   */
  public async postIamRules(
    tenantId?: string,
    Rule?: Rule,
    _options?: Configuration,
  ): Promise<RequestContext> {
    let _config = _options || this.configuration;

    // Path Params
    const localVarPath = '/iam/rules';

    // Make Request Context
    const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.POST);
    requestContext.setHeaderParam('Accept', 'application/json, */*;q=0.8');

    // Query Params
    if (tenantId !== undefined) {
      requestContext.setQueryParam('tenantId', ObjectSerializer.serialize(tenantId, 'string', ''));
    }

    // Body Params
    const contentType = ObjectSerializer.getPreferredMediaType(['application/json']);
    requestContext.setHeaderParam('Content-Type', contentType);
    const serializedBody = ObjectSerializer.stringify(
      ObjectSerializer.serialize(Rule, 'Rule', ''),
      contentType,
    );
    requestContext.setBody(serializedBody);

    const defaultAuth: SecurityAuthentication | undefined =
      _options?.authMethods?.default || this.configuration?.authMethods?.default;
    if (defaultAuth?.applySecurityAuthentication) {
      await defaultAuth?.applySecurityAuthentication(requestContext);
    }

    return requestContext;
  }

  /**
   * Import - Start to Import
   * @param ImportRequest
   */
  public async postImport(
    ImportRequest?: ImportRequest,
    _options?: Configuration,
  ): Promise<RequestContext> {
    let _config = _options || this.configuration;

    // Path Params
    const localVarPath = '/import';

    // Make Request Context
    const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.POST);
    requestContext.setHeaderParam('Accept', 'application/json, */*;q=0.8');

    // Body Params
    const contentType = ObjectSerializer.getPreferredMediaType(['application/json']);
    requestContext.setHeaderParam('Content-Type', contentType);
    const serializedBody = ObjectSerializer.stringify(
      ObjectSerializer.serialize(ImportRequest, 'ImportRequest', ''),
      contentType,
    );
    requestContext.setBody(serializedBody);

    const defaultAuth: SecurityAuthentication | undefined =
      _options?.authMethods?.default || this.configuration?.authMethods?.default;
    if (defaultAuth?.applySecurityAuthentication) {
      await defaultAuth?.applySecurityAuthentication(requestContext);
    }

    return requestContext;
  }

  /**
   * List Import
   * @param ListImportRequest
   */
  public async postLists(
    ListImportRequest?: ListImportRequest,
    _options?: Configuration,
  ): Promise<RequestContext> {
    let _config = _options || this.configuration;

    // Path Params
    const localVarPath = '/lists';

    // Make Request Context
    const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.POST);
    requestContext.setHeaderParam('Accept', 'application/json, */*;q=0.8');

    // Body Params
    const contentType = ObjectSerializer.getPreferredMediaType(['application/json']);
    requestContext.setHeaderParam('Content-Type', contentType);
    const serializedBody = ObjectSerializer.stringify(
      ObjectSerializer.serialize(ListImportRequest, 'ListImportRequest', ''),
      contentType,
    );
    requestContext.setBody(serializedBody);

    const defaultAuth: SecurityAuthentication | undefined =
      _options?.authMethods?.default || this.configuration?.authMethods?.default;
    if (defaultAuth?.applySecurityAuthentication) {
      await defaultAuth?.applySecurityAuthentication(requestContext);
    }

    return requestContext;
  }

  /**
   * Rule Instance - Create
   * @param RuleInstance
   */
  public async postRuleInstances(
    RuleInstance?: RuleInstance,
    _options?: Configuration,
  ): Promise<RequestContext> {
    let _config = _options || this.configuration;

    // Path Params
    const localVarPath = '/rule_instances';

    // Make Request Context
    const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.POST);
    requestContext.setHeaderParam('Accept', 'application/json, */*;q=0.8');

    // Body Params
    const contentType = ObjectSerializer.getPreferredMediaType(['application/json']);
    requestContext.setHeaderParam('Content-Type', contentType);
    const serializedBody = ObjectSerializer.stringify(
      ObjectSerializer.serialize(RuleInstance, 'RuleInstance', ''),
      contentType,
    );
    requestContext.setBody(serializedBody);

    const defaultAuth: SecurityAuthentication | undefined =
      _options?.authMethods?.default || this.configuration?.authMethods?.default;
    if (defaultAuth?.applySecurityAuthentication) {
      await defaultAuth?.applySecurityAuthentication(requestContext);
    }

    return requestContext;
  }

  /**
   * Rules - Create
   * @param Rule
   */
  public async postRules(Rule?: Rule, _options?: Configuration): Promise<RequestContext> {
    let _config = _options || this.configuration;

    // Path Params
    const localVarPath = '/rules';

    // Make Request Context
    const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.POST);
    requestContext.setHeaderParam('Accept', 'application/json, */*;q=0.8');

    // Body Params
    const contentType = ObjectSerializer.getPreferredMediaType(['application/json']);
    requestContext.setHeaderParam('Content-Type', contentType);
    const serializedBody = ObjectSerializer.stringify(
      ObjectSerializer.serialize(Rule, 'Rule', ''),
      contentType,
    );
    requestContext.setBody(serializedBody);

    const defaultAuth: SecurityAuthentication | undefined =
      _options?.authMethods?.default || this.configuration?.authMethods?.default;
    if (defaultAuth?.applySecurityAuthentication) {
      await defaultAuth?.applySecurityAuthentication(requestContext);
    }

    return requestContext;
  }

  /**
   * Create a Transaction Comment
   * @param transactionId
   * @param Comment
   */
  public async postTransactionsComments(
    transactionId: string,
    Comment?: Comment,
    _options?: Configuration,
  ): Promise<RequestContext> {
    let _config = _options || this.configuration;

    // verify required parameter 'transactionId' is not null or undefined
    if (transactionId === null || transactionId === undefined) {
      throw new RequiredError('DefaultApi', 'postTransactionsComments', 'transactionId');
    }

    // Path Params
    const localVarPath = '/transactions/{transactionId}/comments'.replace(
      '{' + 'transactionId' + '}',
      encodeURIComponent(String(transactionId)),
    );

    // Make Request Context
    const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.POST);
    requestContext.setHeaderParam('Accept', 'application/json, */*;q=0.8');

    // Body Params
    const contentType = ObjectSerializer.getPreferredMediaType(['application/json']);
    requestContext.setHeaderParam('Content-Type', contentType);
    const serializedBody = ObjectSerializer.stringify(
      ObjectSerializer.serialize(Comment, 'Comment', ''),
      contentType,
    );
    requestContext.setBody(serializedBody);

    const defaultAuth: SecurityAuthentication | undefined =
      _options?.authMethods?.default || this.configuration?.authMethods?.default;
    if (defaultAuth?.applySecurityAuthentication) {
      await defaultAuth?.applySecurityAuthentication(requestContext);
    }

    return requestContext;
  }

  /**
   * Transaction - Update
   * @param transactionId
   * @param TransactionUpdateRequest
   */
  public async postTransactionsTransactionId(
    transactionId: string,
    TransactionUpdateRequest?: TransactionUpdateRequest,
    _options?: Configuration,
  ): Promise<RequestContext> {
    let _config = _options || this.configuration;

    // verify required parameter 'transactionId' is not null or undefined
    if (transactionId === null || transactionId === undefined) {
      throw new RequiredError('DefaultApi', 'postTransactionsTransactionId', 'transactionId');
    }

    // Path Params
    const localVarPath = '/transactions/{transactionId}'.replace(
      '{' + 'transactionId' + '}',
      encodeURIComponent(String(transactionId)),
    );

    // Make Request Context
    const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.POST);
    requestContext.setHeaderParam('Accept', 'application/json, */*;q=0.8');

    // Body Params
    const contentType = ObjectSerializer.getPreferredMediaType(['application/json']);
    requestContext.setHeaderParam('Content-Type', contentType);
    const serializedBody = ObjectSerializer.stringify(
      ObjectSerializer.serialize(TransactionUpdateRequest, 'TransactionUpdateRequest', ''),
      contentType,
    );
    requestContext.setBody(serializedBody);

    const defaultAuth: SecurityAuthentication | undefined =
      _options?.authMethods?.default || this.configuration?.authMethods?.default;
    if (defaultAuth?.applySecurityAuthentication) {
      await defaultAuth?.applySecurityAuthentication(requestContext);
    }

    return requestContext;
  }

  /**
   * Rule Instance - Update
   * @param ruleInstanceId
   * @param RuleInstance
   */
  public async putRuleInstancesRuleInstanceId(
    ruleInstanceId: string,
    RuleInstance?: RuleInstance,
    _options?: Configuration,
  ): Promise<RequestContext> {
    let _config = _options || this.configuration;

    // verify required parameter 'ruleInstanceId' is not null or undefined
    if (ruleInstanceId === null || ruleInstanceId === undefined) {
      throw new RequiredError('DefaultApi', 'putRuleInstancesRuleInstanceId', 'ruleInstanceId');
    }

    // Path Params
    const localVarPath = '/rule_instances/{ruleInstanceId}'.replace(
      '{' + 'ruleInstanceId' + '}',
      encodeURIComponent(String(ruleInstanceId)),
    );

    // Make Request Context
    const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.PUT);
    requestContext.setHeaderParam('Accept', 'application/json, */*;q=0.8');

    // Body Params
    const contentType = ObjectSerializer.getPreferredMediaType(['application/json']);
    requestContext.setHeaderParam('Content-Type', contentType);
    const serializedBody = ObjectSerializer.stringify(
      ObjectSerializer.serialize(RuleInstance, 'RuleInstance', ''),
      contentType,
    );
    requestContext.setBody(serializedBody);

    const defaultAuth: SecurityAuthentication | undefined =
      _options?.authMethods?.default || this.configuration?.authMethods?.default;
    if (defaultAuth?.applySecurityAuthentication) {
      await defaultAuth?.applySecurityAuthentication(requestContext);
    }

    return requestContext;
  }

  /**
   * Rule - Update
   * @param ruleId
   * @param Rule
   */
  public async putRuleRuleId(
    ruleId: string,
    Rule?: Rule,
    _options?: Configuration,
  ): Promise<RequestContext> {
    let _config = _options || this.configuration;

    // verify required parameter 'ruleId' is not null or undefined
    if (ruleId === null || ruleId === undefined) {
      throw new RequiredError('DefaultApi', 'putRuleRuleId', 'ruleId');
    }

    // Path Params
    const localVarPath = '/rules/{ruleId}'.replace(
      '{' + 'ruleId' + '}',
      encodeURIComponent(String(ruleId)),
    );

    // Make Request Context
    const requestContext = _config.baseServer.makeRequestContext(localVarPath, HttpMethod.PUT);
    requestContext.setHeaderParam('Accept', 'application/json, */*;q=0.8');

    // Body Params
    const contentType = ObjectSerializer.getPreferredMediaType(['application/json']);
    requestContext.setHeaderParam('Content-Type', contentType);
    const serializedBody = ObjectSerializer.stringify(
      ObjectSerializer.serialize(Rule, 'Rule', ''),
      contentType,
    );
    requestContext.setBody(serializedBody);

    const defaultAuth: SecurityAuthentication | undefined =
      _options?.authMethods?.default || this.configuration?.authMethods?.default;
    if (defaultAuth?.applySecurityAuthentication) {
      await defaultAuth?.applySecurityAuthentication(requestContext);
    }

    return requestContext;
  }
}

export class DefaultApiResponseProcessor {
  /**
   * Unwraps the actual response sent by the server from the response context and deserializes the response content
   * to the expected objects
   *
   * @params response Response returned by the server for a request to accountsDelete
   * @throws ApiException if the response code was not in [200, 299]
   */
  public async accountsDelete(response: ResponseContext): Promise<void> {
    const contentType = ObjectSerializer.normalizeMediaType(response.headers['content-type']);
    if (isCodeInRange('200', response.httpStatusCode)) {
      return;
    }

    // Work around for missing responses in specification, e.g. for petstore.yaml
    if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
      const body: void = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'void',
        '',
      ) as void;
      return body;
    }

    throw new ApiException<string | Blob | undefined>(
      response.httpStatusCode,
      'Unknown API Status Code!',
      await response.getBodyAsAny(),
      response.headers,
    );
  }

  /**
   * Unwraps the actual response sent by the server from the response context and deserializes the response content
   * to the expected objects
   *
   * @params response Response returned by the server for a request to accountsInvite
   * @throws ApiException if the response code was not in [200, 299]
   */
  public async accountsInvite(response: ResponseContext): Promise<Account> {
    const contentType = ObjectSerializer.normalizeMediaType(response.headers['content-type']);
    if (isCodeInRange('200', response.httpStatusCode)) {
      const body: Account = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'Account',
        '',
      ) as Account;
      return body;
    }

    // Work around for missing responses in specification, e.g. for petstore.yaml
    if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
      const body: Account = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'Account',
        '',
      ) as Account;
      return body;
    }

    throw new ApiException<string | Blob | undefined>(
      response.httpStatusCode,
      'Unknown API Status Code!',
      await response.getBodyAsAny(),
      response.headers,
    );
  }

  /**
   * Unwraps the actual response sent by the server from the response context and deserializes the response content
   * to the expected objects
   *
   * @params response Response returned by the server for a request to deleteRuleInstancesRuleInstanceId
   * @throws ApiException if the response code was not in [200, 299]
   */
  public async deleteRuleInstancesRuleInstanceId(response: ResponseContext): Promise<void> {
    const contentType = ObjectSerializer.normalizeMediaType(response.headers['content-type']);
    if (isCodeInRange('200', response.httpStatusCode)) {
      return;
    }

    // Work around for missing responses in specification, e.g. for petstore.yaml
    if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
      const body: void = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'void',
        '',
      ) as void;
      return body;
    }

    throw new ApiException<string | Blob | undefined>(
      response.httpStatusCode,
      'Unknown API Status Code!',
      await response.getBodyAsAny(),
      response.headers,
    );
  }

  /**
   * Unwraps the actual response sent by the server from the response context and deserializes the response content
   * to the expected objects
   *
   * @params response Response returned by the server for a request to deleteRulesRuleId
   * @throws ApiException if the response code was not in [200, 299]
   */
  public async deleteRulesRuleId(response: ResponseContext): Promise<void> {
    const contentType = ObjectSerializer.normalizeMediaType(response.headers['content-type']);
    if (isCodeInRange('200', response.httpStatusCode)) {
      return;
    }

    // Work around for missing responses in specification, e.g. for petstore.yaml
    if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
      const body: void = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'void',
        '',
      ) as void;
      return body;
    }

    throw new ApiException<string | Blob | undefined>(
      response.httpStatusCode,
      'Unknown API Status Code!',
      await response.getBodyAsAny(),
      response.headers,
    );
  }

  /**
   * Unwraps the actual response sent by the server from the response context and deserializes the response content
   * to the expected objects
   *
   * @params response Response returned by the server for a request to deleteTransactionsTransactionIdCommentsCommentId
   * @throws ApiException if the response code was not in [200, 299]
   */
  public async deleteTransactionsTransactionIdCommentsCommentId(
    response: ResponseContext,
  ): Promise<void> {
    const contentType = ObjectSerializer.normalizeMediaType(response.headers['content-type']);
    if (isCodeInRange('200', response.httpStatusCode)) {
      return;
    }

    // Work around for missing responses in specification, e.g. for petstore.yaml
    if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
      const body: void = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'void',
        '',
      ) as void;
      return body;
    }

    throw new ApiException<string | Blob | undefined>(
      response.httpStatusCode,
      'Unknown API Status Code!',
      await response.getBodyAsAny(),
      response.headers,
    );
  }

  /**
   * Unwraps the actual response sent by the server from the response context and deserializes the response content
   * to the expected objects
   *
   * @params response Response returned by the server for a request to getAccounts
   * @throws ApiException if the response code was not in [200, 299]
   */
  public async getAccounts(response: ResponseContext): Promise<Array<Account>> {
    const contentType = ObjectSerializer.normalizeMediaType(response.headers['content-type']);
    if (isCodeInRange('200', response.httpStatusCode)) {
      const body: Array<Account> = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'Array<Account>',
        '',
      ) as Array<Account>;
      return body;
    }

    // Work around for missing responses in specification, e.g. for petstore.yaml
    if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
      const body: Array<Account> = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'Array<Account>',
        '',
      ) as Array<Account>;
      return body;
    }

    throw new ApiException<string | Blob | undefined>(
      response.httpStatusCode,
      'Unknown API Status Code!',
      await response.getBodyAsAny(),
      response.headers,
    );
  }

  /**
   * Unwraps the actual response sent by the server from the response context and deserializes the response content
   * to the expected objects
   *
   * @params response Response returned by the server for a request to getBusinessUsersItem
   * @throws ApiException if the response code was not in [200, 299]
   */
  public async getBusinessUsersItem(response: ResponseContext): Promise<Business> {
    const contentType = ObjectSerializer.normalizeMediaType(response.headers['content-type']);
    if (isCodeInRange('200', response.httpStatusCode)) {
      const body: Business = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'Business',
        '',
      ) as Business;
      return body;
    }

    // Work around for missing responses in specification, e.g. for petstore.yaml
    if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
      const body: Business = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'Business',
        '',
      ) as Business;
      return body;
    }

    throw new ApiException<string | Blob | undefined>(
      response.httpStatusCode,
      'Unknown API Status Code!',
      await response.getBodyAsAny(),
      response.headers,
    );
  }

  /**
   * Unwraps the actual response sent by the server from the response context and deserializes the response content
   * to the expected objects
   *
   * @params response Response returned by the server for a request to getBusinessUsersList
   * @throws ApiException if the response code was not in [200, 299]
   */
  public async getBusinessUsersList(response: ResponseContext): Promise<BusinessUsersListResponse> {
    const contentType = ObjectSerializer.normalizeMediaType(response.headers['content-type']);
    if (isCodeInRange('200', response.httpStatusCode)) {
      const body: BusinessUsersListResponse = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'BusinessUsersListResponse',
        '',
      ) as BusinessUsersListResponse;
      return body;
    }

    // Work around for missing responses in specification, e.g. for petstore.yaml
    if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
      const body: BusinessUsersListResponse = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'BusinessUsersListResponse',
        '',
      ) as BusinessUsersListResponse;
      return body;
    }

    throw new ApiException<string | Blob | undefined>(
      response.httpStatusCode,
      'Unknown API Status Code!',
      await response.getBodyAsAny(),
      response.headers,
    );
  }

  /**
   * Unwraps the actual response sent by the server from the response context and deserializes the response content
   * to the expected objects
   *
   * @params response Response returned by the server for a request to getConsumerUsersItem
   * @throws ApiException if the response code was not in [200, 299]
   */
  public async getConsumerUsersItem(response: ResponseContext): Promise<User> {
    const contentType = ObjectSerializer.normalizeMediaType(response.headers['content-type']);
    if (isCodeInRange('200', response.httpStatusCode)) {
      const body: User = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'User',
        '',
      ) as User;
      return body;
    }

    // Work around for missing responses in specification, e.g. for petstore.yaml
    if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
      const body: User = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'User',
        '',
      ) as User;
      return body;
    }

    throw new ApiException<string | Blob | undefined>(
      response.httpStatusCode,
      'Unknown API Status Code!',
      await response.getBodyAsAny(),
      response.headers,
    );
  }

  /**
   * Unwraps the actual response sent by the server from the response context and deserializes the response content
   * to the expected objects
   *
   * @params response Response returned by the server for a request to getConsumerUsersList
   * @throws ApiException if the response code was not in [200, 299]
   */
  public async getConsumerUsersList(response: ResponseContext): Promise<ConsumerUsersListResponse> {
    const contentType = ObjectSerializer.normalizeMediaType(response.headers['content-type']);
    if (isCodeInRange('200', response.httpStatusCode)) {
      const body: ConsumerUsersListResponse = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'ConsumerUsersListResponse',
        '',
      ) as ConsumerUsersListResponse;
      return body;
    }

    // Work around for missing responses in specification, e.g. for petstore.yaml
    if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
      const body: ConsumerUsersListResponse = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'ConsumerUsersListResponse',
        '',
      ) as ConsumerUsersListResponse;
      return body;
    }

    throw new ApiException<string | Blob | undefined>(
      response.httpStatusCode,
      'Unknown API Status Code!',
      await response.getBodyAsAny(),
      response.headers,
    );
  }

  /**
   * Unwraps the actual response sent by the server from the response context and deserializes the response content
   * to the expected objects
   *
   * @params response Response returned by the server for a request to getDashboardStatsTransactions
   * @throws ApiException if the response code was not in [200, 299]
   */
  public async getDashboardStatsTransactions(
    response: ResponseContext,
  ): Promise<DashboardStatsTransactionsCount> {
    const contentType = ObjectSerializer.normalizeMediaType(response.headers['content-type']);
    if (isCodeInRange('200', response.httpStatusCode)) {
      const body: DashboardStatsTransactionsCount = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'DashboardStatsTransactionsCount',
        '',
      ) as DashboardStatsTransactionsCount;
      return body;
    }

    // Work around for missing responses in specification, e.g. for petstore.yaml
    if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
      const body: DashboardStatsTransactionsCount = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'DashboardStatsTransactionsCount',
        '',
      ) as DashboardStatsTransactionsCount;
      return body;
    }

    throw new ApiException<string | Blob | undefined>(
      response.httpStatusCode,
      'Unknown API Status Code!',
      await response.getBodyAsAny(),
      response.headers,
    );
  }

  /**
   * Unwraps the actual response sent by the server from the response context and deserializes the response content
   * to the expected objects
   *
   * @params response Response returned by the server for a request to getImportImportId
   * @throws ApiException if the response code was not in [200, 299]
   */
  public async getImportImportId(response: ResponseContext): Promise<FileImport> {
    const contentType = ObjectSerializer.normalizeMediaType(response.headers['content-type']);
    if (isCodeInRange('200', response.httpStatusCode)) {
      const body: FileImport = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'FileImport',
        '',
      ) as FileImport;
      return body;
    }

    // Work around for missing responses in specification, e.g. for petstore.yaml
    if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
      const body: FileImport = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'FileImport',
        '',
      ) as FileImport;
      return body;
    }

    throw new ApiException<string | Blob | undefined>(
      response.httpStatusCode,
      'Unknown API Status Code!',
      await response.getBodyAsAny(),
      response.headers,
    );
  }

  /**
   * Unwraps the actual response sent by the server from the response context and deserializes the response content
   * to the expected objects
   *
   * @params response Response returned by the server for a request to getRuleImplementations
   * @throws ApiException if the response code was not in [200, 299]
   */
  public async getRuleImplementations(
    response: ResponseContext,
  ): Promise<Array<RuleImplementation>> {
    const contentType = ObjectSerializer.normalizeMediaType(response.headers['content-type']);
    if (isCodeInRange('200', response.httpStatusCode)) {
      const body: Array<RuleImplementation> = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'Array<RuleImplementation>',
        '',
      ) as Array<RuleImplementation>;
      return body;
    }

    // Work around for missing responses in specification, e.g. for petstore.yaml
    if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
      const body: Array<RuleImplementation> = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'Array<RuleImplementation>',
        '',
      ) as Array<RuleImplementation>;
      return body;
    }

    throw new ApiException<string | Blob | undefined>(
      response.httpStatusCode,
      'Unknown API Status Code!',
      await response.getBodyAsAny(),
      response.headers,
    );
  }

  /**
   * Unwraps the actual response sent by the server from the response context and deserializes the response content
   * to the expected objects
   *
   * @params response Response returned by the server for a request to getRuleInstances
   * @throws ApiException if the response code was not in [200, 299]
   */
  public async getRuleInstances(response: ResponseContext): Promise<Array<RuleInstance>> {
    const contentType = ObjectSerializer.normalizeMediaType(response.headers['content-type']);
    if (isCodeInRange('200', response.httpStatusCode)) {
      const body: Array<RuleInstance> = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'Array<RuleInstance>',
        '',
      ) as Array<RuleInstance>;
      return body;
    }

    // Work around for missing responses in specification, e.g. for petstore.yaml
    if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
      const body: Array<RuleInstance> = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'Array<RuleInstance>',
        '',
      ) as Array<RuleInstance>;
      return body;
    }

    throw new ApiException<string | Blob | undefined>(
      response.httpStatusCode,
      'Unknown API Status Code!',
      await response.getBodyAsAny(),
      response.headers,
    );
  }

  /**
   * Unwraps the actual response sent by the server from the response context and deserializes the response content
   * to the expected objects
   *
   * @params response Response returned by the server for a request to getRules
   * @throws ApiException if the response code was not in [200, 299]
   */
  public async getRules(response: ResponseContext): Promise<Array<Rule>> {
    const contentType = ObjectSerializer.normalizeMediaType(response.headers['content-type']);
    if (isCodeInRange('200', response.httpStatusCode)) {
      const body: Array<Rule> = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'Array<Rule>',
        '',
      ) as Array<Rule>;
      return body;
    }

    // Work around for missing responses in specification, e.g. for petstore.yaml
    if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
      const body: Array<Rule> = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'Array<Rule>',
        '',
      ) as Array<Rule>;
      return body;
    }

    throw new ApiException<string | Blob | undefined>(
      response.httpStatusCode,
      'Unknown API Status Code!',
      await response.getBodyAsAny(),
      response.headers,
    );
  }

  /**
   * Unwraps the actual response sent by the server from the response context and deserializes the response content
   * to the expected objects
   *
   * @params response Response returned by the server for a request to getTransaction
   * @throws ApiException if the response code was not in [200, 299]
   */
  public async getTransaction(response: ResponseContext): Promise<TransactionCaseManagement> {
    const contentType = ObjectSerializer.normalizeMediaType(response.headers['content-type']);
    if (isCodeInRange('200', response.httpStatusCode)) {
      const body: TransactionCaseManagement = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'TransactionCaseManagement',
        '',
      ) as TransactionCaseManagement;
      return body;
    }
    if (isCodeInRange('404', response.httpStatusCode)) {
      throw new ApiException<undefined>(
        response.httpStatusCode,
        'Not Found',
        undefined,
        response.headers,
      );
    }

    // Work around for missing responses in specification, e.g. for petstore.yaml
    if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
      const body: TransactionCaseManagement = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'TransactionCaseManagement',
        '',
      ) as TransactionCaseManagement;
      return body;
    }

    throw new ApiException<string | Blob | undefined>(
      response.httpStatusCode,
      'Unknown API Status Code!',
      await response.getBodyAsAny(),
      response.headers,
    );
  }

  /**
   * Unwraps the actual response sent by the server from the response context and deserializes the response content
   * to the expected objects
   *
   * @params response Response returned by the server for a request to getTransactionsList
   * @throws ApiException if the response code was not in [200, 299]
   */
  public async getTransactionsList(response: ResponseContext): Promise<TransactionsListResponse> {
    const contentType = ObjectSerializer.normalizeMediaType(response.headers['content-type']);
    if (isCodeInRange('200', response.httpStatusCode)) {
      const body: TransactionsListResponse = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'TransactionsListResponse',
        '',
      ) as TransactionsListResponse;
      return body;
    }

    // Work around for missing responses in specification, e.g. for petstore.yaml
    if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
      const body: TransactionsListResponse = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'TransactionsListResponse',
        '',
      ) as TransactionsListResponse;
      return body;
    }

    throw new ApiException<string | Blob | undefined>(
      response.httpStatusCode,
      'Unknown API Status Code!',
      await response.getBodyAsAny(),
      response.headers,
    );
  }

  /**
   * Unwraps the actual response sent by the server from the response context and deserializes the response content
   * to the expected objects
   *
   * @params response Response returned by the server for a request to getTransactionsPerUserList
   * @throws ApiException if the response code was not in [200, 299]
   */
  public async getTransactionsPerUserList(
    response: ResponseContext,
  ): Promise<TransactionsListResponse> {
    const contentType = ObjectSerializer.normalizeMediaType(response.headers['content-type']);
    if (isCodeInRange('200', response.httpStatusCode)) {
      const body: TransactionsListResponse = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'TransactionsListResponse',
        '',
      ) as TransactionsListResponse;
      return body;
    }

    // Work around for missing responses in specification, e.g. for petstore.yaml
    if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
      const body: TransactionsListResponse = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'TransactionsListResponse',
        '',
      ) as TransactionsListResponse;
      return body;
    }

    throw new ApiException<string | Blob | undefined>(
      response.httpStatusCode,
      'Unknown API Status Code!',
      await response.getBodyAsAny(),
      response.headers,
    );
  }

  /**
   * Unwraps the actual response sent by the server from the response context and deserializes the response content
   * to the expected objects
   *
   * @params response Response returned by the server for a request to postApikey
   * @throws ApiException if the response code was not in [200, 299]
   */
  public async postApikey(response: ResponseContext): Promise<void> {
    const contentType = ObjectSerializer.normalizeMediaType(response.headers['content-type']);
    if (isCodeInRange('200', response.httpStatusCode)) {
      return;
    }

    // Work around for missing responses in specification, e.g. for petstore.yaml
    if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
      const body: void = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'void',
        '',
      ) as void;
      return body;
    }

    throw new ApiException<string | Blob | undefined>(
      response.httpStatusCode,
      'Unknown API Status Code!',
      await response.getBodyAsAny(),
      response.headers,
    );
  }

  /**
   * Unwraps the actual response sent by the server from the response context and deserializes the response content
   * to the expected objects
   *
   * @params response Response returned by the server for a request to postGetPresignedUrl
   * @throws ApiException if the response code was not in [200, 299]
   */
  public async postGetPresignedUrl(response: ResponseContext): Promise<PresignedUrlResponse> {
    const contentType = ObjectSerializer.normalizeMediaType(response.headers['content-type']);
    if (isCodeInRange('200', response.httpStatusCode)) {
      const body: PresignedUrlResponse = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'PresignedUrlResponse',
        '',
      ) as PresignedUrlResponse;
      return body;
    }

    // Work around for missing responses in specification, e.g. for petstore.yaml
    if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
      const body: PresignedUrlResponse = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'PresignedUrlResponse',
        '',
      ) as PresignedUrlResponse;
      return body;
    }

    throw new ApiException<string | Blob | undefined>(
      response.httpStatusCode,
      'Unknown API Status Code!',
      await response.getBodyAsAny(),
      response.headers,
    );
  }

  /**
   * Unwraps the actual response sent by the server from the response context and deserializes the response content
   * to the expected objects
   *
   * @params response Response returned by the server for a request to postIamRuleInstances
   * @throws ApiException if the response code was not in [200, 299]
   */
  public async postIamRuleInstances(response: ResponseContext): Promise<RuleInstance> {
    const contentType = ObjectSerializer.normalizeMediaType(response.headers['content-type']);
    if (isCodeInRange('200', response.httpStatusCode)) {
      const body: RuleInstance = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'RuleInstance',
        '',
      ) as RuleInstance;
      return body;
    }

    // Work around for missing responses in specification, e.g. for petstore.yaml
    if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
      const body: RuleInstance = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'RuleInstance',
        '',
      ) as RuleInstance;
      return body;
    }

    throw new ApiException<string | Blob | undefined>(
      response.httpStatusCode,
      'Unknown API Status Code!',
      await response.getBodyAsAny(),
      response.headers,
    );
  }

  /**
   * Unwraps the actual response sent by the server from the response context and deserializes the response content
   * to the expected objects
   *
   * @params response Response returned by the server for a request to postIamRules
   * @throws ApiException if the response code was not in [200, 299]
   */
  public async postIamRules(response: ResponseContext): Promise<Rule> {
    const contentType = ObjectSerializer.normalizeMediaType(response.headers['content-type']);
    if (isCodeInRange('200', response.httpStatusCode)) {
      const body: Rule = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'Rule',
        '',
      ) as Rule;
      return body;
    }

    // Work around for missing responses in specification, e.g. for petstore.yaml
    if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
      const body: Rule = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'Rule',
        '',
      ) as Rule;
      return body;
    }

    throw new ApiException<string | Blob | undefined>(
      response.httpStatusCode,
      'Unknown API Status Code!',
      await response.getBodyAsAny(),
      response.headers,
    );
  }

  /**
   * Unwraps the actual response sent by the server from the response context and deserializes the response content
   * to the expected objects
   *
   * @params response Response returned by the server for a request to postImport
   * @throws ApiException if the response code was not in [200, 299]
   */
  public async postImport(response: ResponseContext): Promise<ImportResponse> {
    const contentType = ObjectSerializer.normalizeMediaType(response.headers['content-type']);
    if (isCodeInRange('200', response.httpStatusCode)) {
      const body: ImportResponse = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'ImportResponse',
        '',
      ) as ImportResponse;
      return body;
    }

    // Work around for missing responses in specification, e.g. for petstore.yaml
    if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
      const body: ImportResponse = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'ImportResponse',
        '',
      ) as ImportResponse;
      return body;
    }

    throw new ApiException<string | Blob | undefined>(
      response.httpStatusCode,
      'Unknown API Status Code!',
      await response.getBodyAsAny(),
      response.headers,
    );
  }

  /**
   * Unwraps the actual response sent by the server from the response context and deserializes the response content
   * to the expected objects
   *
   * @params response Response returned by the server for a request to postLists
   * @throws ApiException if the response code was not in [200, 299]
   */
  public async postLists(response: ResponseContext): Promise<void> {
    const contentType = ObjectSerializer.normalizeMediaType(response.headers['content-type']);
    if (isCodeInRange('200', response.httpStatusCode)) {
      return;
    }

    // Work around for missing responses in specification, e.g. for petstore.yaml
    if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
      const body: void = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'void',
        '',
      ) as void;
      return body;
    }

    throw new ApiException<string | Blob | undefined>(
      response.httpStatusCode,
      'Unknown API Status Code!',
      await response.getBodyAsAny(),
      response.headers,
    );
  }

  /**
   * Unwraps the actual response sent by the server from the response context and deserializes the response content
   * to the expected objects
   *
   * @params response Response returned by the server for a request to postRuleInstances
   * @throws ApiException if the response code was not in [200, 299]
   */
  public async postRuleInstances(response: ResponseContext): Promise<RuleInstance> {
    const contentType = ObjectSerializer.normalizeMediaType(response.headers['content-type']);
    if (isCodeInRange('200', response.httpStatusCode)) {
      const body: RuleInstance = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'RuleInstance',
        '',
      ) as RuleInstance;
      return body;
    }

    // Work around for missing responses in specification, e.g. for petstore.yaml
    if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
      const body: RuleInstance = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'RuleInstance',
        '',
      ) as RuleInstance;
      return body;
    }

    throw new ApiException<string | Blob | undefined>(
      response.httpStatusCode,
      'Unknown API Status Code!',
      await response.getBodyAsAny(),
      response.headers,
    );
  }

  /**
   * Unwraps the actual response sent by the server from the response context and deserializes the response content
   * to the expected objects
   *
   * @params response Response returned by the server for a request to postRules
   * @throws ApiException if the response code was not in [200, 299]
   */
  public async postRules(response: ResponseContext): Promise<Rule> {
    const contentType = ObjectSerializer.normalizeMediaType(response.headers['content-type']);
    if (isCodeInRange('200', response.httpStatusCode)) {
      const body: Rule = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'Rule',
        '',
      ) as Rule;
      return body;
    }

    // Work around for missing responses in specification, e.g. for petstore.yaml
    if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
      const body: Rule = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'Rule',
        '',
      ) as Rule;
      return body;
    }

    throw new ApiException<string | Blob | undefined>(
      response.httpStatusCode,
      'Unknown API Status Code!',
      await response.getBodyAsAny(),
      response.headers,
    );
  }

  /**
   * Unwraps the actual response sent by the server from the response context and deserializes the response content
   * to the expected objects
   *
   * @params response Response returned by the server for a request to postTransactionsComments
   * @throws ApiException if the response code was not in [200, 299]
   */
  public async postTransactionsComments(response: ResponseContext): Promise<Comment> {
    const contentType = ObjectSerializer.normalizeMediaType(response.headers['content-type']);
    if (isCodeInRange('200', response.httpStatusCode)) {
      const body: Comment = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'Comment',
        '',
      ) as Comment;
      return body;
    }

    // Work around for missing responses in specification, e.g. for petstore.yaml
    if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
      const body: Comment = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'Comment',
        '',
      ) as Comment;
      return body;
    }

    throw new ApiException<string | Blob | undefined>(
      response.httpStatusCode,
      'Unknown API Status Code!',
      await response.getBodyAsAny(),
      response.headers,
    );
  }

  /**
   * Unwraps the actual response sent by the server from the response context and deserializes the response content
   * to the expected objects
   *
   * @params response Response returned by the server for a request to postTransactionsTransactionId
   * @throws ApiException if the response code was not in [200, 299]
   */
  public async postTransactionsTransactionId(response: ResponseContext): Promise<void> {
    const contentType = ObjectSerializer.normalizeMediaType(response.headers['content-type']);
    if (isCodeInRange('200', response.httpStatusCode)) {
      return;
    }

    // Work around for missing responses in specification, e.g. for petstore.yaml
    if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
      const body: void = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'void',
        '',
      ) as void;
      return body;
    }

    throw new ApiException<string | Blob | undefined>(
      response.httpStatusCode,
      'Unknown API Status Code!',
      await response.getBodyAsAny(),
      response.headers,
    );
  }

  /**
   * Unwraps the actual response sent by the server from the response context and deserializes the response content
   * to the expected objects
   *
   * @params response Response returned by the server for a request to putRuleInstancesRuleInstanceId
   * @throws ApiException if the response code was not in [200, 299]
   */
  public async putRuleInstancesRuleInstanceId(
    response: ResponseContext,
  ): Promise<RuleInstance | any> {
    const contentType = ObjectSerializer.normalizeMediaType(response.headers['content-type']);
    if (isCodeInRange('200', response.httpStatusCode)) {
      const body: RuleInstance = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'RuleInstance',
        '',
      ) as RuleInstance;
      return body;
    }
    if (isCodeInRange('201', response.httpStatusCode)) {
      const body: any = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'any',
        '',
      ) as any;
      return body;
    }

    // Work around for missing responses in specification, e.g. for petstore.yaml
    if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
      const body: RuleInstance | any = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'RuleInstance | any',
        '',
      ) as RuleInstance | any;
      return body;
    }

    throw new ApiException<string | Blob | undefined>(
      response.httpStatusCode,
      'Unknown API Status Code!',
      await response.getBodyAsAny(),
      response.headers,
    );
  }

  /**
   * Unwraps the actual response sent by the server from the response context and deserializes the response content
   * to the expected objects
   *
   * @params response Response returned by the server for a request to putRuleRuleId
   * @throws ApiException if the response code was not in [200, 299]
   */
  public async putRuleRuleId(response: ResponseContext): Promise<void> {
    const contentType = ObjectSerializer.normalizeMediaType(response.headers['content-type']);
    if (isCodeInRange('200', response.httpStatusCode)) {
      return;
    }

    // Work around for missing responses in specification, e.g. for petstore.yaml
    if (response.httpStatusCode >= 200 && response.httpStatusCode <= 299) {
      const body: void = ObjectSerializer.deserialize(
        ObjectSerializer.parse(await response.body.text(), contentType),
        'void',
        '',
      ) as void;
      return body;
    }

    throw new ApiException<string | Blob | undefined>(
      response.httpStatusCode,
      'Unknown API Status Code!',
      await response.getBodyAsAny(),
      response.headers,
    );
  }
}
