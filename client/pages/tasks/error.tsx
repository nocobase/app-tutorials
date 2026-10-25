import { ApiClientError } from '@nocobase/app-client';
import { useTranslation } from '@nocobase/i18n/client';
import { SessionExpiredAlert } from '#components/session-expired-alert';
import { Alert, AlertDescription } from '#components/ui/alert';
import { Button } from '#components/ui/button';

export function TaskError({
  error,
  retry,
  message,
}: {
  error: unknown;
  retry?: () => void;
  message?: string;
}) {
  const { t } = useTranslation();
  const status = error instanceof ApiClientError ? error.status : undefined;
  if (status === 401) return <SessionExpiredAlert />;
  return (
    <Alert variant='destructive'>
      <AlertDescription>
        {message ??
          t(
            status === 403
              ? 'tasks.denied'
              : status === 409
                ? 'tasks.conflict'
                : 'tasks.loadFailed',
          )}
        {retry && (!status || status >= 500 || status === 409) ? (
          <Button type='button' variant='outline' onClick={retry}>
            {t(status === 409 ? 'tasks.reload' : 'tasks.retry')}
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
