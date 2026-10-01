import { handleRequest, type WorkerBindings } from './app.js';
import { DecisionLock } from './decision-lock.js';

export type { WorkerBindings };
export { DecisionLock };

export default {
  async fetch(request: Request, env: WorkerBindings): Promise<Response> {
    return handleRequest(request, env);
  },
};
