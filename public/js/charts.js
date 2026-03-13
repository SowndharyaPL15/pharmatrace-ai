/* PharmaTrace AI — Chart Utilities */

function createDoughnutChart(canvasId, labels, data, title) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: ['#198754','#dc3545','#ffc107','#0dcaf0','#6c757d','#764ba2'],
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 } } },
        title:  { display: true, text: title, font: { size: 14, weight: '600' }, padding: { bottom: 10 } }
      }
    }
  });
}

function createBarChart(canvasId, labels, data, title, colors) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  const bg = Array.isArray(colors) ? colors : (colors || '#0d6efd');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: title,
        data,
        backgroundColor: bg,
        borderRadius: 6,
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: '#f0f0f0' } },
        x: { grid: { display: false } }
      },
      plugins: {
        legend: { display: false },
        title:  { display: true, text: title, font: { size: 14, weight: '600' }, padding: { bottom: 10 } }
      }
    }
  });
}

function createLineChart(canvasId, labels, data, title) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: title,
        data,
        borderColor: '#0d6efd',
        backgroundColor: 'rgba(13,110,253,.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointBackgroundColor: '#0d6efd'
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true, grid: { color: '#f0f0f0' } },
        x: { grid: { display: false } }
      },
      plugins: {
        legend: { display: false },
        title:  { display: true, text: title, font: { size: 14, weight: '600' }, padding: { bottom: 10 } }
      }
    }
  });
}

// Auto-fill batch ID from URL query param ?batch=XXX
(function() {
  const params  = new URLSearchParams(window.location.search);
  const batchId = params.get('batch');
  if (batchId) {
    const input = document.querySelector('input[name="batch_id"]');
    if (input) {
      input.value = batchId;
      const form = input.closest('form');
      if (form) form.submit();
    }
  }
})();
