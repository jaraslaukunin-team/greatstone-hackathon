import type { Layout, ProjectDTO } from '@picpac/shared';
import { ApiRequestError, type ApiClient } from '../api/client';

type Deps = {
  client: ApiClient;
  projectId: string;
  layout: Layout;
  version: number;
  onLocalOnly: () => void;
  onSaved: (project: ProjectDTO) => void;
  onConflict: (server: ProjectDTO, localLayout: Layout) => Promise<void>;
};

export async function syncProject(deps: Deps): Promise<void> {
  try {
    const updated = await deps.client.put<ProjectDTO>(`/projects/${deps.projectId}`, {
      layout: deps.layout,
      version: deps.version,
    });
    deps.onSaved(updated);
  } catch (e) {
    if (e instanceof ApiRequestError && e.code === 'VERSION_CONFLICT') {
      const server = await deps.client.get<ProjectDTO>(`/projects/${deps.projectId}`);
      await deps.onConflict(server, deps.layout);
      return;
    }
    if (e instanceof ApiRequestError && e.status >= 500) {
      deps.onLocalOnly();
      return;
    }
    // network-ish
    deps.onLocalOnly();
  }
}
