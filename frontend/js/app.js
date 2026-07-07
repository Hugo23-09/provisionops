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
    disk_max: 68719476736,
  },
}

function init() {
  const app = document.getElementById('app')
  state.templatesLxc = MOCK.templatesLxc
  state.templatesVm = MOCK.templatesVm
  state.templates = state.templatesLxc
  state.bridges = MOCK.bridges
  state.nodeResources = MOCK.nodeResources
  state.storage = 'local'
  if (state.bridges.length > 0) state.bridge = state.bridges[0].iface
  render()
}

function renderDashboard() {
  const s = state
  const res = s.nodeResources || {}
  const ramGb = res.memory_max ? (res.memory_max / 1073741824).toFixed(1) : '?'
  const diskGb = res.disk_max ? (res.disk_max / 1073741824).toFixed(1) : '?'

  return `
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
      <div class="bg-slate-800 rounded-lg p-4 text-center border border-slate-700">
        <div class="text-slate-400 text-sm">Templates LXC</div>
        <div class="text-2xl font-bold text-white">${s.templatesLxc.length}</div>
      </div>
      <div class="bg-slate-800 rounded-lg p-4 text-center border border-slate-700">
        <div class="text-slate-400 text-sm">ISOs VM</div>
        <div class="text-2xl font-bold text-white">${s.templatesVm.length}</div>
      </div>
      <div class="bg-slate-800 rounded-lg p-4 text-center border border-slate-700">
        <div class="text-slate-400 text-sm">Bridges réseau</div>
        <div class="text-2xl font-bold text-white">${s.bridges.length}</div>
      </div>
      <div class="bg-slate-800 rounded-lg p-4 text-center border border-slate-700">
        <div class="text-slate-400 text-sm">RAM max</div>
        <div class="text-2xl font-bold text-white">${ramGb} Go</div>
      </div>
      <div class="bg-slate-800 rounded-lg p-4 text-center border border-slate-700">
        <div class="text-slate-400 text-sm">Disque max</div>
        <div class="text-2xl font-bold text-white">${diskGb} Go</div>
      </div>
    </div>

    <div class="bg-slate-800 rounded-xl p-8 shadow-lg border border-slate-700 text-center">
      <h2 class="text-2xl font-bold text-white mb-4">Créer une ressource</h2>
      <p class="text-slate-400 mb-6">Assistant pas-à-pas pour provisionner une VM ou un conteneur LXC sur Proxmox.</p>
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <button onclick="startWizard('lxc')"
          class="wizard-card flex-1 max-w-xs mx-auto sm:mx-0 text-center border-0 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-xl transition text-lg">
          <div class="text-3xl mb-2">&#9632;</div>
          <div>Conteneur LXC</div>
          <div class="text-sm text-blue-200 mt-1 font-normal">Disponible</div>
        </button>
        <button onclick="startWizard('vm')"
          class="wizard-card flex-1 max-w-xs mx-auto sm:mx-0 text-center border-0 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-xl transition text-lg">
          <div class="text-3xl mb-2">&#9671;</div>
          <div>Machine Virtuelle</div>
          <div class="text-sm text-blue-200 mt-1 font-normal">Disponible</div>
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
        <p class="text-sm text-slate-400 mt-1">Léger, partage le noyau hôte. Idéal pour services et applications.</p>
      </div>
      <div class="wizard-card ${s.type === 'vm' ? 'selected' : ''}" data-type="vm">
        <div class="text-3xl mb-2">&#9671;</div>
        <h3 class="text-lg font-semibold">Machine Virtuelle</h3>
        <p class="text-sm text-slate-400 mt-1">Noyau dédié, isolation complète. Idéal pour charges lourdes.</p>
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
      <div>
        <label class="flex justify-between text-sm mb-2">
          <span class="text-slate-300">CPU</span>
          <span class="text-blue-400 font-semibold">${s.cpu} cœur${s.cpu > 1 ? 's' : ''}</span>
        </label>
        <input type="range" min="1" max="${maxCpu}" value="${s.cpu}"
          oninput="state.cpu=+this.value; updateResourceDisplay()"
          class="w-full">
        <div class="flex justify-between text-xs text-slate-500 mt-1">
          <span>1</span>
          <span>${maxCpu}</span>
        </div>
      </div>

      <div>
        <label class="flex justify-between text-sm mb-2">
          <span class="text-slate-300">RAM</span>
          <span class="text-blue-400 font-semibold" id="ramDisplay">${(s.ram / 1024).toFixed(1)} Go</span>
        </label>
        <input type="range" min="256" max="${maxRam}" value="${s.ram}" step="256"
          oninput="state.ram=+this.value; updateResourceDisplay()"
          class="w-full">
        <div class="flex justify-between text-xs text-slate-500 mt-1">
          <span>256 Mo</span>
          <span>${(maxRam / 1024).toFixed(0)} Go</span>
        </div>
      </div>

      <div>
        <label class="flex justify-between text-sm mb-2">
          <span class="text-slate-300">Disque</span>
          <span class="text-blue-400 font-semibold" id="diskDisplay">${s.disk} Go</span>
        </label>
        <input type="range" min="1" max="${maxDisk}" value="${s.disk}"
          oninput="state.disk=+this.value; updateResourceDisplay()"
          class="w-full">
        <div class="flex justify-between text-xs text-slate-500 mt-1">
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
          class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white">
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
              class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">
          </div>
          <div>
            <label class="text-xs text-slate-400 mb-1 block">Masque</label>
            <input type="text" value="${escapeHtml(s.ipMask)}" placeholder="24"
              oninput="state.ipMask=this.value"
              class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">
          </div>
          <div>
            <label class="text-xs text-slate-400 mb-1 block">Passerelle</label>
            <input type="text" value="${escapeHtml(s.ipGateway)}" placeholder="192.168.1.1"
              oninput="state.ipGateway=this.value"
              class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">
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
    <div class="bg-slate-700/50 rounded-lg p-4 space-y-3 mb-6">
      <div class="flex justify-between"><span class="text-slate-400">Type</span><span class="text-white font-medium">${typeLabel}</span></div>
      <div class="flex justify-between"><span class="text-slate-400">Template</span><span class="text-white font-medium">${escapeHtml(templateName)}</span></div>
      <div class="flex justify-between"><span class="text-slate-400">CPU</span><span class="text-white font-medium">${s.cpu} cœur${s.cpu > 1 ? 's' : ''}</span></div>
      <div class="flex justify-between"><span class="text-slate-400">RAM</span><span class="text-white font-medium">${(s.ram / 1024).toFixed(1)} Go</span></div>
      <div class="flex justify-between"><span class="text-slate-400">Disque</span><span class="text-white font-medium">${s.disk} Go</span></div>
      <div class="flex justify-between"><span class="text-slate-400">Bridge</span><span class="text-white font-medium">${escapeHtml(s.bridge)}</span></div>
      <div class="flex justify-between"><span class="text-slate-400">IP</span><span class="text-white font-medium">${s.ipMode === 'dhcp' ? 'DHCP' : escapeHtml(s.ipAddress || '—')}</span></div>
      <div class="border-t border-slate-600 pt-3 mt-3">
        <div class="flex justify-between"><span class="text-slate-400">Nom de la ${resourceLabel}</span></div>
        <input type="text" value="${escapeHtml(s.name)}" placeholder="ma-${resourceLabel}"
          oninput="state.name=this.value"
          class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white mt-1 text-sm"
          maxlength="32" pattern="[a-z0-9-]+">
        <p class="text-xs text-slate-500 mt-1">Minuscules, chiffres et tirets uniquement (max 32 car.)</p>
      </div>
    </div>

    <button onclick="createResource()"
      class="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition text-lg ${!s.name ? 'opacity-50 cursor-not-allowed' : ''}"
      ${!s.name ? 'disabled' : ''}>
      Créer la ${resourceLabel}
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
      <div class="text-center py-8">
        <div class="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p class="text-lg text-slate-300">Création en cours...</p>
        <p class="text-sm text-slate-500 mt-2">La ressource est en cours de provisionnement sur Proxmox.</p>
      </div>
    `
  }

  const ok = s.result && s.result.status === 'running'
  const resourceLabel = s.type === 'vm' ? 'La machine virtuelle' : 'Le conteneur'
  return `
    <div class="text-center py-8">
      <div class="text-6xl mb-4 ${ok ? 'text-green-400' : 'text-red-400'}">
        ${ok ? '&#10003;' : '&#10007;'}
      </div>
      <h2 class="text-2xl font-semibold mb-2">${ok ? 'Création lancée' : 'Erreur'}</h2>
      <p class="text-slate-400 mb-6">${ok
        ? `${resourceLabel} est en cours de création sur Proxmox. Tu peux suivre la tâche ci-dessous.`
        : escapeHtml(s.result?.error || 'Une erreur est survenue.')}</p>
      ${ok ? `
        <div class="bg-slate-700/50 rounded-lg p-3 mb-6 text-left">
          <div class="text-xs text-slate-400">UPID</div>
          <div class="text-sm text-green-300 font-mono break-all">${escapeHtml(s.result.upid)}</div>
        </div>
      ` : ''}
      <button onclick="resetWizard()"
        class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-6 rounded-lg transition">
        Créer un autre
      </button>
    </div>
  `
}

