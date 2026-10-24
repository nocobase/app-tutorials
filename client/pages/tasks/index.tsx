import { ApiClientError, useApiClient, useToaster } from '@nocobase/app-client';
import { useAuthentication } from '@nocobase/app-plugin-authentication/client';
import { useCan } from '@nocobase/app-plugin-authorization/client';
import { useTranslation } from '@nocobase/i18n/client';
import { type ColumnDef } from '@tanstack/react-table';
import { ListTodo, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { DataTable } from '#components/data-table';
import { PageContainer } from '#components/page-container';
import { PageHeader } from '#components/page-header';
import { Badge } from '#components/ui/badge';
import { Button } from '#components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '#components/ui/empty';
import { Skeleton } from '#components/ui/skeleton';
import { Spinner } from '#components/ui/spinner';
import { Input } from '#components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#components/ui/select';
import { useUrlSearch } from '#hooks/use-url-search';
import { useTableUrlState } from '#hooks/use-table-url-state';
import { TaskError } from './error.js';
import { taskErrorKey } from './error-key.js';
import type { Task, TasksContext } from './types.js';

export default function TasksPage() {
  const { t } = useTranslation();
  const api = useApiClient();
  const toaster = useToaster();
  const { refresh } = useAuthentication();
  const location = useLocation();
  const { searchParams, search, text, inputProps, updateParams, clear } =
    useUrlSearch({ resetParams: ['page'] });
  const statusValue = searchParams.get('status');
  const status =
    statusValue === 'pending' || statusValue === 'completed'
      ? statusValue
      : 'all';
  const searchRef = useRef<HTMLInputElement>(null);
  const clearFilters = () => {
    clear((params) => params.delete('status'));
    searchRef.current?.focus();
  };
  const createAccess = useCan({
    resource: { type: 'composite', id: 'tutorial.tasks' },
    action: 'create',
  });
  const updateAccess = useCan({
    resource: { type: 'composite', id: 'tutorial.tasks' },
    action: 'update',
  });
  const [result, setResult] = useState<{
    data: Task[];
    meta: { total: number };
    key: string;
    filtered: boolean;
  }>();
  const [error, setError] = useState<unknown>();

  const [revision, setRevision] = useState(0);
  const positionKey = JSON.stringify([
    search,
    status,
    searchParams.get('page'),
    searchParams.get('pageSize'),
    revision,
  ]);
  const [failure, setFailure] = useState<{ key: string; cause: unknown }>();
  const loading = result?.key !== positionKey && failure?.key !== positionKey;
  const table = useTableUrlState({
    sortColumns: [],
    rowCount:
      !loading && !error && result?.key === positionKey
        ? result.meta.total
        : undefined,
  });
  const { pageIndex, pageSize } = table.paginationState;
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const headingRef = useRef<HTMLSpanElement>(null);
  const previousPathRef = useRef(location.pathname);
  const focusHeading = () => headingRef.current?.focus();
  const reload = () => {
    setError(undefined);
    setFailure(undefined);
    setRevision((value) => value + 1);
  };

  useEffect(() => {
    const controller = new AbortController();
    void api
      .request<{ data: Task[]; meta: { total: number } }>({
        path: 'tutorialTasks',
        query: { q: search, status, page: pageIndex + 1, pageSize },
        signal: controller.signal,
      })
      .then((data) => {
        if (!controller.signal.aborted) {
          setResult({
            ...data,
            key: positionKey,
            filtered: Boolean(search || status !== 'all'),
          });
          setError(undefined);
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause);
          setFailure({ key: positionKey, cause });
        }
      });
    return () => controller.abort();
  }, [api, positionKey, search, status, pageIndex, pageSize]);

  useEffect(() => {
    if (
      previousPathRef.current.endsWith('/create') &&
      !location.pathname.endsWith('/create')
    )
      focusHeading();
    previousPathRef.current = location.pathname;
  }, [location.pathname]);

  function saved(task: Task, created = false) {
    // Only insert into the first page when the saved row still matches its filters.
    const matches =
      (!search ||
        task.title.toLocaleLowerCase().includes(search.toLocaleLowerCase())) &&
      (status === 'all' || task.completed === (status === 'completed'));
    if (!created) focusHeading();
    setResult((old) =>
      old
        ? {
            ...old,
            data:
              pageIndex === 0 && matches
                ? [task, ...old.data.filter((row) => row.id !== task.id)].slice(
                    0,
                    pageSize,
                  )
                : old.data.filter((row) => row.id !== task.id),
          }
        : old,
    );
    reload();
  }

  async function setCompleted(task: Task) {
    setPendingIds((old) => new Set(old).add(task.id));
    try {
      const response = await api.request<{ data: Task }>({
        path: `tutorialTasks/${encodeURIComponent(task.id)}`,
        method: 'PATCH',
        json: { completed: !task.completed },
      });
      saved(response.data);
      toaster.show({
        type: 'success',
        title: t('tasks.updated', { title: task.title }),
      });
    } catch (cause: unknown) {
      toaster.show({
        type: 'error',
        title: t(taskErrorKey(cause)),
        ...(cause instanceof ApiClientError && cause.status === 401
          ? {
              action: {
                label: t('tasks.signIn'),
                onClick: () => void refresh(),
              },
            }
          : {}),
      });
      if (cause instanceof ApiClientError && cause.status === 404) {
        focusHeading();
        setResult((old) =>
          old
            ? {
                ...old,
                data: old.data.filter((row) => row.id !== task.id),
                meta: { total: Math.max(0, old.meta.total - 1) },
              }
            : old,
        );
        reload();
      }
    } finally {
      setPendingIds((old) => {
        const next = new Set(old);
        next.delete(task.id);
        return next;
      });
    }
  }

  const columns: ColumnDef<Task>[] = [
    {
      accessorKey: 'title',
      header: t('tasks.taskTitle'),
      cell: ({ row }) => <TaskTitle title={row.original.title} />,
    },
    {
      accessorKey: 'assigneeName',
      header: t('tasks.assignee'),
      cell: ({ row }) =>
        row.original.assigneeId ? (
          <TaskTitle
            title={row.original.assigneeName ?? t('tasks.assigneeUnavailable')}
          />
        ) : (
          t('tasks.unassigned')
        ),
    },
    {
      accessorKey: 'dueDate',
      header: t('tasks.dueDate'),
      cell: ({ row }) =>
        row.original.dueDate ? (
          <time dateTime={row.original.dueDate}>{row.original.dueDate}</time>
        ) : (
          t('tasks.noDueDate')
        ),
    },
    {
      accessorKey: 'completed',
      header: t('tasks.status'),
      cell: ({ row }) => (
        <Badge variant='secondary'>
          {t(row.original.completed ? 'tasks.completed' : 'tasks.pending')}
        </Badge>
      ),
    },
    ...(updateAccess.can
      ? [
          {
            id: 'actions',
            header: t('tasks.actions'),
            cell: ({ row }: { row: { original: Task } }) => (
              <Button
                variant='ghost'
                disabled={pendingIds.has(row.original.id)}
                onClick={() => void setCompleted(row.original)}
              >
                {pendingIds.has(row.original.id) ? (
                  <Spinner data-icon='inline-start' />
                ) : null}
                {t(row.original.completed ? 'tasks.reopen' : 'tasks.complete')}
              </Button>
            ),
          },
        ]
      : []),
  ];
  const newTask = createAccess.can ? (
    <Button
      nativeButton={false}
      render={<Link to={{ pathname: 'create', search: location.search }} />}
    >
      <Plus data-icon='inline-start' />
      {t('tasks.new')}
    </Button>
  ) : null;
  const context: TasksContext = { saved, focusHeading };

  return (
    <PageContainer>
      <PageHeader
        title={
          <span ref={headingRef} tabIndex={-1}>
            {t('tasks.title')}
          </span>
        }
        description={t('tasks.description')}
        actions={result?.meta.total === 0 && !result.filtered ? null : newTask}
      />
      <div className='flex flex-wrap items-center gap-2'>
        <Input
          ref={searchRef}
          {...inputProps}
          maxLength={120}
          aria-label={t('tasks.search')}
          placeholder={t('tasks.search')}
          className='w-full sm:w-72'
        />
        <Select
          value={status}
          items={[
            { value: 'all', label: t('tasks.allStatuses') },
            { value: 'pending', label: t('tasks.pending') },
            { value: 'completed', label: t('tasks.completed') },
          ]}
          onValueChange={(value) =>
            updateParams((params) => {
              if (value === 'all' || !value) params.delete('status');
              else params.set('status', value);
              params.delete('page');
            })
          }
        >
          <SelectTrigger aria-label={t('tasks.status')} className='w-40'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>{t('tasks.allStatuses')}</SelectItem>
            <SelectItem value='pending'>{t('tasks.pending')}</SelectItem>
            <SelectItem value='completed'>{t('tasks.completed')}</SelectItem>
          </SelectContent>
        </Select>
        {text || status !== 'all' ? (
          <Button variant='ghost' onClick={clearFilters}>
            {t('tasks.clearFilters')}
          </Button>
        ) : null}
      </div>
      {createAccess.error || updateAccess.error ? (
        <TaskError
          error={createAccess.error ?? updateAccess.error}
          retry={() => {
            createAccess.retry();
            updateAccess.retry();
          }}
        />
      ) : null}
      {error ? <TaskError error={error} retry={reload} /> : null}
      {loading && !result ? (
        <div
          role='status'
          aria-label={t('tasks.loading')}
          className='flex flex-col gap-4'
        >
          <Skeleton className='h-10 w-full' />
          <Skeleton className='h-10 w-full' />
          <Skeleton className='h-10 w-full' />
        </div>
      ) : null}
      {loading && result ? (
        <div
          role='status'
          className='flex items-center gap-2 text-sm text-muted-foreground'
        >
          <Spinner />
          {t('tasks.loading')}
        </div>
      ) : null}
      {result?.meta.total === 0 && !result.filtered && !loading && !error ? (
        <Empty className='min-h-48 border border-dashed'>
          <EmptyHeader>
            <EmptyMedia variant='icon'>
              <ListTodo />
            </EmptyMedia>
            <EmptyTitle>{t('tasks.emptyTitle')}</EmptyTitle>
            <EmptyDescription>
              {t(
                createAccess.can ? 'tasks.emptyDescription' : 'tasks.askAdmin',
              )}
            </EmptyDescription>
          </EmptyHeader>
          {newTask ? <EmptyContent>{newTask}</EmptyContent> : null}
        </Empty>
      ) : null}
      {result && (result.meta.total > 0 || result.filtered) ? (
        <DataTable
          columns={columns}
          data={result.data}
          {...table}
          manualPagination
          manualSorting
          rowCount={result.meta.total}
          loading={loading || Boolean(error)}
          showSelectedCount={false}
          emptyMessage={
            <div className='flex flex-col items-center gap-2'>
              <span>{t('tasks.noResults')}</span>
              <Button variant='ghost' onClick={clearFilters}>
                {t('tasks.clearFilters')}
              </Button>
            </div>
          }
          getRowId={(row) => row.id}
        />
      ) : null}
      <Outlet context={context} />
    </PageContainer>
  );
}

function TaskTitle({ title }: { title: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(() =>
      setTruncated(node.scrollWidth > node.clientWidth),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [title]);
  return (
    <span
      ref={ref}
      className='block max-w-xs truncate font-medium'
      title={truncated ? title : undefined}
    >
      {title}
    </span>
  );
}
