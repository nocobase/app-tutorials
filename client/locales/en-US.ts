import type { LocaleResource } from '@nocobase/i18n';

import systemEnUS from './system/en-US.js';

const enUS = {
  // The template's own copy: the shell, the sign-in pages, shared components and the homepage. Keep it in
  // `./system/` so a template upgrade can replace it without touching the application's copy below.
  ...systemEnUS,
  // The application's copy goes here, one group per feature. A shared group such as `navigation` is extended by
  // spreading the system one first, `navigation: { ...systemEnUS.navigation, orders: 'Orders' }`, since a group
  // written here replaces the system group of the same name rather than merging with it.
  tasks: {
    dueDate: 'Due date',
    noDueDate: 'No due date',
    dueDateHelp: 'Optional. Choose a calendar date, without a time.',
    dueDateInvalid: 'Choose a valid date.',
    clearDueDate: 'Clear date',

    search: 'Search by title',
    allStatuses: 'All statuses',
    clearFilters: 'Clear filters',
    noResults: 'No tasks match your filters.',

    assignee: 'Assignee',
    unassigned: 'Unassigned',
    assigneeUnavailable: 'User unavailable',
    assigneeInvalid:
      'This user is unavailable. Choose another user or leave the task unassigned.',
    assigneeHelp: 'Choose an enabled user, or leave the task unassigned.',
    assigneeCap: 'Only the first 100 enabled users are listed in this example.',

    readPermission: 'View tasks',
    updatePermission: 'Complete or reopen tasks',
    title: 'Tasks',
    description: 'Create tasks and keep track of what is done.',
    new: 'New task',
    create: 'Create',
    cancel: 'Cancel',
    taskTitle: 'Title',
    status: 'Status',
    actions: 'Actions',
    pending: 'Pending',
    completed: 'Completed',
    complete: 'Complete',
    reopen: 'Reopen',
    emptyTitle: 'No tasks yet',
    emptyDescription: 'Create your first task to start tracking your work.',
    askAdmin: 'Ask an administrator for permission to create tasks.',
    formDescription: 'Give this task a short, clear title.',
    required: 'Enter a task title.',
    tooLong: 'Use no more than 120 characters.',
    created: 'Created "{{title}}".',
    updated: 'Updated "{{title}}".',
    loading: 'Loading',
    retry: 'Retry',
    signIn: 'Sign in again',
    sessionExpired: 'Your session ended. Sign in again to continue.',
    forbidden: 'You do not have permission. Contact an administrator.',
    notFound: 'This task no longer exists. The list will refresh.',
    invalidInput: 'Check the task title and try again.',
    requestFailed: 'The request failed. Please try again.',
  },
};

/**
 * The shape every locale of this application follows, derived from the English wording above.
 *
 * Anything a plugin does not translate falls back to this namespace, so a term defined here is reused everywhere
 * without each plugin repeating it.
 */
export type AppResource = LocaleResource<typeof enUS>;

export default enUS;
