/**
 * Unit tests for the text & form-field component set (Task 8.1).
 *
 * Focus:
 *  - Structural contract: correct element/type, label linkage, className.
 *  - Value semantics for controlled components — especially NumberField's
 *    number | null model and the empty-input → null branch.
 *  - InlineError rendering-vs-hiding behavior (no empty alerts).
 *
 * Task 8.6 (optional) covers deeper computed-style / token assertions; here
 * we validate the JS contract only.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import { PillButton } from './PillButton';
import { TextField } from './TextField';
import { NumberField } from './NumberField';
import { DateField } from './DateField';
import { TimeField } from './TimeField';
import { InlineError } from './InlineError';

describe('PillButton', () => {
  it('defaults to primary variant and type="button"', () => {
    render(<PillButton>확인</PillButton>);
    const btn = screen.getByRole('button', { name: '확인' });
    expect(btn).toHaveClass('pill-primary');
    expect(btn).not.toHaveClass('pill-secondary');
    expect(btn.getAttribute('type')).toBe('button');
  });

  it('uses pill-secondary class when variant="secondary"', () => {
    render(<PillButton variant="secondary">취소</PillButton>);
    const btn = screen.getByRole('button', { name: '취소' });
    expect(btn).toHaveClass('pill-secondary');
    expect(btn).not.toHaveClass('pill-primary');
  });

  it('appends extra className after the variant class', () => {
    render(
      <PillButton className="extra-util">저장</PillButton>,
    );
    const btn = screen.getByRole('button', { name: '저장' });
    expect(btn.className).toBe('pill-primary extra-util');
  });

  it('fires onClick when clicked', () => {
    const onClick = vi.fn();
    render(<PillButton onClick={onClick}>추가</PillButton>);
    fireEvent.click(screen.getByRole('button', { name: '추가' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('TextField', () => {
  it('renders labeled text input with linked htmlFor/id', () => {
    render(<TextField label="장소" value="" onChange={() => {}} id="place" />);
    const input = screen.getByLabelText('장소') as HTMLInputElement;
    expect(input.type).toBe('text');
    expect(input.id).toBe('place');
    expect(input.value).toBe('');
  });

  it('emits raw string via onChange', () => {
    const onChange = vi.fn();
    render(<TextField label="장소" value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('장소'), { target: { value: '서울' } });
    expect(onChange).toHaveBeenCalledWith('서울');
  });

  it('renders InlineError with aria linkage when error is set', () => {
    render(
      <TextField label="장소" value="" onChange={() => {}} error="필수 입력입니다" />,
    );
    const input = screen.getByLabelText('장소');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('필수 입력입니다');
    expect(input.getAttribute('aria-describedby')).toBe(alert.id);
  });
});

describe('NumberField', () => {
  it('renders empty string when value is null', () => {
    render(<NumberField label="결제금액" value={null} onChange={() => {}} id="amt" />);
    const input = screen.getByLabelText('결제금액') as HTMLInputElement;
    expect(input.type).toBe('number');
    expect(input.value).toBe('');
    expect(input.getAttribute('min')).toBe('0');
    expect(input.getAttribute('step')).toBe('1');
  });

  it('emits null when the input is cleared', () => {
    const onChange = vi.fn();
    render(<NumberField label="결제금액" value={1000} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('결제금액'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('emits a number when a numeric value is entered', () => {
    const onChange = vi.fn();
    render(<NumberField label="결제금액" value={null} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('결제금액'), { target: { value: '42000' } });
    expect(onChange).toHaveBeenCalledWith(42000);
  });
});

describe('DateField', () => {
  it('renders type="date" with the ISO value verbatim', () => {
    const onChange = vi.fn();
    render(<DateField label="날짜" value="2026-07-15" onChange={onChange} id="d" />);
    const input = screen.getByLabelText('날짜') as HTMLInputElement;
    expect(input.type).toBe('date');
    expect(input.value).toBe('2026-07-15');
    fireEvent.change(input, { target: { value: '2026-07-16' } });
    expect(onChange).toHaveBeenCalledWith('2026-07-16');
  });
});

describe('TimeField', () => {
  it('renders type="time" with the HH:MM value verbatim', () => {
    const onChange = vi.fn();
    render(<TimeField label="시간" value="14:30" onChange={onChange} id="t" />);
    const input = screen.getByLabelText('시간') as HTMLInputElement;
    expect(input.type).toBe('time');
    expect(input.value).toBe('14:30');
    fireEvent.change(input, { target: { value: '09:00' } });
    expect(onChange).toHaveBeenCalledWith('09:00');
  });
});

describe('InlineError', () => {
  it('renders nothing when children is empty', () => {
    const { container } = render(<InlineError>{''}</InlineError>);
    expect(container.firstChild).toBeNull();
  });

  it('renders an alert with the message when children is non-empty', () => {
    render(<InlineError>비밀번호가 일치하지 않습니다</InlineError>);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('inline-error');
    expect(alert).toHaveTextContent('비밀번호가 일치하지 않습니다');
  });

  it('does not render for null or undefined children', () => {
    const { container: c1 } = render(<InlineError>{null}</InlineError>);
    expect(c1.firstChild).toBeNull();
    const { container: c2 } = render(<InlineError />);
    expect(c2.firstChild).toBeNull();
  });
});
