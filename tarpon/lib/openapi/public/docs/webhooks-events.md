# Webhook events

## Webhook event object

| PROPERTY         | DETAILS                                                                   |
| ---------------- | ------------------------------------------------------------------------- |
| id               | Unique identifier for the event                                           |
| type             | Event type (e.g., `USER_STATE_UPDATED`).                                  |
| data             | Object containing data associated with the event.                         |
| createdTimestamp | Time at which the event was created. Measured in ms since the Unix epoch. |

### Sample event object

```json
{
  "id": "2fa554d3-1ffa-4361-9af6-5479c2d4847f",
  "type": "USER_STATE_UPDATED",
  "createdTimestamp": 1661522222301,
  "data": {
    "userId": "U-1",
    "state": "BLOCKED",
    "reason": "updated manually",
    "triggeredBy": "MANUAL"
  }
}
```

## Types of Events

This section lists the currently available event types

| RESOURCE                                                                                                                                                                 | EVENTTYPE                  | DATA                                                                                                               | DESCRIPTION                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| [Consumer User](https://docs.flagright.com/docs/flagright-api/55fc43dfa5972-user), [Business User](https://docs.flagright.com/docs/flagright-api/e6c30c54acc8d-business) | USER_STATE_UPDATED         | [UserStateDetails](https://docs.flagright.com/docs/flagright-api/6449d29f75b92-user-state-details)                 | Occurs whenever a user's state is updated                                     |
| Case                                                                                                                                                                     | CASE_CLOSED                | [CaseClosedDetails](https://docs.flagright.com/docs/flagright-api/33c1ef3ffbde8-case-closed-details)               | Occurs whenever a case is closed                                              |
| Alert                                                                                                                                                                    | ALERT_CLOSED               | [AlertClosedDetails](https://docs.flagright.com/docs/flagright-api/5a207dd38b88e-alert-closed-details)             | Occurs whenever a alert is closed                                             |
| Transaction Status Updated                                                                                                                                               | TRANSACTION_STATUS_UPDATED | [TransactionStatusDetails](https://docs.flagright.com/docs/flagright-api/05e432d383e7b-transaction-status-details) | Occurs whenever a transaction status is updated manually on Flagright console |
| KYC Status Updated                                                                                                                                                       | KYC_STATUS_UPDATED         | [KycStatusDetails](https://docs.flagright.com/docs/flagright-api/0b5b0b0b5b0b-kyc-status-details)                  | Occurs whenever a kyc status is updated                                       |
