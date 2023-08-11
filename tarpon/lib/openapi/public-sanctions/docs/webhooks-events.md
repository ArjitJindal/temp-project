# Webhook events

Flagright uses webhooks to notify your application when an event happens in your account. Webhooks are particularly useful for asynchronous events. A wehbook event is fired when a monitored search has been detected as having updated search results available, and/or the suspended state of the monitored search changes.

A webhook enables Flagright to push real-time notifications to your app. Flagright uses HTTPS to send these notifications to your app as a JSON payload. You can then use these notifications to execute actions in your backend systems.

## Steps to receive webhooks

- Identify the events you want to monitor and the event payloads to parse.
- Create a webhook endpoint as an HTTP endpoint (URL) on your server.
- Handle requests from Flagright by parsing each event object and returning 2xx response status codes.
- Deploy your webhook endpoint so it’s a publicly accessible HTTPS URL.
- Register your publicly accessible HTTPS URL in the Flagright console and store the secret signing key (for verifying the payload) in a secure place.

Source IP Addresses: [List](https://docs.flagright.com/docs/flagright-api/0b0bb2cf007e5-webhooks-overview#source-ip-addresses)

## Webhook event object

The data payload is as follows:

| PROPERTY     | DETAILS                                                                    |
| ------------ | -------------------------------------------------------------------------- |
| search_id    | The numeric ID of the search                                               |
| type         | Event type (e.g., `MONITORED_SEARCH_UPDATED`).                             |
| updated      | An array of the Entity IDs in the search result which have been modified.  |
| new          | An array of the Entity IDs which have been added to the search result.     |
| removed      | An array of the Entity IDs which have been removed from the search result. |
| is_suspended | Indicates whether this monitored search has been suspended or not.         |

### Sample event object

```json
{
  "event": "MONITORED_SEARCH_UPDATE",
  "search_id": 10117833,
  "updated": ["8NMXF7QX4QV8LFD", "X4525MEAZKKPX0T", "73HBD537LCX5JT6"],
  "new": ["Q3OX4KS0KEMCVDH", "UCC60H79WVU94Z0"],
  "removed": ["9D1ETD0ADTT4HDH", "I38XC0R6Y1EQ083"],
  "is_suspended": true
}
```
