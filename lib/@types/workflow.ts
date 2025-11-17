export interface BaseCaseAlertWorkflow {
  id: string
  workflowType: 'case' | 'alert'
  version: number
  name: string
  description?: string
  author: string
  enabled: boolean
  statuses: string[]
  statusAssignments: { [key: string]: string }
  transitions: any
  roleTransitions: any
}

export interface CaseWorkflow extends BaseCaseAlertWorkflow {
  workflowType: 'case'
  autoClose: boolean
}

export interface AlertWorkflow extends BaseCaseAlertWorkflow {
  workflowType: 'alert'
}

// Unified approval workflow type for all approval workflows
// All approval workflows use the 'change-approval' workflowType
export interface ApprovalWorkflow {
  id: string
  workflowType: 'change-approval'
  version: number
  name: string
  description?: string
  author: string
  enabled: boolean
  approvalChain: string[]
}
