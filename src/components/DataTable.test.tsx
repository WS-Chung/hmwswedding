/**
 * Unit tests for <DataTable> (Task 8.3).
 *
 * Coverage:
 *  - Renders column headers and each row's cells (view mode).
 *  - Clicking 편집 puts the target row into edit mode and 저장 forwards the
 *    accumulated patch to `onSaveEdit(id, patch)`.
 *  - Clicking 삭제 opens the confirm dialog; 확인 forwards `onDelete(id)`.
 *  - When `onSaveEdit` rejects, the row stays in edit mode and `onError`
 *    is invoked (preserves "이전 상태 유지" contract, design § 에러 처리
 *    원칙 / Requirement 2.12).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { DataTable } from './DataTable';

interface FakeRow {
  Wed_id: string;
  Wed_name: string;
  Wed_note: string | null;
}

const rows: FakeRow[] = [
  { Wed_id: 'a-1', Wed_name: '홀 A', Wed_note: '메모 A' },
  { Wed_id: 'b-2', Wed_name: '홀 B', Wed_note: null },
];

const columns = [
  { key: 'Wed_name' as const, header: '이름' },
  { key: 'Wed_note' as const, header: '메모' },
];

describe('DataTable — rendering', () => {
  it('renders each column header and each row', () => {
    render(<DataTable<FakeRow> rows={rows} columns={columns} />);
    expect(screen.getByRole('columnheader', { name: '이름' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '메모' })).toBeInTheDocument();
    expect(screen.getByText('홀 A')).toBeInTheDocument();
    expect(screen.getByText('홀 B')).toBeInTheDocument();
    expect(screen.getByText('메모 A')).toBeInTheDocument();
  });

  it('renders the empty message when rows is empty', () => {
    render(
      <DataTable<FakeRow>
        rows={[]}
        columns={columns}
        emptyMessage="비어 있음"
      />,
    );
    expect(screen.getByText('비어 있음')).toBeInTheDocument();
  });

  it('renders a top-right 추가 button only when onAdd is provided', () => {
    const onAdd = vi.fn();
    const { rerender, container } = render(
      <DataTable<FakeRow> rows={rows} columns={columns} />,
    );
    // Without onAdd: no toolbar.
    expect(container.querySelector('.data-table-toolbar')).toBeNull();

    rerender(
      <DataTable<FakeRow> rows={rows} columns={columns} onAdd={onAdd} />,
    );
    const toolbar = container.querySelector('.data-table-toolbar');
    expect(toolbar).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '추가' }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});

describe('DataTable — inline edit', () => {
  it('clicking 편집 puts the row into edit mode; 저장 calls onSaveEdit with patch', async () => {
    const onSaveEdit = vi.fn().mockResolvedValue(undefined);
    render(
      <DataTable<FakeRow>
        rows={rows}
        columns={columns}
        onSaveEdit={onSaveEdit}
      />,
    );

    // There are two edit buttons (one per row); click the first row's.
    const editButtons = screen.getAllByRole('button', { name: '편집' });
    fireEvent.click(editButtons[0]);

    // The row is now in edit mode: inputs appear labeled with column headers.
    const nameInput = screen.getByLabelText('이름') as HTMLInputElement;
    const noteInput = screen.getByLabelText('메모') as HTMLInputElement;
    expect(nameInput.value).toBe('홀 A');
    expect(noteInput.value).toBe('메모 A');

    // Edit the name field.
    fireEvent.change(nameInput, { target: { value: '홀 A - 수정' } });
    expect((screen.getByLabelText('이름') as HTMLInputElement).value).toBe(
      '홀 A - 수정',
    );

    // Click 저장.
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(onSaveEdit).toHaveBeenCalledTimes(1);
    });
    expect(onSaveEdit).toHaveBeenCalledWith('a-1', {
      Wed_name: '홀 A - 수정',
    });

    // After success the row leaves edit mode: the input for 이름 disappears.
    await waitFor(() => {
      expect(screen.queryByLabelText('이름')).toBeNull();
    });
    // And the edit/delete controls are back.
    expect(screen.getAllByRole('button', { name: '편집' })).toHaveLength(2);
  });

  it('취소 restores the row without invoking onSaveEdit', () => {
    const onSaveEdit = vi.fn();
    render(
      <DataTable<FakeRow>
        rows={rows}
        columns={columns}
        onSaveEdit={onSaveEdit}
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: '편집' })[0]);
    const nameInput = screen.getByLabelText('이름') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'DIRTY' } });

    fireEvent.click(screen.getByRole('button', { name: '취소' }));

    // Edit mode dismissed — inputs gone, original value still shown.
    expect(screen.queryByLabelText('이름')).toBeNull();
    expect(screen.getByText('홀 A')).toBeInTheDocument();
    expect(onSaveEdit).not.toHaveBeenCalled();
  });

  it('failed save keeps the row in edit mode and calls onError', async () => {
    const onSaveEdit = vi
      .fn()
      .mockRejectedValue(new Error('네트워크 오류'));
    const onError = vi.fn();
    render(
      <DataTable<FakeRow>
        rows={rows}
        columns={columns}
        onSaveEdit={onSaveEdit}
        onError={onError}
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: '편집' })[0]);
    fireEvent.change(screen.getByLabelText('이름'), {
      target: { value: '변경값' },
    });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('네트워크 오류');
    });

    // Row remains in edit mode.
    const nameInput = screen.getByLabelText('이름') as HTMLInputElement;
    expect(nameInput.value).toBe('변경값');
    // 저장 / 취소 controls still visible.
    expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '취소' })).toBeInTheDocument();
  });
});

describe('DataTable — delete', () => {
  it('clicking 삭제 opens the confirm dialog; 확인 calls onDelete', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(
      <DataTable<FakeRow>
        rows={rows}
        columns={columns}
        onDelete={onDelete}
      />,
    );

    // No dialog initially.
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getAllByRole('button', { name: '삭제' })[1]);

    // Dialog appears with the confirmation message.
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent('정말 삭제하시겠습니까?');

    fireEvent.click(screen.getByRole('button', { name: '확인' }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('b-2');
    });
    // Dialog closes.
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('취소 in the dialog closes it without calling onDelete', () => {
    const onDelete = vi.fn();
    render(
      <DataTable<FakeRow>
        rows={rows}
        columns={columns}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: '삭제' })[0]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('failed delete closes the dialog and calls onError', async () => {
    const onDelete = vi.fn().mockRejectedValue(new Error('삭제 실패'));
    const onError = vi.fn();
    render(
      <DataTable<FakeRow>
        rows={rows}
        columns={columns}
        onDelete={onDelete}
        onError={onError}
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: '삭제' })[0]);
    fireEvent.click(screen.getByRole('button', { name: '확인' }));

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('삭제 실패');
    });
    // Dialog closed even on failure (parent will re-fetch to restore state).
    expect(screen.queryByRole('dialog')).toBeNull();
    // Rows still displayed (parent controls state; DataTable never mutates them).
    expect(screen.getByText('홀 A')).toBeInTheDocument();
    expect(screen.getByText('홀 B')).toBeInTheDocument();
  });
});

describe('DataTable — custom renderers', () => {
  it('uses render() for view-mode cells when provided', () => {
    render(
      <DataTable<FakeRow>
        rows={rows}
        columns={[
          {
            key: 'Wed_name',
            header: '이름',
            render: (row) => <strong data-testid="name-cell">★{row.Wed_name}★</strong>,
          },
        ]}
      />,
    );
    const cells = screen.getAllByTestId('name-cell');
    expect(cells[0]).toHaveTextContent('★홀 A★');
    expect(cells[1]).toHaveTextContent('★홀 B★');
  });

  it('uses renderEdit() for edit-mode cells when provided', () => {
    const onSaveEdit = vi.fn().mockResolvedValue(undefined);
    render(
      <DataTable<FakeRow>
        rows={rows}
        columns={[
          {
            key: 'Wed_name',
            header: '이름',
            renderEdit: (row, patch, setPatch) => (
              <input
                data-testid="custom-editor"
                value={
                  'Wed_name' in patch
                    ? (patch.Wed_name ?? '')
                    : row.Wed_name
                }
                onChange={(e) =>
                  setPatch({ ...patch, Wed_name: e.target.value.toUpperCase() })
                }
              />
            ),
          },
        ]}
        onSaveEdit={onSaveEdit}
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: '편집' })[0]);
    const editor = screen.getByTestId('custom-editor') as HTMLInputElement;
    fireEvent.change(editor, { target: { value: 'abc' } });
    // The custom renderer uppercased the value.
    expect(
      (screen.getByTestId('custom-editor') as HTMLInputElement).value,
    ).toBe('ABC');
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    return waitFor(() => {
      expect(onSaveEdit).toHaveBeenCalledWith('a-1', { Wed_name: 'ABC' });
    });
  });
});
