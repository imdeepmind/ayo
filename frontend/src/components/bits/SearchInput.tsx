import type { InputHTMLAttributes } from 'react';

type SearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type'> & {
  value: string;
  onChange: (value: string) => void;
};

export default function SearchInput({
  value,
  onChange,
  className = '',
  ...rest
}: SearchInputProps) {
  return (
    <div className={`relative ${className}`.trim()}>
      <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-text-faint">
        {/* simple search icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M8.5 3a5.5 5.5 0 1 0 3.473 9.8l3.614 3.613a.75.75 0 1 0 1.06-1.06l-3.613-3.614A5.5 5.5 0 0 0 8.5 3Zm-4 5.5a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
            clipRule="evenodd"
          />
        </svg>
      </span>
      <input
        type="search"
        aria-label="Search files"
        className="w-full rounded-xl border border-border bg-surface-alt/80 py-2 pl-8 pr-3 text-sm text-text placeholder:text-text-faint outline-none transition focus:bg-surface focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border-strong dark:bg-surface-alt dark:text-text dark:focus:bg-surface"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...rest}
      />
    </div>
  );
}
