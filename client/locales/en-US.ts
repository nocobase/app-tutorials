import type { LocaleResource } from '@nocobase/i18n';

import systemEnUS from './system/en-US.js';

const enUS = {
  // The template's own copy: the shell, the sign-in pages, shared components and the homepage. Keep it in
  // `./system/` so a template upgrade can replace it without touching the application's copy below.
  ...systemEnUS,
  actions: { ...systemEnUS.actions, signInAgain: 'Sign in again' },
  status: {
    sessionExpired: 'Your session has ended. Sign in again to continue.',
  },
  tasks: {
    title: 'Tasks',
    description: 'Plan work, assign owners and follow progress.',
    new: 'New task',
    editTitle: 'Edit task',
    titleField: 'Title',
    descriptionField: 'Description',
    status: 'Status',
    assignee: 'Assignee',
    dueDate: 'Due date',
    updatedAt: 'Updated',
    todo: 'To do',
    inProgress: 'In progress',
    done: 'Done',
    allStatuses: 'All statuses',
    allTasks: 'All tasks',
    mine: 'Assigned to me',
    search: 'Search by title…',
    clear: 'Clear filters',
    unassigned: 'Unassigned',
    noDate: 'No due date',
    unavailable: 'Unavailable user',
    chooseDate: 'Choose a date',
    clearDate: 'Clear date',
    searchPeople: 'Search by name…',
    empty: 'No tasks yet',
    emptyHelp: "Create a task to start planning your team's work.",
    emptyReadOnly:
      'Ask an administrator to create tasks or assign work to you.',
    noResults: 'No matching tasks',
    noResultsHelp: 'Try another search or clear the filters.',
    required: 'Enter a title.',
    tooLong: 'Use 120 characters or fewer.',
    descriptionLong: 'Use 2,000 characters or fewer.',
    invalidDate: 'Choose a valid date.',
    invalidAssignee: 'Choose an active user or leave unassigned.',
    created: 'Created task "{{title}}"',
    saved: 'Saved task "{{title}}"',
    progressSaved: 'Updated task "{{title}}"',
    deleted: 'Deleted task "{{title}}"',
    deleteTitle: 'Delete task "{{title}}"?',
    deleteDescription:
      'This task will be permanently deleted. This cannot be undone.',
    missing:
      'Task "{{title}}" no longer exists or is outside your access. Close this view to return to the list.',
    missingToast: 'Task "{{title}}" is no longer available.',
    refreshFailed:
      'Your changes were saved, but the list could not refresh. Retry loading the list.',
    loadFailed: 'Could not load tasks. Please retry.',
    saveFailed: 'Could not save. Your changes are still here; please retry.',
    denied:
      'You do not have permission for this action. Ask an administrator for access.',
    noRead: 'You cannot view the task list. Ask an administrator for access.',
    conflict:
      'This task changed while you were editing. Reload the latest version before saving again.',
    progressConflict:
      'Task "{{title}}" changed. Review its current status and choose again.',
    progressFailed: 'Could not update task "{{title}}". Please retry.',
    actionMenu: 'Actions for {{title}}',
    changeProgress: 'Change status',
    manager: 'Task manager',
    member: 'Task member',
    reader: 'Task reader',
    assignedScope: 'Tasks assigned to the current user',
    read: 'View tasks',
    createPermission: 'Create tasks',
    editPermission: 'Edit details and assignment',
    progressPermission: 'Update status',
    deletePermission: 'Delete tasks',
    create: 'Create',
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
    edit: 'Edit',
    delete: 'Delete',
    retry: 'Retry',
    reload: 'Reload latest version',
    loading: 'Loading',
    noPeople: 'No matching users',
    peopleFailed: 'Could not load users. Please retry.',
    previous: 'Previous',
    next: 'Next',
    page: 'Page {{page}}',
    invalidInput: 'Check this value and try again.',
    overdue: 'Overdue',
    discardTitle: 'Discard unsaved changes?',
    discardHelp: 'Your changes will be lost.',
    discard: 'Discard',
    keepEditing: 'Keep editing',
  },
  // The application's copy goes here, one group per feature. A shared group such as `navigation` is extended by
  // spreading the system one first, `navigation: { ...systemEnUS.navigation, orders: 'Orders' }`, since a group
  // written here replaces the system group of the same name rather than merging with it.
};

/**
 * The shape every locale of this application follows, derived from the English wording above.
 *
 * Anything a plugin does not translate falls back to this namespace, so a term defined here is reused everywhere
 * without each plugin repeating it.
 */
export type AppResource = LocaleResource<typeof enUS>;

export default enUS;
