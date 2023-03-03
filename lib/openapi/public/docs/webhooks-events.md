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
    "reason": "updated manually"
  }
}
```

## Types of Events

This section lists the currently available event types

| RESOURCE                                                                                                                                                                 | EVENTTYPE          | DATA                                                                                                 | DESCRIPTION                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ | ---------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| [Consumer User](https://docs.flagright.com/docs/flagright-api/55fc43dfa5972-user), [Business User](https://docs.flagright.com/docs/flagright-api/e6c30c54acc8d-business) | USER_STATE_UPDATED | [UserStateDetails](https://docs.flagright.com/docs/flagright-api/6449d29f75b92-user-state-details)   | Occurs whenever a user's state is updated |
| Case                                                                                                                                                                     | CASE_CLOSED        | [CaseClosedDetails](https://docs.flagright.com/docs/flagright-api/33c1ef3ffbde8-case-closed-details) | Occurs whenever a case is closed          |
