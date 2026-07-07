const STEPS = [
  { id: 'type',label:'Type' },{ id: 'template',label:'OS' },
  { id: 'resources',label:'Ressources' },{ id: 'network',label:'Réseau' },
  { id: 'confirm',label:'Confirmation' },
]

let state = {
  page:'dashboard', step:0, type:null, templatesLxc:[], templatesVm:[], templates:[],
  template:null, cpu:2, ram:2048, disk:20, storage:'', bridges:[], bridge:'',
  ipMode:'dhcp', ipAddress:'', ipMask:'', ipGateway:'', name:'', vmid:null,
  nodeResources:null, creating:false, result:null, history:[], vms:[], connected:false,
  search:'', taskUpid:null, taskStatus:null,
}

const MOCK = {
  templatesLxc:[{volid:"local:vztmpl/debian-12-standard_12.7-1_amd64.tar.zst",size:235929600},{volid:"local:vztmpl/ubuntu-24.04-standard_24.04-2_amd64.tar.zst",size:268435456},{volid:"local:vztmpl/alpine-3.21-default_20250108_amd64.tar.xz",size:8388608}],
  templatesVm:[{volid:"local:iso/debian-12.10.0-amd64-netinst.iso",size:734003200},{volid:"local:iso/ubuntu-24.04.1-live-server-amd64.iso",size:1610612736}],
  bridges:[{iface:"vmbr0",cidr:"192.168.1.0/24"},{iface:"vmbr1",cidr:"10.0.0.0/24"}],
  nodeResources:{cpu_max:16,memory_max:34359738368,memory_used:12884901888,disk_max:68719476736,disk_used:21474836480},
  vms:[{vmid:100,name:"proxy-web",type:"lxc",status:"running",cpu:0.05,mem:805306368,maxmem:1073741824,disk:4294967296,maxdisk:8589934592,uptime:86400,node:"pve"},{vmid:101,name:"base-debian",type:"lxc",status:"stopped",cpu:0,mem:0,maxmem:536870912,disk:4294967296,maxdisk:5368709120,uptime:0,node:"pve"},{vmid:102,name:"serveur-app",type:"qemu",status:"running",cpu:0.5,mem:4294967296,maxmem:8589934592,disk:53687091200,maxdisk:107374182400,uptime:604800,node:"pve"}],
}

function e(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}
function pct(a,b){return b>0?Math.round((a/b)*100):0}
function barC(p){return p>=90?'bg-red-500':p>=70?'bg-amber-500':'bg-blue-500'}
function fmtSize(v){if(!v)return'0 Go';const g=v/1073741824;return g>=1024?(g/1024).toFixed(1)+' To':g.toFixed(1)+' Go'}
function fmtUptime(s){if(!s||s<=0)return'—';const d=Math.floor(s/86400),h=Math.floor((s%86400)/3600);return d>0?`${d}j ${h}h`:`${h}h`}
function clamp(v,mn,mx){return Math.max(mn,Math.min(mx,v))}
function nextVmid(){const ids=state.vms.map(v=>v.vmid).filter(Boolean);return ids.length>0?Math.max(...ids)+1:100}

function statusBadge(){return state.connected
  ?'<span class="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-900/30 px-2.5 py-1 rounded-full border border-emerald-700/30"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-500/50"></span>Connecté</span>'
  :'<span class="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 bg-amber-900/30 px-2.5 py-1 rounded-full border border-amber-700/30"><span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>Mode démo</span>'}

function nav(page,label){return`<button onclick="navigate('${page}')" class="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">${label}</button>`}

// ---- TOAST ----

function toast(msg,type='info'){
  const colors={info:'bg-blue-600/90',success:'bg-emerald-600/90',error:'bg-red-600/90',warning:'bg-amber-600/90'}
  const el=document.createElement('div')
  el.className=`fixed bottom-6 right-6 z-50 ${colors[type]||colors.info} backdrop-blur-xl text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-2xl border border-white/10 animate-[slideUp_0.3s_cubic-bezier(0.16,1,0.3,1)]`
  el.innerHTML=msg
  document.body.appendChild(el)
  setTimeout(()=>{el.style.opacity='0';el.style.transition='opacity 0.3s';setTimeout(()=>el.remove(),300)},3500)
}

// ---- INIT ----

function setMock(){
  Object.assign(state,{templatesLxc:MOCK.templatesLxc,templatesVm:MOCK.templatesVm,templates:MOCK.templatesLxc,bridges:MOCK.bridges,nodeResources:MOCK.nodeResources,vms:MOCK.vms,storage:'local'})
  if(state.bridges.length)state.bridge=state.bridges[0].iface
}

