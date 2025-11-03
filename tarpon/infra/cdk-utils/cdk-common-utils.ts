import { Fn } from 'aws-cdk-lib'

// sample queue url https://sqs.ap-southeast-1.amazonaws.com/293986822825/SecondaryTarponQueue.fifo
// <protocol>://sqs<region>.amazonaws.com/<account>/<queueName>
export const getSQSQueuePrefix = (queueUrl: string) => {
  const domain = Fn.select(2, Fn.split('/', queueUrl))
  const account = Fn.select(3, Fn.split('/', queueUrl))

  return `https://${domain}/${account}`
}

export const getSQSQueueName = (queueUrl: string = '') => {
  return Fn.select(4, Fn.split('/', queueUrl))
}
