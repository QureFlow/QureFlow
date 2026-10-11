import { useQueue } from '../../context/QueueContext';
export const ConnectionBanner = () => {
  const { connectionError, refreshState } = useQueue();
  if (!connectionError) return null;
  return (
    <div
      role="status"
      className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:max-w-md z-50 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 shadow-lg"
    >
      {connectionError}{' '}
      <button onClick={refreshState} className="font-bold underline ml-2">
        Retry
      </button>
    </div>
  );
};
