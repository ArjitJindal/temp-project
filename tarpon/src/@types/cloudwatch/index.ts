import { Dimension } from '@aws-sdk/client-cloudwatch'

export type Metric = {
  namespace: string
  name: string
  kind: 'GAUGE' | 'CULMULATIVE'
}

export type MetricsData = {
  metric: Metric
  value: number
  dimensions?: Array<Dimension>
  timestamp?: number
}
