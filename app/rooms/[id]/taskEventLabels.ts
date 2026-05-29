import type { LiveTask } from './types';

// Map an in-flight TaskEvent into a short, human-readable label for the
// ticker UI. Returns null for events we don't want to surface (raw text
// from the LLM is usually noisy planning chatter).
export function friendlyEventLabel(
  ev: LiveTask['events'][number] | undefined,
): { icon: string; text: string } | null {
  if (!ev) return null;
  if (ev.kind === 'tool_call') {
    const data = (ev.data ?? {}) as Record<string, unknown>;
    switch (ev.toolName) {
      case 'web_search': {
        const q = (data.query as string) ?? '';
        return {
          icon: '🔍',
          text: q ? `Searching the web for "${truncate(q, 50)}"` : 'Searching the web',
        };
      }
      case 'fetch_url': {
        const url = (data.url as string) ?? '';
        return { icon: '🌐', text: url ? `Reading ${prettyUrl(url)}` : 'Reading a page' };
      }
      case 'list_files': {
        const dir = (data.directory as string) ?? '.';
        return { icon: '📂', text: `Looking around (${dir})` };
      }
      case 'read_file': {
        const path = (data.path as string) ?? '';
        return { icon: '📄', text: `Reading ${shortPath(path)}` };
      }
      case 'write_file': {
        const path = (data.path as string) ?? '';
        return { icon: '✍️', text: `Drafting ${shortPath(path)}` };
      }
      case 'install_packages': {
        const pkgs = (data.packages as string[]) ?? [];
        return {
          icon: '📦',
          text: pkgs.length
            ? `Installing ${pkgs.slice(0, 2).join(', ')}${pkgs.length > 2 ? '…' : ''}`
            : 'Installing packages',
        };
      }
      case 'run_command': {
        const cmd = (data.command as string) ?? '';
        return { icon: '⚡', text: `Running ${truncate(cmd, 40)}` };
      }
      case 'check_preview':
        return { icon: '🩺', text: 'Checking the preview' };
      case 'mark_skeleton_complete':
        return { icon: '🏗️', text: 'Skeleton ready — refining now' };
      default:
        return { icon: '⚙️', text: ev.toolName ?? 'Working' };
    }
  }
  if (ev.kind === 'tool_result') {
    // Don't show tool_results in the ticker — the corresponding tool_call
    // already covered it. (We could show summaries for failures here later.)
    return null;
  }
  if (ev.kind === 'text') {
    const t = (ev.text ?? '').trim();
    if (!t) return null;
    return { icon: '💭', text: truncate(t, 80) };
  }
  return null;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

function shortPath(path: string): string {
  // Strip leading src/ and keep the last 2 segments — "Hero.jsx" beats
  // "/home/user/app/src/components/Hero.jsx" in a ticker.
  const cleaned = path.replace(/^\/+/, '').replace(/^src\//, '');
  const parts = cleaned.split('/');
  if (parts.length <= 2) return cleaned;
  return parts.slice(-2).join('/');
}

function prettyUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/$/, '');
    return path ? `${u.host}${path}` : u.host;
  } catch {
    return truncate(url, 50);
  }
}
