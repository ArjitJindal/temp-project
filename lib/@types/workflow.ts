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

export interface BaseApprovalWorkflow {
  id: string
  workflowType:
    | 'risk-levels-approval'
    | 'risk-factors-approval'
    | 'user-update-approval'
    | 'rule-approval'
  version: number
  name: string
  description?: string
  author: string
  enabled: boolean
  approvalChain: string[]
}

export interface RiskLevelApprovalWorkflow {
  id: string
  workflowType: 'risk-levels-approval'
  version: number
  name: string
  description?: string
  author: string
  enabled: boolean
  approvalChain: string[]
}

export interface RiskFactorsApprovalWorkflow extends BaseApprovalWorkflow {
  workflowType: 'risk-factors-approval'
}

export interface RuleApprovalWorkflow extends BaseApprovalWorkflow {
  workflowType: 'rule-approval'
}

export interface UserUpdateApprovalWorkflow extends BaseApprovalWorkflow {
  workflowType: 'user-update-approval'
}
