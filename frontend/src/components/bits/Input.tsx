import { forwardRef, type InputHTMLAttributes } from 'react';

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  id: string;
  error?: string;
};

const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ label, id, error, className = '', ...rest }, ref) => {
    return (
      <div className="space-y-2">
        <label
          htmlFor={id}
          className="block text-sm font-semibold text-slate-700 dark:text-slate-200"
        >
          {label}
        </label>
        <input
          id={id}
          ref={ref}
          className={`w-full rounded-xl border-2 ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-200 focus:border-sky-500 focus:ring-sky-500/20 dark:border-slate-600 dark:focus:border-sky-400'} bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition-all duration-200 focus:ring-4 dark:bg-slate-900/50 dark:text-slate-100 dark:placeholder:text-slate-500 ${className}`.trim()}
          {...rest}
        />
        {error && (
          <p className="text-sm text-red-500 dark:text-red-400 flex items-center gap-1.5">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            {error}
          </p>
        )}
      </div>
    );
  }
);

TextInput.displayName = 'TextInput';

export default TextInput;
