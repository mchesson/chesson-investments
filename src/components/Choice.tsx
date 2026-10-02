// A short list of choices as buttons (owner, Oct 2, 2026: buttons and colors,
// not dropdowns). Radio inputs styled as pills: works in any form, no script,
// keyboard arrows move between them.
export function Choice({ name, label, hint, options, defaultValue, required, color = 'blue' }: {
  name: string; label: string; hint?: string; options: readonly { key: string; label: string }[];
  defaultValue?: string | null; required?: boolean; color?: 'blue' | 'aqua' | 'energy';
}) {
  return (
    <fieldset className="f choice" data-c={color}>
      <legend>{label}{hint ? <span className="h">{hint}</span> : null}</legend>
      <div className="choice-opts">
        {options.map((o) => (
          <label key={o.key} className="choice-opt">
            <input type="radio" name={name} value={o.key} defaultChecked={(defaultValue ?? '') === o.key} required={required} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
