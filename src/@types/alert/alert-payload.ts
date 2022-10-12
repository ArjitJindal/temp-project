export interface NewCaseAlertPayload {
  kind: 'NEW_CASE'
  tenantId: string
  caseId: string
}

export interface NewTransactionAlertPayload {
  kind: 'NEW_TRANSACTION'
  tenantId: string
  transactionId?: string
  userId?: string
}

export type AlertPayload = NewCaseAlertPayload | NewTransactionAlertPayload
