# .DefaultApi

All URIs are relative to _http://localhost:3000_

| Method | HTTP request | Description |
| --- | --- | --- |
| [**accountsChangeTenant**](DefaultApi.md#accountsChangeTenant) | **POST** /accounts/{userId}/change_tenant | Account - Change Tenant |
| [**accountsDelete**](DefaultApi.md#accountsDelete) | **DELETE** /accounts/{userId} | Account - Delete |
| [**accountsInvite**](DefaultApi.md#accountsInvite) | **POST** /accounts | Account - Invite |
| [**deleteBusinessUsersUserIdFilesFileId**](DefaultApi.md#deleteBusinessUsersUserIdFilesFileId) | **DELETE** /business/users/{userId}/files/{fileId} | Business User Files - Delete |
| [**deleteConsumerUsersUserIdFilesFileId**](DefaultApi.md#deleteConsumerUsersUserIdFilesFileId) | **DELETE** /consumer/users/{userId}/files/{fileId} | Consumer User Files - Delete |
| [**deleteRuleInstancesRuleInstanceId**](DefaultApi.md#deleteRuleInstancesRuleInstanceId) | **DELETE** /rule_instances/{ruleInstanceId} | Rule Instance - Delete |
| [**deleteRulesRuleId**](DefaultApi.md#deleteRulesRuleId) | **DELETE** /rules/{ruleId} | Rule - Delete |
| [**deleteTransactionsTransactionIdCommentsCommentId**](DefaultApi.md#deleteTransactionsTransactionIdCommentsCommentId) | **DELETE** /transactions/{transactionId}/comments/{commentId} | Delete a Transaction Comment |
| [**getAccounts**](DefaultApi.md#getAccounts) | **GET** /accounts | Account - List |
| [**getBusinessUsersItem**](DefaultApi.md#getBusinessUsersItem) | **GET** /business/users/{userId} | Business Users - Item - Get |
| [**getBusinessUsersList**](DefaultApi.md#getBusinessUsersList) | **GET** /business/users | Business Users - List |
| [**getConsumerUsersItem**](DefaultApi.md#getConsumerUsersItem) | **GET** /consumer/users/{userId} | Consumer Users - Item - Get |
| [**getConsumerUsersList**](DefaultApi.md#getConsumerUsersList) | **GET** /consumer/users | Consumer Users - List |
| [**getDashboardStatsHitsPerUser**](DefaultApi.md#getDashboardStatsHitsPerUser) | **GET** /dashboard_stats/hits_per_user | DashboardStats - Hits per user |
| [**getDashboardStatsRuleHit**](DefaultApi.md#getDashboardStatsRuleHit) | **GET** /dashboard_stats/rule_hit | DashboardStats - Rule hit |
| [**getDashboardStatsTransactions**](DefaultApi.md#getDashboardStatsTransactions) | **GET** /dashboard_stats/transactions | DashboardStats - Transactions |
| [**getImportImportId**](DefaultApi.md#getImportImportId) | **GET** /import/{importId} | Import - Get Import Info |
| [**getPulseManualRiskAssignment**](DefaultApi.md#getPulseManualRiskAssignment) | **GET** /pulse/manual-risk-assignment | Risk Level - Get Manual Assignment |
| [**getPulseRiskClassification**](DefaultApi.md#getPulseRiskClassification) | **GET** /pulse/risk-classification | Risk classification - GET |
| [**getRuleImplementations**](DefaultApi.md#getRuleImplementations) | **GET** /rule_implementations | Rule Implementations - List |
| [**getRuleInstances**](DefaultApi.md#getRuleInstances) | **GET** /rule_instances | Rule Instance - List |
| [**getRules**](DefaultApi.md#getRules) | **GET** /rules | Rules - List |
| [**getTenantsList**](DefaultApi.md#getTenantsList) | **GET** /tenants | Tenant - List |
| [**getTenantsSettings**](DefaultApi.md#getTenantsSettings) | **GET** /tenants/settings | Tenant - Get Settings |
| [**getTransaction**](DefaultApi.md#getTransaction) | **GET** /transactions/{transactionId} | Transaction - Get |
| [**getTransactionsList**](DefaultApi.md#getTransactionsList) | **GET** /transactions | Transaction - List |
| [**getTransactionsListExport**](DefaultApi.md#getTransactionsListExport) | **GET** /transactions/export | Transaction - Export |
| [**postApikey**](DefaultApi.md#postApikey) | **POST** /apikey | Tarpon API Key - Create |
| [**postBusinessUsersUserIdFiles**](DefaultApi.md#postBusinessUsersUserIdFiles) | **POST** /business/users/{userId}/files | Business User Files - Create |
| [**postConsumerUsersUserIdFiles**](DefaultApi.md#postConsumerUsersUserIdFiles) | **POST** /consumer/users/{userId}/files | Consumer User Files - Create |
| [**postGetPresignedUrl**](DefaultApi.md#postGetPresignedUrl) | **POST** /files/getPresignedUrl | Files - Get Presigned URL |
| [**postIamRuleInstances**](DefaultApi.md#postIamRuleInstances) | **POST** /iam/rule_instances | Rule Instance - Create |
| [**postIamRules**](DefaultApi.md#postIamRules) | **POST** /iam/rules | Rules - Create |
| [**postImport**](DefaultApi.md#postImport) | **POST** /import | Import - Start to Import |
| [**postLists**](DefaultApi.md#postLists) | **POST** /lists | List Import |
| [**postPulseRiskClassification**](DefaultApi.md#postPulseRiskClassification) | **POST** /pulse/risk-classification | Risk classification - POST |
| [**postRuleInstances**](DefaultApi.md#postRuleInstances) | **POST** /rule_instances | Rule Instance - Create |
| [**postRules**](DefaultApi.md#postRules) | **POST** /rules | Rules - Create |
| [**postTenantsSettings**](DefaultApi.md#postTenantsSettings) | **POST** /tenants/settings | Tenant - POST Settings |
| [**postTransactionsComments**](DefaultApi.md#postTransactionsComments) | **POST** /transactions/{transactionId}/comments | Create a Transaction Comment |
| [**postTransactionsTransactionId**](DefaultApi.md#postTransactionsTransactionId) | **POST** /transactions/{transactionId} | Transaction - Update |
| [**pulseManualRiskAssignment**](DefaultApi.md#pulseManualRiskAssignment) | **POST** /pulse/manual-risk-assignment | Risk Level - Manual Assignment |
| [**putRuleInstancesRuleInstanceId**](DefaultApi.md#putRuleInstancesRuleInstanceId) | **PUT** /rule_instances/{ruleInstanceId} | Rule Instance - Update |
| [**putRuleRuleId**](DefaultApi.md#putRuleRuleId) | **PUT** /rules/{ruleId} | Rule - Update |

# **accountsChangeTenant**

> void accountsChangeTenant()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:.DefaultApiAccountsChangeTenantRequest = {
  // string
  userId: "userId_example",
  // ChangeTenantPayload (optional)
  ChangeTenantPayload: {
    newTenantId: "newTenantId_example",
  },
};

apiInstance.accountsChangeTenant(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

| Name                    | Type                    | Description | Notes                 |
| ----------------------- | ----------------------- | ----------- | --------------------- |
| **ChangeTenantPayload** | **ChangeTenantPayload** |             |
| **userId**              | [**string**]            |             | defaults to undefined |

### Return type

**void**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not defined

### HTTP response details

| Status code | Description           | Response headers |
| ----------- | --------------------- | ---------------- |
| **200**     | OK                    | -                |
| **403**     | Not enough privileges | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **accountsDelete**

> void accountsDelete()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:.DefaultApiAccountsDeleteRequest = {
  // string
  userId: "userId_example",
};

apiInstance.accountsDelete(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

| Name       | Type         | Description | Notes                 |
| ---------- | ------------ | ----------- | --------------------- |
| **userId** | [**string**] |             | defaults to undefined |

### Return type

**void**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **accountsInvite**

> Account accountsInvite()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:.DefaultApiAccountsInviteRequest = {
  // AccountInvitePayload (optional)
  AccountInvitePayload: {
    email: "email_example",
    password: "password_example",
  },
};

apiInstance.accountsInvite(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

| Name                     | Type                     | Description | Notes |
| ------------------------ | ------------------------ | ----------- | ----- |
| **AccountInvitePayload** | **AccountInvitePayload** |             |

### Return type

**Account**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **deleteBusinessUsersUserIdFilesFileId**

> void deleteBusinessUsersUserIdFilesFileId()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:.DefaultApiDeleteBusinessUsersUserIdFilesFileIdRequest = {
  // string
  userId: "userId_example",
  // string
  fileId: "fileId_example",
};

apiInstance.deleteBusinessUsersUserIdFilesFileId(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

| Name       | Type         | Description | Notes                 |
| ---------- | ------------ | ----------- | --------------------- |
| **userId** | [**string**] |             | defaults to undefined |
| **fileId** | [**string**] |             | defaults to undefined |

### Return type

**void**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **deleteConsumerUsersUserIdFilesFileId**

> void deleteConsumerUsersUserIdFilesFileId()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:.DefaultApiDeleteConsumerUsersUserIdFilesFileIdRequest = {
  // string
  userId: "userId_example",
  // string
  fileId: "fileId_example",
};

apiInstance.deleteConsumerUsersUserIdFilesFileId(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

| Name       | Type         | Description | Notes                 |
| ---------- | ------------ | ----------- | --------------------- |
| **userId** | [**string**] |             | defaults to undefined |
| **fileId** | [**string**] |             | defaults to undefined |

### Return type

**void**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **deleteRuleInstancesRuleInstanceId**

> void deleteRuleInstancesRuleInstanceId()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:.DefaultApiDeleteRuleInstancesRuleInstanceIdRequest = {
  // string
  ruleInstanceId: "ruleInstanceId_example",
};

apiInstance.deleteRuleInstancesRuleInstanceId(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

| Name               | Type         | Description | Notes                 |
| ------------------ | ------------ | ----------- | --------------------- |
| **ruleInstanceId** | [**string**] |             | defaults to undefined |

### Return type

**void**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **deleteRulesRuleId**

> void deleteRulesRuleId()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:.DefaultApiDeleteRulesRuleIdRequest = {
  // string
  ruleId: "ruleId_example",
};

apiInstance.deleteRulesRuleId(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

| Name       | Type         | Description | Notes                 |
| ---------- | ------------ | ----------- | --------------------- |
| **ruleId** | [**string**] |             | defaults to undefined |

### Return type

**void**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **deleteTransactionsTransactionIdCommentsCommentId**

> void deleteTransactionsTransactionIdCommentsCommentId()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:.DefaultApiDeleteTransactionsTransactionIdCommentsCommentIdRequest = {
  // string
  transactionId: "transactionId_example",
  // string
  commentId: "commentId_example",
};

apiInstance.deleteTransactionsTransactionIdCommentsCommentId(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

| Name              | Type         | Description | Notes                 |
| ----------------- | ------------ | ----------- | --------------------- |
| **transactionId** | [**string**] |             | defaults to undefined |
| **commentId**     | [**string**] |             | defaults to undefined |

### Return type

**void**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **getAccounts**

> Array<Account> getAccounts()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:any = {};

apiInstance.getAccounts(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

This endpoint does not need any parameter.

### Return type

**Array<Account>**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **getBusinessUsersItem**

> InternalBusinessUser getBusinessUsersItem()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:.DefaultApiGetBusinessUsersItemRequest = {
  // string
  userId: "userId_example",
};

apiInstance.getBusinessUsersItem(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

| Name       | Type         | Description | Notes                 |
| ---------- | ------------ | ----------- | --------------------- |
| **userId** | [**string**] |             | defaults to undefined |

### Return type

**InternalBusinessUser**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **getBusinessUsersList**

> BusinessUsersListResponse getBusinessUsersList()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:.DefaultApiGetBusinessUsersListRequest = {
  // number
  limit: 3.14,
  // number
  skip: 3.14,
  // number
  beforeTimestamp: 3.14,
  // number (optional)
  afterTimestamp: 3.14,
  // string (optional)
  filterId: "filterId_example",
};

apiInstance.getBusinessUsersList(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

| Name                | Type         | Description | Notes                            |
| ------------------- | ------------ | ----------- | -------------------------------- |
| **limit**           | [**number**] |             | defaults to undefined            |
| **skip**            | [**number**] |             | defaults to undefined            |
| **beforeTimestamp** | [**number**] |             | defaults to undefined            |
| **afterTimestamp**  | [**number**] |             | (optional) defaults to undefined |
| **filterId**        | [**string**] |             | (optional) defaults to undefined |

### Return type

**BusinessUsersListResponse**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **getConsumerUsersItem**

> InternalConsumerUser getConsumerUsersItem()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:.DefaultApiGetConsumerUsersItemRequest = {
  // string
  userId: "userId_example",
};

apiInstance.getConsumerUsersItem(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

| Name       | Type         | Description | Notes                 |
| ---------- | ------------ | ----------- | --------------------- |
| **userId** | [**string**] |             | defaults to undefined |

### Return type

**InternalConsumerUser**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **getConsumerUsersList**

> ConsumerUsersListResponse getConsumerUsersList()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:.DefaultApiGetConsumerUsersListRequest = {
  // number
  limit: 3.14,
  // number
  skip: 3.14,
  // number
  beforeTimestamp: 3.14,
  // number (optional)
  afterTimestamp: 3.14,
  // string (optional)
  filterId: "filterId_example",
};

apiInstance.getConsumerUsersList(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

| Name                | Type         | Description | Notes                            |
| ------------------- | ------------ | ----------- | -------------------------------- |
| **limit**           | [**number**] |             | defaults to undefined            |
| **skip**            | [**number**] |             | defaults to undefined            |
| **beforeTimestamp** | [**number**] |             | defaults to undefined            |
| **afterTimestamp**  | [**number**] |             | (optional) defaults to undefined |
| **filterId**        | [**string**] |             | (optional) defaults to undefined |

### Return type

**ConsumerUsersListResponse**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **getDashboardStatsHitsPerUser**

> DashboardStatsHitsPerUser getDashboardStatsHitsPerUser()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:.DefaultApiGetDashboardStatsHitsPerUserRequest = {
  // number (optional)
  startTimestamp: 3.14,
  // number (optional)
  endTimestamp: 3.14,
};

apiInstance.getDashboardStatsHitsPerUser(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

| Name               | Type         | Description | Notes                            |
| ------------------ | ------------ | ----------- | -------------------------------- |
| **startTimestamp** | [**number**] |             | (optional) defaults to undefined |
| **endTimestamp**   | [**number**] |             | (optional) defaults to undefined |

### Return type

**DashboardStatsHitsPerUser**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **getDashboardStatsRuleHit**

> DashboardStatsRulesCount getDashboardStatsRuleHit()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:.DefaultApiGetDashboardStatsRuleHitRequest = {
  // 'WEEK' | 'MONTH' | 'DAY' | 'YEAR' (optional)
  startTimestamp: "WEEK",
  // number (optional)
  endTimestamp: 3.14,
};

apiInstance.getDashboardStatsRuleHit(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

| Name               | Type                | Description     | Notes                            |
| ------------------ | ------------------- | --------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------- | --- | -------------------------------- |
| **startTimestamp** | [\*\*&#39;WEEK&#39; | &#39;MONTH&#39; | &#39;DAY&#39;                    | &#39;YEAR&#39;**]**Array<&#39;WEEK&#39; &#124; &#39;MONTH&#39; &#124; &#39;DAY&#39; &#124; &#39;YEAR&#39;>\*\* |     | (optional) defaults to undefined |
| **endTimestamp**   | [**number**]        |                 | (optional) defaults to undefined |

### Return type

**DashboardStatsRulesCount**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **getDashboardStatsTransactions**

> DashboardStatsTransactionsCount getDashboardStatsTransactions()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:.DefaultApiGetDashboardStatsTransactionsRequest = {
  // 'WEEK' | 'MONTH' | 'DAY' | 'YEAR' | MONTH, DAY or YEAR
  timeframe: "WEEK",
  // number (optional)
  endTimestamp: 3.14,
};

apiInstance.getDashboardStatsTransactions(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

| Name             | Type                | Description     | Notes                            |
| ---------------- | ------------------- | --------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------ | --------------------- |
| **timeframe**    | [\*\*&#39;WEEK&#39; | &#39;MONTH&#39; | &#39;DAY&#39;                    | &#39;YEAR&#39;**]**Array<&#39;WEEK&#39; &#124; &#39;MONTH&#39; &#124; &#39;DAY&#39; &#124; &#39;YEAR&#39;>\*\* | MONTH, DAY or YEAR | defaults to undefined |
| **endTimestamp** | [**number**]        |                 | (optional) defaults to undefined |

### Return type

**DashboardStatsTransactionsCount**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **getImportImportId**

> FileImport getImportImportId()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:.DefaultApiGetImportImportIdRequest = {
  // string
  importId: "importId_example",
};

apiInstance.getImportImportId(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

| Name         | Type         | Description | Notes                 |
| ------------ | ------------ | ----------- | --------------------- |
| **importId** | [**string**] |             | defaults to undefined |

### Return type

**FileImport**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **getPulseManualRiskAssignment**

> ManualRiskAssignmentUserState getPulseManualRiskAssignment()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:.DefaultApiGetPulseManualRiskAssignmentRequest = {
  // string | UserID of the user to get manual risk assignment settings
  userId: "userId_example",
};

apiInstance.getPulseManualRiskAssignment(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

| Name | Type | Description | Notes |
| --- | --- | --- | --- |
| **userId** | [**string**] | UserID of the user to get manual risk assignment settings | defaults to undefined |

### Return type

**ManualRiskAssignmentUserState**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description           | Response headers |
| ----------- | --------------------- | ---------------- |
| **200**     | OK                    | -                |
| **403**     | Not enough privileges | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **getPulseRiskClassification**

> Array<RiskClassificationScore> getPulseRiskClassification()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:any = {};

apiInstance.getPulseRiskClassification(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

This endpoint does not need any parameter.

### Return type

**Array<RiskClassificationScore>**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **getRuleImplementations**

> Array<RuleImplementation> getRuleImplementations()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:any = {};

apiInstance.getRuleImplementations(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

This endpoint does not need any parameter.

### Return type

**Array<RuleImplementation>**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json, application/xml

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **getRuleInstances**

> Array<RuleInstance> getRuleInstances()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:any = {};

apiInstance.getRuleInstances(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

This endpoint does not need any parameter.

### Return type

**Array<RuleInstance>**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **getRules**

> Array<Rule> getRules()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:.DefaultApiGetRulesRequest = {
  // string (optional)
  ruleId: "ruleId_example",
};

apiInstance.getRules(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

| Name       | Type         | Description | Notes                            |
| ---------- | ------------ | ----------- | -------------------------------- |
| **ruleId** | [**string**] |             | (optional) defaults to undefined |

### Return type

**Array<Rule>**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **getTenantsList**

> Array<Tenant> getTenantsList()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:any = {};

apiInstance.getTenantsList(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

This endpoint does not need any parameter.

### Return type

**Array<Tenant>**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **getTenantsSettings**

> TenantSettings getTenantsSettings()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:any = {};

apiInstance.getTenantsSettings(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

This endpoint does not need any parameter.

### Return type

**TenantSettings**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **getTransaction**

> TransactionCaseManagement getTransaction()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:.DefaultApiGetTransactionRequest = {
  // string
  transactionId: "transactionId_example",
};

apiInstance.getTransaction(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

| Name              | Type         | Description | Notes                 |
| ----------------- | ------------ | ----------- | --------------------- |
| **transactionId** | [**string**] |             | defaults to undefined |

### Return type

**TransactionCaseManagement**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |
| **404**     | Not Found   | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **getTransactionsList**

> TransactionsListResponse getTransactionsList()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:.DefaultApiGetTransactionsListRequest = {
  // number
  limit: 3.14,
  // number
  skip: 3.14,
  // number
  beforeTimestamp: 3.14,
  // number (optional)
  afterTimestamp: 3.14,
  // string (optional)
  filterId: "filterId_example",
  // RuleAction (optional)
  filterOutStatus: "FLAG",
  // Array<string> (optional)
  filterRulesExecuted: [
    "filterRulesExecuted_example",
  ],
  // Array<string> (optional)
  filterRulesHit: [
    "filterRulesHit_example",
  ],
  // string (optional)
  transactionType: "transactionType_example",
  // Array<string> (optional)
  filterOriginCurrencies: [
    "filterOriginCurrencies_example",
  ],
  // Array<string> (optional)
  filterDestinationCurrencies: [
    "filterDestinationCurrencies_example",
  ],
  // string (optional)
  sortField: "sortField_example",
  // string (optional)
  sortOrder: "sortOrder_example",
  // string (optional)
  filterOriginUserId: "filterOriginUserId_example",
  // string (optional)
  filterDestinationUserId: "filterDestinationUserId_example",
};

apiInstance.getTransactionsList(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

| Name | Type | Description | Notes |
| --- | --- | --- | --- |
| **limit** | [**number**] |  | defaults to undefined |
| **skip** | [**number**] |  | defaults to undefined |
| **beforeTimestamp** | [**number**] |  | defaults to undefined |
| **afterTimestamp** | [**number**] |  | (optional) defaults to undefined |
| **filterId** | [**string**] |  | (optional) defaults to undefined |
| **filterOutStatus** | **RuleAction** |  | (optional) defaults to undefined |
| **filterRulesExecuted** | **Array&lt;string&gt;** |  | (optional) defaults to undefined |
| **filterRulesHit** | **Array&lt;string&gt;** |  | (optional) defaults to undefined |
| **transactionType** | [**string**] |  | (optional) defaults to undefined |
| **filterOriginCurrencies** | **Array&lt;string&gt;** |  | (optional) defaults to undefined |
| **filterDestinationCurrencies** | **Array&lt;string&gt;** |  | (optional) defaults to undefined |
| **sortField** | [**string**] |  | (optional) defaults to undefined |
| **sortOrder** | [**string**] |  | (optional) defaults to undefined |
| **filterOriginUserId** | [**string**] |  | (optional) defaults to undefined |
| **filterDestinationUserId** | [**string**] |  | (optional) defaults to undefined |

### Return type

**TransactionsListResponse**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **getTransactionsListExport**

> InlineResponse200 getTransactionsListExport()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:.DefaultApiGetTransactionsListExportRequest = {
  // number
  limit: 3.14,
  // number
  skip: 3.14,
  // number
  beforeTimestamp: 3.14,
  // number (optional)
  afterTimestamp: 3.14,
  // string (optional)
  filterId: "filterId_example",
  // Array<string> (optional)
  filterRulesExecuted: [
    "filterRulesExecuted_example",
  ],
  // Array<string> (optional)
  filterRulesHit: [
    "filterRulesHit_example",
  ],
  // RuleAction (optional)
  filterOutStatus: "FLAG",
  // string (optional)
  sortField: "sortField_example",
  // string (optional)
  sortOrder: "sortOrder_example",
};

apiInstance.getTransactionsListExport(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

| Name | Type | Description | Notes |
| --- | --- | --- | --- |
| **limit** | [**number**] |  | defaults to undefined |
| **skip** | [**number**] |  | defaults to undefined |
| **beforeTimestamp** | [**number**] |  | defaults to undefined |
| **afterTimestamp** | [**number**] |  | (optional) defaults to undefined |
| **filterId** | [**string**] |  | (optional) defaults to undefined |
| **filterRulesExecuted** | **Array&lt;string&gt;** |  | (optional) defaults to undefined |
| **filterRulesHit** | **Array&lt;string&gt;** |  | (optional) defaults to undefined |
| **filterOutStatus** | **RuleAction** |  | (optional) defaults to undefined |
| **sortField** | [**string**] |  | (optional) defaults to undefined |
| **sortOrder** | [**string**] |  | (optional) defaults to undefined |

### Return type

**InlineResponse200**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json, text/plain

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |
| **400**     | Bad Request | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **postApikey**

> void postApikey()

Generate a new Tarpon API key for a tenant

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:.DefaultApiPostApikeyRequest = {
  // string | Tenant ID (optional)
  tenantId: "tenantId_example",
  // string | AWS Gateway usage plan ID (optional)
  usagePlanId: "usagePlanId_example",
};

apiInstance.postApikey(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

| Name            | Type         | Description               | Notes                            |
| --------------- | ------------ | ------------------------- | -------------------------------- |
| **tenantId**    | [**string**] | Tenant ID                 | (optional) defaults to undefined |
| **usagePlanId** | [**string**] | AWS Gateway usage plan ID | (optional) defaults to undefined |

### Return type

**void**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | New API Key | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **postBusinessUsersUserIdFiles**

> void postBusinessUsersUserIdFiles()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:.DefaultApiPostBusinessUsersUserIdFilesRequest = {
  // string
  userId: "userId_example",
  // FileInfo (optional)
  FileInfo: {
    s3Key: "s3Key_example",
    bucket: "bucket_example",
    filename: "filename_example",
    size: 3.14,
    downloadLink: "downloadLink_example",
  },
};

apiInstance.postBusinessUsersUserIdFiles(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

| Name         | Type         | Description | Notes                 |
| ------------ | ------------ | ----------- | --------------------- |
| **FileInfo** | **FileInfo** |             |
| **userId**   | [**string**] |             | defaults to undefined |

### Return type

**void**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not defined

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **postConsumerUsersUserIdFiles**

> void postConsumerUsersUserIdFiles()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:.DefaultApiPostConsumerUsersUserIdFilesRequest = {
  // string
  userId: "userId_example",
  // FileInfo (optional)
  FileInfo: {
    s3Key: "s3Key_example",
    bucket: "bucket_example",
    filename: "filename_example",
    size: 3.14,
    downloadLink: "downloadLink_example",
  },
};

apiInstance.postConsumerUsersUserIdFiles(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

| Name         | Type         | Description | Notes                 |
| ------------ | ------------ | ----------- | --------------------- |
| **FileInfo** | **FileInfo** |             |
| **userId**   | [**string**] |             | defaults to undefined |

### Return type

**void**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not defined

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **postGetPresignedUrl**

> PresignedUrlResponse postGetPresignedUrl()

Get a presigned URL for uploading a file

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:any = {};

apiInstance.postGetPresignedUrl(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

This endpoint does not need any parameter.

### Return type

**PresignedUrlResponse**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **postIamRuleInstances**

> RuleInstance postIamRuleInstances()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:.DefaultApiPostIamRuleInstancesRequest = {
  // string | Tenant ID (optional)
  tenantId: "tenantId_example",
  // RuleInstance (optional)
  RuleInstance: {
    id: "id_example",
    type: "TRANSACTION",
    ruleId: "ruleId_example",
    parameters: {},
    riskLevelParameters: {
      VERY_HIGH: {},
      HIGH: {},
      MEDIUM: {},
      LOW: {},
      VERY_LOW: {},
    },
    action: "FLAG",
    riskLevelActions: {
      VERY_HIGH: "FLAG",
      HIGH: "FLAG",
      MEDIUM: "FLAG",
      LOW: "FLAG",
      VERY_LOW: "FLAG",
    },
    status: "ACTIVE",
    createdAt: 3.14,
    updatedAt: 3.14,
    runCount: 3.14,
    hitCount: 3.14,
  },
};

apiInstance.postIamRuleInstances(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

| Name             | Type             | Description | Notes                            |
| ---------------- | ---------------- | ----------- | -------------------------------- |
| **RuleInstance** | **RuleInstance** |             |
| **tenantId**     | [**string**]     | Tenant ID   | (optional) defaults to undefined |

### Return type

**RuleInstance**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **postIamRules**

> Rule postIamRules()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:.DefaultApiPostIamRulesRequest = {
  // string | Tenant ID (optional)
  tenantId: "tenantId_example",
  // Rule (optional)
  Rule: {
    id: "id_example",
    type: "TRANSACTION",
    name: "name_example",
    description: "description_example",
    defaultParameters: {},
    defaultRiskLevelParameters: {
      VERY_HIGH: {},
      HIGH: {},
      MEDIUM: {},
      LOW: {},
      VERY_LOW: {},
    },
    defaultAction: "FLAG",
    defaultRiskLevelActions: {
      VERY_HIGH: "FLAG",
      HIGH: "FLAG",
      MEDIUM: "FLAG",
      LOW: "FLAG",
      VERY_LOW: "FLAG",
    },
    ruleImplementationName: "ruleImplementationName_example",
    labels: [
      "labels_example",
    ],
    createdAt: 3.14,
    updatedAt: 3.14,
    tenantIds: [
      "tenantIds_example",
    ],
  },
};

apiInstance.postIamRules(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

| Name         | Type         | Description | Notes                            |
| ------------ | ------------ | ----------- | -------------------------------- |
| **Rule**     | **Rule**     |             |
| **tenantId** | [**string**] | Tenant ID   | (optional) defaults to undefined |

### Return type

**Rule**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **postImport**

> ImportResponse postImport()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:.DefaultApiPostImportRequest = {
  // ImportRequest (optional)
  ImportRequest: {
    type: "TRANSACTION",
    format: "flagright",
    s3Key: "s3Key_example",
    filename: "filename_example",
  },
};

apiInstance.postImport(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

| Name              | Type              | Description | Notes |
| ----------------- | ----------------- | ----------- | ----- |
| **ImportRequest** | **ImportRequest** |             |

### Return type

**ImportResponse**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **postLists**

> void postLists()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:.DefaultApiPostListsRequest = {
  // ListImportRequest (optional)
  ListImportRequest: {
    listName: "listName_example",
    indexName: "indexName_example",
    data: "data_example",
  },
};

apiInstance.postLists(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

| Name                  | Type                  | Description | Notes |
| --------------------- | --------------------- | ----------- | ----- |
| **ListImportRequest** | **ListImportRequest** |             |

### Return type

**void**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not defined

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **postPulseRiskClassification**

> Array<RiskClassificationScore> postPulseRiskClassification()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:.DefaultApiPostPulseRiskClassificationRequest = {
  // Array<RiskClassificationScore> (optional)
  RiskClassificationScore: [
    {
      riskLevel: "VERY_HIGH",
      lowerBoundRiskScore: 0,
      upperBoundRiskScore: 0,
    },
  ],
};

apiInstance.postPulseRiskClassification(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

| Name                        | Type                               | Description | Notes |
| --------------------------- | ---------------------------------- | ----------- | ----- |
| **RiskClassificationScore** | **Array<RiskClassificationScore>** |             |

### Return type

**Array<RiskClassificationScore>**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |
| **400**     | Bad Request | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **postRuleInstances**

> RuleInstance postRuleInstances()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:.DefaultApiPostRuleInstancesRequest = {
  // RuleInstance (optional)
  RuleInstance: {
    id: "id_example",
    type: "TRANSACTION",
    ruleId: "ruleId_example",
    parameters: {},
    riskLevelParameters: {
      VERY_HIGH: {},
      HIGH: {},
      MEDIUM: {},
      LOW: {},
      VERY_LOW: {},
    },
    action: "FLAG",
    riskLevelActions: {
      VERY_HIGH: "FLAG",
      HIGH: "FLAG",
      MEDIUM: "FLAG",
      LOW: "FLAG",
      VERY_LOW: "FLAG",
    },
    status: "ACTIVE",
    createdAt: 3.14,
    updatedAt: 3.14,
    runCount: 3.14,
    hitCount: 3.14,
  },
};

apiInstance.postRuleInstances(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

| Name             | Type             | Description | Notes |
| ---------------- | ---------------- | ----------- | ----- |
| **RuleInstance** | **RuleInstance** |             |

### Return type

**RuleInstance**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **postRules**

> Rule postRules()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:.DefaultApiPostRulesRequest = {
  // Rule (optional)
  Rule: {
    id: "id_example",
    type: "TRANSACTION",
    name: "name_example",
    description: "description_example",
    defaultParameters: {},
    defaultRiskLevelParameters: {
      VERY_HIGH: {},
      HIGH: {},
      MEDIUM: {},
      LOW: {},
      VERY_LOW: {},
    },
    defaultAction: "FLAG",
    defaultRiskLevelActions: {
      VERY_HIGH: "FLAG",
      HIGH: "FLAG",
      MEDIUM: "FLAG",
      LOW: "FLAG",
      VERY_LOW: "FLAG",
    },
    ruleImplementationName: "ruleImplementationName_example",
    labels: [
      "labels_example",
    ],
    createdAt: 3.14,
    updatedAt: 3.14,
    tenantIds: [
      "tenantIds_example",
    ],
  },
};

apiInstance.postRules(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

| Name     | Type     | Description | Notes |
| -------- | -------- | ----------- | ----- |
| **Rule** | **Rule** |             |

### Return type

**Rule**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **postTenantsSettings**

> TenantSettings postTenantsSettings()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:.DefaultApiPostTenantsSettingsRequest = {
  // TenantSettings (optional)
  TenantSettings: {
    features: [
      "PULSE",
    ],
  },
};

apiInstance.postTenantsSettings(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

| Name               | Type               | Description | Notes |
| ------------------ | ------------------ | ----------- | ----- |
| **TenantSettings** | **TenantSettings** |             |

### Return type

**TenantSettings**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **postTransactionsComments**

> Comment postTransactionsComments()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:.DefaultApiPostTransactionsCommentsRequest = {
  // string
  transactionId: "transactionId_example",
  // Comment (optional)
  Comment: {
    id: "id_example",
    body: "body_example",
    userId: "userId_example",
    files: [
      {
        s3Key: "s3Key_example",
        bucket: "bucket_example",
        filename: "filename_example",
        size: 3.14,
        downloadLink: "downloadLink_example",
      },
    ],
    createdAt: 3.14,
    updatedAt: 3.14,
  },
};

apiInstance.postTransactionsComments(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

| Name              | Type         | Description | Notes                 |
| ----------------- | ------------ | ----------- | --------------------- |
| **Comment**       | **Comment**  |             |
| **transactionId** | [**string**] |             | defaults to undefined |

### Return type

**Comment**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **postTransactionsTransactionId**

> void postTransactionsTransactionId()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:.DefaultApiPostTransactionsTransactionIdRequest = {
  // string
  transactionId: "transactionId_example",
  // TransactionUpdateRequest (optional)
  TransactionUpdateRequest: {
    status: "FLAG",
    assignments: [
      {
        assigneeUserId: "assigneeUserId_example",
        assignedByUserId: "assignedByUserId_example",
        timestamp: 3.14,
      },
    ],
    reason: [
      "reason_example",
    ],
  },
};

apiInstance.postTransactionsTransactionId(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

| Name | Type | Description | Notes |
| --- | --- | --- | --- |
| **TransactionUpdateRequest** | **TransactionUpdateRequest** |  |
| **transactionId** | [**string**] |  | defaults to undefined |

### Return type

**void**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not defined

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **pulseManualRiskAssignment**

> ManualRiskAssignmentUserState pulseManualRiskAssignment()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:.DefaultApiPulseManualRiskAssignmentRequest = {
  // string | UserID of the user whose risk is being manually assigned
  userId: "userId_example",
  // ManualRiskAssignmentPayload (optional)
  ManualRiskAssignmentPayload: {
    riskLevel: "VERY_HIGH",
  },
};

apiInstance.pulseManualRiskAssignment(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

| Name | Type | Description | Notes |
| --- | --- | --- | --- |
| **ManualRiskAssignmentPayload** | **ManualRiskAssignmentPayload** |  |
| **userId** | [**string**] | UserID of the user whose risk is being manually assigned | defaults to undefined |

### Return type

**ManualRiskAssignmentUserState**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

### HTTP response details

| Status code | Description           | Response headers |
| ----------- | --------------------- | ---------------- |
| **200**     | OK                    | -                |
| **403**     | Not enough privileges | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **putRuleInstancesRuleInstanceId**

> RuleInstance | any putRuleInstancesRuleInstanceId()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:.DefaultApiPutRuleInstancesRuleInstanceIdRequest = {
  // string
  ruleInstanceId: "ruleInstanceId_example",
  // RuleInstance (optional)
  RuleInstance: {
    id: "id_example",
    type: "TRANSACTION",
    ruleId: "ruleId_example",
    parameters: {},
    riskLevelParameters: {
      VERY_HIGH: {},
      HIGH: {},
      MEDIUM: {},
      LOW: {},
      VERY_LOW: {},
    },
    action: "FLAG",
    riskLevelActions: {
      VERY_HIGH: "FLAG",
      HIGH: "FLAG",
      MEDIUM: "FLAG",
      LOW: "FLAG",
      VERY_LOW: "FLAG",
    },
    status: "ACTIVE",
    createdAt: 3.14,
    updatedAt: 3.14,
    runCount: 3.14,
    hitCount: 3.14,
  },
};

apiInstance.putRuleInstancesRuleInstanceId(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

| Name               | Type             | Description | Notes                 |
| ------------------ | ---------------- | ----------- | --------------------- |
| **RuleInstance**   | **RuleInstance** |             |
| **ruleInstanceId** | [**string**]     |             | defaults to undefined |

### Return type

**RuleInstance | any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |
| **201**     | Created     | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)

# **putRuleRuleId**

> void putRuleRuleId()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:.DefaultApiPutRuleRuleIdRequest = {
  // string
  ruleId: "ruleId_example",
  // Rule (optional)
  Rule: {
    id: "id_example",
    type: "TRANSACTION",
    name: "name_example",
    description: "description_example",
    defaultParameters: {},
    defaultRiskLevelParameters: {
      VERY_HIGH: {},
      HIGH: {},
      MEDIUM: {},
      LOW: {},
      VERY_LOW: {},
    },
    defaultAction: "FLAG",
    defaultRiskLevelActions: {
      VERY_HIGH: "FLAG",
      HIGH: "FLAG",
      MEDIUM: "FLAG",
      LOW: "FLAG",
      VERY_LOW: "FLAG",
    },
    ruleImplementationName: "ruleImplementationName_example",
    labels: [
      "labels_example",
    ],
    createdAt: 3.14,
    updatedAt: 3.14,
    tenantIds: [
      "tenantIds_example",
    ],
  },
};

apiInstance.putRuleRuleId(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

| Name       | Type         | Description | Notes                 |
| ---------- | ------------ | ----------- | --------------------- |
| **Rule**   | **Rule**     |             |
| **ruleId** | [**string**] |             | defaults to undefined |

### Return type

**void**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not defined

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](README.md#documentation-for-api-endpoints) [[Back to Model list]](README.md#documentation-for-models) [[Back to README]](README.md)
