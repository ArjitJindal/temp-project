import { ChecklistStatus } from '../openapi-internal/ChecklistStatus'
import { DefaultApiGetAlertListRequest } from '../openapi-internal/RequestParameters'
import { OptionalPagination } from '../pagination'

export interface AlertParams
  extends OptionalPagination<
    Omit<DefaultApiGetAlertListRequest, 'filterQaStatus'>
  > {
  filterQaStatus?: ChecklistStatus | "NOT_QA'd"
  excludeAlertIds?: string[]
}
