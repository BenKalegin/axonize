import { ReactNode, ChangeEvent } from 'react'

interface FormFieldProps {
  /** Field label */
  label: string
  /** Field content */
  children: ReactNode
  /** Optional CSS class for the field container */
  className?: string
  /** Optional CSS class for the label */
  labelClassName?: string
}

/**
 * Reusable form field wrapper with label
 */
export function FormField({
  label,
  children,
  className = 'settings-field',
  labelClassName,
}: FormFieldProps) {
  return (
    <div className={className}>
      <label className={labelClassName}>{label}</label>
      {children}
    </div>
  )
}

interface TextFieldProps {
  /** Field label */
  label: string
  /** Input type (default: 'text') */
  type?: 'text' | 'password' | 'number' | 'email' | 'url'
  /** Current value */
  value: string | number
  /** Change handler */
  onChange: (value: string) => void
  /** Placeholder text */
  placeholder?: string
  /** Whether the field is disabled */
  disabled?: boolean
  /** Minimum value (for number inputs) */
  min?: number
  /** Maximum value (for number inputs) */
  max?: number
  /** Step value (for number inputs) */
  step?: number
  /** Optional CSS class for the field container */
  className?: string
  /** Optional CSS class for the input */
  inputClassName?: string
}

/**
 * Text input field with label
 */
export function TextField({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  disabled = false,
  min,
  max,
  step,
  className = 'settings-field',
  inputClassName = 'settings-input',
}: TextFieldProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
  }

  return (
    <FormField label={label} className={className}>
      <input
        className={inputClassName}
        type={type}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
      />
    </FormField>
  )
}

interface SelectFieldProps {
  /** Field label */
  label: string
  /** Current value */
  value: string
  /** Change handler */
  onChange: (value: string) => void
  /** Select options */
  options: Array<{ value: string; label: string }>
  /** Whether the field is disabled */
  disabled?: boolean
  /** Optional CSS class for the field container */
  className?: string
  /** Optional CSS class for the select */
  selectClassName?: string
}

/**
 * Select dropdown field with label
 */
export function SelectField({
  label,
  value,
  onChange,
  options,
  disabled = false,
  className = 'settings-field',
  selectClassName = 'settings-select',
}: SelectFieldProps) {
  const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value)
  }

  return (
    <FormField label={label} className={className}>
      <select
        className={selectClassName}
        value={value}
        onChange={handleChange}
        disabled={disabled}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FormField>
  )
}
