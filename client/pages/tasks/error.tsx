import { ApiClientError } from '@nocobase/app-client';
import { useAuthentication } from '@nocobase/app-plugin-authentication/client';
import { useTranslation } from '@nocobase/i18n/client';
import { Alert, AlertDescription } from '#components/ui/alert';
import { Button } from '#components/ui/button';

import { taskErrorKey } from './error-key.js';

export function TaskError({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  const { t } = useTranslation();
  const { refresh } = useAuthentication();
  const status = error instanceof ApiClientError ? error.status : undefined;
  return (
    <Alert variant='destructive'>
      <AlertDescription>
        {t(taskErrorKey(error))}
        {status === 401 ? (
          <Button variant='outline' onClick={() => void refresh()}>
            {t('tasks.signIn')}
          </Button>
        ) : null}
        {retry && (!status || status >= 500) ? (
          <Button variant='outline' onClick={retry}>
            {t('tasks.retry')}
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
