import { useEffect, useRef, useState } from 'react';
import { useOutletContext, useParams, useNavigate } from 'react-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ApiClientError,
  useApiClient,
  useToaster,
  useNavigationGuard,
} from '@nocobase/app-client';
import { useCan } from '@nocobase/app-plugin-authorization/client';
import { useTranslation } from '@nocobase/i18n/client';
import { RouteDialog } from '#components/route-dialog';
import { useRouteOverlay } from '#components/use-route-overlay';
import { Button } from '#components/ui/button';
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from '#components/ui/field';
import { Input } from '#components/ui/input';
import { Textarea } from '#components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#components/ui/select';
import { Spinner } from '#components/ui/spinner';
import { Skeleton } from '#components/ui/skeleton';
import { DatePicker } from '#components/date-picker';
import { AssigneePicker } from './assignee-picker.js';
import { TaskError } from './error.js';
import { TaskStatusBadge } from './display.js';
import { TASK_STATUSES, type Task, type TasksContext } from './types.js';

const FORM_ID = 'task-form';
export default function TaskFormPage() {
  const { t } = useTranslation();
  const { taskId } = useParams();
  const pendingRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  useNavigationGuard(() => !pendingRef.current);
  const submitting = (value: boolean) => {
    pendingRef.current = value;
    setBusy(value);
  };
  return (
    <RouteDialog
      title={t(taskId ? 'tasks.editTitle' : 'tasks.new')}
      beforeClose={() => !pendingRef.current}
      footer={<Footer busy={busy} ready={ready} editing={Boolean(taskId)} />}
    >
      <FormLoader
        key={taskId ?? 'new'}
        submitting={submitting}
        setReady={setReady}
      />
    </RouteDialog>
  );
}
function Footer({
  busy,
  ready,
  editing,
}: {
  busy: boolean;
  ready: boolean;
  editing: boolean;
}) {
  const { t } = useTranslation();
  const { close } = useRouteOverlay();
  return (
    <>
      <Button variant='outline' disabled={busy} onClick={() => void close()}>
        {t(ready ? 'tasks.cancel' : 'tasks.close')}
      </Button>
      {ready ? (
        <Button type='submit' form={FORM_ID} disabled={busy}>
          {busy ? <Spinner /> : null}
          {t(editing ? 'tasks.save' : 'tasks.create')}
        </Button>
      ) : null}
    </>
  );
}
function FormLoader({
  submitting,
  setReady,
}: {
  submitting: (v: boolean) => void;
  setReady: (v: boolean) => void;
}) {
  const { t } = useTranslation();
  const { taskId } = useParams();
  const api = useApiClient();
  const { missing } = useOutletContext<TasksContext>();
  const create = useCan({
    resource: { type: 'composite', id: 'tasks' },
    action: 'create',
  });
  useEffect(() => {
    if (!taskId) setReady(create.can);
  }, [taskId, create.can, setReady]);
  const missingRef = useRef(missing);
  useEffect(() => {
    missingRef.current = missing;
  }, [missing]);
  const [result, setResult] = useState<{ task?: Task; error?: unknown }>();
  const [revision, setRevision] = useState(0);
  const reload = () => {
    setReady(false);
    setResult(undefined);
    setRevision((v) => v + 1);
  };
  useEffect(() => {
    if (!taskId) return;
    const controller = new AbortController();
    void api
      .request<{ data: Task }>({
        path: `tasks/${taskId}/edit`,
        signal: controller.signal,
      })
      .then(
        ({ data }) => {
          if (controller.signal.aborted) return;
          setResult({ task: data });
          setReady(true);
        },
        (error: unknown) => {
          if (controller.signal.aborted) return;
          setResult({ error });
          setReady(false);
          if (error instanceof ApiClientError && error.status === 404)
            missingRef.current(taskId);
        },
      );
    return () => controller.abort();
  }, [api, taskId, revision, setReady]);
  if (!taskId && !create.can)
    return create.isPending ? (
      <Skeleton className='h-10 w-full' />
    ) : (
      <TaskError error={undefined} message={t('tasks.denied')} />
    );
  if (taskId && !result?.task)
    return result?.error ? (
      <TaskError
        error={result.error}
        message={
          result.error instanceof ApiClientError && result.error.status === 404
            ? t('tasks.missing', { title: taskId })
            : undefined
        }
        retry={reload}
      />
    ) : (
      <div className='flex flex-col gap-4' aria-label={t('tasks.loading')}>
        {[1, 2, 3, 4].map((v) => (
          <Skeleton key={v} className='h-10 w-full' />
        ))}
      </div>
    );
  return (
    <TaskForm
      key={`${taskId ?? 'new'}:${revision}`}
      task={result?.task}
      submitting={submitting}
      setReady={setReady}
      reload={reload}
    />
  );
}
function TaskForm({
  task,
  submitting,
  setReady,
  reload,
}: {
  task?: Task;
  submitting: (v: boolean) => void;
  setReady: (v: boolean) => void;
  reload: () => void;
}) {
  const { t } = useTranslation();
  const api = useApiClient();
  const toaster = useToaster();
  const { close } = useRouteOverlay();
  const navigate = useNavigate();
  const { saved, missing } = useOutletContext<TasksContext>();
  const savingRef = useRef(false);
  const composingRef = useRef(false);
  const [error, setError] = useState<unknown>();
  const [gone, setGone] = useState(false);
  const [assigneeLabel, setAssigneeLabel] = useState(
    () => task?.assigneeName ?? t('tasks.unavailable'),
  );
  const schema = z.object({
    title: z
      .string()
      .trim()
      .min(1, t('tasks.required'))
      .max(120, t('tasks.tooLong')),
    description: z.string().trim().max(2000, t('tasks.descriptionLong')),
    assigneeId: z.string(),
    dueDate: z.string(),
    status: z.enum(TASK_STATUSES),
  });
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      title: task?.title ?? '',
      description: task?.description ?? '',
      assigneeId: task?.assigneeId ?? '',
      dueDate: task?.dueDate ?? '',
      status: task?.status ?? 'todo',
    },
  });
  const conflict = error instanceof ApiClientError && error.status === 409;
  useEffect(() => {
    setReady(!gone && !conflict);
  }, [gone, conflict, setReady]);
  useEffect(() => {
    const timer = setTimeout(() => form.setFocus('title'), 0);
    return () => clearTimeout(timer);
  }, [form]);
  async function submit(values: z.infer<typeof schema>) {
    if (savingRef.current || composingRef.current || gone || conflict) return;
    savingRef.current = true;
    submitting(true);
    setError(undefined);
    let response: { data: Task };
    try {
      const details = {
        title: values.title,
        description: values.description,
        assigneeId: values.assigneeId || null,
        dueDate: values.dueDate || null,
      };
      response = await api.request<{ data: Task }>({
        path: task ? `tasks/${task.id}` : 'tasks',
        method: task ? 'PATCH' : 'POST',
        json: task
          ? { ...details, expectedUpdatedAt: task.updatedAt }
          : { ...details, status: values.status },
      });
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.status === 404 && task) {
        setGone(true);
        setReady(false);
        missing(task.id);
        setError(cause);
      } else {
        const parsed =
          cause instanceof ApiClientError && cause.status === 400
            ? z
                .object({
                  error: z.object({
                    fieldViolations: z.array(
                      z.object({
                        field: z.string(),
                        reason: z.string().optional(),
                      }),
                    ),
                  }),
                })
                .safeParse(cause.payload)
            : undefined;
        if (parsed?.success) {
          let focus = true;
          for (const violation of parsed.data.error.fieldViolations) {
            const field = violation.field.replace(/^body\./, '');
            if (
              ![
                'title',
                'description',
                'assigneeId',
                'dueDate',
                'status',
              ].includes(field)
            )
              continue;
            const key =
              field === 'title'
                ? violation.reason === 'too_small'
                  ? 'required'
                  : 'tooLong'
                : field === 'description'
                  ? 'descriptionLong'
                  : field === 'assigneeId'
                    ? 'invalidAssignee'
                    : field === 'dueDate'
                      ? 'invalidDate'
                      : 'invalidInput';
            form.setError(
              field as keyof z.infer<typeof schema>,
              { type: 'server', message: t(`tasks.${key}`) },
              { shouldFocus: focus },
            );
            focus = false;
          }
          if (focus) setError(cause);
        } else setError(cause);
      }
      savingRef.current = false;
      submitting(false);
      return;
    }
    // The write succeeded. Navigation and list refresh failures must never become save failures.
    savingRef.current = false;
    submitting(false);
    saved(response.data, !task);
    toaster.show({
      type: 'success',
      title: t(task ? 'tasks.saved' : 'tasks.created', {
        title: response.data.title,
      }),
    });
    if (task) await close();
    else
      await navigate(
        { pathname: '..', search: '' },
        { relative: 'path', replace: true },
      );
  }
  return (
    <form
      id={FORM_ID}
      noValidate
      onSubmit={(event) => void form.handleSubmit(submit)(event)}
      onCompositionStart={() => {
        composingRef.current = true;
      }}
      onCompositionEnd={() => {
        composingRef.current = false;
      }}
      onKeyDown={(event) => {
        if (
          event.key === 'Enter' &&
          (event.nativeEvent.isComposing || composingRef.current)
        )
          event.preventDefault();
      }}
    >
      <FieldGroup>
        {error ? (
          <TaskError
            error={error}
            message={
              gone
                ? t('tasks.missing', { title: task?.title })
                : error instanceof ApiClientError &&
                    [401, 403, 409].includes(error.status)
                  ? undefined
                  : t('tasks.saveFailed')
            }
            retry={conflict ? reload : undefined}
          />
        ) : null}
        {!gone ? (
          <>
            <Controller
              control={form.control}
              name='title'
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor='task-title'>
                    {t('tasks.titleField')}{' '}
                    <span aria-hidden='true' className='text-destructive'>
                      *
                    </span>
                  </FieldLabel>
                  <Input
                    {...field}
                    id='task-title'
                    aria-required='true'
                    aria-invalid={fieldState.invalid}
                    aria-describedby='task-title-error'
                    disabled={form.formState.isSubmitting || conflict}
                  />
                  <FieldError
                    id='task-title-error'
                    errors={[fieldState.error]}
                  />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name='description'
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor='task-description'>
                    {t('tasks.descriptionField')}
                  </FieldLabel>
                  <Textarea
                    {...field}
                    id='task-description'
                    rows={4}
                    aria-invalid={fieldState.invalid}
                    aria-describedby='task-description-error'
                    disabled={form.formState.isSubmitting || conflict}
                  />
                  <FieldError
                    id='task-description-error'
                    errors={[fieldState.error]}
                  />
                </Field>
              )}
            />
            <div className='grid gap-4 sm:grid-cols-2'>
              <Controller
                control={form.control}
                name='assigneeId'
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor='task-assignee'>
                      {t('tasks.assignee')}
                    </FieldLabel>
                    <AssigneePicker
                      disabled={form.formState.isSubmitting || conflict}
                      id='task-assignee'
                      inputRef={field.ref}
                      value={field.value}
                      label={assigneeLabel}
                      onChange={(person) => {
                        field.onChange(person?.id ?? '');
                        setAssigneeLabel(person?.name ?? '');
                      }}
                      invalid={fieldState.invalid}
                      describedBy='task-assignee-error'
                    />
                    <FieldError
                      id='task-assignee-error'
                      errors={[fieldState.error]}
                    />
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name='dueDate'
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor='task-due'>
                      {t('tasks.dueDate')}
                    </FieldLabel>
                    <DatePicker
                      disabled={form.formState.isSubmitting || conflict}
                      id='task-due'
                      inputRef={field.ref}
                      value={field.value}
                      onChange={field.onChange}
                      invalid={fieldState.invalid}
                      describedBy='task-due-error'
                    />
                    <FieldError
                      id='task-due-error'
                      errors={[fieldState.error]}
                    />
                  </Field>
                )}
              />
            </div>
            {task ? (
              <Field>
                <FieldLabel>{t('tasks.status')}</FieldLabel>
                <div>
                  <TaskStatusBadge status={task.status} />
                </div>
              </Field>
            ) : (
              <Controller
                control={form.control}
                name='status'
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel htmlFor='task-status'>
                      {t('tasks.status')}
                    </FieldLabel>
                    <Select
                      disabled={form.formState.isSubmitting || conflict}
                      items={TASK_STATUSES.map((value) => ({
                        value,
                        label: t(`tasks.${value}`),
                      }))}
                      value={field.value}
                      onValueChange={(value) => {
                        if (value) field.onChange(value);
                      }}
                    >
                      <SelectTrigger
                        id='task-status'
                        ref={field.ref}
                        className='w-full'
                        aria-invalid={fieldState.invalid}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className='w-auto max-w-[min(var(--container-sm),var(--available-width))] min-w-(--anchor-width) [&_[data-slot=select-item]>:first-child]:whitespace-normal'>
                        <SelectGroup>
                          {TASK_STATUSES.map((value) => (
                            <SelectItem key={value} value={value}>
                              {t(`tasks.${value}`)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />
            )}
          </>
        ) : null}
      </FieldGroup>
    </form>
  );
}
