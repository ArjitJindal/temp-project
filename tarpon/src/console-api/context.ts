import { Context as GlobalContext } from '@/core/utils/context'

export type Context = {
  email: string
  userId: string
  role: string
  tenantId: string
  orgName: string
}

// fromGlobalContext pulls context values from our context object for the console only.
// Currently our code is littered with '.?' operators and 'as string' because we're never sure if we have a user
// in the context, since we use the same context for console + public APIs. On the console, all actions require
// authentication so we should never encounter this situation and stay typesafe.
export function fromGlobalContext(context: GlobalContext | undefined): Context {
  if (!context) {
    throw new Error('No context')
  }
  return {
    email: context.user?.email as string,
    userId: context.user?.id as string,
    role: context.user?.role as string,
    tenantId: context.tenantId as string,
    orgName: context.user?.orgName as string,
  }
}
