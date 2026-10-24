import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import { expect, test } from 'vitest';
import { useUrlSearch } from '../../client/hooks/use-url-search.js';

function SearchHarness() {
  const search = useUrlSearch({ resetParams: ['page'], delay: 20 });
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <input aria-label='Search' {...search.inputProps} />
      <output data-testid='url'>{location.search}</output>
      <button
        onClick={() =>
          search.updateParams((p) => {
            p.set('status', 'pending');
            p.delete('page');
          })
        }
      >
        Pending
      </button>
      <button onClick={() => search.clear((p) => p.delete('status'))}>
        Clear
      </button>
      <button onClick={() => navigate('?q=restored&page=2')}>Navigate</button>
    </>
  );
}

test('keeps composed text, concurrent filters and navigation in sync without mocking the router', async () => {
  render(
    <MemoryRouter initialEntries={['/tasks?page=3&pageSize=20']}>
      <SearchHarness />
    </MemoryRouter>,
  );
  const input = screen.getByRole('textbox', { name: 'Search' });
  fireEvent.compositionStart(input);
  fireEvent.input(input, { target: { value: 'renwu' }, isComposing: true });
  await new Promise((resolve) => setTimeout(resolve, 40));
  expect(screen.getByTestId('url').textContent).toBe('?page=3&pageSize=20');
  fireEvent.input(input, { target: { value: '任务' }, isComposing: true });
  fireEvent.compositionEnd(input, { data: '任务' });
  fireEvent.click(screen.getByRole('button', { name: 'Pending' }));
  await waitFor(() =>
    expect(
      new URLSearchParams(screen.getByTestId('url').textContent ?? '').get('q'),
    ).toBe('任务'),
  );
  let params = new URLSearchParams(screen.getByTestId('url').textContent ?? '');
  expect(params.get('status')).toBe('pending');
  expect(params.get('pageSize')).toBe('20');
  expect(params.has('page')).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Navigate' }));
  expect(input).toHaveValue('restored');
  fireEvent.change(input, { target: { value: 'stale' } });
  fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
  await new Promise((resolve) => setTimeout(resolve, 40));
  expect(input).toHaveValue('');
  params = new URLSearchParams(screen.getByTestId('url').textContent ?? '');
  expect(params.has('q')).toBe(false);
  expect(params.has('status')).toBe(false);
});
