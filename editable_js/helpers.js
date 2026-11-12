/**
 * SHARED HELPERS
 * Small functions used by more than one view (Table, Category, Charts).
 */

// Turns "2026-05-17T00:00:00.000" into "May 17, 2026"
export function formatDate(isoDate) {
  return new Date(isoDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// This dataset writes missing values as "------" or "N/A". Treat both as missing.
export function isMissing(value) {
  return value === '------' || value === 'N/A' || value === undefined || value === '';
}

// Show "Not listed" instead of a missing value
export function orNotListed(value) {
  return isMissing(value) ? 'Not listed' : value;
}

// Every inspection result in data.json, ranked from safest (1) to least safe (7).
// "level" picks the badge colour: good = green, warning = amber, bad = red.
// "group" is the simpler label used by the results chart.
const RESULT_INFO = {
  'Compliant - No Health Risk': { rank: 1, level: 'good', group: 'Compliant' },
  'Compliance Schedule - Completed': { rank: 2, level: 'good', group: 'Problems fixed' },
  'Facility Reopened': { rank: 3, level: 'good', group: 'Problems fixed' },
  'Compliance Schedule - Outstanding': { rank: 4, level: 'warning', group: 'Violations observed' },
  'Non-Compliant - Violations Observed': { rank: 5, level: 'warning', group: 'Violations observed' },
  'Critical Violations observed': { rank: 6, level: 'bad', group: 'Critical violations' },
  'Facility Closed': { rank: 7, level: 'bad', group: 'Facility closed' },
};

// Missing (or unexpected) results are grey and always sort to the bottom.
const MISSING_RESULT = { rank: Infinity, level: 'missing', group: 'Not listed' };

export function resultInfo(result) {
  return RESULT_INFO[result] || MISSING_RESULT;
}

export function isCompliant(result) {
  return result === 'Compliant - No Health Risk';
}

// A symbol alongside the colour, so the badge doesn't rely on colour alone.
const LEVEL_SYMBOL = { good: '✓', warning: '!', bad: '✕', missing: '?' };

// Coloured badge with a symbol and the full result text
export function resultBadge(result) {
  const { level } = resultInfo(result);
  return `
    <span class="result-badge result-${level}">
      <span aria-hidden="true">${LEVEL_SYMBOL[level]}</span>
      ${orNotListed(result)}
    </span>`;
}
