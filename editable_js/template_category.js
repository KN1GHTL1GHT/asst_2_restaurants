/**
 * CATEGORY VIEW
 * For a health inspector (or reporter) comparing types of business:
 * which kinds of places get inspected most, and how often they pass?
 * Groups every inspection by type of business. Each group shows how many
 * inspections it has and how many were compliant, with the inspections
 * listed underneath.
 */
import { formatDate, isMissing, orNotListed, isCompliant, resultBadge } from './helpers.js';

// Turns the list of inspections into one object per type of business:
// { name: 'Restaurant', inspections: [...], compliant: 1, noResult: 9 }
function groupByCategory(data) {
  const groups = {};

  data.forEach((inspection) => {
    const name = orNotListed(inspection.category);
    if (!groups[name]) {
      groups[name] = { name, inspections: [], compliant: 0, noResult: 0 };
    }
    groups[name].inspections.push(inspection);
    if (isCompliant(inspection.inspection_results)) {
      groups[name].compliant += 1;
    }
    if (isMissing(inspection.inspection_results)) {
      groups[name].noResult += 1;
    }
  });

  // Biggest groups first; "Not listed" always last
  return Object.values(groups).sort((a, b) => {
    if (a.name === 'Not listed') return 1;
    if (b.name === 'Not listed') return -1;
    return b.inspections.length - a.inspections.length || a.name.localeCompare(b.name);
  });
}

function inspectionItem(inspection) {
  const place = isMissing(inspection.city) ? '' : ` · ${inspection.city}`;
  return `
    <li class="category-item">
      <span>
        <strong>${inspection.name}</strong>${place}
        <span class="item-date">${formatDate(inspection.inspection_date)}</span>
      </span>
      ${resultBadge(inspection.inspection_results)}
    </li>`;
}

function categorySection(group, index) {
  const total = group.inspections.length;
  // Compliance rate only counts inspections that have a result
  const withResult = total - group.noResult;
  const percent = withResult > 0 ? Math.round((group.compliant / withResult) * 100) : 0;
  const complianceText = withResult > 0
    ? `<span class="stat-value">${group.compliant}</span> of ${withResult} compliant (${percent}%)`
    : 'No results recorded yet';
  const headingId = `category-${index}`;

  // Newest inspections first inside each group
  const items = [...group.inspections]
    .sort((a, b) => new Date(b.inspection_date) - new Date(a.inspection_date))
    .map(inspectionItem)
    .join('');

  return `
    <section class="category-section" aria-labelledby="${headingId}">
      <div class="category-header">
        <h3 id="${headingId}">${group.name}</h3>
        <p class="category-stat"><span class="stat-value">${total}</span> ${total === 1 ? 'inspection' : 'inspections'}</p>
        <p class="category-stat">${complianceText}</p>
        <div class="compliance-meter" aria-hidden="true"><span style="width: ${percent}%"></span></div>
        <p class="category-stat category-stat-muted">${group.noResult} no result</p>
      </div>
      <details class="category-items">
        <summary>Show ${total} ${total === 1 ? 'inspection' : 'inspections'}</summary>
        <ul>${items}</ul>
      </details>
    </section>`;
}

function showCategories(data) {
  const groups = groupByCategory(data);

  /*html*/
  return `
    <h2 class="view-title">📂 Category View</h2>
    <p class="view-description">
      <strong>Reflection: </strong>This view is for a health inspector deciding which types of business need the most attention, so they need to compare whole groups rather than individual places.
      It focuses on the totals and compliance rate for each type of business, with the individual inspections tucked underneath, which shows patterns the table can't.
      To build it, I turned the flat list of ${data.length} inspections into ${groups.length} groups, each holding its own inspections and a count of how many were compliant.
      One problem was that inspections with no result made some groups look worse than they were, so each group now shows how many results are missing and calculates its compliance rate only from inspections that have one.
    </p>
    <p class="category-summary">
      ${data.length} inspections across ${groups.length} types of business.
      "Compliant" means the result was "Compliant - No Health Risk".
      Each compliance rate counts only inspections that have a result; inspections with no result are counted separately.
    </p>
    <div class="category-list">
      ${groups.map(categorySection).join('')}
    </div>
  `;
}

export default showCategories;
