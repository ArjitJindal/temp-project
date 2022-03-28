# .DefaultApi

All URIs are relative to _http://localhost:3000_

| Method | HTTP request | Description |
| --- | --- | --- |
| [**deleteRuleInstancesRuleInstanceId**](DefaultApi.md#deleteRuleInstancesRuleInstanceId) | **DELETE** /rule_instances/{ruleInstanceId} | Rule Instance - Delete |
| [**deleteTransactionsTransactionIdCommentsCommentId**](DefaultApi.md#deleteTransactionsTransactionIdCommentsCommentId) | **DELETE** /transactions/{transactionId}/comments/{commentId} |
| [**getBusinessUsersList**](DefaultApi.md#getBusinessUsersList) | **GET** /business/users | Business Users - List |
| [**getConsumerUsersList**](DefaultApi.md#getConsumerUsersList) | **GET** /consumer/users | Consumer Users - List |
| [**getDashboardStatsTransactions**](DefaultApi.md#getDashboardStatsTransactions) | **GET** /dashboard_stats/transactions | DashboardStats - Transactions |
| [**getTransactionsList**](DefaultApi.md#getTransactionsList) | **GET** /transactions | Transaction - List |
| [**getTransactionsPerUserList**](DefaultApi.md#getTransactionsPerUserList) | **GET** /user/transactions | Transaction Per User - List |
| [**postApikey**](DefaultApi.md#postApikey) | **POST** /apikey | Tarpon API Key - Create |
| [**postGetPresignedUrl**](DefaultApi.md#postGetPresignedUrl) | **POST** /files/getPresignedUrl | Files - Get Presigned URL |
| [**postImport**](DefaultApi.md#postImport) | **POST** /import | Import - Start to Import |
| [**postLists**](DefaultApi.md#postLists) | **POST** /lists | List Import |
| [**postRuleInstances**](DefaultApi.md#postRuleInstances) | **POST** /rule_instances | Rule Instance - Create |
| [**postTransactionsComments**](DefaultApi.md#postTransactionsComments) | **POST** /transactions/{transactionId}/comments | Create a Transaction Comment |
| [**putRuleInstancesRuleInstanceId**](DefaultApi.md#putRuleInstancesRuleInstanceId) | **PUT** /rule_instances/{ruleInstanceId} | Rule Instance - Update |

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
};

apiInstance.getBusinessUsersList(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

| Name                | Type         | Description | Notes                 |
| ------------------- | ------------ | ----------- | --------------------- |
| **limit**           | [**number**] |             | defaults to undefined |
| **skip**            | [**number**] |             | defaults to undefined |
| **beforeTimestamp** | [**number**] |             | defaults to undefined |

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
};

apiInstance.getConsumerUsersList(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

| Name                | Type         | Description | Notes                 |
| ------------------- | ------------ | ----------- | --------------------- |
| **limit**           | [**number**] |             | defaults to undefined |
| **skip**            | [**number**] |             | defaults to undefined |
| **beforeTimestamp** | [**number**] |             | defaults to undefined |

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

# **getDashboardStatsTransactions**

> Set<any> getDashboardStatsTransactions()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:.DefaultApiGetDashboardStatsTransactionsRequest = {
  // number
  category: 3.14,
  // number
  timeframe: 3.14,
  // string (optional)
  fromTimestamp: "fromTimestamp_example",
  // any (optional)
  body: {},
};

apiInstance.getDashboardStatsTransactions(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

| Name              | Type         | Description | Notes                            |
| ----------------- | ------------ | ----------- | -------------------------------- |
| **body**          | **any**      |             |
| **category**      | [**number**] |             | defaults to undefined            |
| **timeframe**     | [**number**] |             | defaults to undefined            |
| **fromTimestamp** | [**string**] |             | (optional) defaults to undefined |

### Return type

**Set<any>**

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
};

apiInstance.getTransactionsList(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

| Name                | Type         | Description | Notes                 |
| ------------------- | ------------ | ----------- | --------------------- |
| **limit**           | [**number**] |             | defaults to undefined |
| **skip**            | [**number**] |             | defaults to undefined |
| **beforeTimestamp** | [**number**] |             | defaults to undefined |

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

# **getTransactionsPerUserList**

> TransactionsListResponse getTransactionsPerUserList()

### Example

```typescript
import {  } from '';
import * as fs from 'fs';

const configuration = .createConfiguration();
const apiInstance = new .DefaultApi(configuration);

let body:.DefaultApiGetTransactionsPerUserListRequest = {
  // number
  limit: 3.14,
  // number
  skip: 3.14,
  // number
  beforeTimestamp: 3.14,
  // string
  userId: "userId_example",
};

apiInstance.getTransactionsPerUserList(body).then((data:any) => {
  console.log('API called successfully. Returned data: ' + data);
}).catch((error:any) => console.error(error));
```

### Parameters

| Name                | Type         | Description | Notes                 |
| ------------------- | ------------ | ----------- | --------------------- |
| **limit**           | [**number**] |             | defaults to undefined |
| **skip**            | [**number**] |             | defaults to undefined |
| **beforeTimestamp** | [**number**] |             | defaults to undefined |
| **userId**          | [**string**] |             | defaults to undefined |

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
    ruleId: "ruleId_example",
    parameters: {},
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
    ruleId: "ruleId_example",
    parameters: {},
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
