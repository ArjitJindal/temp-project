---
tags: [Fraud prevention, bad actors]
internal: true
---

# Sonar: Known Bad Actor Database

Flagright Sonar is a known bad actor database enabling fintech startups collaborate anonymously against chargebacks, fraud, and financial crime. It is a free (because you provide your data) with unlimited API calls and is built on trust that everyone in the community will contribute to it with accurate data of bad actors in their systems.

Flagright reserves the right to monitor, assess, investigate the usage data and might terminate access if we conclude that this trust is being abused.

## How it works

There are two APIs:

1. Contribute API
2. Query API

### Contribute API

This API enables you to report known bad actors from your environment. It lets various specify parameters including routing and bank account numbers, email address, zip code, reason for reporting etc. It returns a success or failure message. See the API specifications for more.

### Query API

This API enables your to query your transaction payload against Sonar Database. It lets you specify various parameters including routing and bank account numbers, email address, zip code, reason for reporting etc. It returns whether there is a match for each parameter you queried, the number of reports by others in the community, and the reason for reporting for each. See the API specifications for more.

### Reasons

You can currently specify the following reasons.

Reference: [Directory of ACH Return Codes](https://paysimple.com/help/Zions/ps30/a2-ach-return-codes/Directory_of_ACH_Return_Codes.htm#XREF_b3)

We do not map to all ACH codes, but only the common ones whenever it might be relevant for fraud.

`insufficient_funds`: The user took advantage of ACH processing time and moved the funds out of your services, leaving your position in the open (before the ACH transaction was complete, returning an NSF code). (R01, R09)

`authorization_revoked`: The user reported to the bank that the transaction was not authorized and revoked the transaction authorization prior to the transaction date. (R05, R07, R10)

`account_unqualified`: Account doesn’t exist, is closed, or a similar issue with the account setup (R02, R03, R04, R13, R12, R20)
unauthorized_pull: The user initiated an unauthorized pull from a counter-party

`scam`: The user is using your services to scam others
id_theft: The user used a stolen identity to create an account

`fake_id`: The user used a stolen identity to create an account

`account_takeover`: The transaction was submitted from a compromised account by a malicious party
suspicious_activity: An umbrella term for suspicious activity if you cannot classify it otherwise with a more specific reason
other: See the comments field - Comment is mandatory if “other” reason is selected
