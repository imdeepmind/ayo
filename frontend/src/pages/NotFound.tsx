import { useNavigate } from 'react-router-dom';
import PageSection from '@/components/bits/Section';
import AuthCard from '@/components/items/AuthCard';
import Button from '@/components/bits/Button';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <PageSection>
      <AuthCard
        title="404 - Page Not Found"
        description={<>The page you are looking for doesn&apos;t exist or has been moved.</>}
        footer={
          <div className="flex justify-center w-full">
            <Button onClick={() => navigate('/')} variant="primary">
              Return to Home
            </Button>
          </div>
        }
      >
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          <div className="text-6xl font-black text-slate-200 tracking-tighter">404</div>
          <p className="text-slate-500 dark:text-slate-400 text-center">
            Oops! It seems you&apos;ve wandered into uncharted territory.
          </p>
        </div>
      </AuthCard>
    </PageSection>
  );
}
