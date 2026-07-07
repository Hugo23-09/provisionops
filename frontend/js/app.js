async function apiFetch(path) {
  const resp = await fetch(path);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

function formatBytes(bytes) {
  if (!bytes) return "N/A";
  const gb = bytes / 1073741824;
  return gb.toFixed(1) + " Go";
}

function statCard(label, value, color = "text-slate-700") {
  return `<div class="bg-slate-50 rounded-lg p-4 text-center">
    <div class="text-sm text-slate-500 mb-1">${label}</div>
    <div class="text-2xl font-bold ${color}">${value}</div>
  </div>`;
}

async function init() {
  const app = document.getElementById("app");

  try {
    const [health, templatesLxc, templatesVm, storages, bridges, resources] = await Promise.all([
      apiFetch("/api/proxmox/health"),
      apiFetch("/api/proxmox/templates?type=lxc"),
      apiFetch("/api/proxmox/templates?type=vm"),
      apiFetch("/api/proxmox/storages"),
      apiFetch("/api/proxmox/bridges"),
      apiFetch("/api/proxmox/resources"),
    ]);

    const proxmoxOk = health.status === "ok";
    const proxmoxStatus = proxmoxOk
      ? `<span class="text-green-500 font-bold">Connecté</span>`
      : `<span class="text-red-500 font-bold">Erreur</span>`;

    const res = resources.data;

    app.innerHTML = `
      <div class="mb-6">
        <h2 class="text-2xl font-semibold text-slate-800">Tableau de bord</h2>
        <p class="text-slate-500 mt-1">Connexion Proxmox : ${proxmoxStatus}</p>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        ${statCard("Templates LXC", templatesLxc.data.length)}
        ${statCard("Templates VM", templatesVm.data.length)}
        ${statCard("Storages", storages.data.length)}
        ${statCard("Bridges réseau", bridges.data.length)}
      </div>

      <div class="mb-6">
        <h3 class="text-lg font-semibold text-slate-700 mb-3">Ressources du nœud</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          ${statCard("CPU max", `${res.cpu_max} cœurs`)}
          ${statCard("RAM max", formatBytes(res.memory_max))}
          ${statCard("Disque max", formatBytes(res.disk_max))}
        </div>
      </div>

      <div class="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p class="text-blue-700 text-sm">
          <strong>ProvisionOps v0.1.0</strong> &mdash; Le wizard de création
          de VM/LXC arrivera au prochain sprint.
        </p>
      </div>
    `;
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
