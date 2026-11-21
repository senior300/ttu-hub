import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, X } from 'lucide-react';

export const BrandMark: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({
  size = 'md',
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const dim =
    size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-12 w-12' : 'h-9 w-9';

  if (imgFailed) {
    return (
      <div
        className={`${dim} rounded-lg bg-[#0C2924] text-white flex items-center justify-center font-display font-bold text-sm shrink-0`}
        aria-label="TTU HUB crest"
      >
        TH
      </div>
    );
  }

  return (
    <img
      src="/src/assets/images/ttu_hub_crest_emerald_1795288319427.jpg"
      alt="TTU HUB Emblem"
      referrerPolicy="no-referrer"
      onError={() => setImgFailed(true)}
      className={`${dim} rounded-lg object-cover border border-stone-200 bg-white shrink-0`}
    />
  );
};

export const PageHeader: React.FC<{
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}> = ({ title, subtitle, action }) => (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-stone-200">
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0C2924] text-balance">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-1 text-sm text-stone-600 max-w-2xl">{subtitle}</p>
      )}
    </div>
    {action && <div className="shrink-0 flex items-center gap-3">{action}</div>}
  </div>
);

export const StatTile: React.FC<{
  label: string;
  value: string | number;
  helper?: string;
}> = ({ label, value, helper }) => (
  <div className="bg-white border border-stone-200 rounded-xl p-5">
    <p className="text-xs font-medium text-stone-500">{label}</p>
    <p className="mt-2 text-2xl font-bold text-[#0C2924] tabular-nums">
      {value}
    </p>
    {helper && <p className="mt-1 text-xs text-stone-500">{helper}</p>}
  </div>
);

export const StatusLabel: React.FC<{
  status: string;
}> = ({ status }) => {
  const norm = status.toUpperCase();
  if (
    norm === 'APPROVED' ||
    norm === 'ACTIVE' ||
    norm === 'AVAILABLE' ||
    norm === 'RECOVERED' ||
    norm === 'GRADED'
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        {status.replace(/_/g, ' ')}
      </span>
    );
  }
  if (norm === 'PENDING' || norm === 'PENDING_APPROVAL' || norm === 'RESERVED') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        {status.replace(/_/g, ' ')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700">
      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
      {status.replace(/_/g, ' ')}
    </span>
  );
};

export const EmptyState: React.FC<{
  title: string;
  description: string;
  action?: React.ReactNode;
}> = ({ title, description, action }) => (
  <div className="bg-white border border-stone-200 rounded-xl p-10 text-center">
    <h3 className="text-base font-semibold text-[#0C2924]">{title}</h3>
    <p className="mt-1.5 text-sm text-stone-600 max-w-md mx-auto">{description}</p>
    {action && <div className="mt-5 flex justify-center">{action}</div>}
  </div>
);

export const ErrorBanner: React.FC<{
  message: string;
  onDismiss?: () => void;
}> = ({ message, onDismiss }) => (
  <div
    role="alert"
    className="flex items-start justify-between gap-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-3 text-sm"
  >
    <div className="flex items-start gap-2.5">
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />
      <span>{message}</span>
    </div>
    {onDismiss && (
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss alert"
        className="text-rose-600 hover:text-rose-900"
      >
        <X className="w-4 h-4" />
      </button>
    )}
  </div>
);

export const LoadingSkeleton: React.FC<{ rows?: number }> = ({ rows = 3 }) => (
  <div className="space-y-3" aria-busy="true" aria-label="Loading content">
    {Array.from({ length: rows }).map((_, i) => (
      <div
        key={i}
        className="h-24 bg-white border border-stone-200 rounded-xl animate-pulse p-5"
      >
        <div className="h-4 w-1/3 bg-stone-200 rounded" />
        <div className="mt-3 h-3 w-2/3 bg-stone-100 rounded" />
      </div>
    ))}
  </div>
);

export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}> = ({ open, onClose, title, children }) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="bg-white border border-stone-200 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
          <h2 className="text-lg font-bold text-[#0C2924]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-stone-500 hover:text-[#0C2924] hover:bg-stone-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};
