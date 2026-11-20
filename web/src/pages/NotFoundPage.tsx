import React from 'react';
import { Link } from 'react-router-dom';
import { FileQuestion, ArrowLeft, Home } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <div className="w-20 h-20 bg-surface-muted rounded-full flex items-center justify-center mx-auto mb-6 border border-border">
        <FileQuestion className="w-10 h-10 text-text-muted" />
      </div>
      <h1 className="text-4xl font-extrabold text-text tracking-tight sm:text-5xl">404</h1>
      <p className="mt-2 text-xl font-semibold text-text">Page Not Found</p>
      <p className="mt-3 text-sm text-text-muted max-w-md mx-auto">
        The pod or resource you requested could not be located in the cluster namespace. It may have
        been evicted or rescheduled.
      </p>
      <div className="mt-8 flex items-center justify-center gap-4">
        <Button asChild variant="primary">
          <Link to="/" className="gap-2">
            <Home className="w-4 h-4" />
            Return to Store
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/status" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Check Cluster Status
          </Link>
        </Button>
      </div>
    </div>
  );
};
