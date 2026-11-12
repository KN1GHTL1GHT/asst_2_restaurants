/**
 * CHARTS VIEW
 * For a reporter looking for patterns across all inspections.
 *   Chart 1 (bar):   Which types of business were inspected most?
 *   Chart 2 (donut): How did the inspections turn out?
 *
 * showCharts(data) returns the HTML: one <canvas> per chart, with a text alternative under each
 * drawCharts(data) runs after that HTML is on the page, and draws a chart into each <canvas>
 *
 * Chart.js docs: https://www.chartjs.org/docs/latest/getting-started/
 */
import { orNotListed, resultInfo } from './helpers.js';

// ---------- Reshaping the data for Chart.js ----------

// Chart 1: { labels: ['Fast Food - Chain', ...], numbers: [29, ...] }, biggest first
function countByCategory(data) {
  const counts = {};
  data.forEach((inspection) => {
    const category = orNotListed(inspection.category);
    counts[category] = (counts[category] || 0) + 1;
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return {
    labels: sorted.map(([category]) => category),
    numbers: sorted.map(([, count]) => count),
  };
}

// Chart 2: the 8 raw results folded into 6 simpler groups, in order from best to worst
const RESULT_GROUPS = [
  { label: 'Compliant', colour: '#2e8540' },
  { label: 'Problems fixed', colour: '#7cc49a' },
  { label: 'Violations observed', colour: '#e0a100' },
  { label: 'Critical violations', colour: '#e06b2d' },
  { label: 'Facility closed', colour: '#b3261e' },
  { label: 'Not listed', colour: '#9e9e9e' },
];

function countByResultGroup(data) {
  const counts = {};
  data.forEach((inspection) => {
    const group = resultInfo(inspection.inspection_results).group;
    counts[group] = (counts[group] || 0) + 1;
  });

  return {
    labels: RESULT_GROUPS.map((group) => group.label),
    numbers: RESULT_GROUPS.map((group) => counts[group.label] || 0),
    colours: RESULT_GROUPS.map((group) => group.colour),
  };
}

// ---------- Text alternatives (one sentence per chart) ----------

function categorySentence(data) {
  const { labels, numbers } = countByCategory(data);
  return `${labels[0]} businesses had the most inspections: ${numbers[0]} of ${data.length}, `
    + `followed by ${labels[1]} (${numbers[1]}) and ${labels[2]} (${numbers[2]}).`;
}

function resultSentence(data) {
  const { labels, numbers } = countByResultGroup(data);
  const count = (label) => numbers[labels.indexOf(label)];
  const percent = (n) => Math.round((n / data.length) * 100);
  const compliant = count('Compliant');
  const missing = count('Not listed');
  return `Only ${compliant} of ${data.length} inspections (${percent(compliant)}%) were fully compliant, `
    + `while ${missing} (${percent(missing)}%) had no result recorded.`;
}

// For the linked hover: how many inspections of each type of business had each result group.
// { 'Fast Food - Chain': { Compliant: 8, 'Not listed': 11, ... }, ... }
function countCategoryByResultGroup(data) {
  const counts = {};
  data.forEach((inspection) => {
    const category = orNotListed(inspection.category);
    const group = resultInfo(inspection.inspection_results).group;
    counts[category] = counts[category] || {};
    counts[category][group] = (counts[category][group] || 0) + 1;
  });
  return counts;
}

// Adds transparency to a "#rrggbb" colour, for the faded part of a highlighted bar or slice
function faded(hex) {
  return `${hex}33`;
}

const LINK_HINT = 'Hover over (or tap) a bar or a slice to see how the two charts connect.';

// ---------- HTML ----------

function showCharts(data) {
  const categoryCount = countByCategory(data).labels.length;
  // Give the bar chart enough height for one bar per type of business
  const barHeight = categoryCount * 28 + 100;

  /*html*/
  return `
    <h2 class="view-title">📈 Charts View</h2>
    <p class="view-description">
      <strong>Reflection: </strong>This view is for a reporter looking for patterns across the whole county, who needs the big picture at a glance rather than details about any one business.
      It focuses on overall totals (which types of business get inspected most, and how inspections turned out) and hides individual names entirely, so it's the fastest view for spotting a story, while the table stays the most useful for an everyday diner.
      To build the donut chart, I folded the 8 raw inspection results into 6 simpler groups and turned them into the matching lists of labels and numbers that Chart.js needs.
      One problem was that when I linked the two charts so hovering one highlights the other, the highlight stayed on after the mouse left a chart, because Chart.js only reports hovering inside the plot area; I fixed it by listening for Chart.js's own "mouse left" event and clearing the highlight there.
    </p>
    <div class="charts-grid">
      <figure class="chart-figure">
        <div class="chart-box" style="height: ${barHeight}px">
          <canvas id="chart-one" role="img" aria-label="Bar chart of inspections by type of business" aria-describedby="chart-one-summary"></canvas>
        </div>
        <figcaption class="chart-summary" id="chart-one-summary">${categorySentence(data)}</figcaption>
      </figure>
      <figure class="chart-figure">
        <div class="chart-box chart-box-donut">
          <canvas id="chart-two" role="img" aria-label="Donut chart of inspection results" aria-describedby="chart-two-summary"></canvas>
        </div>
        <figcaption class="chart-summary" id="chart-two-summary">${resultSentence(data)}</figcaption>
      </figure>
    </div>
    <p class="chart-link-status" id="chart-link-status" aria-live="polite">${LINK_HINT}</p>
  `;
}


// ---------- Drawing ----------

const BAR_COLOUR = '#007cba';

function drawCharts(data) {
  // Chart.js is loaded by a <script> tag in index.html. If it didn't load, say so instead of breaking.
  if (typeof Chart === 'undefined') {
    document.querySelector('.charts-grid').innerHTML =
      '<p class="error">Chart.js did not load, so the charts can\'t be drawn. Check the &lt;script&gt; tag in index.html.</p>';
    return;
  }

  const titleFont = { size: 16, weight: 'bold' };
  const byCategory = countByCategory(data);
  const byResult = countByResultGroup(data);
  const crossCounts = countCategoryByResultGroup(data);
  const status = document.querySelector('#chart-link-status');

  // Chart.js only calls onHover while the mouse is inside the plot area, so it never reports
  // the mouse leaving the chart. This small plugin catches Chart.js's own "mouseout" instead.
  // kind is 'bar' or 'slice': each chart only clears a highlight that it started.
  function clearOnMouseOut(kind) {
    return {
      id: `clear-on-mouseout-${kind}`,
      afterEvent: (chart, args) => {
        if (args.event.type === 'mouseout' && !redrawing) clearHighlight(kind);
      },
    };
  }

  // ----- Chart 1: horizontal bar chart, inspections by type of business -----
  // Two stacked datasets: the highlighted part of each bar, and the faded rest.
  // With nothing highlighted, the first dataset holds the full counts and the second is all zeros.
  const barChart = new Chart(document.querySelector('#chart-one'), {
    type: 'bar',
    data: {
      labels: byCategory.labels,
      datasets: [
        { label: 'Number of inspections', data: [...byCategory.numbers], backgroundColor: BAR_COLOUR },
        { label: 'Other results', data: byCategory.labels.map(() => 0), backgroundColor: faded(BAR_COLOUR) },
      ],
    },
    options: {
      indexAxis: 'y', // horizontal bars, so long business-type names stay readable
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      interaction: { mode: 'index', axis: 'y', intersect: true },
      plugins: {
        title: { display: true, text: 'Inspections by type of business', font: titleFont },
        legend: { display: false }, // one series: the title already names it
        tooltip: { filter: (item) => item.raw > 0 },
      },
      scales: {
        x: { stacked: true, title: { display: true, text: 'Number of inspections' }, beginAtZero: true, ticks: { precision: 0 } },
        y: { stacked: true, title: { display: true, text: 'Type of business' }, ticks: { autoSkip: false } },
      },
      onHover: (event, elements) => {
        if (redrawing) return;
        if (elements.length) highlightCategory(elements[0].index);
        else clearHighlight('bar');
      },
    },
    plugins: [clearOnMouseOut('bar')],
  });

  // ----- Chart 2: donut chart, inspection results -----
  // Each result group is drawn as two slices side by side: the highlighted part and the faded rest.
  // With nothing highlighted, the faded part is 0, so each group looks like one slice.
  function donutSlices(highlightCounts) {
    const values = [];
    const colours = [];
    byResult.labels.forEach((label, i) => {
      const total = byResult.numbers[i];
      const highlighted = highlightCounts ? highlightCounts[i] : total;
      values.push(highlighted, total - highlighted);
      colours.push(byResult.colours[i], faded(byResult.colours[i]));
    });
    // No white border on empty slices, or they'd show up as thin lines
    return { values, colours, borders: values.map((value) => (value > 0 ? 2 : 0)) };
  }

  const startSlices = donutSlices(null);
  const donutChart = new Chart(document.querySelector('#chart-two'), {
    type: 'doughnut',
    data: {
      labels: byResult.labels.flatMap((label) => [label, label]),
      datasets: [{
        label: 'Number of inspections',
        data: startSlices.values,
        backgroundColor: startSlices.colours,
        borderColor: '#ffffff',
        borderWidth: startSlices.borders,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      plugins: {
        title: { display: true, text: 'How did the inspections turn out?', font: titleFont },
        legend: {
          position: 'bottom',
          onClick: () => {}, // clicking the legend doesn't hide slices
          labels: {
            // One legend entry per result group (not per half-slice), with its count,
            // so the legend works without relying on colour
            generateLabels: () => byResult.labels.map((label, i) => ({
              text: `${label} (${byResult.numbers[i]})`,
              fillStyle: byResult.colours[i],
              strokeStyle: byResult.colours[i],
              lineWidth: 0,
              hidden: false,
              index: i * 2,
            })),
          },
        },
        tooltip: {
          filter: (item) => item.raw > 0,
          callbacks: {
            label: (item) => {
              const group = Math.floor(item.dataIndex / 2);
              return ` ${byResult.numbers[group]} inspections`;
            },
          },
        },
      },
      onHover: (event, elements) => {
        if (redrawing) return;
        if (elements.length) highlightResultGroup(Math.floor(elements[0].index / 2));
        else clearHighlight('slice');
      },
    },
    plugins: [clearOnMouseOut('slice')],
  });

  // ----- Linking the two charts -----
  let current = null; // what's highlighted now, so we only redraw when it changes
  let redrawing = false; // true while we redraw a chart ourselves

  // Chart.js replays the last mouse event when a chart redraws, which would call onHover again.
  // Ignore those replays, and clear the redrawn chart's own hover state and tooltip.
  function redraw(chart) {
    redrawing = true;
    chart.setActiveElements([]);
    chart.tooltip.setActiveElements([], { x: 0, y: 0 });
    chart.update();
    redrawing = false;
  }

  // Hovering a bar: show that type of business's share of each donut slice
  function highlightCategory(categoryIndex) {
    const category = byCategory.labels[categoryIndex];
    if (current === `bar:${category}`) return;
    // Only reset the bars if a slice had highlighted them (redrawing would clear the hovered bar's tooltip)
    if (current && current.startsWith('slice:')) resetBars();
    current = `bar:${category}`;

    const counts = byResult.labels.map((group) => crossCounts[category][group] || 0);
    setDonut(donutSlices(counts));

    const parts = byResult.labels
      .map((group, i) => `${counts[i]} ${group.toLowerCase()}`)
      .filter((text, i) => counts[i] > 0);
    status.textContent = `${category} (${byCategory.numbers[categoryIndex]} inspections): ${parts.join(', ')}.`;
  }

  // Hovering a slice: show how many of each bar had that result
  function highlightResultGroup(groupIndex) {
    const group = byResult.labels[groupIndex];
    if (current === `slice:${group}`) return;
    // Only reset the donut if a bar had highlighted it (redrawing would clear the hovered slice's tooltip)
    if (current && current.startsWith('bar:')) setDonut(donutSlices(null));
    current = `slice:${group}`;

    const [shown, rest] = barChart.data.datasets;
    shown.data = byCategory.labels.map((category) => crossCounts[category][group] || 0);
    rest.data = byCategory.numbers.map((total, i) => total - shown.data[i]);
    shown.backgroundColor = byResult.colours[groupIndex];
    shown.label = group;
    redraw(barChart);

    const parts = byCategory.labels
      .map((category, i) => `${category} ${shown.data[i]}`)
      .filter((text, i) => shown.data[i] > 0);
    status.textContent = `${group} (${byResult.numbers[groupIndex]} inspections): ${parts.join(', ')}.`;
  }

  function resetBars() {
    const [shown, rest] = barChart.data.datasets;
    shown.data = [...byCategory.numbers];
    rest.data = byCategory.labels.map(() => 0);
    shown.backgroundColor = BAR_COLOUR;
    shown.label = 'Number of inspections';
    redraw(barChart);
  }

  function setDonut(slices) {
    const dataset = donutChart.data.datasets[0];
    dataset.data = slices.values;
    dataset.backgroundColor = slices.colours;
    dataset.borderWidth = slices.borders;
    redraw(donutChart);
  }

  // kind ('bar' or 'slice') = only clear if that chart started the current highlight,
  // so leaving the bar chart can't undo a highlight the donut just started (and vice versa)
  function clearHighlight(kind) {
    if (current === null || !current.startsWith(`${kind}:`)) return;
    current = null;
    resetBars();
    setDonut(donutSlices(null));
    status.textContent = LINK_HINT;
  }
}

export { showCharts, drawCharts };
