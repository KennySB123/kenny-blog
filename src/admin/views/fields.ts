import { h } from '../dom';
import type { Field } from '../platforms';

/** Render one option field. `onChange` receives the parsed value. */
export function renderField(field: Field, value: unknown, onChange: (v: unknown) => void, opts: { overridden?: boolean; onReset?: () => void } = {}) {
  const id = `f-${Math.random().toString(36).slice(2, 9)}`;
  let control: HTMLElement;
  switch (field.type) {
    case 'select':
      control = h(
        'select',
        { id, class: 'input', onchange: (e: Event) => onChange((e.target as HTMLSelectElement).value) },
        (field.options ?? []).map(([v, label]) => h('option', { value: v, selected: v === value }, label))
      );
      break;
    case 'textarea':
      control = h('textarea', { id, class: 'input', rows: 3, oninput: (e: Event) => onChange((e.target as HTMLTextAreaElement).value) });
      (control as HTMLTextAreaElement).value = String(value ?? '');
      break;
    case 'number':
      control = h('input', {
        id,
        class: 'input input-narrow',
        type: 'number',
        min: field.min,
        max: field.max,
        step: field.step,
        value: String(value ?? ''),
        onchange: (e: Event) => onChange(Number((e.target as HTMLInputElement).value)),
      });
      break;
    case 'checkbox':
      control = h('input', { id, type: 'checkbox', checked: value === true, onchange: (e: Event) => onChange((e.target as HTMLInputElement).checked) });
      return h(
        'div',
        { class: 'field field-check' },
        control,
        h('label', { for: id }, field.label, opts.overridden ? overrideMark(opts.onReset) : null),
        field.hint ? h('p', { class: 'hint' }, field.hint) : null
      );
    default:
      control = h('input', { id, class: 'input', type: 'text', value: String(value ?? ''), oninput: (e: Event) => onChange((e.target as HTMLInputElement).value) });
  }
  return h(
    'div',
    { class: 'field' },
    h('label', { for: id }, field.label, opts.overridden ? overrideMark(opts.onReset) : null),
    control,
    field.hint ? h('p', { class: 'hint' }, field.hint) : null
  );
}

function overrideMark(onReset?: () => void) {
  return h(
    'span',
    { class: 'override' },
    ' · this essay only',
    onReset ? h('button', { type: 'button', class: 'linklike', onclick: (e: Event) => (e.preventDefault(), onReset()) }, 'reset') : null
  );
}

export function toggle(label: string, checked: boolean, onChange: (v: boolean) => void) {
  const input = h('input', { type: 'checkbox', role: 'switch', checked, onchange: () => onChange(input.checked) });
  return h('label', { class: 'switch' }, input, h('span', { class: 'switch-track', 'aria-hidden': 'true' }), h('span', { class: 'switch-label' }, label));
}
