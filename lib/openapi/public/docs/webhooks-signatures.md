# Check the webhook signatures

Flagright signs the webhook events it sends to your endpoints by including a signature in each event’s X-Flagright-Signature header. This allows you to verify that the events were sent by Flagright, not by a third party. You can verify signatures either using our official libraries, or manually using your own solution.

Before you can verify signatures, you need to retrieve your endpoint’s secret from your Console's Webhooks settings. Select an endpoint that you want to obtain the secret for, then click the `Reveal` button to retrieve the secret.

Flagright generates a unique secret key for each endpoint. If you use multiple endpoints, you must obtain a secret for each one you want to verify signatures on.

## Verifying signatures

The X-Flagright-Signature header included in each signed event contains one or more signatures. Multiple signatures are separated by commas.

```
X-Flagright-Signature:
cebeda32affa62cdca3fa51cad7e77a0e56ff536d,ae63f272406069a9788598b792a944a07aba8
```

Flagright generates signatures using a hash-based message authentication code (HMAC) with SHA-256.

It is possible to have multiple signatures. This can happen when you roll an endpoint’s secret from the Flagright Console, and choose to keep the previous secret active for some period of time. During this time, your endpoint has multiple active secrets and Flagright generates one signature for each secret.

### Step 1: Determine the expected signature

Compute an HMAC with the SHA256 hash function. Use the endpoint’s signing secret as the key, and use the request body string as the message.

### Step 2: Compare the signatures

Compare the signature (or signatures) in the header to the expected signature.

### Sample code

```typescript
const hmac = createHmac('sha256', 'your-webhook-secret-key')
hmac.update(request.body)
const receivedSignatures = request.headers['X-Flagright-Signature'].split(',')
const calculatedSignature = hmac.digest('hex')

if (!receivedSignatures.includes(calculatedSignature)) {
  throw new Error('Invalid signature')
}
```
