# Webhooks overview

## Use incoming webhooks to get real-time updates

Flagright uses webhooks to notify your application when an event happens in your account. Webhooks are particularly useful for asynchronous events including but not limited to:

- Transaction is investigated and approved by your compliance team
- User's state has changes
- New case is created
- Rule action has been updated

### How Flagright uses webhooks

A webhook enables Flagright to push real-time notifications to your app. Flagright uses HTTPS to send these notifications to your app as a JSON payload. You can then use these notifications to execute actions in your backend systems.

### Steps to receive webhooks

You can start receiving event notifications in your app using the steps in this section:

1. Identify the events you want to monitor and the event payloads to parse.
2. Create a webhook endpoint as an HTTP endpoint (URL) on your server.
3. Handle requests from Flagright by parsing each event object and returning 2xx response status codes.
4. Deploy your webhook endpoint so it’s a publicly accessible HTTPS URL.
5. Register your publicly accessible HTTPS URL in the Flagright console and store the secret signing key (for verifying the payload) in a secure place.

### How to create a webhook endpoint

Creating a webhook endpoint is no different from creating any other page on your website. It’s an HTTP or HTTPS endpoint on your server with a URL. If you’re still developing your endpoint on your local machine, it can be HTTP. After it’s publicly accessible, it must be HTTPS. You can use one endpoint to handle several different event types at once or set up individual endpoints for specific events.

### Step 1: Identify the events to subscribe

Check [Webhooks Events](https://docs.flagright.com/docs/flagright-api/295118b92ce19-webhook-events) for the complete list of events.

### Step 2: Create a webhook endpoint

Set up an HTTP endpoint that can accept unauthenticated webhook requests with a POST method.

### Step 3: Handle requests from Flagright

Your endpoint must be configured to read [event objects](https://docs.flagright.com/docs/flagright-api/295118b92ce19-webhook-events) for the type of events you want to receive. Flagright sends events to your webhook endpoint as part of a POST request with a JSON payload.

#### Check event objects

Each event is structured as an event object with a `type`, `id`, `data` and `createdTimestamp`. Your endpoint must check the event type and parse the payload of each event.

```json
{
  "id": "2fa554d3-1ffa-4361-9af6-5479c2d4847f",
  "type": "USER_STATE_UPDATED",
  "createdTimestamp": 1661522222301,
  "data": {...}
}
```

#### Return a 2xx response

Your endpoint must quickly return a successful status code (2xx) prior to any complex logic that could cause a timeout (10 seconds).

#### Built-in retries

Flagright webhooks have built-in retry methods for 3xx, 4xx, or 5xx response status codes. We will retry for up to 3 days until we either receive a 2XX or we mark it as failed. If Flagright doesn’t quickly receive a 2xx response status code for an event, we mark the event as failed and stop trying to send it to your endpoint.

### Step 4: Secure your webhooks (recommended)

Use [webhook signatures](https://docs.flagright.com/docs/flagright-api/5f9800707ca91-check-the-webhook-signatures) to verify that Flagright generated a webhook request and that it didn’t come from a server acting like Flagright.

### Sample code

Example in Python Flask:

```python
@app.route('/flagright_webhooks', methods=['POST'])
def webhook():
    event = request.json
    if event.type == 'USER_STATE_UPDATED':
        latest_user_state = event.data
        # Then define and call a method to handle latest_user_state.
    else:
        print(f'Unhandled event type ${event.type}')

    # Return a response to acknowledge receipt of the event
    return 'OK'
```

## Source IP Addresses

Webhooks will be delivered from the following IP addresses:

| Region      | IP addresses   |
| ----------- | -------------- |
| US          | 35.155.123.185 |
| US          | 44.237.56.178  |
| US          | 52.11.98.137   |
| EU          | 3.67.28.78     |
| EU          | 3.76.95.10     |
| EU          | 35.156.181.187 |
| EU          | 18.132.155.115 |
| EU          | 18.134.212.219 |
| EU          | 35.177.249.136 |
| Asia        | 18.139.42.183  |
| Asia        | 3.1.188.28     |
| Asia        | 3.1.234.194    |
| Asia        | 13.234.102.242 |
| Asia        | 3.109.243.84   |
| Asia        | 43.205.70.199  |
| Australia   | 18.139.42.183  |
| Australia   | 3.104.94.7     |
| Australia   | 54.79.45.195   |
| Middle East | 3.28.175.208   |
| Middle East | 3.28.224.220   |
| Middle East | 51.112.26.119  |

For improved security, you can lock down your webhook endpoints to only accept the requests coming from the IP addresses specified above.
