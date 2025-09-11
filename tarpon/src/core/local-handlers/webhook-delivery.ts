import { WebhookDeliveryTask } from '@/@types/webhook'
import { handleWebhookDeliveryTask } from '@/lambdas/webhook-deliverer/utils'

export const handleLocalWebhookDelivery = async (
  tenantId: string,
  webhookDeliveryTask: WebhookDeliveryTask
) => {
  await handleWebhookDeliveryTask(webhookDeliveryTask)
}
