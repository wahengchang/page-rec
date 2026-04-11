/**
 * Convert a recording to a natural-language description of what the user did.
 */

const ACTION_VERBS = {
  click: 'Clicked',
  input: 'Typed',
  scroll: 'Scrolled',
  submit: 'Submitted form',
  navigate: 'Navigated to',
};

function describeElement(action) {
  const meta = action.meta || {};
  const parts = [];

  // Tag with best identifier attached
  let tag = meta.tagName ? `<${meta.tagName}` : '';
  if (meta.testId) tag += ` data-testid="${meta.testId}"`;
  else if (meta.id) tag += ` id="${meta.id}"`;
  else if (meta.name) tag += ` name="${meta.name}"`;
  else if (meta.className) {
    const cls = meta.className.split(/\s+/).slice(0, 2).join('.');
    if (cls) tag += `.${cls}`;
  }
  if (tag) parts.push(tag + '>');

  // Role
  if (meta.role) parts.push(`[role="${meta.role}"]`);

  // Label
  if (meta.ariaLabel) parts.push(`labeled "${meta.ariaLabel}"`);
  else if (meta.placeholder) parts.push(`placeholder "${meta.placeholder}"`);

  // Text content for clicks
  if (action.type === 'click' && meta.textContent) {
    parts.push(`showing "${meta.textContent.slice(0, 50)}"`);
  }

  return parts.length ? parts.join(' ') : action.selector;
}

function formatTime(ms) {
  if (ms < 1000) return `${ms}ms`;
  const sec = (ms / 1000).toFixed(1);
  return `${sec}s`;
}

function describeAction(action, index) {
  const verb = ACTION_VERBS[action.type] || action.type;
  const time = formatTime(action.elapsed);
  const element = describeElement(action);

  switch (action.type) {
    case 'click':
      return `${index}. [${time}] ${verb} on ${element}`;

    case 'input':
      if (action.value === '***') {
        return `${index}. [${time}] ${verb} a password into ${element}`;
      }
      return `${index}. [${time}] ${verb} "${action.value}" into ${element}`;

    case 'scroll': {
      const coords = (action.value || '0,0').split(',');
      const y = coords[1] || '0';
      return `${index}. [${time}] ${verb} down to y=${y}px`;
    }

    case 'submit':
      return `${index}. [${time}] ${verb} at ${element}`;

    case 'navigate':
      return `${index}. [${time}] ${verb} ${action.url}`;

    default:
      return `${index}. [${time}] ${verb} on ${element}`;
  }
}

export function describeRecording(recording) {
  const lines = [];
  const date = new Date(recording.timestamp).toLocaleString();
  const firstUrl = recording.actions[0]?.url || 'unknown page';

  lines.push(`Recording: ${recording.name}`);
  lines.push(`Date: ${date}`);
  lines.push(`Starting page: ${firstUrl}`);
  lines.push(`Total actions: ${recording.actions.length}`);
  lines.push('');
  lines.push('Steps:');
  lines.push('');

  recording.actions.forEach((action, i) => {
    lines.push(describeAction(action, i + 1));
  });

  // Summary
  const types = {};
  for (const a of recording.actions) {
    types[a.type] = (types[a.type] || 0) + 1;
  }
  const lastAction = recording.actions[recording.actions.length - 1];
  const totalTime = lastAction ? formatTime(lastAction.elapsed) : '0s';

  lines.push('');
  lines.push('---');
  lines.push(`Summary: ${recording.actions.length} actions over ${totalTime}`);
  const breakdown = Object.entries(types).map(([t, c]) => `${c} ${t}(s)`).join(', ');
  lines.push(`Breakdown: ${breakdown}`);

  return lines.join('\n');
}
