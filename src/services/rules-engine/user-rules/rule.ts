import { MongoClient } from 'mongodb'
import { Rule } from '../rule'
import { Vars } from '../utils/format-description'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'

export interface UserVars<P> extends Vars {
  user: User | Business
  parameters: P
}
export abstract class UserRule<P, T extends object = object> extends Rule {
  tenantId: string
  user: User | Business
  parameters: P
  filters: T
  mongoDb: MongoClient

  constructor(
    tenantId: string,
    data: {
      user: User | Business
    },
    params: {
      parameters: P
      filters: T
    },
    mongoDb: MongoClient
  ) {
    super()
    this.tenantId = tenantId
    this.user = data.user
    this.parameters = params.parameters
    this.filters = params.filters || {}
    this.mongoDb = mongoDb
  }

  public getUserVars(): UserVars<P> {
    return {
      user: this.user,
      parameters: this.parameters,
    }
  }
}
