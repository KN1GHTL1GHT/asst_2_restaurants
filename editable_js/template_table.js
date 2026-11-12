
/**
 * TABLE VIEW
 * For a diner deciding where to get a safe bite to eat:
 * look up a place, see where it is, what kind of place it is,
 * when it was last inspected, and how that inspection went.
 * Sortable by name, category, date and result (ties broken by name, A–Z).
 */

import { formatDate, isMissing, orNotListed, resultInfo, resultBadge } from './helpers.js';

// The columns, in order. "firstDirection" is the direction used the first time a column is clicked.
const COLUMNS = [
  { key: 'name', label: 'Name', sortable: true, firstDirection: 'ascending' },
  { key: 'address', label: 'Address', sortable: false },
  { key: 'category', label: 'Category', sortable: true, firstDirection: 'ascending' },
  { key: 'date', label: 'Last Inspected', sortable: true, firstDirection: 'descending' },
  { key: 'result', label: 'Result', sortable: true, firstDirection: 'ascending' },
];

// Current sort, kept between clicks
let sortKey = 'name';
let sortDirection = 'ascending';
let tableData = [];

// One business = same name at the same address. Ignores capitals and extra spaces.
function businessKey(inspection) {
  return [inspection.name, inspection.address_line_1, inspection.city]
    .map((part) => String(part).trim().toUpperCase())
    .join('|');
}

// One row per business:
// - Show the most recent inspection that has a result.
// - If there is a newer inspection with no result yet, remember its date as "pendingDate".
// - If none of a business's inspections have a result, show the most recent one ("Not listed").
function latestInspections(data) {
  const byBusiness = {};
  data.forEach((inspection) => {
    const key = businessKey(inspection);
    byBusiness[key] = byBusiness[key] || [];
    byBusiness[key].push(inspection);
  });

  return Object.values(byBusiness).map((inspections) => {
    // Newest first
    const newestFirst = [...inspections].sort(
      (a, b) => new Date(b.inspection_date) - new Date(a.inspection_date)
    );
    const newest = newestFirst[0];
    const newestWithResult = newestFirst.find((inspection) => !isMissing(inspection.inspection_results));

    if (!newestWithResult) {
      return { ...newest, pendingDate: null };
    }

    const hasNewerPending =
      new Date(newest.inspection_date) > new Date(newestWithResult.inspection_date);

    return { ...newestWithResult, pendingDate: hasNewerPending ? newest.inspection_date : null };
  });
}

function compareNames(a, b) {
  return a.name.localeCompare(b.name);
}

// Compares two inspections on the chosen column. Missing values always go last,
// whichever direction is chosen. Ties are broken by name, A–Z.
function compareInspections(a, b) {
  const flip = sortDirection === 'ascending' ? 1 : -1;
  let primary = 0;

  if (sortKey === 'name') {
    primary = compareNames(a, b) * flip;
  } else if (sortKey === 'category') {
    const aMissing = isMissing(a.category);
    const bMissing = isMissing(b.category);
    if (aMissing || bMissing) {
      primary = aMissing - bMissing;
    } else {
      primary = a.category.localeCompare(b.category) * flip;
    }
  } else if (sortKey === 'date') {
    primary = (new Date(a.inspection_date) - new Date(b.inspection_date)) * flip;
  } else if (sortKey === 'result') {
    const aRank = resultInfo(a.inspection_results).rank;
    const bRank = resultInfo(b.inspection_results).rank;
    if (aRank === Infinity || bRank === Infinity) {
      primary = (aRank === Infinity) - (bRank === Infinity);
    } else {
      primary = (aRank - bRank) * flip;
    }
  }

  return primary !== 0 ? primary : compareNames(a, b);
}

function headerCell(column) {
  if (!column.sortable) {
    return `<th scope="col">${column.label}</th>`;
  }

  const isSorted = column.key === sortKey;
  const ariaSort = isSorted ? ` aria-sort="${sortDirection}"` : '';
  const arrow = isSorted ? (sortDirection === 'ascending' ? '▲' : '▼') : '↕';

  return `
    <th scope="col"${ariaSort}>
      <button type="button" class="sort-button" data-sort-key="${column.key}">
        ${column.label}<span class="sort-arrow" aria-hidden="true">${arrow}</span>
      </button>
    </th>`;
}

// Shown under the date when a newer inspection exists but has no result yet
function pendingNote(inspection) {
  if (!inspection.pendingDate) return '';
  return `
    <span class="pending-note">
      <span aria-hidden="true">⏳</span>
      Newer inspection on ${formatDate(inspection.pendingDate)}: result pending
    </span>`;
}

function tableRow(inspection) {
  const address = [inspection.address_line_1, inspection.city]
    .filter((part) => !isMissing(part))
    .join(', ');

  return `
    <tr>
      <th scope="row">${inspection.name}</th>
      <td>${address || 'Not listed'}</td>
      <td>${orNotListed(inspection.category)}</td>
      <td>${formatDate(inspection.inspection_date)}${pendingNote(inspection)}</td>
      <td>${resultBadge(inspection.inspection_results)}</td>
    </tr>`;
}

function showTable(data) {
  tableData = data;
  const sorted = latestInspections(data).sort(compareInspections);

  /*html*/
  return `
    <h2 class="view-title">📊 Table View</h2>
    <p class="view-description">
      <strong>Reflection: </strong>This table is for diners looking for a safe place to eat, who need to find a business quickly and see how its latest inspection went.
      It focuses on individual businesses and their most recent result, color-coded and sortable from safest to least safe, which makes it the most useful view for actually deciding where to eat.
      To build it, I grouped the ${data.length} inspections by business name and address and kept only each business's most recent one, turning ${data.length} rows into ${sorted.length}.
      One problem was that some of the newest inspections had no result recorded, so the table shows the latest inspection that does have a result and adds a "result pending" note with the newer date.
    </p>
    <div class="table-wrapper" role="region" aria-labelledby="table-caption" tabindex="0">
      <table class="restaurant-table">
        <caption id="table-caption">
          Most recent food safety inspection for ${sorted.length} businesses in Prince George's County, Maryland
          <span class="caption-hint">Column headers with buttons can be sorted. Missing results are listed as "Not listed" and sorted last.</span>
        </caption>
        <thead>
          <tr>${COLUMNS.map(headerCell).join('')}</tr>
        </thead>
        <tbody>
          ${sorted.map(tableRow).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// The table is re-drawn from an HTML string, so listen for clicks on the
// whole page and react only to the sort buttons.
document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-sort-key]');
  if (!button) return;

  const key = button.dataset.sortKey;
  if (key === sortKey) {
    sortDirection = sortDirection === 'ascending' ? 'descending' : 'ascending';
  } else {
    sortKey = key;
    sortDirection = COLUMNS.find((column) => column.key === key).firstDirection;
  }

  document.getElementById('data-display').innerHTML = showTable(tableData);
  // Put keyboard focus back on the button that was pressed
  document.querySelector(`[data-sort-key="${key}"]`).focus();
});

export default showTable;
