import type { User } from './schema';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { UserServices } from './userService';

const USER_QUERY_KEY = 'fetchOneUser' as const;
const USER_QUERY_KEYS = [USER_QUERY_KEY] as const;

export const useFetchOneUser = (currentId: User['id']) =>
  useQuery({
    queryKey: [USER_QUERY_KEY, currentId],
    queryFn: () => UserServices.fetchOne(currentId),
    enabled: currentId >= 0,
  });

export const useInvalidateUser = () => {
  const client = useQueryClient();

  return {
    invalidateUser: () =>
      client.invalidateQueries({
        queryKey: USER_QUERY_KEYS,
      }),
  };
};
