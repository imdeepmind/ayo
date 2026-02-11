import logo from '../assets/images/logo-universal.png';
import { PageSection } from '../components/bits/Section';
import { Card } from '../components/bits/Card';
import { PageSubtitle, PageTitle, SectionLabel } from '../components/bits/Typography';

export default function Home() {
  return (
    <PageSection size="lg">
      <Card>
        <div className="mb-6 flex flex-col items-center gap-4">
          <img
            src={logo}
            alt="ayo logo"
            className="h-20 w-20 object-contain drop-shadow-[0_0_25px_rgba(56,189,248,0.55)]"
          />
          <PageTitle>
            ayo <span className="text-sky-500">file server</span>
          </PageTitle>
          <PageSubtitle className="max-w-md">
            A minimal starter home page. Use the navigation above to explore the auth flows.
          </PageSubtitle>
        </div>

        <div className="grid gap-4 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-700/70 dark:bg-slate-900/40">
            <SectionLabel>Status</SectionLabel>
            <p>Routing & Tailwind are wired up.</p>
          </div>
          <div className="rounded-xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-700/70 dark:bg-slate-900/40">
            <SectionLabel>Auth</SectionLabel>
            <p>Try the Login, Register, and Reset pages.</p>
          </div>
          <div className="rounded-xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-700/70 dark:bg-slate-900/40">
            <SectionLabel>Theme</SectionLabel>
            <p>Use the header toggle to switch dark / light.</p>
          </div>
        </div>
      </Card>
    </PageSection>
  );
}

