/**
 * Unit tests for the Select dropdown component (Task 8.2).
 *
 * These tests fix the observable contract used by BudgetItemTable when it
 * binds the 카테고리 field to the live `Wed_Budget_Category` set:
 *  (a) rendered option values match the `options` prop exactly, in order;
 *  (b) selecting an option emits the option string via `onChange`;
 *  (c) when `placeholder` is provided and `value === ''`, a disabled first
 *      option carrying the placeholder text is rendered before the real
 *      options — the sentinel is not a valid selectable value.
 *
 * Property 9 (design.md § Testing Strategy) is verified structurally in test
 * (a): the option-value set equals the input `options` set at render time.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import { Select } from './Select';

describe('Select', () => {
  it('renders option elements whose values equal the input options array', () => {
    const options = ['웨딩홀', '스드메', '신혼여행'];
    render(
      <Select
        label="카테고리"
        value="웨딩홀"
        onChange={() => {}}
        options={options}
        id="cat"
      />,
    );
    const select = screen.getByLabelText('카테고리') as HTMLSelectElement;
    const rendered = Array.from(select.options).map((o) => o.value);
    expect(rendered).toEqual(options);
  });

  it('emits the selected option string via onChange', () => {
    const onChange = vi.fn();
    const options = ['웨딩홀', '스드메', '신혼여행'];
    render(
      <Select
        label="카테고리"
        value="웨딩홀"
        onChange={onChange}
        options={options}
      />,
    );
    fireEvent.change(screen.getByLabelText('카테고리'), {
      target: { value: '스드메' },
    });
    expect(onChange).toHaveBeenCalledWith('스드메');
  });

  it('renders the placeholder as a disabled first option when value is empty', () => {
    const options = ['웨딩홀', '스드메'];
    render(
      <Select
        label="카테고리"
        value=""
        onChange={() => {}}
        options={options}
        placeholder="카테고리를 선택하세요"
      />,
    );
    const select = screen.getByLabelText('카테고리') as HTMLSelectElement;
    const first = select.options[0];
    expect(first.value).toBe('');
    expect(first.textContent).toBe('카테고리를 선택하세요');
    expect(first.disabled).toBe(true);
    // Real option set (excluding the placeholder sentinel) still matches input.
    const real = Array.from(select.options)
      .slice(1)
      .map((o) => o.value);
    expect(real).toEqual(options);
  });

  it('omits the placeholder option once a real value is selected', () => {
    const options = ['웨딩홀', '스드메'];
    render(
      <Select
        label="카테고리"
        value="웨딩홀"
        onChange={() => {}}
        options={options}
        placeholder="카테고리를 선택하세요"
      />,
    );
    const select = screen.getByLabelText('카테고리') as HTMLSelectElement;
    const rendered = Array.from(select.options).map((o) => o.value);
    expect(rendered).toEqual(options);
  });

  it('wires aria-invalid and aria-describedby when error is set', () => {
    render(
      <Select
        label="카테고리"
        value=""
        onChange={() => {}}
        options={['웨딩홀']}
        error="카테고리를 선택해주세요"
      />,
    );
    const select = screen.getByLabelText('카테고리');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('카테고리를 선택해주세요');
    expect(select.getAttribute('aria-describedby')).toBe(alert.id);
  });
});
