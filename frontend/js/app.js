async function init() {
  const app = document.getElementById('app');

  try {
    const resp = await fetch('/api/health');
    const data = await resp.json();

    if (data.status === 'ok') {
      app.innerHTML = `
        <div class="text-center py-12">
          <div class="text-green-500 text-6xl mb-4">&#10003;</div>
          <h2 class="text-2xl font-semibold text-slate-800">API connectée</h2>
          <p class="text-slate-500 mt-2">Version ${data.version}</p>
          <p class="text-slate-400 text-sm mt-6">Le wizard de création arrivera bientôt...</p>
        </div>
      `;
    }
  } catch {
    app.innerHTML = `
      <div class="text-center py-12">
        <div class="text-red-500 text-6xl mb-4">&#10007;</div>
        <h2 class="text-2xl font-semibold text-slate-800">API indisponible</h2>
        <p class="text-slate-500 mt-2">Impossible de contacter le backend.</p>
      </div>
    `;
  }
}

init();
