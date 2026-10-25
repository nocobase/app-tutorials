import { TasksContext } from './context.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Outlet, useSearchParams, useNavigate } from 'react-router';
import { useApiClient, ApiClientError } from '@nocobase/app-client';
import { useCan } from '@nocobase/app-plugin-authorization/client';
import { useTranslation } from '@nocobase/i18n/client';
import { Plus, RefreshCw, ListTodo, Search } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { PageContainer } from '#components/page-container';
import { PageHeader } from '#components/page-header';
import { DataTable, DataTableColumnHeader } from '#components/data-table';
import { RecordLink } from '#components/record-link';
import { Button } from '#components/ui/button';
import { Input } from '#components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '#components/ui/select';
import { Alert, AlertDescription } from '#components/ui/alert';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '#components/ui/empty';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '#components/ui/tooltip';
import { Skeleton } from '#components/ui/skeleton';
import { StatusBadge, DateText, TruncatedTitle, TaskError } from './shared.js';
import { TaskActions } from './task-actions.js';
import { statuses, type Task, type TaskList } from './types.js';

export default function TasksPage() {
  const api = useApiClient();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can: canCreate } = useCan({
    resource: { type: 'composite', id: 'tasks' },
    action: 'create',
  });
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const status = statuses.find((s) => s === params.get('status')) ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const pageSize =
    [10, 20, 50].find((n) => n === Number(params.get('pageSize'))) ?? 10;
  const orderBy =
    ['updatedAt:desc', 'updatedAt:asc', 'dueDate:asc', 'dueDate:desc'].find(
      (s) => s === params.get('orderBy'),
    ) ?? 'updatedAt:desc';
  const query = new URLSearchParams({
    q,
    status,
    page: String(page),
    pageSize: String(pageSize),
    orderBy,
  });
  if (!status) query.delete('status');
  const queryKey = query.toString();
  const search = params.size ? `?${params.toString()}` : '';
  const [draft, setDraft] = useState(q);
  const [composing, setComposing] = useState(false);
  const [updates, setUpdates] = useState<Record<string, Task>>({});
  const [missingIds, setMissingIds] = useState<string[]>([]);
  const [result, setResult] = useState<TaskList>();
  const [settled, setSettled] = useState('');
  const [error, setError] = useState<unknown>();
  const [revision, setRevision] = useState(0);
  const mutationRef = useRef(false);
  const [savedRefreshFailed, setSavedRefreshFailed] = useState(false);
  const generationRef = useRef(0);
  const requestKey = `${queryKey}|${revision}`;
  const loading = settled !== requestKey;
  const reload = useCallback(() => setRevision((r) => r + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    const current = ++generationRef.current;
    void api
      .request<TaskList>({
        path: `tasks?${queryKey}`,
        signal: controller.signal,
      })
      .then(
        (next) => {
          if (current !== generationRef.current || controller.signal.aborted)
            return;
          if (next.meta.page !== page)
            setParams(
              (current) => {
                const corrected = new URLSearchParams(current);
                corrected.set('page', String(next.meta.page));
                return corrected;
              },
              { replace: true },
            );
          setResult(next);
          setUpdates((old) => {
            const reconciled = { ...old };
            for (const row of next.data)
              if (
                reconciled[row.id] &&
                row.updatedAt >= reconciled[row.id].updatedAt
              )
                delete reconciled[row.id];
            return reconciled;
          });
          setError(undefined);
          setSettled(requestKey);
          mutationRef.current = false;
          setSavedRefreshFailed(false);
        },
        (next: unknown) => {
          if (current !== generationRef.current || controller.signal.aborted)
            return;
          setSettled(requestKey);
          setError(next);
          setSavedRefreshFailed(mutationRef.current);
          if (
            next instanceof ApiClientError &&
            [401, 403].includes(next.status)
          )
            setResult(undefined);
        },
      );
    return () => controller.abort();
  }, [api, queryKey, revision, requestKey, page, setParams]);
  useEffect(() => {
    if (composing || draft.trim() === q) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (draft.trim()) next.set('q', draft.trim());
      else next.delete('q');
      next.set('page', '1');
      setParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(timer);
  }, [draft, q, composing, params, setParams]);
  const [previousQuery, setPreviousQuery] = useState(q);
  if (q !== previousQuery && !composing) {
    setPreviousQuery(q);
    setDraft(q);
  }
  const update = (values: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next);
  };
  const changed = (task: Task, created = false) => {
    ++generationRef.current;
    mutationRef.current = true;
    setError(undefined);
    setUpdates((old) => ({ ...old, [task.id]: task }));
    const matches =
      created ||
      ((!status || status === task.status) &&
        (!q || task.title.toLowerCase().includes(q.toLowerCase())));
    setResult((old) => {
      const existed = old?.data.some((row) => row.id === task.id) ?? false;
      const data = (old?.data ?? []).filter((row) => row.id !== task.id);
      if (matches) data.unshift(task);
      return {
        data: data.slice(0, pageSize),
        meta: {
          page: created ? 1 : page,
          pageSize,
          total: Math.max(
            0,
            (old?.meta.total ?? 0) +
              (created ? 1 : existed && !matches ? -1 : 0),
          ),
        },
      };
    });
    if (created) void navigate('/tasks', { replace: true });
    reload();
  };
  const removed = (id: string, committed = true) => {
    setMissingIds((old) => [...old, id]);
    setUpdates((old) => {
      const next = { ...old };
      delete next[id];
      return next;
    });
    ++generationRef.current;
    mutationRef.current = committed;
    setResult((old) =>
      old
        ? {
            data: old.data.filter((row) => row.id !== id),
            meta: { ...old.meta, total: Math.max(0, old.meta.total - 1) },
          }
        : old,
    );
    reload();
  };
  // Toolbar minimum widths keep search and translated status choices usable; flex wrapping handles narrow screens.
  const newButton = (
    <Button nativeButton={false} render={<Link to={`new${search}`} />}>
      <Plus />
      {t('tasks.new')}
    </Button>
  );
  const filtered = !!q || !!status;
  const empty = (
    <Empty className='min-h-48 border border-dashed'>
      <EmptyHeader>
        <EmptyMedia variant='icon'>
          <ListTodo />
        </EmptyMedia>
        <EmptyTitle>
          {t(filtered ? 'tasks.noResults' : 'tasks.emptyTitle')}
        </EmptyTitle>
        <EmptyDescription>
          {t(
            filtered
              ? 'tasks.noResultsHint'
              : canCreate
                ? 'tasks.emptyDescription'
                : 'tasks.emptyReadonly',
          )}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        {filtered ? (
          <Button
            variant='outline'
            onClick={() => update({ q: '', status: '', page: '1' })}
          >
            {t('tasks.clear')}
          </Button>
        ) : canCreate ? (
          newButton
        ) : null}
      </EmptyContent>
    </Empty>
  );
  const columns: ColumnDef<Task>[] = [
    {
      accessorKey: 'title',
      header: t('tasks.taskTitle'),
      cell: ({ row }) => (
        <RecordLink to={`${row.original.id}${search}`}>
          <TruncatedTitle>{row.original.title}</TruncatedTitle>
        </RecordLink>
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'status',
      header: t('tasks.status'),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
      enableSorting: false,
    },
    {
      accessorKey: 'assigneeName',
      header: t('tasks.assignee'),
      cell: ({ row }) => (
        <TruncatedTitle>
          {row.original.assigneeName ?? t('tasks.unassigned')}
        </TruncatedTitle>
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'dueDate',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('tasks.dueDate')} />
      ),
      cell: ({ row }) => (
        <span className='whitespace-nowrap'>
          <DateText value={row.original.dueDate} />
        </span>
      ),
    },
    {
      accessorKey: 'updatedAt',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('tasks.updatedAt')} />
      ),
      cell: ({ row }) => (
        <span className='whitespace-nowrap text-muted-foreground'>
          <DateText value={row.original.updatedAt} timestamp />
        </span>
      ),
    },
    { id: 'actions', cell: ({ row }) => <TaskActions task={row.original} /> },
  ];
  const pagination = { pageIndex: (result?.meta.page ?? page) - 1, pageSize };
  const sorting = [
    { id: orderBy.split(':')[0], desc: orderBy.endsWith('desc') },
  ];
  return (
    <TasksContext.Provider
      value={{
        changed,
        removed,
        reload,
        tasks: result?.data ?? [],
        updates,
        search,
        refreshVersion: revision,
        missingIds,
      }}
    >
      <PageContainer>
        <PageHeader
          title={t('tasks.title')}
          description={t('tasks.subtitle')}
          actions={
            <>
              {canCreate && !!result && (filtered || !!result.data.length)
                ? newButton
                : null}{' '}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant='outline'
                      size='icon'
                      aria-label={t('tasks.refresh')}
                      disabled={loading}
                      onClick={reload}
                    >
                      <RefreshCw className={loading ? 'animate-spin' : ''} />
                    </Button>
                  }
                />
                <TooltipContent>{t('tasks.refresh')}</TooltipContent>
              </Tooltip>
            </>
          }
        />
        <div className='flex flex-wrap items-center gap-2'>
          <form
            className='relative min-w-48 flex-1 sm:max-w-72'
            onSubmit={(event) => {
              event.preventDefault();
              if (composing) return;
              update({ q: draft.trim(), page: '1' });
            }}
          >
            <Search className='pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground' />
            <Input
              id='task-search'
              className='pl-9'
              aria-label={t('tasks.search')}
              placeholder={t('tasks.search')}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onCompositionStart={() => setComposing(true)}
              onCompositionEnd={(event) => {
                setComposing(false);
                setDraft(event.currentTarget.value);
              }}
            />
          </form>
          <Select
            value={status || 'all'}
            onValueChange={(value) =>
              update({
                status: value === 'all' ? '' : (value ?? ''),
                page: '1',
              })
            }
          >
            <SelectTrigger aria-label={t('tasks.status')} className='w-40'>
              <SelectValue>
                {status ? t(`tasks.${status}`) : t('tasks.all')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className='w-auto min-w-(--anchor-width) max-w-[min(var(--container-sm),var(--available-width))] [&_[data-slot=select-item]>:first-child]:whitespace-normal'>
              <SelectItem value='all'>{t('tasks.all')}</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`tasks.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filtered && (
            <Button
              variant='ghost'
              onClick={() => update({ q: '', status: '', page: '1' })}
            >
              {t('tasks.clear')}
            </Button>
          )}
        </div>
        {savedRefreshFailed && (
          <Alert>
            <AlertDescription>{t('tasks.reloadFailed')}</AlertDescription>
          </Alert>
        )}
        <TaskError
          error={error}
          retry={reload}
          reset={() => {
            setDraft('');
            setParams({}, { replace: true });
          }}
        />
        {loading && !result ? (
          <div aria-label={t('tasks.loading')} className='flex flex-col gap-3'>
            {[1, 2, 3].map((n) => (
              <Skeleton key={n} className='h-12 w-full' />
            ))}
          </div>
        ) : result && !result.data.length && !filtered ? (
          empty
        ) : result ? (
          <DataTable
            columns={columns}
            data={result.data}
            getRowId={(row) => row.id}
            showSelectedCount={false}
            manualPagination
            rowCount={result.meta.total}
            paginationState={pagination}
            pageSizeOptions={[10, 20, 50]}
            onPaginationChange={(next) => {
              const value =
                typeof next === 'function' ? next(pagination) : next;
              update({
                page: String(value.pageIndex + 1),
                pageSize: String(value.pageSize),
              });
            }}
            manualSorting
            sortingState={sorting}
            onSortingChange={(next) => {
              const value = typeof next === 'function' ? next(sorting) : next;
              update({
                orderBy: value[0]
                  ? `${value[0].id}:${value[0].desc ? 'desc' : 'asc'}`
                  : 'updatedAt:desc',
                page: '1',
              });
            }}
            loading={loading}
            emptyMessage={empty}
          />
        ) : null}
        <Outlet />
      </PageContainer>
    </TasksContext.Provider>
  );
}
