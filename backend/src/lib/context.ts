import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export const requestContext = new AsyncLocalStorage<{ requestId: string; actorId?: string }>();
export const operationMetadata = () => ({
  requestId: requestContext.getStore()?.requestId || randomUUID(),
  actorId: requestContext.getStore()?.actorId || 'system',
  timestamp: new Date().toISOString(),
});
