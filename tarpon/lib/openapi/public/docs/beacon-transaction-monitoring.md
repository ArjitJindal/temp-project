---
tags: [Anti money laundering, Fraud prevention, Real-time, KYT]
internal: true
---

# Beacon: Real-time AML & Fraud Transaction Monitoring

## Overview

Flagright Beacon is a real-time transaction monitoring rules engine. It’s designed to capture malicious and suspicious activity in real-time based on customer risk appetite. It is a fully automated system, guided by human input. You are in charge of all the rules and thresholds, and the rest is taken care of.

## Terminology

- Tenant: Flagright's customer (From here on the term "Tenant" is adopted throughout this document)
- Account: A user of a tenant. E.g. compliance analyst
- User: A consumer or business user of tenant
- Flagright Console: Flagright's easy-to-use, no-code back office portal enabling compliance teams to do more with less.
- KYC: [Know your customer](https://en.wikipedia.org/wiki/Know_your_customer)
- SME: Small-medium enterprise and/or Business

# Components

It consists of the following components:

- Real-time API
- Flagright Console
  - Rules library
  - Created rules
  - Lists
  - Case management

## Real-time API

Flagright API is designed with simplicity and extensibility in mind. It delivers extreme performance in real-timeness and reliability even for complex, data-intensive rules. Take a look at the API documentation for more on real-time API.

## Flagright Console

### Rules Library

The Rules library offers hundreds of pre-configured rules and can be activated instantly in a single click. It is designed to enable compliance teams collaborate with compliance teams at other startups around the world anonymously. By enabling the network effect, rules library gives access to the latest prevention techniques to all Flagright customers in real-time. Flagright anonymizes the templates end to end to eliminate the security and privacy risks. Thanks to this network effect, the number and the coverage of rule variants in the rules library increase exponentially while eliminating the time to configure rules over time to miliseconds.

### Created Rules

Created rules section is only visible to you and it displays the rules you choose to use. The thresholds and rules you are using aren’t visible to anyone else except you and your company. Similarly, this section enables you to activate, deactivate, or edit the rules within seconds. The macroview in this section also provides a high-level performance report on the number of suspensions or hits caused by each rule to help you manage your risk appetite at a single view.

### Request a New Rule

Request a new rule section displays a form that lets accounts request a new rule if it doesn’t exist in the rules library. Standard SLA for new rules are 48 hours. Accounts are able to define request priority to indicate urgency.

# Features

- Extreme performance: p95 less than 2 seconds.
- Rule management
  - Anonymized, secure networking on rules library
  - Single-click activation/deactivation
  - Easy configuration of rules (less than 10 seconds)
    - Granular threshold setup forked at risk level (optional, see DRSE documentation)
  - Track performance metrics
    - Insights on performance
    - System recommendations to optimize false positives
    - System recommendations based on historical data
    - System recommendations based on anomaly detection algorithms (optional, see MLAD documentation)
  - Editable tables and views
  - Readability
    - Pagination
    - Horizontal scrolling
  - Flexible action definitions
    - Monitor
    - Flag
    - Reject
    - Whitelist
    - Blacklist
    - Custom actions
- Case Management

  - Assign a case

  <!---->

  - Unsuspend a case
  - Suspend a transaction manually
  - Suspend a user manually
  - Transaction history at user level
  - Risk scores (See DRSE documentation) (optional)

- Advanced reporting
  - Filter
  - Download
  - Visualizations
  - Customization
- Lists
  - Create whitelists & blacklists
  - Manage lists
  - Build real-time rules back on lists
