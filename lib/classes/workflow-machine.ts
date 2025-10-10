import {
  BaseCaseAlertWorkflow,
  CaseWorkflow,
  AlertWorkflow,
  BaseApprovalWorkflow,
  RiskLevelApprovalWorkflow,
  RiskFactorsApprovalWorkflow,
  UserUpdateApprovalWorkflow,
} from '../@types/workflow'

export abstract class BaseWorkflowMachine {
  protected definition: BaseCaseAlertWorkflow

  constructor(definition: BaseCaseAlertWorkflow) {
    BaseWorkflowMachine.validate(definition)
    // TODO: consider extending the definition class instead of wrapping it in this class
    this.definition = definition
  }

  /**
   * Validates the workflow definition when it's created or updated
   * @param definition The workflow definition to validate
   * @throws Error if the definition is invalid
   */
  public static validate(definition: BaseCaseAlertWorkflow): void {
    // ensure statuses are defined and OPEN and CLOSED are included
    if (!definition.statuses || Object.keys(definition.statuses).length === 0) {
      throw new Error('Workflow must have at least OPEN and CLOSED states')
    }
    if (
      !definition.statuses.includes('OPEN') ||
      !definition.statuses.includes('CLOSED')
    ) {
      throw new Error('Workflow must have OPEN and CLOSED states')
    }
    // ensure no duplicate statuses
    if (definition.statuses.length !== new Set(definition.statuses).size) {
      throw new Error('Statuses must be unique')
    }
    // ensure statusAssignments are defined and each and every status has an assignment (except CLOSED)
    // defined means a valid role is present when assignment should be performed else null is present
    // open should necessarily have a role assigned and closed should not have a role assigned
    // TODO: check for open not null and closed null
    // TODO: ensure all the referenced roles are defined in RBAC
    const assignmentStatuses = Object.keys(definition.statusAssignments)
    if (
      assignmentStatuses.includes('CLOSED') ||
      assignmentStatuses.length !== definition.statuses.length - 1
    ) {
      throw new Error(
        'Status assignments must be defined for each status, except CLOSED'
      )
    }
    // TODO: implement all the checks
  }

  /**
   * Returns the list of allowed actions for a given status and role
   * @param status Current status/state
   * @param role User role
   * @returns Array of allowed actions
   */
  public getAllowedActions(status: string, role: string | null): string[] {
    const transitions = this.definition.transitions[status]
    const allowedActions = role
      ? (transitions?.[role] ?? []).map((transition) => transition.action)
      : []
    const defaultActions =
      transitions?.['_DEFAULT']?.map((transition) => transition.action) ?? []
    return [...new Set([...allowedActions, ...defaultActions])]
  }

  /**
   * Returns the default action for the current state
   * @param status Current status/state
   * @returns Default action or null if none defined
   */
  public getDefaultAction(_status: string): string | null {
    const transitions = this.definition.transitions[_status]
    return transitions['_DEFAULT']?.[0]?.action ?? null
  }

  public getNextStatus(_status: string, _action: string): string {
    const transitions = this.definition.transitions[_status]
    const nextStatus = transitions[_action]?.find(
      (transition) => transition.action === _action
    )?.to
    const defaultStatus = transitions['_DEFAULT']?.find(
      (transition) => transition.action === _action
    )?.to
    return nextStatus ?? defaultStatus
  }

  /**
   * Returns the role that should be assigned for a given status
   * @param status Current status/state
   * @returns Role identifier
   */
  public getAssignmentRole(status: string): string | null {
    return this.definition.statusAssignments[status]
  }

  /**
   * Returns the workflow definition
   */
  public getDefinition(): BaseCaseAlertWorkflow {
    return this.definition
  }
}

export class CaseWorkflowMachine extends BaseWorkflowMachine {
  constructor(definition: CaseWorkflow) {
    super(definition)
  }
}

export class AlertWorkflowMachine extends BaseWorkflowMachine {
  constructor(definition: AlertWorkflow) {
    super(definition)
  }
}

export class BaseApprovalWorkflowMachine {
  protected definition: BaseApprovalWorkflow

  constructor(definition: BaseApprovalWorkflow) {
    BaseApprovalWorkflowMachine.validate(definition)
    this.definition = definition
  }

  public static validate(definition: BaseApprovalWorkflow): void {
    // ensure approvalChain is defined and has at least one role
    if (!definition.approvalChain || definition.approvalChain.length === 0) {
      throw new Error('Approval workflow must have at least one role')
    }
    // ensure approvalChain has at least one role
    if (definition.approvalChain.length === 0) {
      throw new Error('Approval workflow must have at least one role')
    }
    // ensure approvalChain does not have duplicate roles
    if (
      new Set(definition.approvalChain).size !== definition.approvalChain.length
    ) {
      throw new Error('Approval workflow must have unique roles')
    }
    // ensure approvalChain does not exceed 3 steps
    if (definition.approvalChain.length > 3) {
      throw new Error('Approval workflow must have at most 3 steps')
    }
  }

  public getDefinition(): BaseApprovalWorkflow {
    return this.definition
  }

  public getApprovalStep(currentStep: number): {
    role: string
    isLastStep: boolean
  } {
    const approvalChain = this.definition.approvalChain
    const steps = approvalChain.length

    if (currentStep >= steps) {
      throw new Error('Approval workflow is already at the last step') // already approved
    }

    const isLastStep = currentStep === steps - 1
    return { role: approvalChain[currentStep], isLastStep }
  }
}
export class RiskLevelApprovalWorkflowMachine extends BaseApprovalWorkflowMachine {
  constructor(definition: RiskLevelApprovalWorkflow) {
    super(definition)
  }

  public getDefinition(): RiskLevelApprovalWorkflow {
    return this.definition as RiskLevelApprovalWorkflow
  }
}

export class RiskFactorsApprovalWorkflowMachine extends BaseApprovalWorkflowMachine {
  constructor(definition: RiskFactorsApprovalWorkflow) {
    super(definition)
  }

  public getDefinition(): RiskFactorsApprovalWorkflow {
    return this.definition as RiskFactorsApprovalWorkflow
  }
}

export class UserUpdateApprovalWorkflowMachine extends BaseApprovalWorkflowMachine {
  constructor(definition: UserUpdateApprovalWorkflow) {
    super(definition)
  }

  public getDefinition(): UserUpdateApprovalWorkflow {
    return this.definition as UserUpdateApprovalWorkflow
  }
}