async function tryConnect(){
  try{
    const h=await(await fetch('/api/proxmox/health')).json()
    if(h.status!=='ok')throw Error()
    const[lxc,vm,br,res,vms]=await Promise.all([
      fetch('/api/proxmox/templates?type=lxc').then(r=>r.json()),
      fetch('/api/proxmox/templates?type=vm').then(r=>r.json()),
      fetch('/api/proxmox/bridges').then(r=>r.json()),
      fetch('/api/proxmox/resources').then(r=>r.json()),
      fetch('/api/proxmox/vms').then(r=>r.json()),
    ])
    Object.assign(state,{templatesLxc:lxc.data,templatesVm:vm.data,templates:lxc.data,bridges:br.data,nodeResources:res.data,vms:vms.data||[],storage:'local'})
    if(state.bridges.length)state.bridge=state.bridges[0].iface
    state.connected=true
  }catch{setMock();state.connected=false}
  render()
}

function init(){setMock();render();tryConnect()}

// ---- NAV ----

function navigate(page){state.page=page;render()}

function render(){
  if(state.page==='dashboard')renderDashboard()
  else if(state.page==='wizard')renderWizard()
  else if(state.page==='history')renderHistory()
}

// ===================== DASHBOARD =====================

async function refreshData(){
  if(!state.connected)return
  try{
    const[res,vms]=await Promise.all([
      fetch('/api/proxmox/resources').then(r=>r.json()),
      fetch('/api/proxmox/vms').then(r=>r.json()),
    ])
    state.nodeResources=res.data;state.vms=vms.data||[]
    render()
  }catch{toast('Impossible de rafraîchir','error')}
}

async function vmAction(vmid,type,action){
  const names={start:'Démarrage',stop:'Arrêt',delete:'Suppression'}
  const labels={start:'démarrer',stop:'arrêter',delete:'supprimer'}
  if(action==='delete'&&!confirm(`Supprimer définitivement la machine ${vmid} ?`))return
  try{
    const method=action==='delete'?'DELETE':'POST'
    const ep=action==='delete'?`/api/proxmox/${type}/${vmid}`:`/api/proxmox/${type}/${vmid}/${action}`
    const r=await fetch(ep,{method})
    const d=await r.json()
    if(!r.ok)throw new Error(d.detail||'Erreur')
    toast(`${names[action]} de ${vmid} lancé`,`success`)
    setTimeout(refreshData,2000)
  }catch(e){toast(`Erreur: ${e.message}`,'error')}
}

