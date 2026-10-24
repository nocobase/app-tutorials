import { ApiClientError } from '@nocobase/app-client';

export function taskErrorKey(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.status === 401) return 'tasks.sessionExpired';
    if (error.status === 403) return 'tasks.forbidden';
    if (error.status === 404) return 'tasks.notFound';
    if (error.status === 400) return 'tasks.invalidInput';
  }
  return 'tasks.requestFailed';
}