function navButtons(canNext) {
  return `
    <div class="flex justify-between mt-8">
      <button onclick="prevStep()" class="text-slate-400 hover:text-white transition ${state.step === 1 ? 'invisible' : ''}">
        ← Précédent
      </button>
      <button onclick="nextStep()" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-5 rounded-lg transition ${!canNext ? 'opacity-50 cursor-not-allowed' : ''}" ${!canNext ? 'disabled' : ''}>
        Suivant →
      </button>
    </div>
  `
}

function updateResourceDisplay() {
  const ramEl = document.getElementById('ramDisplay')
  const diskEl = document.getElementById('diskDisplay')
  if (ramEl) ramEl.textContent = (state.ram / 1024).toFixed(1) + ' Go'
  if (diskEl) diskEl.textContent = state.disk + ' Go'
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
}

function showHistory() {
  state.step = -1
  const app = document.getElementById('app')
  const entries = state.history || []

  app.innerHTML = `
    <div class="bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-700">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-semibold">Historique des créations</h2>
        <button onclick="init()" class="text-sm text-slate-400 hover:text-white transition">← Retour</button>
      </div>
      ${entries.length === 0 ? `
        <p class="text-slate-400 text-center py-8">Aucune création pour l'instant.</p>
      ` : `
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-slate-400 border-b border-slate-700">
                <th class="text-left py-2 pr-4">Date</th>
                <th class="text-left py-2 pr-4">Type</th>
                <th class="text-left py-2 pr-4">Nom</th>
                <th class="text-left py-2 pr-4">CPU/RAM/Disque</th>
                <th class="text-left py-2">Statut</th>
              </tr>
            </thead>
            <tbody>
              ${entries.map(e => {
                const date = e.created_at ? new Date(e.created_at).toLocaleString('fr-FR') : '—'
                const typeLabel = e.type === 'vm' ? 'VM' : 'LXC'
                const specs = `${e.cpu}c / ${(e.ram/1024).toFixed(1)}G / ${e.disk}G`
                return `<tr class="border-b border-slate-700/50 hover:bg-slate-700/30">
                  <td class="py-2 pr-4 text-slate-300 whitespace-nowrap">${date}</td>
                  <td class="py-2 pr-4"><span class="bg-slate-700 text-xs px-2 py-0.5 rounded">${typeLabel}</span></td>
                  <td class="py-2 pr-4 text-white font-medium">${escapeHtml(e.name)}</td>
                  <td class="py-2 pr-4 text-slate-300 text-xs">${specs}</td>
                  <td class="py-2">${e.status === 'success'
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
