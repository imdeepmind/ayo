/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover:   'var(--color-primary-hover)',
          active:  'var(--color-primary-active)',
        },
        sidebar: {
          bg:    'var(--color-sidebar-bg)',
          bgDark:'var(--color-sidebar-bg-dark)',
          text:  'var(--color-sidebar-text)',
          muted: 'var(--color-sidebar-text-muted)',
          border:'var(--color-sidebar-border)',
          track: 'var(--color-sidebar-track)',
          fill:  'var(--color-sidebar-fill)',
        },
        background: {
          DEFAULT: 'var(--color-bg)',
        },
        surface: {
          DEFAULT: 'var(--color-surface)',
          alt:     'var(--color-surface-alt)',
          hover:   'var(--color-surface-hover)',
          muted:   'var(--color-surface-muted)',
        },
        text: {
          DEFAULT: 'var(--color-text)',
          muted:   'var(--color-text-muted)',
          subtle:  'var(--color-text-subtle)',
          faint:   'var(--color-text-faint)',
        },
        border: {
          DEFAULT: 'var(--color-border)',
          strong:  'var(--color-border-strong)',
          input:   'var(--color-border-input)',
        },
      },
      boxShadow: {
        sm:      'var(--shadow-sm, none)',
        DEFAULT: 'var(--shadow-md, none)',
        md:      'var(--shadow-md, none)',
        lg:      'var(--shadow-lg, none)',
        xl:      'var(--shadow-xl, none)',
        '2xl':   'var(--shadow-2xl, none)',
      },
    },
  },
  plugins: [],
};