function renderDashboard(){
  const s=state,res=s.nodeResources||{}
  const memMax=res.memory_max||0,memUsed=res.memory_used||0,dkMax=res.disk_max||0,dkUsed=res.disk_used||0
  const mp=pct(memUsed,memMax),dp=pct(dkUsed,dkMax),rn=s.vms.filter(v=>v.status==='running').length
  const filtered=s.search?s.vms.filter(v=>v.name.toLowerCase().includes(s.search.toLowerCase())||String(v.vmid).includes(s.search)):s.vms

  document.getElementById('app').innerHTML=`
  <div class="page min-h-screen">
    <div class="max-w-5xl mx-auto px-6 py-8">
      <!-- Top -->
      <div class="flex items-center justify-between mb-10">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-blue-500/20">P</div>
          <div><h1 class="text-base font-semibold text-white tracking-tight">ProvisionOps</h1><p class="text-xs text-slate-500">Autoservice Proxmox</p></div>
        </div>
        <div class="flex items-center gap-2.5">
          ${statusBadge()}
          <button onclick="refreshData()" class="text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/5" title="Rafraîchir">↻</button>
          <button onclick="navigate('history')" class="text-sm text-slate-400 hover:text-white transition-colors">Historique</button>
        </div>
      </div>

      <!-- Tiles -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <div class="stat-tile"><div class="stat-icon" style="background:rgba(59,130,246,0.12)">&#9632;</div><div class="stat-val">${s.templatesLxc.length}</div><div class="stat-lbl">Templates LXC</div></div>
        <div class="stat-tile"><div class="stat-icon" style="background:rgba(99,102,241,0.12)">&#9671;</div><div class="stat-val">${s.templatesVm.length}</div><div class="stat-lbl">ISOs VM</div></div>
        <div class="stat-tile"><div class="stat-icon" style="background:rgba(16,185,129,0.12)">&#127961;</div><div class="stat-val">${s.bridges.length}</div><div class="stat-lbl">Bridges</div></div>
        <div class="stat-tile"><div class="stat-icon" style="background:rgba(139,92,246,0.12)">&#9889;</div><div class="stat-val">${rn}<span class="text-sm font-normal text-slate-500">/${s.vms.length-rn}</span></div><div class="stat-lbl">En ligne</div></div>
      </div>

      <!-- Bars -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        <div class="glass rounded-2xl p-5">
          <div class="flex items-center justify-between mb-2"><span class="text-sm font-medium text-slate-300">RAM</span><span class="text-sm font-semibold text-white">${fmtSize(memUsed)} / ${fmtSize(memMax)}</span></div>
          <div class="h-1.5 bg-slate-700/50 rounded-full overflow-hidden"><div class="h-full ${barC(mp)} rounded-full transition-all duration-500" style="width:${mp}%"></div></div>
          <div class="flex justify-between mt-1.5"><span class="text-xs text-slate-600">${mp}% utilisé</span><span class="text-xs text-slate-600">${100-mp}% libre</span></div>
        </div>
        <div class="glass rounded-2xl p-5">
          <div class="flex items-center justify-between mb-2"><span class="text-sm font-medium text-slate-300">Stockage</span><span class="text-sm font-semibold text-white">${fmtSize(dkUsed)} / ${fmtSize(dkMax)}</span></div>
          <div class="h-1.5 bg-slate-700/50 rounded-full overflow-hidden"><div class="h-full ${barC(dp)} rounded-full transition-all duration-500" style="width:${dp}%"></div></div>
          <div class="flex justify-between mt-1.5"><span class="text-xs text-slate-600">${dp}% utilisé</span><span class="text-xs text-slate-600">${100-dp}% libre</span></div>
        </div>
      </div>

      <!-- VM Table -->
      <div class="glass rounded-2xl p-6 mb-8">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-semibold text-white">Machines</h2>
          <div class="flex items-center gap-3">
            <input type="text" placeholder="Rechercher..." value="${e(s.search)}" oninput="state.search=this.value;renderDashboard()"
              class="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-600 outline-none focus:border-blue-500/50 w-40">
            <span class="text-xs text-slate-500">${filtered.length}/${s.vms.length}</span>
          </div>
        </div>
        ${filtered.length===0?`<p class="text-slate-600 text-sm text-center py-8">${s.vms.length===0?'Aucune machine':'Aucun résultat'}</p>`:`
        <div class="overflow-x-auto -mx-6 px-6">
          <table class="w-full text-sm">
            <thead><tr class="text-xs text-slate-600 border-b border-white/5">
              <th class="text-left py-2.5 pr-3 font-medium">VMID</th><th class="text-left py-2.5 pr-3 font-medium">Nom</th>
              <th class="text-left py-2.5 pr-3 font-medium">Type</th><th class="text-left py-2.5 pr-3 font-medium">Statut</th>
              <th class="text-left py-2.5 pr-3 font-medium">CPU</th><th class="text-left py-2.5 pr-3 font-medium">RAM</th>
              <th class="text-left py-2.5 pr-3 font-medium">Disque</th><th class="text-left py-2.5 font-medium">Actions</th>
            </tr></thead>
            <tbody>${filtered.map(v=>{
              const isVm=v.type==='qemu',tp=v.type==='qemu'?'vm':'lxc'
              return `<tr class="vm-row border-b border-white/5">
                <td class="py-3 pr-3 text-slate-400 font-mono text-xs">${v.vmid}</td>
                <td class="py-3 pr-3 text-white font-medium">${e(v.name)}</td>
                <td class="py-3 pr-3"><span class="text-xs px-2 py-0.5 rounded-full ${isVm?'bg-indigo-900/30 text-indigo-300':'bg-blue-900/30 text-blue-300'}">${isVm?'VM':'LXC'}</span></td>
                <td class="py-3 pr-3"><span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full ${v.status==='running'?'bg-emerald-500 shadow-sm shadow-emerald-500/40':'bg-slate-600'}"></span><span class="text-xs ${v.status==='running'?'text-emerald-400':'text-slate-500'}">${v.status==='running'?'En ligne':'Arrêté'}</span></span></td>
                <td class="py-3 pr-3 text-xs text-slate-300">${v.maxmem?Math.round((v.cpu||0)*100):0}%</td>
                <td class="py-3 pr-3"><div class="flex items-center gap-2"><span class="text-xs text-slate-300">${fmtSize(v.mem)}</span><div class="w-12 h-1 bg-slate-700/50 rounded-full overflow-hidden hidden sm:block"><div class="h-full ${barC(pct(v.mem,v.maxmem))} rounded-full" style="width:${pct(v.mem,v.maxmem)}%"></div></div></div></td>
                <td class="py-3 pr-3 text-xs text-slate-300">${fmtSize(v.disk)}</td>
                <td class="py-3 flex gap-1.5">
                  ${v.status==='running'?`<button onclick="vmAction(${v.vmid},'${tp}','stop')" class="text-xs px-2 py-1 rounded-lg bg-amber-900/30 text-amber-400 hover:bg-amber-900/50 transition" title="Arrêter">&#9632;</button>`:`<button onclick="vmAction(${v.vmid},'${tp}','start')" class="text-xs px-2 py-1 rounded-lg bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50 transition" title="Démarrer">&#9654;</button>`}
                  <button onclick="vmAction(${v.vmid},'${tp}','delete')" class="text-xs px-2 py-1 rounded-lg bg-red-900/30 text-red-400 hover:bg-red-900/50 transition" title="Supprimer">&#10005;</button>
                </td>
              </tr>`
            }).join('')}</tbody>
          </table>
        </div>`}
      </div>

      <!-- Create -->
      <div class="glass rounded-2xl p-8 text-center">
        <h2 class="text-xl font-bold text-white mb-1 tracking-tight">Nouvelle ressource</h2>
        <p class="text-sm text-slate-400 mb-7">Assistant pas-à-pas pour provisionner</p>
        <div class="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
          <button onclick="startWizard('lxc')" class="flex-1 bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold py-5 px-6 rounded-xl transition-all duration-200 shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30 hover:-translate-y-0.5">
            <div class="text-2xl mb-1.5">&#9632;</div><div class="text-sm">Nouveau LXC</div><div class="text-xs text-blue-200/70 font-normal mt-0.5">Conteneur léger</div>
          </button>
          <button onclick="startWizard('vm')" class="flex-1 bg-gradient-to-br from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-semibold py-5 px-6 rounded-xl transition-all duration-200 shadow-lg shadow-indigo-600/20 hover:shadow-indigo-500/30 hover:-translate-y-0.5">
            <div class="text-2xl mb-1.5">&#9671;</div><div class="text-sm">Nouvelle VM</div><div class="text-xs text-indigo-200/70 font-normal mt-0.5">Machine complète</div>
          </button>
        </div>
      </div>
    </div>
  </div>`
}

// ===================== WIZARD =====================

function startWizard(type){
  state.page='wizard';state.step=1;state.type=type;state.template=null
  state.templates=type==='vm'?state.templatesVm:state.templatesLxc
  state.name='';state.vmid=null;state.creating=false;state.result=null;state.taskUpid=null;state.taskStatus=null
  state.cpu=2;state.ram=2048;state.disk=20;state.ipMode='dhcp';state.ipAddress='';state.ipMask='';state.ipGateway=''
  renderWizard()
}

function renderWizard(){
  if(state.creating||state.result){renderWizardResult();return}
  document.getElementById('app').innerHTML=`
  <div class="page min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900">
    <div class="max-w-2xl mx-auto px-6 py-8">
      <div class="flex items-center justify-between mb-8">${nav('dashboard','← Retour')}<span class="text-xs text-slate-600 font-medium">Étape ${state.step}/5</span></div>
      <div class="step-track mb-10">${STEPS.map((s,i)=>`
        ${i>0?`<div class="step-line ${i<=state.step?'done':''}"></div>`:''}
        <div class="step-dot ${i+1===state.step?'active':''} ${i+1<state.step?'done':''}">${i+1<state.step?'✓':(i+1)}</div>
      `).join('')}</div>
      <div class="step-fade">${renderWizardStep()}</div>
    </div>
  </div>`
  bindWizardEvents()
}

function renderWizardStep(){
  switch(state.step){
    case 1:return stepType()
    case 2:return stepTemplate()
    case 3:return stepResources()
    case 4:return stepNetwork()
    case 5:return stepConfirm()
    default:return''
  }
}

function stepType(){const s=state;return`
  <h2 class="text-2xl font-bold text-white mb-2 tracking-tight">Type de ressource</h2>
  <p class="text-sm text-slate-400 mb-7">Que veux-tu créer ?</p>
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <div class="select-card ${s.type==='lxc'?'selected':''}" data-type="lxc"><div class="text-3xl mb-2">&#9632;</div><h3 class="text-base font-semibold text-white">Conteneur LXC</h3><p class="text-sm text-slate-400 mt-1">Partage le noyau hôte.</p></div>
    <div class="select-card ${s.type==='vm'?'selected':''}" data-type="vm"><div class="text-3xl mb-2">&#9671;</div><h3 class="text-base font-semibold text-white">Machine Virtuelle</h3><p class="text-sm text-slate-400 mt-1">Noyau dédié.</p></div>
  </div>${navButtons(s.type!==null,1)}`}

function stepTemplate(){const s=state,l=s.type==='lxc'?'template LXC':'ISO VM'
  if(s.templates.length===0)return`<p class="text-slate-500">Aucun ${l}.</p>${navButtons(false,2)}`
  return`<h2 class="text-2xl font-bold text-white mb-2 tracking-tight">Système d'exploitation</h2>
  <p class="text-sm text-slate-400 mb-7">Choisis un ${l} :</p>
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mb-6">${s.templates.map(t=>{
    const n=t.volid.split('/').pop().replace(/\.(tar\.(gz|zst|bz2|xz)|img|iso)$/,'').replace(/-standard|_amd64|_arm64/g,'')
    const sel=s.template&&s.template.volid===t.volid
    return`<div class="tpl-card ${sel?'selected':''}" data-volid="${e(t.volid)}"><div class="text-sm font-medium text-white">${e(n)}</div><div class="text-xs text-slate-500 mt-0.5">${(t.size/1048576).toFixed(0)} Mo</div></div>`
  }).join('')}</div>${navButtons(s.template!==null,2)}`}

function stepResources(){const s=state,res=s.nodeResources||{},mxC=Math.min(res.cpu_max||8,32),mxR=Math.min(Math.floor((res.memory_max||17179869184)/1048576),65536),mxD=Math.min(Math.floor((res.disk_max||107374182400)/1073741824),500)
  return`<h2 class="text-2xl font-bold text-white mb-2 tracking-tight">Ressources</h2>
  <p class="text-sm text-slate-400 mb-7">Alloue CPU, RAM et disque</p>
  <div class="space-y-3">
    <div class="resource-card"><div class="flex items-center justify-between mb-3"><span class="text-sm font-medium text-slate-300">Processeurs</span><div class="flex items-center gap-2"><input type="number" value="${s.cpu}" min="1" max="${mxC}" onchange="state.cpu=clamp(+this.value,1,${mxC});renderWizard()" class="res-in"><span class="text-xs text-slate-500 w-12">cœur${s.cpu>1?'s':''}</span></div></div><input type="range" min="1" max="${mxC}" value="${s.cpu}" oninput="state.cpu=+this.value;renderWizard()" class="w-full"><div class="flex justify-between mt-1"><span class="text-xs text-slate-600">1</span><span class="text-xs text-slate-600">${mxC}</span></div></div>
    <div class="resource-card"><div class="flex items-center justify-between mb-3"><span class="text-sm font-medium text-slate-300">Mémoire RAM</span><div class="flex items-center gap-2"><input type="number" value="${(s.ram/1024)}" min="0.25" max="${(mxR/1024)}" step="0.25" onchange="state.ram=clamp(Math.round(+this.value*1024),256,${mxR});renderWizard()" class="res-in"><span class="text-xs text-slate-500 w-8">Go</span></div></div><input type="range" min="256" max="${mxR}" value="${s.ram}" step="256" oninput="state.ram=+this.value;renderWizard()" class="w-full"><div class="flex justify-between mt-1"><span class="text-xs text-slate-600">256 Mo</span><span class="text-xs text-slate-600">${(mxR/1024).toFixed(0)} Go</span></div></div>
    <div class="resource-card"><div class="flex items-center justify-between mb-3"><span class="text-sm font-medium text-slate-300">Stockage</span><div class="flex items-center gap-2"><input type="number" value="${s.disk}" min="1" max="${mxD}" onchange="state.disk=clamp(+this.value,1,${mxD});renderWizard()" class="res-in"><span class="text-xs text-slate-500 w-8">Go</span></div></div><input type="range" min="1" max="${mxD}" value="${s.disk}" oninput="state.disk=+this.value;renderWizard()" class="w-full"><div class="flex justify-between mt-1"><span class="text-xs text-slate-600">1 Go</span><span class="text-xs text-slate-600">${mxD} Go</span></div></div>
  </div>${navButtons(true,3)}`}

function stepNetwork(){const s=state;return`
  <h2 class="text-2xl font-bold text-white mb-2 tracking-tight">Réseau</h2>
  <p class="text-sm text-slate-400 mb-7">Configure l'interface réseau</p>
  <div class="space-y-4">
    <div><label class="text-sm text-slate-300 mb-1.5 block font-medium">Bridge</label><select onchange="state.bridge=this.value" class="inp w-full">${s.bridges.map(b=>`<option value="${e(b.iface)}" ${b.iface===s.bridge?'selected':''}>${e(b.iface)}${b.cidr?' ('+e(b.cidr)+')':''}</option>`).join('')}</select></div>
    <div><label class="text-sm text-slate-300 mb-2 block font-medium">Adressage IP</label><div class="flex gap-4"><label class="flex items-center gap-2 cursor-pointer"><input type="radio" name="ip" value="dhcp" ${s.ipMode==='dhcp'?'checked':''} onchange="state.ipMode='dhcp';renderWizard()" class="accent-blue-500"><span class="text-sm text-white">DHCP</span></label><label class="flex items-center gap-2 cursor-pointer"><input type="radio" name="ip" value="static" ${s.ipMode==='static'?'checked':''} onchange="state.ipMode='static';renderWizard()" class="accent-blue-500"><span class="text-sm text-white">Statique</span></label></div></div>
    ${s.ipMode==='static'?`<div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5"><div><label class="text-xs text-slate-500 mb-1 block">Adresse</label><input type="text" value="${e(s.ipAddress)}" placeholder="192.168.1.100" oninput="state.ipAddress=this.value" class="inp w-full text-sm"></div><div><label class="text-xs text-slate-500 mb-1 block">Masque</label><input type="text" value="${e(s.ipMask)}" placeholder="24" oninput="state.ipMask=this.value" class="inp w-full text-sm"></div><div><label class="text-xs text-slate-500 mb-1 block">Passerelle</label><input type="text" value="${e(s.ipGateway)}" placeholder="192.168.1.1" oninput="state.ipGateway=this.value" class="inp w-full text-sm"></div></div>`:''}
  </div>${navButtons(true,4)}`}

function stepConfirm(){const s=state,isVm=s.type==='vm',rl=isVm?'machine virtuelle':'conteneur',tn=s.template?s.template.volid.split('/').pop():'—'
  if(!s.vmid)state.vmid=nextVmid()
  return`<h2 class="text-2xl font-bold text-white mb-2 tracking-tight">Confirmation</h2>
  <p class="text-sm text-slate-400 mb-7">Vérifie les paramètres avant création</p>
  <div class="glass rounded-2xl p-6 space-y-3 mb-6">${[
    ['Type',isVm?'VM':'LXC'],['Template',tn],['CPU',`${s.cpu} cœur${s.cpu>1?'s':''}`],
    ['RAM',`${(s.ram/1024).toFixed(1)} Go`],['Disque',`${s.disk} Go`],['Bridge',s.bridge],
    ['IP',s.ipMode==='dhcp'?'DHCP':(s.ipAddress||'—')],
  ].map(([k,v])=>`<div class="flex justify-between items-center py-0.5"><span class="text-sm text-slate-400">${k}</span><span class="text-sm text-white font-medium">${v}</span></div>`).join('')}
    <div class="border-t border-white/5 pt-3 mt-3 space-y-3">
      <div><label class="text-sm text-slate-400 block mb-1">VMID</label><input type="number" value="${s.vmid||nextVmid()}" min="100" max="999999999" onchange="state.vmid=+this.value;renderWizard()" class="inp w-full text-sm"></div>
      <div><label class="text-sm text-slate-400 block mb-1">Nom de la ${rl}</label><input type="text" value="${e(s.name)}" placeholder="ma-${rl}" oninput="state.name=this.value;renderWizard()" class="inp w-full text-sm" maxlength="32"><p class="text-xs text-slate-600 mt-1">a-z, 0-9, tirets (max 32 car.)</p></div>
    </div>
  </div>
  <button onclick="createResource()" class="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 text-base shadow-lg shadow-emerald-600/20 hover:shadow-emerald-500/30 ${!s.name?'opacity-40 cursor-not-allowed':''}" ${!s.name?'disabled':''}>&#9654; Lancer la création</button>
  <div class="flex justify-center mt-4">${nav('dashboard','← Retour au menu')}</div>`}

function renderWizardResult(){
  const s=state,app=document.getElementById('app')
  if(s.creating&&!s.taskStatus&&!s.result){
    app.innerHTML=`
    <div class="page min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900">
      <div class="max-w-lg mx-auto px-6 py-8 text-center">
        <div class="flex items-center justify-between mb-8">${nav('dashboard','← Retour')}<span class="text-xs text-slate-600 font-medium">Création</span></div>
        <div class="pt-12">
          <div class="relative inline-flex mb-7"><div class="animate-spin h-16 w-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full"></div><div class="absolute inset-0 flex items-center justify-center"><span class="text-2xl">&#9889;</span></div></div>
          <h2 class="text-xl font-bold text-white mb-2 tracking-tight">Création en cours...</h2>
          <p class="text-sm text-slate-400 mb-4">Provisionnement sur Proxmox</p>
          <div class="flex items-center justify-center gap-2 text-xs text-slate-600 bg-white/5 rounded-full px-4 py-2 max-w-xs mx-auto">
            <span>VMID ${s.vmid||'—'}</span><span class="w-1 h-1 bg-slate-700 rounded-full"></span><span>${s.type==='vm'?'VM':'LXC'}</span><span class="w-1 h-1 bg-slate-700 rounded-full"></span><span>${e(s.name||'—')}</span>
          </div>
          <div class="mt-10">${nav('dashboard','← Annuler')}</div>
        </div>
      </div>
    </div>`
    return
  }
  // Task polling result
  const ok=s.taskStatus==='OK'||(s.result&&s.result.status==='running')
  const rl=s.type==='vm'?'La VM':'Le conteneur'
  app.innerHTML=`
  <div class="page min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900">
    <div class="max-w-lg mx-auto px-6 py-8 text-center">
      <div class="flex items-center justify-between mb-8">${nav('dashboard','← Retour')}<span class="text-xs text-slate-600 font-medium">Résultat</span></div>
      <div class="pt-8">
        <div class="text-6xl mb-6 ${ok?'text-emerald-400':'text-red-400'}">${ok?'✓':'✗'}</div>
        <h2 class="text-xl font-bold text-white mb-2 tracking-tight">${ok?'Création terminée':'Erreur'}</h2>
        <p class="text-sm text-slate-400 mb-6 max-w-sm mx-auto">${ok?`${rl} (VMID ${s.vmid}) a été créée avec succès.`:e(s.result?.error||'Une erreur est survenue.')}</p>
        ${s.result?.upid?`<div class="glass rounded-xl p-4 mb-6 text-left max-w-sm mx-auto"><div class="text-xs text-slate-500 mb-1">UPID</div><div class="text-sm text-emerald-300 font-mono break-all">${e(s.result.upid)}</div></div>`:''}
        <div class="flex gap-3 justify-center">
          <button onclick="startWizard('${s.type}')" class="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-6 rounded-xl transition shadow-lg shadow-blue-600/20">Créer un autre</button>
          <button onclick="navigate('dashboard')" class="bg-white/10 hover:bg-white/15 text-white font-semibold py-3 px-6 rounded-xl transition">← Menu</button>
        </div>
      </div>
    </div>
  </div>`
}

async function pollTask(upid){
  if(!upid||!state.connected)return
  for(let i=0;i<30;i++){
    try{
      const r=await fetch(`/api/proxmox/task/${encodeURIComponent(upid)}`)
      const d=await r.json()
      const st=d.data||{}
      if(st.status==='stopped'){
        state.taskStatus=st.exitstatus||'OK'
        state.creating=false
        // update the vms list in background
        try{const v=await(await fetch('/api/proxmox/vms')).json();state.vms=v.data||[]}catch{}
        toast(state.taskStatus==='OK'?'Création terminée avec succès':'La création a échoué',state.taskStatus==='OK'?'success':'error')
        renderWizardResult()
        return
      }
    }catch{}
    await new Promise(r=>setTimeout(r,2000))
  }
  // timeout - show result anyway
  state.creating=false
  if(!state.result)state.result={status:'running',upid}
  renderWizardResult()
  toast('La tâche est toujours en cours (vérifie Proxmox)','warning')
}

function navButtons(can,step){return`
  <div class="flex items-center justify-between mt-8">
    <button onclick="prevStep()" class="text-sm text-slate-400 hover:text-white transition-colors ${step===1?'invisible':''}">← Précédent</button>
    <button onclick="nextStep()" class="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 px-6 rounded-xl transition-all duration-200 shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30 ${!can?'opacity-40 cursor-not-allowed':''}" ${!can?'disabled':''}>Suivant →</button>
  </div>`}

function bindWizardEvents(){
  document.querySelectorAll('.select-card[data-type]').forEach(el=>{el.addEventListener('click',()=>{if(!el.classList.contains('disabled')){state.type=el.dataset.type;state.template=null;state.templates=state.type==='vm'?state.templatesVm:state.templatesLxc;renderWizard()}})})
  document.querySelectorAll('.tpl-card[data-volid]').forEach(el=>{el.addEventListener('click',()=>{const v=el.dataset.volid;state.template=state.templates.find(t=>t.volid===v)||null;renderWizard()})})
}

function nextStep(){if(state.step===1&&!state.type)return;if(state.step===2&&!state.template)return;if(state.step>=5)return;state.step++;renderWizard()}
function prevStep(){if(state.step>1){state.step--;renderWizard()}}

function createResource(){
  const s=state
  if(!s.name)return
  if(!s.connected){
    s.creating=true;s.result=null;s.taskUpid=null;s.taskStatus=null;render()
    setTimeout(()=>{
      s.result={status:'running',upid:`UPID:mock:${Date.now().toString(36)}:vzcreate:${s.vmid||100}:root@pam!`}
      s.history.unshift({created_at:new Date().toISOString(),type:s.type,name:s.name,cpu:s.cpu,ram:s.ram,disk:s.disk,vmid:s.vmid,status:'success'})
      s.taskStatus='OK';s.creating=false;render()
    },2000)
    return
  }
  const ip=s.ipMode==='static'&&s.ipAddress?`${s.ipAddress}/${s.ipMask||'24'}${s.ipGateway?','+s.ipGateway:''}`:'dhcp'
  s.creating=true;s.result=null;s.taskUpid=null;s.taskStatus=null;render()
  fetch('/api/proxmox/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:s.type,template:s.template.volid,cpu:s.cpu,ram:s.ram,disk:s.disk,storage:s.storage,bridge:s.bridge,name:s.name,ip_config:ip,vmid:s.vmid})})
    .then(async r=>{
      const d=await r.json()
      if(!r.ok)throw new Error(d.detail||'Erreur')
      s.result=d
      s.history.unshift({created_at:new Date().toISOString(),type:s.type,name:s.name,cpu:s.cpu,ram:s.ram,disk:s.disk,vmid:s.vmid,status:'success'})
      toast('Création lancée, suivi en cours...','info')
      pollTask(d.upid)
    })
    .catch(e=>{s.result={status:'error',error:e.message};s.creating=false;toast(`Erreur: ${e.message}`,'error');render()})
}

// ===================== HISTORY =====================

function renderHistory(){
  const entries=state.history
  document.getElementById('app').innerHTML=`
  <div class="page min-h-screen">
    <div class="max-w-3xl mx-auto px-6 py-8">
      <div class="flex items-center justify-between mb-8">
        <div class="flex items-center gap-3"><div class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-blue-500/20">P</div><h1 class="text-base font-semibold text-white tracking-tight">Historique</h1></div>
        ${nav('dashboard','← Retour')}
      </div>
      <div class="glass rounded-2xl p-6">
        ${entries.length===0?`<p class="text-slate-600 text-sm text-center py-10">Aucune création pour l'instant.</p>`:`
        <div class="overflow-x-auto -mx-6 px-6">
          <table class="w-full text-sm">
            <thead><tr class="text-xs text-slate-600 border-b border-white/5">
              <th class="text-left py-2.5 pr-4 font-medium">Date</th><th class="text-left py-2.5 pr-4 font-medium">VMID</th><th class="text-left py-2.5 pr-4 font-medium">Type</th><th class="text-left py-2.5 pr-4 font-medium">Nom</th><th class="text-left py-2.5 pr-4 font-medium">CPU/RAM/Disque</th><th class="text-left py-2.5 font-medium">Statut</th>
            </tr></thead>
            <tbody>${entries.map(e=>{
              const d=e.created_at?new Date(e.created_at).toLocaleString('fr-FR'):'—'
              return`<tr class="vm-row border-b border-white/5">
                <td class="py-3 pr-4 text-slate-300 whitespace-nowrap text-xs">${d}</td>
                <td class="py-3 pr-4 text-slate-400 font-mono text-xs">${e.vmid||'—'}</td>
                <td class="py-3 pr-4"><span class="text-xs px-2 py-0.5 rounded-full ${e.type==='vm'?'bg-indigo-900/30 text-indigo-300':'bg-blue-900/30 text-blue-300'}">${e.type==='vm'?'VM':'LXC'}</span></td>
                <td class="py-3 pr-4 text-white font-medium">${e.name||'—'}</td>
                <td class="py-3 pr-4 text-slate-300 text-xs">${e.cpu||'?'}c/${((e.ram||0)/1024).toFixed(1)}G/${e.disk||'?'}G</td>
                <td class="py-3">${e.status==='success'?'<span class="text-emerald-400 text-xs font-medium">✓ Succès</span>':'<span class="text-red-400 text-xs font-medium">✗ Erreur</span>'}</td>
              </tr>`
            }).join('')}</tbody>
          </table>
        </div>`}
      </div>
    </div>
  </div>`
}

init()
