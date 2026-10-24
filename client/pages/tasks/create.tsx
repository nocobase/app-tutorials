import { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ApiClientError, useApiClient, useToaster } from '@nocobase/app-client';
import { useTranslation } from '@nocobase/i18n/client';
import { RouteDialog } from '#components/route-dialog';
import { useRouteOverlay } from '#components/use-route-overlay';
import { Button } from '#components/ui/button';
import { Field, FieldLabel, FieldError } from '#components/ui/field';
import { Input } from '#components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#components/ui/select';
import { Spinner } from '#components/ui/spinner';
import { TaskError } from './error.js';
import type { Task, TasksContext } from './types.js';

const FORM_ID = 'tutorial-task-create';
const fieldErrorPayload = z.object({
  error: z.object({
    fieldViolations: z.array(
      z.object({ field: z.string(), reason: z.string().optional() }),
    ),
  }),
});

export default function CreateTaskPage() {
  const { t } = useTranslation();
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  function submitting(value: boolean) {
    pendingRef.current = value;
    setPending(value);
  }
  return (
    <RouteDialog
      title={t('tasks.new')}
      description={t('tasks.formDescription')}
      className='sm:max-w-md'
      beforeClose={() => !pendingRef.current}
      footer={<Footer pending={pending} />}
    >
      <TaskForm submitting={submitting} />
    </RouteDialog>
  );
}

