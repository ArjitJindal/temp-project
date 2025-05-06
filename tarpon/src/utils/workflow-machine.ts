import { BaseCaseAlertWorkflow } from '@/@types/openapi-internal/BaseCaseAlertWorkflow'
import { CaseWorkflow } from '@/@types/openapi-internal/CaseWorkflow'
import { AlertWorkflow } from '@/@types/openapi-internal/AlertWorkflow'

export abstract class BaseWorkflowMachine {
  protected definition: BaseCaseAlertWorkflow

  constructor(definition: BaseCaseAlertWorkflow) {
    BaseWorkflowMachine.validate(definition)
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
  public getAllowedActions(_status: string, _role: string): string[] {
    return []
  }

  /**
   * Returns the default action for the current state
   * @param status Current status/state
   * @returns Default action or null if none defined
   */
  public getDefaultAction(_status: string): string | null {
    return null
  }

  /**
   * Returns the role that should be assigned for a given status
   * @param status Current status/state
   * @returns Role identifier
   */
  public getAssignmentRole(_status: string): string {
    return ''
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
