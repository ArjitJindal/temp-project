import { MerchantMonitoringSummary } from '@/@types/openapi-internal/MerchantMonitoringSummary'
import { PropertiesProperties } from '@/@types/openapi-internal/PropertiesProperties'

export const summaryToProperties = (
  summary: MerchantMonitoringSummary
): PropertiesProperties[] => {
  return [
    {
      key: 'Summary',
      value: summary.summary,
    },
    {
      key: 'Revenue',
      value: summary.revenue,
    },
    {
      key: 'Company name',
      value: summary.companyName,
    },
    {
      key: 'Products',
      value: summary.products?.join(', '),
    },
    {
      key: 'Industry',
      value: summary.industry,
    },
    {
      key: 'Location',
      value: summary.location,
    },
    {
      key: 'Employees',
      value: summary.employees,
    },
  ]
}
