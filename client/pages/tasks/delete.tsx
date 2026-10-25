import { useEffect, useRef, useState } from 'react';
import {
  ApiClientError,
  useApiClient,
  useNavigationGuard,
  useToaster,
} from '@nocobase/app-client';
import { useTranslation } from '@nocobase/i18n/client';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '#components/ui/alert-dialog';
import { Button } from '#components/ui/button';
import { Spinner } from '#components/ui/spinner';
import { TaskError } from './error.js';
import type { Task } from './types.js';

export function DeleteTask({
  task,
  close,
  removed,
  missing,
}: {
  task: Task;
  close: () => void;
  removed: (id: string) => void;
  missing: (id: string) => void;
}) {
  const { t } = useTranslation();
  const api = useApiClient();
  const toaster = useToaster();
  const [latest, setLatest] = useState<Task>();
  const [error, setError] = useState<unknown>();
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const [revision, setRevision] = useState(0);
  useNavigationGuard(() => !pendingRef.current);
  const missingRef = useRef(missing);
  useEffect(() => {
    missingRef.current = missing;
  }, [missing]);
  const gone = error instanceof ApiClientError && error.status === 404;
  useEffect(() => {
    const controller = new AbortController();
    void api
      .request<{ data: Task }>({
        path: `tasks/${task.id}/delete`,
        signal: controller.signal,
      })
      .then((response) => {
        if (!controller.signal.aborted) setLatest(response.data);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause);
        if (cause instanceof ApiClientError && cause.status === 404) {
          toaster.show({
            type: 'info',
            title: t('tasks.missingToast', { title: task.title }),
          });
          missingRef.current(task.id);
        }
      });
    return () => controller.abort();
  }, [api, task.id, task.title, revision, toaster, t]);
  async function remove() {
    if (pendingRef.current || !latest || gone) return;
    pendingRef.current = true;
    setPending(true);
    setError(undefined);
    try {
      await api.request({
        path: `tasks/${task.id}`,
        method: 'DELETE',
        query: { expectedUpdatedAt: latest.updatedAt },
      });
      toaster.show({
        type: 'success',
        title: t('tasks.deleted', { title: latest.title }),
      });
      pendingRef.current = false;
      removed(task.id);
      close();
    } catch (cause) {
      setError(cause);
      if (cause instanceof ApiClientError && cause.status === 404) {
        toaster.show({
          type: 'info',
          title: t('tasks.missingToast', { title: task.title }),
        });
        missing(task.id);
      }
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !pendingRef.current) close();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('tasks.deleteTitle', { title: latest?.title ?? task.title })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t(gone ? 'tasks.missing' : 'tasks.deleteDescription', {
              title: task.title,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && !gone ? (
          <TaskError
            error={error}
            retry={
              !latest ||
              (error instanceof ApiClientError && error.status === 409)
                ? () => {
                    setError(undefined);
                    setLatest(undefined);
                    setRevision((value) => value + 1);
                  }
                : undefined
            }
          />
        ) : null}
        {!latest && !error ? (
          <div role='status' className='flex items-center gap-2'>
            <Spinner />
            {t('tasks.loading')}
          </div>
        ) : null}
        <AlertDialogFooter>
          <Button variant='outline' disabled={pending} onClick={close}>
            {t(gone ? 'tasks.close' : 'tasks.cancel')}
          </Button>
          {!gone ? (
            <Button
              variant='destructive'
              disabled={
                pending ||
                !latest ||
                (error instanceof ApiClientError &&
                  [401, 403, 409].includes(error.status))
              }
              onClick={() => void remove()}
            >
              {pending ? <Spinner /> : null}
              {t('tasks.delete')}
            </Button>
          ) : null}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
