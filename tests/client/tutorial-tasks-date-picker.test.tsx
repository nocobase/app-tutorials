import { useState } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, test } from 'vitest';
import { format } from 'date-fns';
import { enUS, zhCN } from 'react-day-picker/locale';
import { DatePicker } from '../../client/components/date-picker.js';

afterEach(cleanup);

function Harness({ chinese = false }: { chinese?: boolean }) {
  const [value, setValue] = useState<Date | undefined>(
    () => new Date(2028, 1, 29),
  );
  return (
    <>
      <label htmlFor='due-date'>Due date</label>
      <DatePicker
        id='due-date'
        value={value}
        onChange={setValue}
        locale={chinese ? zhCN : enUS}
        placeholder='No due date'
        clearLabel='Clear date'
      />
      <output>{value ? format(value, 'yyyy-MM-dd') : 'null'}</output>
    </>
  );
}

test('keeps a calendar date across selection and supports clearing and keyboard dismissal', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  const trigger = screen.getByLabelText('Due date');
  expect(trigger).toHaveTextContent('February 29th, 2028');
  await user.click(trigger);
  await user.click(
    screen.getByRole('button', { name: /Monday, February 28th, 2028/ }),
  );
  expect(screen.getByRole('status')).toHaveTextContent('2028-02-28');
  await waitFor(() => expect(trigger).toHaveFocus());
  await user.click(trigger);
  await user.keyboard('{Escape}');
  await waitFor(() => expect(trigger).toHaveFocus());
  expect(screen.getByRole('status')).toHaveTextContent('2028-02-28');
  await user.click(trigger);
  await user.click(screen.getByRole('button', { name: 'Clear date' }));
  expect(screen.getByRole('status')).toHaveTextContent('null');
  expect(trigger).toHaveTextContent('No due date');
});

test('localizes the calendar and its navigation', async () => {
  const user = userEvent.setup();
  render(<Harness chinese />);
  expect(screen.getByLabelText('Due date')).toHaveTextContent('2028年2月29日');
  await user.click(screen.getByLabelText('Due date'));
  expect(
    screen.queryByRole('button', { name: /Go to the next month/ }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('grid')).toHaveAccessibleName(/2028/);
});
