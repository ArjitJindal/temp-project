import { ListItem } from '@/@types/openapi-public/ListItem'

export type FlagrightList = {
  id: string
  name: string
  description: string
  items: ListItem[]
}

export const FLAGRIGHT_LIST_LIBRARY: FlagrightList[] = []
