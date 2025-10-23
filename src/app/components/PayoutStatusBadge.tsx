'use client';

interface PayoutStatusBadgeProps {
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  darkMode?: boolean;
}

export default function PayoutStatusBadge({
  chargesEnabled,
  payoutsEnabled
}: PayoutStatusBadgeProps) {
  const getStatusColor = () => {
    if (chargesEnabled && payoutsEnabled) {
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    } else if (chargesEnabled && !payoutsEnabled) {
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    } else {
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    }
  };

  const getStatusText = () => {
    if (chargesEnabled && payoutsEnabled) {
      return 'Fully Active';
    } else if (chargesEnabled && !payoutsEnabled) {
      return 'Charges Only';
    } else {
      return 'Inactive';
    }
  };

  const getStatusIcon = () => {
    if (chargesEnabled && payoutsEnabled) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    } else if (chargesEnabled && !payoutsEnabled) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      );
    } else {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor()}`}>
        {getStatusIcon()}
        <span className="ml-1">{getStatusText()}</span>
      </span>
      
      <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs ${
          chargesEnabled 
            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
            : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
        }`}>
          Charges
        </span>
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs ${
          payoutsEnabled 
            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
            : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
        }`}>
          Payouts
        </span>
      </div>
    </div>
  );
}
