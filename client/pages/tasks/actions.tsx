import { useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import {
  ApiClientError,
  useApiClient,
  useNavigationGuard,
  useToaster,
} from '@nocobase/app-client';
import { useAuthentication } from '@nocobase/app-plugin-authentication/client';
import { useTranslation } from '@nocobase/i18n/client';
import {
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
  CircleIcon,
  CircleDotIcon,
  CircleCheckIcon,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#components/ui/dropdown-menu';
import { Button } from '#components/ui/button';
import { Spinner } from '#components/ui/spinner';
import { DeleteTask } from './delete.js';
import {
  TASK_STATUSES,
  type Task,
  type TasksContext,
  type TaskStatus,
} from './types.js';

export function TaskActions({
  task,
  context,
  detail = false,
  onBusyChange,
  onRemoved,
}: {
  task: Task;
  context: TasksContext;
  detail?: boolean;
  onRemoved?: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { t } = useTranslation();
  const location = useLocation();
  const api = useApiClient();
  const toaster = useToaster();
  const { refresh } = useAuthentication();
  const pendingRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  useNavigationGuard(() => !pendingRef.current);
  async function progress(status: TaskStatus) {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setBusy(true);
    onBusyChange?.(true);
    try {
      const { data: latest } = await api.request<{ data: Task }>({
        path: `tasks/${task.id}/status`,
      });
      const { data } = await api.request<{ data: Task }>({
        path: `tasks/${task.id}/status`,
        method: 'PATCH',
        json: { status, expectedUpdatedAt: latest.updatedAt },
      });
      context.saved(data);
      toaster.show({
        type: 'success',
        title: t('tasks.progressSaved', { title: data.title }),
      });
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 404) {
        context.missing(task.id);
        toaster.show({
          type: 'info',
          title: t('tasks.missingToast', { title: task.title }),
        });
      } else if (error instanceof ApiClientError && error.status === 409) {
        let refreshed = false;
        try {
          const { data } = await api.request<{ data: Task }>({
            path: `tasks/${task.id}/status`,
          });
          context.saved(data);
          refreshed = true;
        } catch {
          context.reload();
        }
        toaster.show({
          type: 'error',
          title: t(
            refreshed ? 'tasks.progressConflict' : 'tasks.progressFailed',
            { title: task.title },
          ),
        });
      } else if (error instanceof ApiClientError && error.status === 401) {
        toaster.show({ type: 'error', title: t('status.sessionExpired') });
        void refresh();
      } else
        toaster.show({
          type: 'error',
          title: t(
            error instanceof ApiClientError && error.status === 403
              ? 'tasks.denied'
              : 'tasks.progressFailed',
            { title: task.title },
          ),
        });
    } finally {
      pendingRef.current = false;
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  const permitted =
    task.permissions.edit ||
    task.permissions.progress ||
    task.permissions.delete;
  if (!permitted) return null;
  const icons = {
    todo: CircleIcon,
    inProgress: CircleDotIcon,
    done: CircleCheckIcon,
  };
  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          render={
            <Button
              variant={detail ? 'outline' : 'ghost'}
              size={detail ? 'default' : 'icon-sm'}
              disabled={busy}
              aria-label={t('tasks.actionMenu', { title: task.title })}
            />
          }
        >
          {busy ? <Spinner /> : <MoreHorizontalIcon />}
          {detail ? t('tasks.actionMenu', { title: task.title }) : null}
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='w-auto min-w-40'>
          <DropdownMenuGroup>
            {task.permissions.edit ? (
              <DropdownMenuItem
                render={
                  <Link
                    to={{
                      pathname: detail ? 'edit' : `edit/${task.id}`,
                      search: location.search,
                    }}
                  />
                }
              >
                <PencilIcon />
                {t('tasks.edit')}
              </DropdownMenuItem>
            ) : null}
            {task.permissions.progress
              ? TASK_STATUSES.filter((status) => status !== task.status).map(
                  (status) => {
                    const Icon = icons[status];
                    return (
                      <DropdownMenuItem
                        key={status}
                        onClick={() => void progress(status)}
                      >
                        <Icon />
                        {t(`tasks.${status}`)}
                      </DropdownMenuItem>
                    );
                  },
                )
              : null}
            {task.permissions.delete ? (
              <>
                {task.permissions.edit || task.permissions.progress ? (
                  <DropdownMenuSeparator />
                ) : null}
                <DropdownMenuItem
                  variant='destructive'
                  onClick={() => setDeleting(true)}
                >
                  <Trash2Icon />
                  {t('tasks.delete')}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {deleting ? (
        <DeleteTask
          task={task}
          close={() => setDeleting(false)}
          removed={(id) => {
            context.missing(id);
            onRemoved?.();
          }}
          missing={context.missing}
        />
      ) : null}
    </>
  );
}