function TaskForm({ submitting }: { submitting: (value: boolean) => void }) {
  const { t } = useTranslation();
  const api = useApiClient();
  const toaster = useToaster();
  const { close } = useRouteOverlay();
  const { saved } = useOutletContext<TasksContext>();
  const [error, setError] = useState<unknown>();
  const composingRef = useRef(false);
  const [assignees, setAssignees] = useState<{
    data: { id: string; name: string }[];
    meta: { total: number };
  }>();
  const [assigneeError, setAssigneeError] = useState<unknown>();
  const [assigneeRevision, setAssigneeRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void api
      .request<{
        data: { id: string; name: string }[];
        meta: { total: number };
      }>({ path: 'tutorialTasks/assignees', signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted) setAssignees(value);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setAssigneeError(cause);
      });
    return () => controller.abort();
  }, [api, assigneeRevision]);
  const form = useForm<{ title: string; assigneeId: string | null }>({
    resolver: zodResolver(
      z.object({
        title: z
          .string()
          .trim()
          .min(1, t('tasks.required'))
          .max(120, t('tasks.tooLong')),
        assigneeId: z.string().nullable(),
      }),
    ),
    defaultValues: { title: '', assigneeId: null },
  });

  useEffect(() => {
    if (form.formState.errors.assigneeId && !form.formState.isSubmitting)
      form.setFocus('assigneeId');
  }, [form, form.formState.errors.assigneeId, form.formState.isSubmitting]);

  async function submit(values: { title: string; assigneeId: string | null }) {
    if (composingRef.current) return;
    submitting(true);
    setError(undefined);
    try {
      const response = await api.request<{ data: Task }>({
        path: 'tutorialTasks',
        method: 'POST',
        json: values,
      });
      saved(response.data, true);
      toaster.show({
        type: 'success',
        title: t('tasks.created', { title: response.data.title }),
      });
      submitting(false);
      await close();
    } catch (cause: unknown) {
      const parsed =
        cause instanceof ApiClientError && cause.status === 400
          ? fieldErrorPayload.safeParse(cause.payload)
          : undefined;
      const violation = parsed?.success
        ? parsed.data.error.fieldViolations.find(
            (item) => item.field === 'title' || item.field === 'assigneeId',
          )
        : undefined;
      if (violation?.field === 'assigneeId') {
        form.setError('assigneeId', {
          type: 'server',
          message: t('tasks.assigneeInvalid'),
        });
      } else if (violation) {
        const key =
          violation.reason === 'too_small'
            ? 'tasks.required'
            : violation.reason === 'too_big'
              ? 'tasks.tooLong'
              : 'tasks.invalidInput';
        form.setError(
          'title',
          { type: 'server', message: t(key) },
          { shouldFocus: true },
        );
      } else {
        setError(cause);
      }
    } finally {
      submitting(false);
    }
  }

  return (
    <form
      id={FORM_ID}
      noValidate
      onSubmit={(event) => {
        void form.handleSubmit(submit)(event);
      }}
      className='flex flex-col gap-4'
      onKeyDown={(event) => {
        if (
          event.key === 'Enter' &&
          (event.nativeEvent.isComposing || composingRef.current)
        )
          event.preventDefault();
      }}
    >
      {error ? <TaskError error={error} /> : null}
      <Field data-invalid={!!form.formState.errors.title}>
        <FieldLabel htmlFor='tutorial-task-title'>
          {t('tasks.taskTitle')} *
        </FieldLabel>
        <Input
          id='tutorial-task-title'
          autoComplete='off'
          aria-required
          aria-invalid={!!form.formState.errors.title}
          aria-describedby={
            form.formState.errors.title
              ? 'tutorial-task-title-error'
              : undefined
          }
          readOnly={form.formState.isSubmitting}
          {...form.register('title')}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onCompositionEnd={() => {
            composingRef.current = false;
          }}
        />
        {form.formState.errors.title ? (
          <FieldError id='tutorial-task-title-error'>
            {form.formState.errors.title.message}
          </FieldError>
        ) : null}
      </Field>
      <Field data-invalid={!!form.formState.errors.assigneeId}>
        <FieldLabel htmlFor='tutorial-task-assignee'>
          {t('tasks.assignee')}
        </FieldLabel>
        <Controller
          control={form.control}
          name='assigneeId'
          render={({ field }) => (
            <Select
              value={field.value ?? ''}
              onValueChange={(value) => {
                field.onChange(value || null);
                form.clearErrors('assigneeId');
              }}
              disabled={form.formState.isSubmitting}
            >
              <SelectTrigger
                id='tutorial-task-assignee'
                ref={field.ref}
                onBlur={field.onBlur}
                className='w-full'
                aria-invalid={!!form.formState.errors.assigneeId}
                aria-describedby={
                  form.formState.errors.assigneeId
                    ? 'tutorial-task-assignee-error'
                    : 'tutorial-task-assignee-help'
                }
              >
                <SelectValue>
                  {field.value
                    ? (assignees?.data.find((user) => user.id === field.value)
                        ?.name ?? t('tasks.assigneeUnavailable'))
                    : t('tasks.unassigned')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=''>{t('tasks.unassigned')}</SelectItem>
                {assignees?.data.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <p
          id='tutorial-task-assignee-help'
          className='text-sm text-muted-foreground'
        >
          {t('tasks.assigneeHelp')}
        </p>
        {form.formState.errors.assigneeId ? (
          <FieldError id='tutorial-task-assignee-error'>
            {form.formState.errors.assigneeId.message}
          </FieldError>
        ) : null}
        {!assignees && !assigneeError ? (
          <p role='status' className='text-sm text-muted-foreground'>
            {t('tasks.loading')}
          </p>
        ) : null}
        {assigneeError ? (
          <TaskError
            error={assigneeError}
            retry={() => {
              setAssigneeError(undefined);
              setAssigneeRevision((value) => value + 1);
            }}
          />
        ) : null}
        {assignees && assignees.meta.total > 100 ? (
          <p className='text-sm text-muted-foreground'>
            {t('tasks.assigneeCap')}
          </p>
        ) : null}
      </Field>
    </form>
  );
}

function Footer({ pending }: { pending: boolean }) {
  const { t } = useTranslation();
  const { close } = useRouteOverlay();
  return (
    <>
      <Button
        type='button'
        variant='outline'
        disabled={pending}
        onClick={() => void close()}
      >
        {t('tasks.cancel')}
      </Button>
      <Button type='submit' form={FORM_ID} disabled={pending}>
        {pending ? <Spinner data-icon='inline-start' /> : null}
        {t('tasks.create')}
      </Button>
    </>
  );
}
