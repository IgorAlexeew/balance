import { useQuery } from '@tanstack/react-query'
import { familyApi } from '../api/family-api'

export const familyKeys = {
  all: ['family'] as const,
}

export function useFamilyGroups() {
  return useQuery({ queryKey: familyKeys.all, queryFn: familyApi.list })
}
