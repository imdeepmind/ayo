import { forwardRef, type InputHTMLAttributes } from 'react';

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  id: string;
  error?: string;
};

const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ label, id, error, className = '', ...rest }, ref) => {
    return (
      <div className="space-y-1">
        <label
          htmlFor={id}
          className="block text-sm font-medium text-slate-700 dark:text-slate-200"
        >
          {label}
        </label>
        <input
          id={id}
          ref={ref}
          className={`w-full rounded-lg border ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-slate-300 focus:border-sky-500 focus:ring-sky-500'} bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:ring-2 dark:border-slate-600 dark:bg-slate-900/70 dark:text-slate-100 ${className}`.trim()}
          {...rest}
        />
        {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
      </div>
    );
  }
);

TextInput.displayName = 'TextInput';

export default TextInput;
