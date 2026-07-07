const STEPS = [
  { id: 'type',     label: 'Type' },
  { id: 'template', label: 'OS' },
  { id: 'resources',label: 'Ressources' },
  { id: 'network',  label: 'Réseau' },
  { id: 'confirm',  label: 'Confirmation' },
  { id: 'result',   label: 'Résultat' },
]

let state = {
  step: 0,
  type: null,
  templatesLxc: [],
  templatesVm: [],
  templates: [],
  template: null,
  cpu: 2,
  ram: 2048,
  disk: 20,
  storage: '',
  bridges: [],
  bridge: '',
  ipMode: 'dhcp',
  ipAddress: '',
  ipMask: '',
  ipGateway: '',
  name: '',
  nodeResources: null,
  creating: false,
  result: null,
  history: [],
  vms: [],
  connected: false,
}

const MOCK = {
  templatesLxc: [
    { volid: "local:vztmpl/debian-12-standard_12.7-1_amd64.tar.zst", size: 235929600 },
    { volid: "local:vztmpl/ubuntu-24.04-standard_24.04-2_amd64.tar.zst", size: 268435456 },
    { volid: "local:vztmpl/alpine-3.21-default_20250108_amd64.tar.xz", size: 8388608 },
  ],
  templatesVm: [
    { volid: "local:iso/debian-12.10.0-amd64-netinst.iso", size: 734003200 },
    { volid: "local:iso/ubuntu-24.04.1-live-server-amd64.iso", size: 1610612736 },
  ],
  bridges: [
    { iface: "vmbr0", cidr: "192.168.1.0/24" },
    { iface: "vmbr1", cidr: "10.0.0.0/24" },
  ],
  nodeResources: {
    cpu_max: 16,
    memory_max: 34359738368,
    memory_used: 12884901888,
    disk_max: 68719476736,
    disk_used: 21474836480,
  },
  vms: [
    { vmid: 100, name: "proxy-web", type: "lxc", status: "running", cpu: 0.05, mem: 805306368, maxmem: 1073741824, disk: 4294967296, maxdisk: 8589934592, uptime: 86400, node: "pve" },
    { vmid: 101, name: "base-debian", type: "lxc", status: "stopped", cpu: 0, mem: 0, maxmem: 536870912, disk: 4294967296, maxdisk: 5368709120, uptime: 0, node: "pve" },
    { vmid: 102, name: "serveur-app", type: "qemu", status: "running", cpu: 0.5, mem: 4294967296, maxmem: 8589934592, disk: 53687091200, maxdisk: 107374182400, uptime: 604800, node: "pve" },
    { vmid: 103, name: "docker-host", type: "qemu", status: "running", cpu: 0.8, mem: 8589934592, maxmem: 17179869184, disk: 107374182400, maxdisk: 214748364800, uptime: 1209600, node: "pve" },
  ],
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

function renderStepIndicator(current) {
  return `<div class="flex items-center justify-center mb-8 px-4">
    ${STEPS.slice(0, 5).map((s, i) => `
      ${i > 0 ? `<div class="step-connector ${i <= current ? 'done' : ''}"></div>` : ''}
      <div class="step-circle ${i === current ? 'active' : ''} ${i < current ? 'done' : ''}">
        ${i < current ? '&#10003;' : (i + 1)}
      </div>
    `).join('')}
  </div>`
}

function render() {
  const app = document.getElementById('app')
  const s = state

  if (s.step === 0) {
    app.innerHTML = renderDashboard()
    return
  }

  const stepContent = renderStep()
  app.innerHTML = `
    ${renderStepIndicator(s.step - 1)}
    <div class="bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-700 step-content">
      <h2 class="text-xl font-semibold mb-6">${STEPS[s.step - 1].label}</h2>
      ${stepContent}
    </div>
  `
  bindStepEvents()
}

function setMockData() {
  state.templatesLxc = MOCK.templatesLxc
  state.templatesVm = MOCK.templatesVm
  state.templates = state.templatesLxc
  state.bridges = MOCK.bridges
  state.nodeResources = MOCK.nodeResources
  state.vms = MOCK.vms
  state.storage = 'local'
  if (state.bridges.length > 0) state.bridge = state.bridges[0].iface
}

async function tryConnect() {
  try {
    const resp = await fetch('/api/proxmox/health')
    if (!resp.ok) throw new Error('API indisponible')
    const health = await resp.json()
    if (health.status !== 'ok') throw new Error('Proxmox hors ligne')

    const [templatesLxcData, templatesVmData, bridgesData, resourcesData, vmsData] = await Promise.all([
      fetch('/api/proxmox/templates?type=lxc').then(r => r.json()),
      fetch('/api/proxmox/templates?type=vm').then(r => r.json()),
      fetch('/api/proxmox/bridges').then(r => r.json()),
      fetch('/api/proxmox/resources').then(r => r.json()),
      fetch('/api/proxmox/vms').then(r => r.json()),
    ])

    state.templatesLxc = templatesLxcData.data
    state.templatesVm = templatesVmData.data
    state.templates = state.templatesLxc
    state.bridges = bridgesData.data
    state.nodeResources = resourcesData.data
    state.vms = vmsData.data || []
    state.storage = 'local'
    if (state.bridges.length > 0) state.bridge = state.bridges[0].iface
    state.connected = true
  } catch {
    setMockData()
    state.connected = false
  }

  document.getElementById('status-badge').outerHTML = statusBadge()
  render()
}

function statusBadge() {
  if (state.connected) {
    return `<span id="status-badge" class="text-xs bg-green-900/50 text-green-400 px-2 py-0.5 rounded-full border border-green-700/50">Connecté</span>`
  }
  return `<span id="status-badge" class="text-xs bg-amber-900/50 text-amber-400 px-2 py-0.5 rounded-full border border-amber-700/50">Mode démo</span>`
}

function init() {
  const app = document.getElementById('app')
  setMockData()
  render()
  tryConnect()
}

function pct(a, b) {
  return b > 0 ? Math.round((a / b) * 100) : 0
}

function barColor(pct) {
  if (pct >= 90) return 'bg-red-500'
  if (pct >= 70) return 'bg-amber-500'
  return 'bg-blue-500'
}

function formatBytes(v) {
  if (!v) return '0'
  const gb = v / 1073741824
  if (gb >= 1024) return (gb / 1024).toFixed(1) + ' To'
  return gb.toFixed(1) + ' Go'
}

function formatUptime(s) {
  if (!s || s <= 0) return '—'
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  if (d > 0) return `${d}j ${h}h`
  return `${h}h`
}

function renderDashboard() {
  const s = state
  const res = s.nodeResources || {}
  const memMax = res.memory_max || 0
  const memUsed = res.memory_used || 0
  const diskMax = res.disk_max || 0
  const diskUsed = res.disk_used || 0
  const memPct = pct(memUsed, memMax)
  const diskPct = pct(diskUsed, diskMax)

  const vmsRunning = s.vms.filter(v => v.status === 'running').length
  const vmsStopped = s.vms.filter(v => v.status === 'stopped').length

  return `
    <div class="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 shadow-lg border border-slate-700/50 mb-6">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-lg font-bold text-white shadow">P</div>
          <div>
            <h1 class="text-lg font-bold text-white">ProvisionOps</h1>
            <p class="text-xs text-slate-400">Autoservice Proxmox</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          ${statusBadge()}
          <button onclick="showHistory()" class="text-xs bg-slate-700/50 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-600/50 transition">Historique</button>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <div class="stat-card">
        <div class="stat-icon" style="background:#1e3a5f">&#128187;</div>
        <div class="stat-value">${s.templatesLxc.length}</div>
        <div class="stat-label">Templates LXC</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:#1e3a5f">&#128190;</div>
        <div class="stat-value">${s.templatesVm.length}</div>
        <div class="stat-label">ISOs VM</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:#1e3a5f">&#127961;</div>
        <div class="stat-value">${s.bridges.length}</div>
        <div class="stat-label">Bridges</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:#3b1e5f">&#9889;</div>
        <div class="stat-value">${vmsRunning + vmsStopped}</div>
        <div class="stat-label">VMs <span class="text-green-400">${vmsRunning}</span>/<span class="text-slate-500">${vmsStopped}</span></div>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
      <div class="bg-slate-800 rounded-xl p-4 border border-slate-700/50">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm text-slate-300">&#128268; RAM</span>
          <span class="text-sm text-white font-semibold">${formatBytes(memUsed)} / ${formatBytes(memMax)}</span>
        </div>
        <div class="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div class="h-full ${barColor(memPct)} rounded-full transition-all" style="width:${memPct}%"></div>
        </div>
        <div class="flex justify-between mt-1">
          <span class="text-xs text-slate-500">${memPct}% utilisé</span>
          <span class="text-xs text-slate-500">${100 - memPct}% libre</span>
        </div>
      </div>
      <div class="bg-slate-800 rounded-xl p-4 border border-slate-700/50">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm text-slate-300">&#128190; Disque</span>
          <span class="text-sm text-white font-semibold">${formatBytes(diskUsed)} / ${formatBytes(diskMax)}</span>
        </div>
        <div class="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div class="h-full ${barColor(diskPct)} rounded-full transition-all" style="width:${diskPct}%"></div>
        </div>
        <div class="flex justify-between mt-1">
          <span class="text-xs text-slate-500">${diskPct}% utilisé</span>
          <span class="text-xs text-slate-500">${100 - diskPct}% libre</span>
        </div>
      </div>
    </div>

    <div class="bg-slate-800 rounded-xl p-5 border border-slate-700/50 mb-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-sm font-semibold text-white">&#128187; Ressources existantes</h2>
        <span class="text-xs text-slate-400">${s.vms.length} machine${s.vms.length > 1 ? 's' : ''}</span>
      </div>
      ${s.vms.length === 0 ? `
        <p class="text-slate-500 text-sm text-center py-6">Aucune machine trouvée</p>
      ` : `
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-slate-500 text-xs border-b border-slate-700/50">
                <th class="text-left py-2 pr-3 font-medium">VMID</th>
                <th class="text-left py-2 pr-3 font-medium">Nom</th>
                <th class="text-left py-2 pr-3 font-medium">Type</th>
                <th class="text-left py-2 pr-3 font-medium">Statut</th>
                <th class="text-left py-2 pr-3 font-medium">CPU</th>
                <th class="text-left py-2 pr-3 font-medium">RAM</th>
                <th class="text-left py-2 pr-3 font-medium">Disque</th>
                <th class="text-left py-2 font-medium">Uptime</th>
              </tr>
            </thead>
            <tbody>
              ${s.vms.map(v => {
                const isVm = v.type === 'qemu'
                const cpuPct = v.maxmem ? Math.round((v.cpu || 0) * 100) : 0
                const memPctV = pct(v.mem, v.maxmem)
                const diskPctV = pct(v.disk, v.maxdisk)
                return `<tr class="border-b border-slate-700/30 hover:bg-slate-700/20 transition">
                  <td class="py-2.5 pr-3 text-slate-400 font-mono text-xs">${v.vmid}</td>
                  <td class="py-2.5 pr-3 text-white font-medium">${escapeHtml(v.name)}</td>
                  <td class="py-2.5 pr-3">
                    <span class="text-xs px-1.5 py-0.5 rounded ${isVm ? 'bg-indigo-900/50 text-indigo-300' : 'bg-blue-900/50 text-blue-300'}">
                      ${isVm ? 'VM' : 'LXC'}
                    </span>
                  </td>
                  <td class="py-2.5 pr-3">
                    <span class="flex items-center gap-1.5">
                      <span class="w-1.5 h-1.5 rounded-full ${v.status === 'running' ? 'bg-green-500' : 'bg-slate-600'}"></span>
                      <span class="text-xs ${v.status === 'running' ? 'text-green-400' : 'text-slate-400'}">${v.status === 'running' ? 'En ligne' : 'Arrêté'}</span>
                    </span>
                  </td>
                  <td class="py-2.5 pr-3 text-xs text-slate-300">${cpuPct}%</td>
                  <td class="py-2.5 pr-3">
                    <div class="flex items-center gap-2">
                      <span class="text-xs text-slate-300">${formatBytes(v.mem)}</span>
                      <div class="w-12 h-1.5 bg-slate-700 rounded-full overflow-hidden hidden sm:block">
                        <div class="h-full ${barColor(memPctV)} rounded-full" style="width:${memPctV}%"></div>
                      </div>
                    </div>
                  </td>
                  <td class="py-2.5 pr-3">
                    <div class="flex items-center gap-2">
                      <span class="text-xs text-slate-300">${formatBytes(v.disk)}</span>
                      <div class="w-12 h-1.5 bg-slate-700 rounded-full overflow-hidden hidden sm:block">
                        <div class="h-full ${barColor(diskPctV)} rounded-full" style="width:${diskPctV}%"></div>
                      </div>
                    </div>
                  </td>
                  <td class="py-2.5 text-xs text-slate-400">${formatUptime(v.uptime)}</td>
                </tr>`
              }).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>

    <div class="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 shadow-lg border border-slate-700/50 text-center">
      <h2 class="text-lg font-bold text-white mb-1">Nouvelle ressource</h2>
      <p class="text-sm text-slate-400 mb-6">Assistant pas-à-pas pour provisionner</p>
      <div class="flex flex-col sm:flex-row gap-3 justify-center max-w-lg mx-auto">
        <button onclick="startWizard('lxc')"
          class="create-card bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold py-5 px-6 rounded-xl transition-all duration-200 shadow hover:shadow-lg hover:-translate-y-0.5 flex-1">
          <div class="text-3xl mb-2">&#9632;</div>
          <div class="text-base">Conteneur LXC</div>
          <div class="text-xs text-blue-200 mt-1 font-normal">Léger, partage le noyau</div>
        </button>
        <button onclick="startWizard('vm')"
          class="create-card bg-gradient-to-br from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-semibold py-5 px-6 rounded-xl transition-all duration-200 shadow hover:shadow-lg hover:-translate-y-0.5 flex-1">
          <div class="text-3xl mb-2">&#9671;</div>
          <div class="text-base">Machine Virtuelle</div>
          <div class="text-xs text-indigo-200 mt-1 font-normal">Isolation complète</div>
        </button>
      </div>
    </div>
  `
}

function startWizard(type) {
  state.step = 1
  state.type = type
  state.template = null
  state.templates = type === 'vm' ? state.templatesVm : state.templatesLxc
  render()
}

function renderStep() {
  const s = state
  switch (s.step) {
    case 1: return renderTypeStep()
    case 2: return renderTemplateStep()
    case 3: return renderResourcesStep()
    case 4: return renderNetworkStep()
    case 5: return renderConfirmStep()
    case 6: return renderResultStep()
    default: return ''
  }
}

function renderTypeStep() {
  const s = state
  return `
    <p class="text-slate-400 mb-6">Quel type de ressource veux-tu créer ?</p>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div class="wizard-card ${s.type === 'lxc' ? 'selected' : ''}" data-type="lxc">
        <div class="text-3xl mb-2">&#9632;</div>
        <h3 class="text-lg font-semibold">Conteneur LXC</h3>
        <p class="text-sm text-slate-400 mt-1">Léger, partage le noyau hôte.</p>
      </div>
      <div class="wizard-card ${s.type === 'vm' ? 'selected' : ''}" data-type="vm">
        <div class="text-3xl mb-2">&#9671;</div>
        <h3 class="text-lg font-semibold">Machine Virtuelle</h3>
        <p class="text-sm text-slate-400 mt-1">Noyau dédié, isolation complète.</p>
      </div>
    </div>
    ${navButtons(s.type !== null)}
  `
}

function renderTemplateStep() {
  const s = state
  const label = s.type === 'lxc' ? 'template LXC' : 'ISO VM'
  if (s.templates.length === 0) {
    return `<p class="text-slate-400">Aucun ${label} disponible.</p>${navButtons(false)}`
  }
  return `
    <p class="text-slate-400 mb-4">Choisis le système d'exploitation :</p>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
      ${s.templates.map(t => {
        const name = t.volid.split('/').pop().replace(/\.(tar\.(gz|zst|bz2|xz)|img|iso)$/, '').replace(/-standard|_amd64|_arm64/g, '')
        const isSelected = s.template && s.template.volid === t.volid
        return `<div class="template-card ${isSelected ? 'selected' : ''}" data-volid="${escapeHtml(t.volid)}">
          <div class="text-sm font-medium text-white">${escapeHtml(name)}</div>
          <div class="text-xs text-slate-400 mt-1">${(t.size / 1048576).toFixed(0)} Mo</div>
        </div>`
      }).join('')}
    </div>
    ${navButtons(s.template !== null)}
  `
}

function renderResourcesStep() {
  const s = state
  const res = s.nodeResources || {}
  const maxCpu = Math.min(res.cpu_max || 8, 32)
  const maxRam = Math.min(Math.floor((res.memory_max || 17179869184) / 1048576), 65536)
  const maxDisk = Math.min(Math.floor((res.disk_max || 107374182400) / 1073741824), 500)

  return `
    <div class="space-y-6">
      <div class="resource-row">
        <div class="resource-header">
          <span class="resource-label">&#9889; CPU</span>
          <div class="resource-input-group">
            <input type="number" value="${s.cpu}" min="1" max="${maxCpu}"
              onchange="state.cpu=clamp(+this.value,1,${maxCpu}); render()"
              class="resource-input" id="cpuInput">
            <span class="resource-unit">cœur${s.cpu > 1 ? 's' : ''}</span>
          </div>
        </div>
        <input type="range" min="1" max="${maxCpu}" value="${s.cpu}"
          oninput="state.cpu=+this.value; render()"
          class="resource-slider" id="cpuSlider">
        <div class="resource-range">
          <span>1</span>
          <span>${maxCpu}</span>
        </div>
      </div>

      <div class="resource-row">
        <div class="resource-header">
          <span class="resource-label">&#128268; RAM</span>
          <div class="resource-input-group">
            <input type="number" value="${(s.ram / 1024)}" min="0.25" max="${(maxRam / 1024)}" step="0.25"
              onchange="state.ram=clamp(Math.round(+this.value*1024),256,${maxRam}); render()"
              class="resource-input" id="ramInput">
            <span class="resource-unit">Go</span>
          </div>
        </div>
        <input type="range" min="256" max="${maxRam}" value="${s.ram}" step="256"
          oninput="state.ram=+this.value; render()"
          class="resource-slider" id="ramSlider">
        <div class="resource-range">
          <span>256 Mo</span>
          <span>${(maxRam / 1024).toFixed(0)} Go</span>
        </div>
      </div>

      <div class="resource-row">
        <div class="resource-header">
          <span class="resource-label">&#128190; Disque</span>
          <div class="resource-input-group">
            <input type="number" value="${s.disk}" min="1" max="${maxDisk}"
              onchange="state.disk=clamp(+this.value,1,${maxDisk}); render()"
              class="resource-input" id="diskInput">
            <span class="resource-unit">Go</span>
          </div>
        </div>
        <input type="range" min="1" max="${maxDisk}" value="${s.disk}"
          oninput="state.disk=+this.value; render()"
          class="resource-slider" id="diskSlider">
        <div class="resource-range">
          <span>1 Go</span>
          <span>${maxDisk} Go</span>
        </div>
      </div>
    </div>
    ${navButtons(true)}
  `
}

function renderNetworkStep() {
  const s = state
  return `
    <div class="space-y-4">
      <div>
        <label class="text-sm text-slate-300 mb-1 block">Bridge réseau</label>
        <select onchange="state.bridge=this.value"
          class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-white">
          ${s.bridges.map(b => `
            <option value="${escapeHtml(b.iface)}" ${b.iface === s.bridge ? 'selected' : ''}>
              ${escapeHtml(b.iface)} ${b.cidr ? '(' + escapeHtml(b.cidr) + ')' : ''}
            </option>
          `).join('')}
        </select>
      </div>

      <div>
        <label class="text-sm text-slate-300 mb-2 block">Adressage IP</label>
        <div class="flex gap-4">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="ipMode" value="dhcp" ${s.ipMode === 'dhcp' ? 'checked' : ''}
              onchange="state.ipMode='dhcp'; render()" class="accent-blue-500">
            <span class="text-white">DHCP</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="ipMode" value="static" ${s.ipMode === 'static' ? 'checked' : ''}
              onchange="state.ipMode='static'; render()" class="accent-blue-500">
            <span class="text-white">IP Statique</span>
          </label>
        </div>
      </div>

      ${s.ipMode === 'static' ? `
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label class="text-xs text-slate-400 mb-1 block">Adresse IP</label>
            <input type="text" value="${escapeHtml(s.ipAddress)}" placeholder="192.168.1.100"
              oninput="state.ipAddress=this.value"
              class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm">
          </div>
          <div>
            <label class="text-xs text-slate-400 mb-1 block">Masque</label>
            <input type="text" value="${escapeHtml(s.ipMask)}" placeholder="24"
              oninput="state.ipMask=this.value"
              class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm">
          </div>
          <div>
            <label class="text-xs text-slate-400 mb-1 block">Passerelle</label>
            <input type="text" value="${escapeHtml(s.ipGateway)}" placeholder="192.168.1.1"
              oninput="state.ipGateway=this.value"
              class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm">
          </div>
        </div>
      ` : ''}
    </div>
    ${navButtons(true)}
  `
}

function renderConfirmStep() {
  const s = state
  const templateName = s.template ? s.template.volid.split('/').pop() : '—'
  const isVm = s.type === 'vm'
  const resourceLabel = isVm ? 'machine virtuelle' : 'conteneur'
  const typeLabel = isVm ? 'Machine Virtuelle' : 'Conteneur LXC'

  return `
    <div class="bg-slate-700/50 rounded-xl p-5 space-y-3 mb-6">
      <div class="flex justify-between items-center py-1">
        <span class="text-slate-400">Type</span>
        <span class="text-white font-medium flex items-center gap-1.5">
          ${isVm ? '&#9671;' : '&#9632;'} ${typeLabel}
        </span>
      </div>
      <div class="border-t border-slate-600/50"></div>
      <div class="flex justify-between"><span class="text-slate-400">Template</span><span class="text-white font-medium text-sm">${escapeHtml(templateName)}</span></div>
      <div class="border-t border-slate-600/50"></div>
      <div class="flex justify-between"><span class="text-slate-400">CPU</span><span class="text-white font-medium">${s.cpu} cœur${s.cpu > 1 ? 's' : ''}</span></div>
      <div class="flex justify-between"><span class="text-slate-400">RAM</span><span class="text-white font-medium">${(s.ram / 1024).toFixed(1)} Go</span></div>
      <div class="flex justify-between"><span class="text-slate-400">Disque</span><span class="text-white font-medium">${s.disk} Go</span></div>
      <div class="flex justify-between"><span class="text-slate-400">Bridge</span><span class="text-white font-medium">${escapeHtml(s.bridge)}</span></div>
      <div class="flex justify-between"><span class="text-slate-400">IP</span><span class="text-white font-medium">${s.ipMode === 'dhcp' ? 'DHCP' : escapeHtml(s.ipAddress || '—')}</span></div>
      <div class="border-t border-slate-600/50 pt-3 mt-3">
        <div class="flex justify-between"><span class="text-slate-400">Nom de la ${resourceLabel}</span></div>
        <input type="text" value="${escapeHtml(s.name)}" placeholder="ma-${resourceLabel}"
          oninput="state.name=this.value; render()"
          class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-white mt-1 text-sm"
          maxlength="32" pattern="[a-z0-9-]+" autofocus>
        <p class="text-xs text-slate-500 mt-1.5">Minuscules, chiffres et tirets uniquement (max 32 car.)</p>
      </div>
    </div>

    <button onclick="createResource()"
      class="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 text-lg shadow-lg hover:shadow-xl ${!s.name ? 'opacity-50 cursor-not-allowed' : ''}"
      ${!s.name ? 'disabled' : ''}>
      &#9654; Créer la ${resourceLabel}
    </button>

    <div class="flex justify-between mt-4">
      <button onclick="prevStep()" class="text-slate-400 hover:text-white transition">← Précédent</button>
    </div>
  `
}

function renderResultStep() {
  const s = state
  if (s.creating) {
    return `
      <div class="text-center py-12">
        <div class="animate-spin h-14 w-14 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-5"></div>
        <p class="text-lg text-slate-300">Création en cours...</p>
        <p class="text-sm text-slate-500 mt-2">Provisionnement sur Proxmox</p>
      </div>
    `
  }

  const ok = s.result && s.result.status === 'running'
  const resourceLabel = s.type === 'vm' ? 'La machine virtuelle' : 'Le conteneur'
  return `
    <div class="text-center py-8">
      <div class="text-7xl mb-5 ${ok ? 'text-green-400' : 'text-red-400'}">
        ${ok ? '&#10003;' : '&#10007;'}
      </div>
      <h2 class="text-2xl font-bold mb-2">${ok ? 'Création lancée' : 'Erreur'}</h2>
      <p class="text-slate-400 mb-6 max-w-md mx-auto">${ok
        ? `${resourceLabel} est en cours de création sur Proxmox.`
        : escapeHtml(s.result?.error || 'Une erreur est survenue.')}</p>
      ${ok ? `
        <div class="bg-slate-700/50 rounded-xl p-4 mb-6 text-left max-w-lg mx-auto">
          <div class="text-xs text-slate-400 mb-1">UPID</div>
          <div class="text-sm text-green-300 font-mono break-all">${escapeHtml(s.result.upid)}</div>
        </div>
      ` : ''}
      <div class="flex gap-3 justify-center">
        <button onclick="resetWizard()"
          class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-xl transition shadow-lg hover:shadow-xl">
          Créer un autre
        </button>
        <button onclick="init()"
          class="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 px-8 rounded-xl transition shadow-lg hover:shadow-xl">
          ← Menu
        </button>
      </div>
    </div>
  `
}

function navButtons(canNext) {
  return `
    <div class="flex justify-between mt-8">
      <button onclick="prevStep()" class="text-slate-400 hover:text-white transition ${state.step === 1 ? 'invisible' : ''}">
        ← Précédent
      </button>
      <button onclick="nextStep()" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-6 rounded-lg transition shadow ${!canNext ? 'opacity-50 cursor-not-allowed' : ''}" ${!canNext ? 'disabled' : ''}>
        Suivant →
      </button>
    </div>
  `
}

function bindStepEvents() {
  document.querySelectorAll('.wizard-card[data-type]').forEach(el => {
    el.addEventListener('click', () => {
      if (!el.classList.contains('disabled')) {
        state.type = el.dataset.type
        state.template = null
        state.templates = state.type === 'vm' ? state.templatesVm : state.templatesLxc
        render()
      }
    })
  })
  document.querySelectorAll('.template-card[data-volid]').forEach(el => {
    el.addEventListener('click', () => {
      const volid = el.dataset.volid
      state.template = state.templates.find(t => t.volid === volid) || null
      render()
    })
  })
}

function nextStep() {
  if (state.step === 1 && !state.type) return
  if (state.step === 2 && !state.template) return
  if (state.step === 5) return
  if (state.step < 5) {
    state.step++
    render()
  }
}

function prevStep() {
  if (state.step > 1) {
    state.step--
    render()
  }
}

function createResource() {
  const s = state
  if (!s.name) return

  if (!s.connected) {
    s.creating = true
    s.step = 6
    render()

    setTimeout(() => {
      s.result = {
        status: 'running',
        upid: `UPID:mock:00000000:${Date.now().toString(36)}:vzcreate:${Math.floor(Math.random() * 900 + 100)}:root@pam!`,
      }
      state.history.unshift({
        created_at: new Date().toISOString(),
        type: s.type,
        name: s.name,
        cpu: s.cpu,
        ram: s.ram,
        disk: s.disk,
        status: 'success',
      })
      s.creating = false
      render()
    }, 2000)
    return
  }

  const ipConfig = s.ipMode === 'static' && s.ipAddress
    ? `${s.ipAddress}/${s.ipMask || '24'}${s.ipGateway ? ',' + s.ipGateway : ''}`
    : 'dhcp'

  s.creating = true
  s.step = 6
  render()

  fetch('/api/proxmox/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: s.type,
      template: s.template.volid,
      cpu: s.cpu,
      ram: s.ram,
      disk: s.disk,
      storage: s.storage,
      bridge: s.bridge,
      name: s.name,
      ip_config: ipConfig,
    }),
  })
    .then(async resp => {
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.detail || 'Erreur serveur')
      s.result = data
      state.history.unshift({
        created_at: new Date().toISOString(),
        type: s.type,
        name: s.name,
        cpu: s.cpu,
        ram: s.ram,
        disk: s.disk,
        status: 'success',
      })
    })
    .catch(e => {
      s.result = { status: 'error', error: e.message }
    })
    .finally(() => {
      s.creating = false
      render()
    })
}

function showHistory() {
  state.step = -1
  const app = document.getElementById('app')
  const entries = state.history || []

  app.innerHTML = `
    <div class="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 shadow-lg border border-slate-700/50">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-bold">Historique des créations</h2>
        <button onclick="init()" class="text-sm text-slate-400 hover:text-white transition flex items-center gap-1">← Retour</button>
      </div>
      ${entries.length === 0 ? `
        <p class="text-slate-400 text-center py-12">Aucune création pour l'instant.</p>
      ` : `
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-slate-400 border-b border-slate-700">
                <th class="text-left py-2.5 pr-4">Date</th>
                <th class="text-left py-2.5 pr-4">Type</th>
                <th class="text-left py-2.5 pr-4">Nom</th>
                <th class="text-left py-2.5 pr-4">CPU/RAM/Disque</th>
                <th class="text-left py-2.5">Statut</th>
              </tr>
            </thead>
            <tbody>
              ${entries.map(e => {
                const date = e.created_at ? new Date(e.created_at).toLocaleString('fr-FR') : '—'
                const typeLabel = e.type === 'vm' ? 'VM' : 'LXC'
                const specs = `${e.cpu}c / ${(e.ram/1024).toFixed(1)}G / ${e.disk}G`
                return `<tr class="border-b border-slate-700/50 hover:bg-slate-700/20 transition">
                  <td class="py-2.5 pr-4 text-slate-300 whitespace-nowrap">${date}</td>
                  <td class="py-2.5 pr-4"><span class="bg-slate-700 text-xs px-2 py-0.5 rounded">${typeLabel}</span></td>
                  <td class="py-2.5 pr-4 text-white font-medium">${escapeHtml(e.name)}</td>
                  <td class="py-2.5 pr-4 text-slate-300 text-xs">${specs}</td>
                  <td class="py-2.5">${e.status === 'success'
                    ? '<span class="text-green-400">✓ Succès</span>'
                    : '<span class="text-red-400">✗ Erreur</span>'}</td>
                </tr>`
              }).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `
}

function resetWizard() {
  state.step = 0
  state.type = null
  state.template = null
  state.cpu = 2
  state.ram = 2048
  state.disk = 20
  state.bridge = state.bridges.length > 0 ? state.bridges[0].iface : ''
  state.ipMode = 'dhcp'
  state.ipAddress = ''
  state.ipMask = ''
  state.ipGateway = ''
  state.name = ''
  state.creating = false
  state.result = null
  render()
}

init()
