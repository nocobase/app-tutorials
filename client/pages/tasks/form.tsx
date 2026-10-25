import { useTasks, focusTaskSearch, useTaskOverlayFocus } from './context.js';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { ApiClientError, useApiClient, useToaster } from '@nocobase/app-client';
import { useCan } from '@nocobase/app-plugin-authorization/client';
import { useTranslation, useLocale } from '@nocobase/i18n/client';
import { enUS, zhCN } from 'react-day-picker/locale';
import { CalendarIcon, LoaderCircle } from 'lucide-react';
import { RouteDialog } from '#components/route-dialog';
import { Button } from '#components/ui/button';
import { Input } from '#components/ui/input';
import { Label } from '#components/ui/label';
import { Textarea } from '#components/ui/textarea';
import { Alert, AlertDescription } from '#components/ui/alert';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '#components/ui/select';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '#components/ui/popover';
import { Calendar } from '#components/ui/calendar';
import { Skeleton } from '#components/ui/skeleton';
import { useSettingsLeave } from '../settings/hooks.js';
import { AssigneePicker } from './assignee-picker.js';
import { TaskError, DateText } from './shared.js';
import { statuses, type Task, type TaskStatus } from './types.js';
interface Fields {
  title: string;
  description: string;
  assignee: { id: string; name: string } | null;
  dueDate: string | null;
  status: TaskStatus;
}
const initial: Fields = {
  title: '',
  description: '',
  assignee: null,
  dueDate: null,
  status: 'todo',
};
export default function TaskForm() {
  useTaskOverlayFocus();
  const { taskId } = useParams();
  const creating = !taskId;
  const api = useApiClient();
  const { t } = useTranslation();
  const { locale } = useLocale();
  const parent = useTasks();
  const { reload } = parent;
  const navigate = useNavigate();
  const location = useLocation();
  const toaster = useToaster();
  const { can } = useCan({
    resource: { type: 'composite', id: 'tasks' },
    action: creating ? 'create' : 'edit',
  });
  const [fields, setFields] = useState<Fields>(initial);
  const [version, setVersion] = useState('');
  const [loadedTitle, setLoadedTitle] = useState<string>();
  const [loading, setLoading] = useState(!creating);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<unknown>();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [revision, setRevision] = useState(0);
  const pendingRef = useRef(false);
  const composingRef = useRef(false);
  const leave = useSettingsLeave(dirty, busy, undefined, {
    title: t('tasks.discardTitle', {
      title: loadedTitle ?? (fields.title.trim() || t('tasks.new')),
    }),
    description: t('tasks.discardHint'),
    confirmLabel: t('tasks.discard'),
  });
  const nested = location.pathname.endsWith(`/${taskId}/edit`);
  const fatal =
    error instanceof ApiClientError && [401, 403, 404].includes(error.status);
  const closeTo =
    creating || fatal ? '/tasks' : nested ? `/tasks/${taskId}` : '/tasks';
  const close = () => {
    void (async () => {
      if (await leave.guard()) {
        leave.allow();
        void navigate(`${closeTo}${parent.search}`, { replace: true });
        if (!nested) focusTaskSearch();
      }
    })();
  };
  useEffect(() => {
    if (creating) return;
    const controller = new AbortController();
    void api
      .request<{ data: Task }>({
        path: `tasks/${taskId}/edit`,
        signal: controller.signal,
      })
      .then(
        ({ data }) => {
          if (controller.signal.aborted) return;
          setFields({
            title: data.title,
            description: data.description,
            assignee: data.assigneeId
              ? {
                  id: data.assigneeId,
                  name: data.assigneeName ?? data.assigneeId,
                }
              : null,
            dueDate: data.dueDate,
            status: data.status,
          });
          setVersion(data.updatedAt);
          setLoadedTitle(data.title);
          setDirty(false);
          setErrors({});
          setError(undefined);
          setLoading(false);
        },
        (next: unknown) => {
          if (!controller.signal.aborted) {
            setError(next);
            if (next instanceof ApiClientError && next.status === 404) reload();
            setLoading(false);
          }
        },
      );
    return () => controller.abort();
  }, [api, taskId, creating, revision, reload]);
  const update = <K extends keyof Fields>(key: K, value: Fields[K]) => {
    setFields((old) => ({ ...old, [key]: value }));
    setDirty(true);
    setErrors((old) => {
      const next = { ...old };
      delete next[key];
      if (submitted && key === 'title' && typeof value === 'string') {
        const title = value.trim();
        if (!title) next.title = t('tasks.titleRequired');
        else if (title.length > 120) next.title = t('tasks.titleLong');
      }
      if (
        submitted &&
        key === 'description' &&
        typeof value === 'string' &&
        value.length > 2000
      )
        next.description = t('tasks.descriptionLong');
      return next;
    });
  };
  const validate = () => {
    const next: Record<string, string> = {};
    if (!fields.title.trim()) next.title = t('tasks.titleRequired');
    else if (fields.title.trim().length > 120)
      next.title = t('tasks.titleLong');
    if (fields.description.length > 2000)
      next.description = t('tasks.descriptionLong');
    return next;
  };
  const focusField = (field: string) =>
    requestAnimationFrame(() =>
      document.getElementById(`task-${field}`)?.focus(),
    );
  const save = async () => {
    if (pendingRef.current || composingRef.current || !can) return;
    setSubmitted(true);
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) {
      focusField(Object.keys(next)[0]);
      return;
    }
    pendingRef.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const values = {
        title: fields.title.trim(),
        description: fields.description.trim(),
        assigneeId: fields.assignee?.id ?? null,
        dueDate: fields.dueDate,
        ...(creating
          ? { status: fields.status }
          : { expectedUpdatedAt: version }),
      };
      const { data } = await api.request<{ data: Task }>({
        path: creating ? 'tasks' : `tasks/${taskId}`,
        method: creating ? 'POST' : 'PATCH',
        json: values,
      });
      leave.allow();
      setDirty(false);
      parent.changed(data, creating);
      toaster.show({
        type: 'success',
        title: t(creating ? 'tasks.created' : 'tasks.saved', {
          title: data.title,
        }),
      });
      if (!creating)
        void navigate(`${closeTo}${parent.search}`, { replace: true });
      if (!nested) focusTaskSearch();
    } catch (next) {
      if (
        next instanceof ApiClientError &&
        next.reason === 'TASK_ASSIGNEE_INVALID'
      ) {
        setErrors({ assignee: t('tasks.ownerInvalid') });
        focusField('assignee');
      } else if (next instanceof ApiClientError && next.status === 400) {
        const violations =
          (
            next.payload as {
              error?: { fieldViolations?: { field: string }[] };
            }
          ).error?.fieldViolations ?? [];
        const fieldErrors: Record<string, string> = {};
        for (const item of violations) {
          const field = item.field.replace(/^body\.|^json\./u, '');
          if (['title', 'description', 'assigneeId', 'dueDate'].includes(field))
            fieldErrors[field === 'assigneeId' ? 'assignee' : field] = t(
              field === 'title'
                ? 'tasks.titleInvalid'
                : field === 'description'
                  ? 'tasks.descriptionLong'
                  : field === 'dueDate'
                    ? 'tasks.dateInvalid'
                    : 'tasks.ownerInvalid',
            );
        }
        if (Object.keys(fieldErrors).length) {
          setErrors(fieldErrors);
          focusField(Object.keys(fieldErrors)[0]);
        } else setError(next);
      } else {
        setError(next);
        if (next instanceof ApiClientError && next.status === 404 && taskId)
          parent.removed(taskId, false);
      }
    } finally {
      pendingRef.current = false;
      setBusy(false);
    }
  };
  // The description's minimum height fits a short paragraph; other field widths follow the dialog grid.
  // Explicit labels and error ids accommodate the composed calendar and searchable assignee controls.
  return (
    <RouteDialog
      title={t(creating ? 'tasks.new' : 'tasks.edit')}
      description={t('tasks.formHint')}
      beforeClose={leave.guard}
      closeTo={`${closeTo}${parent.search}`}
      footer={
        <>
          <Button variant='outline' disabled={busy} onClick={close}>
            {t(fatal ? 'tasks.back' : 'tasks.cancel')}
          </Button>
          {can && !fatal && (
            <Button
              type='submit'
              form='task-form'
              disabled={
                busy ||
                loading ||
                (!creating && !version) ||
                (error instanceof ApiClientError && error.status === 409)
              }
            >
              {busy && <LoaderCircle className='animate-spin' />}
              {t(
                busy
                  ? 'tasks.saving'
                  : creating
                    ? 'tasks.create'
                    : 'tasks.save',
              )}
            </Button>
          )}
        </>
      }
    >
      {leave.dialog}
      <TaskError
        error={error}
        title={loadedTitle}
        retry={
          !creating && !version ? () => setRevision((n) => n + 1) : undefined
        }
        reload={() => {
          void (async () => {
            if (!(await leave.guard())) return;
            leave.reset();
            setLoading(true);
            setRevision((n) => n + 1);
          })();
        }}
      />
      {!can ? (
        <Alert variant='destructive'>
          <AlertDescription>{t('tasks.denied')}</AlertDescription>
        </Alert>
      ) : loading ? (
        <div aria-label={t('tasks.loading')} className='flex flex-col gap-5'>
          {[1, 2, 3, 4].map((field) => (
            <div key={field} className='flex flex-col gap-2'>
              <Skeleton className='h-4 w-1/4' />
              <Skeleton className='h-9 w-full' />
            </div>
          ))}
        </div>
      ) : (
        !fatal && (
          <form
            id='task-form'
            className='flex flex-col gap-5'
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
            onCompositionStart={() => {
              composingRef.current = true;
            }}
            onCompositionEnd={() => {
              composingRef.current = false;
            }}
          >
            <div className='flex flex-col gap-2'>
              <Label htmlFor='task-title'>
                {t('tasks.taskTitle')}{' '}
                <span className='text-destructive'>*</span>
              </Label>
              <Input
                id='task-title'
                autoFocus
                required
                disabled={busy}
                value={fields.title}
                onChange={(event) => update('title', event.target.value)}
                aria-invalid={!!errors.title}
                aria-describedby={errors.title ? 'task-title-error' : undefined}
              />
              {errors.title && (
                <p
                  id='task-title-error'
                  role='alert'
                  className='text-sm text-destructive'
                >
                  {errors.title}
                </p>
              )}
            </div>
            <div className='flex flex-col gap-2'>
              <Label htmlFor='task-description'>{t('tasks.description')}</Label>
              <Textarea
                id='task-description'
                className='min-h-28'
                disabled={busy}
                value={fields.description}
                onChange={(event) => update('description', event.target.value)}
                aria-invalid={!!errors.description}
                aria-describedby={
                  errors.description ? 'task-description-error' : undefined
                }
              />
              {errors.description && (
                <p
                  id='task-description-error'
                  role='alert'
                  className='text-sm text-destructive'
                >
                  {errors.description}
                </p>
              )}
            </div>
            <div className='grid gap-5 sm:grid-cols-2'>
              <div className='flex flex-col gap-2'>
                <Label htmlFor='task-assignee'>{t('tasks.assignee')}</Label>
                <AssigneePicker
                  value={fields.assignee}
                  onChange={(value) => update('assignee', value)}
                  disabled={busy}
                  invalid={!!errors.assignee}
                />
                {errors.assignee && (
                  <p
                    id='task-assignee-error'
                    role='alert'
                    className='text-sm text-destructive'
                  >
                    {errors.assignee}
                  </p>
                )}
              </div>
              <div className='flex flex-col gap-2'>
                <Label htmlFor='task-dueDate'>{t('tasks.dueDate')}</Label>
                <Popover>
                  <PopoverTrigger
                    render={
                      <Button
                        id='task-dueDate'
                        aria-invalid={!!errors.dueDate}
                        aria-describedby={
                          errors.dueDate ? 'task-dueDate-error' : undefined
                        }
                        variant='outline'
                        disabled={busy}
                        className='w-full justify-start font-normal'
                      >
                        <CalendarIcon />
                        <DateText value={fields.dueDate} />
                      </Button>
                    }
                  />
                  <PopoverContent className='w-auto p-0' align='start'>
                    <Calendar
                      mode='single'
                      locale={locale.startsWith('zh') ? zhCN : enUS}
                      selected={
                        fields.dueDate
                          ? new Date(`${fields.dueDate}T12:00:00`)
                          : undefined
                      }
                      onSelect={(date) =>
                        update(
                          'dueDate',
                          date
                            ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
                            : null,
                        )
                      }
                    />
                    <Button
                      variant='ghost'
                      className='w-full'
                      onClick={() => update('dueDate', null)}
                    >
                      {t('tasks.clearDate')}
                    </Button>
                  </PopoverContent>
                </Popover>
                {errors.dueDate && (
                  <p
                    id='task-dueDate-error'
                    role='alert'
                    className='text-sm text-destructive'
                  >
                    {errors.dueDate}
                  </p>
                )}
              </div>
            </div>
            {creating && (
              <div className='flex flex-col gap-2'>
                <Label htmlFor='task-status'>{t('tasks.status')}</Label>
                <Select
                  value={fields.status}
                  onValueChange={(value) =>
                    update('status', value as TaskStatus)
                  }
                  disabled={busy}
                >
                  <SelectTrigger id='task-status' className='w-full'>
                    <SelectValue>{t(`tasks.${fields.status}`)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className='w-auto min-w-(--anchor-width) max-w-[min(var(--container-sm),var(--available-width))] [&_[data-slot=select-item]>:first-child]:whitespace-normal'>
                    {statuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {t(`tasks.${status}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </form>
        )
      )}
    </RouteDialog>
  );
}
