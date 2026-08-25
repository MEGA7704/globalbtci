const $=s=>document.querySelector(s);
const state={session:null,data:null,view:"dashboard",promoAt:0,reports:null};
const labels={dashboard:"Tableau de bord",projects:"Projets",expenses:"Dépenses",labor:"Main-d'œuvre",trades:"Corps de métier",suppliers:"Fournisseurs",reports:"Rapports",users:"Utilisateurs",import:"Import Excel",settings:"Paramètres",superDashboard:"Tableau de bord",companies:"Entreprises",superUsers:"Membres",subscriptions:"Abonnements",resets:"Réinitialisations",audit:"Journal système"};

function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]))}
function money(v){return new Intl.NumberFormat("fr-FR").format(Number(v||0))+" FCFA"}
function dateFr(v){if(!v)return"";const d=new Date(v.length===10?v+"T00:00:00":v);return Number.isNaN(+d)?v:d.toLocaleDateString("fr-FR")}
function toast(msg,error=false){const t=$("#toast");t.textContent=msg;t.className="toast"+(error?" error":"");setTimeout(()=>t.classList.add("hidden"),3200)}
function openModal(html){$("#modalContent").innerHTML=html;$("#modal").classList.remove("hidden")}
function closeModal(){$("#modal").classList.add("hidden");$("#modalContent").innerHTML=""}
$("#closeModal").onclick=closeModal;
$("#modal").addEventListener("click",e=>{if(e.target===$("#modal"))closeModal()});
function formData(form){return Object.fromEntries(new FormData(form).entries())}
async function api(path,opts={}){
  const headers={...(opts.body?{"content-type":"application/json"}:{}),...(opts.headers||{})};
  if(state.session?.csrf&&opts.method&&opts.method!=="GET")headers["X-CSRF-Token"]=state.session.csrf;
  const r=await fetch(path,{credentials:"same-origin",...opts,headers});
  const b=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(b.error||"Erreur serveur");
  return b;
}
function post(path,obj){return api(path,{method:"POST",body:JSON.stringify(obj)})}
function selectOptions(rows,value="id",label="name",selected=""){return `<option value="">— Sélectionner —</option>`+(rows||[]).map(r=>`<option value="${esc(r[value])}" ${String(r[value])===String(selected)?"selected":""}>${esc(r[label])}</option>`).join("")}
function projectOptions(selected=""){return selectOptions(state.data?.projects||[],"id","name",selected)}
function tradeOptions(projectId,selected=""){return selectOptions((state.data?.trades||[]).filter(t=>!projectId||t.project_id===projectId),"id","name",selected)}
function supplierOptions(selected=""){return selectOptions(state.data?.suppliers||[],"id","name",selected)}
function statusText(s){return ({preparation:"Préparation",in_progress:"En cours",suspended:"Suspendu",completed:"Terminé",active:"Actif",disabled:"Désactivé",deleted:"Supprimé"})[s]||s}
function table(headers,rows){return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")||`<tr><td colspan="${headers.length}" class="empty">Aucune donnée</td></tr>`}</tbody></table></div>`}
function kpi(label,value,cls=""){return `<div class="kpi ${cls}"><span>${esc(label)}</span><strong>${value}</strong></div>`}
function barChart(items,labelKey,valueKey){
  const max=Math.max(1,...items.map(x=>Number(x[valueKey]||0)));
  return `<div class="chart">${items.slice(0,12).map(x=>`<div class="bar-col"><b>${money(x[valueKey])}</b><div class="bar" style="height:${Math.max(4,150*Number(x[valueKey]||0)/max)}px"></div><small title="${esc(x[labelKey])}">${esc(x[labelKey])}</small></div>`).join("")||'<div class="empty">Pas encore de données</div>'}</div>`;
}
async function init(){
  try{
    await post("/api/bootstrap",{});
  }catch(err){
    $("#loginMessage").innerHTML=`Configuration Cloudflare incomplète : ${esc(err.message)}<br><small>Vérifiez D1, KV et les secrets du projet.</small>`;
  }
  try{state.session=await api("/api/session");await enter()}catch{}
}

function setAuthMode(mode){
  const login=mode==="login";
  $("#loginForm").classList.toggle("hidden",!login);
  $("#registerForm").classList.toggle("hidden",login);
  $("#forgotPassword").classList.toggle("hidden",!login);
  $("#showLogin").classList.toggle("active",login);
  $("#showRegister").classList.toggle("active",!login);
  $("#loginMessage").textContent="";
}
$("#showLogin").onclick=()=>setAuthMode("login");
$("#showRegister").onclick=()=>setAuthMode("register");
$("#toggleRegisterPassword").onclick=()=>{
  const i=$("#registerPassword");
  i.type=i.type==="password"?"text":"password";
  $("#toggleRegisterPassword").textContent=i.type==="password"?"Voir":"Masquer";
};
$("#registerForm").onsubmit=async e=>{
  e.preventDefault();
  $("#loginMessage").textContent="";
  const p1=$("#registerPassword").value,p2=$("#registerPassword2").value;
  if(p1!==p2){
    $("#loginMessage").textContent="Les deux mots de passe ne correspondent pas.";
    return;
  }
  try{
    state.session=await post("/api/register",{
      company_name:$("#registerCompany").value,
      city:$("#registerCity").value,
      full_name:$("#registerName").value,
      phone:$("#registerPhone").value,
      email:$("#registerEmail").value,
      password:p1
    });
    await enter();
  }catch(err){
    $("#loginMessage").textContent=err.message;
  }
};

$("#togglePassword").onclick=()=>{const i=$("#loginPassword");i.type=i.type==="password"?"text":"password";$("#togglePassword").textContent=i.type==="password"?"Voir":"Masquer"};
$("#loginForm").onsubmit=async e=>{
  e.preventDefault();$("#loginMessage").textContent="";
  try{state.session=await post("/api/login",{email:$("#loginEmail").value,password:$("#loginPassword").value});await enter()}
  catch(err){$("#loginMessage").textContent=err.message}
};
$("#forgotPassword").onclick=()=>openModal(`<h2>Mot de passe oublié</h2><p class="muted">Administrateur : réinitialisation par le Super Admin. Agent : réinitialisation par votre Administrateur.</p><form id="forgotForm" class="form-grid"><label class="span2">Votre e-mail<input name="email" type="email" required></label><button class="btn primary span2">Envoyer la demande</button></form><div id="forgotMsg" class="message"></div>`);
document.addEventListener("submit",async e=>{
  if(e.target.id==="forgotForm"){e.preventDefault();try{const r=await post("/api/password-reset/request",formData(e.target));$("#forgotMsg").textContent=r.message}catch(err){$("#forgotMsg").textContent=err.message}}
});

async function enter(){
  $("#loginScreen").classList.add("hidden");$("#appShell").classList.remove("hidden");
  $("#userBadge").textContent=`${state.session.user.full_name} · ${state.session.user.role}`;
  $("#roleEyebrow").textContent=state.session.user.role==="superadmin"?"SUPER ADMINISTRATION":"ESPACE ENTREPRISE";
  if(state.session.company)$("#planBadge").textContent=`${state.session.company.plan.toUpperCase()} · expire le ${dateFr(state.session.company.plan_expires_at)}`; else $("#planBadge").textContent="SUPER ADMIN";
  buildNav();await reload();
  if(state.session.user.must_change_password)showChangePassword(true);
  if(state.session.user.role==="superadmin")navigate("superDashboard");else navigate("dashboard");
  maybePromo(true);
}
function buildNav(){
  const superadmin=state.session.user.role==="superadmin";
  const admin=state.session.user.role==="admin";
  const items=superadmin?[
    ["superDashboard","Tableau de bord"],["companies","Entreprises"],["superUsers","Membres"],["subscriptions","Abonnements"],["resets","Réinitialisations"],["audit","Journal"]
  ]:[
    ["dashboard","Tableau de bord"],["projects","Projets"],["expenses","Dépenses"],["labor","Main-d'œuvre"],["trades","Métiers"],["suppliers","Fournisseurs"],["reports","Rapports"],["import","Import Excel"],...(admin?[["users","Utilisateurs"]]:[]),["settings","Paramètres"]
  ];
  $("#mainNav").innerHTML=items.map(([id,l])=>`<button data-nav="${id}">${l}</button>`).join("")+`<button id="logout" class="logout">Déconnexion</button>`;
  $("#mainNav").classList.remove("hidden");
  document.querySelectorAll("[data-nav]").forEach(b=>b.onclick=()=>navigate(b.dataset.nav));
  $("#logout").onclick=async()=>{try{await post("/api/logout",{})}catch{}location.reload()};
}
async function reload(){state.data=await api("/api/load")}
function navigate(view){
  state.view=view;document.querySelectorAll("[data-nav]").forEach(b=>b.classList.toggle("active",b.dataset.nav===view));
  $("#pageTitle").textContent=labels[view]||"GLOBAL BT";$("#pageSubtitle").textContent=state.session.company?.name||"Administration générale";
  render();maybePromo(false);
}
function render(){
  const c=$("#content");
  if(state.session.user.role==="superadmin")return renderSuper(c);
  ({dashboard:renderDashboard,projects:renderProjects,expenses:renderExpenses,labor:renderLabor,trades:renderTrades,suppliers:renderSuppliers,reports:renderReports,users:renderUsers,import:renderImport,settings:renderSettings}[state.view]||renderDashboard)(c);
}
function renderDashboard(c){
  const s=state.data.summary,total=Number(s.materials)+Number(s.labor),remain=Number(s.budget)-total,rate=s.budget?Math.round(total*100/s.budget):0;
  const projectSpend=(state.data.projects||[]).map(p=>({name:p.name,total:(state.data.expenses||[]).filter(x=>x.project_id===p.id).reduce((a,x)=>a+Number(x.total_price),0)+(state.data.labor||[]).filter(x=>x.project_id===p.id).reduce((a,x)=>a+Number(x.amount),0)})).sort((a,b)=>b.total-a.total);
  c.innerHTML=`<div class="kpis">${kpi("Projets",s.projects)}${kpi("Matériaux",money(s.materials))}${kpi("Main-d'œuvre",money(s.labor))}${kpi("Dépenses totales",money(total))}${kpi("Budget global",money(s.budget))}${kpi("Budget restant",money(remain),remain<0?"alert":"")}${kpi("Dépenses du mois",money(s.month))}${kpi("Consommation",rate+"%",rate>=100?"alert":"")}</div>
  <div class="grid2"><div class="panel"><div class="panel-head"><h2>Dépenses par projet</h2></div>${barChart(projectSpend,"name","total")}</div>
  <div class="panel"><h2>Budget consommé</h2><p><strong>${rate}%</strong> du budget global</p><div class="progress"><span style="width:${Math.min(100,rate)}%"></span></div>${rate>=90?`<p class="notice ${rate>=100?"danger-note":""}">${rate>=100?"Dépassement budgétaire":"Attention : budget presque épuisé"}</p>`:""}</div></div>`;
}
function projectForm(p={}){
  return `<form id="projectForm" class="form-grid">
  <input type="hidden" name="id" value="${esc(p.id||"")}"><input type="hidden" name="action" value="${p.id?"update":"create"}">
  <label>Nom du projet<input name="name" required value="${esc(p.name||"")}"></label><label>Type<input name="project_type" value="${esc(p.project_type||"Bâtiment")}"></label>
  <label>Localité<input name="location" value="${esc(p.location||"")}"></label><label>Budget prévisionnel<input name="budget" type="number" min="0" value="${esc(p.budget||0)}"></label>
  <label>Maître d'ouvrage<input name="owner_name" value="${esc(p.owner_name||"")}"></label><label>Responsable<input name="manager_name" value="${esc(p.manager_name||"")}"></label>
  <label>Date début<input name="start_date" type="date" value="${esc(p.start_date||"")}"></label><label>Date fin<input name="end_date" type="date" value="${esc(p.end_date||"")}"></label>
  <label>Statut<select name="status"><option value="preparation">Préparation</option><option value="in_progress" ${p.status==="in_progress"?"selected":""}>En cours</option><option value="suspended" ${p.status==="suspended"?"selected":""}>Suspendu</option><option value="completed" ${p.status==="completed"?"selected":""}>Terminé</option></select></label>
  <label class="span2">Description<textarea name="description">${esc(p.description||"")}</textarea></label><button class="btn primary span2">Enregistrer</button></form>`;
}
function renderProjects(c){
  c.innerHTML=`<div class="panel"><div class="panel-head"><h2>Projets de construction</h2><button id="addProject" class="btn primary">+ Nouveau projet</button></div>${table(["Projet","Localité","Budget","Statut","Actions"],state.data.projects.map(p=>`<tr><td><strong>${esc(p.name)}</strong><br><small>${esc(p.project_type||"")}</small></td><td>${esc(p.location||"")}</td><td class="money">${money(p.budget)}</td><td><span class="status">${statusText(p.status)}</span></td><td class="actions"><button class="btn small secondary edit-project" data-id="${p.id}">Modifier</button>${state.session.user.role==="admin"?`<button class="btn small danger del-project" data-id="${p.id}">Supprimer</button>`:""}</td></tr>`))}</div>`;
  $("#addProject").onclick=()=>{openModal(`<h2>Nouveau projet</h2>${projectForm()}`);bindProjectForm()};
  document.querySelectorAll(".edit-project").forEach(b=>b.onclick=()=>{openModal(`<h2>Modifier le projet</h2>${projectForm(state.data.projects.find(x=>x.id===b.dataset.id))}`);bindProjectForm()});
  document.querySelectorAll(".del-project").forEach(b=>b.onclick=()=>confirmAction("Supprimer ce projet ?",()=>post("/api/project",{action:"delete",id:b.dataset.id})));
}
function bindProjectForm(){const f=$("#projectForm");f.onsubmit=async e=>{e.preventDefault();try{await post("/api/project",formData(f));closeModal();await reload();render();toast("Projet enregistré")}catch(err){toast(err.message,true)}}}

function expenseForm(x={}){
  const pid=x.project_id||state.data.projects[0]?.id||"";
  return `<form id="expenseForm" class="form-grid"><input type="hidden" name="id" value="${esc(x.id||"")}"><input type="hidden" name="action" value="${x.id?"update":"create"}">
  <label>Projet<select id="expProject" name="project_id" required>${projectOptions(pid)}</select></label><label>Corps de métier<select id="expTrade" name="trade_id">${tradeOptions(pid,x.trade_id||"")}</select></label>
  <label>Date<input name="expense_date" type="date" required value="${esc(x.expense_date||new Date().toISOString().slice(0,10))}"></label><label>Fournisseur<select name="supplier_id">${supplierOptions(x.supplier_id||"")}</select></label>
  <label class="span2">Désignation<input name="description" required value="${esc(x.description||"")}"></label><label>Quantité<input id="expQty" name="quantity" type="number" step="0.01" min="0" value="${esc(x.quantity||1)}"></label>
  <label>Unité<input name="unit" placeholder="Sac, pièce, m²..." value="${esc(x.unit||"")}"></label><label>Prix unitaire<input id="expPu" name="unit_price" type="number" min="0" value="${esc(x.unit_price||0)}"></label>
  <label>Prix total calculé<input id="expTotal" readonly value="${money(x.total_price||0)}"></label><label>Référence facture<input name="invoice_reference" value="${esc(x.invoice_reference||"")}"></label>
  <label class="span2">Observation<textarea name="notes">${esc(x.notes||"")}</textarea></label><button class="btn primary span2">Enregistrer la dépense</button></form>`;
}
function renderExpenses(c){
  c.innerHTML=`<div class="panel"><div class="panel-head"><h2>Dépenses matériaux</h2><button id="addExpense" class="btn primary">+ Nouvelle dépense</button></div>
  <div class="filters"><input id="expenseSearch" placeholder="Rechercher..."><select id="expenseProjectFilter">${projectOptions()}</select></div>
  <div id="expenseTable"></div></div>`;const draw=()=>{const q=$("#expenseSearch").value.toLowerCase(),pid=$("#expenseProjectFilter").value;const rows=state.data.expenses.filter(x=>(!pid||x.project_id===pid)&&(!q||`${x.description} ${x.project_name} ${x.trade_name||""} ${x.supplier_name||""}`.toLowerCase().includes(q)));$("#expenseTable").innerHTML=table(["Date","Projet","Métier","Désignation","Qté","PU","Total","Actions"],rows.map(x=>`<tr><td>${dateFr(x.expense_date)}</td><td>${esc(x.project_name)}</td><td>${esc(x.trade_name||"—")}</td><td>${esc(x.description)}</td><td>${esc(x.quantity)} ${esc(x.unit||"")}</td><td class="money">${money(x.unit_price)}</td><td class="money"><strong>${money(x.total_price)}</strong></td><td class="actions"><button class="btn small secondary edit-exp" data-id="${x.id}">Modifier</button>${state.session.user.role==="admin"?`<button class="btn small danger del-exp" data-id="${x.id}">Supprimer</button>`:""}</td></tr>`));bindExpenseRows()};
  $("#expenseSearch").oninput=draw;$("#expenseProjectFilter").onchange=draw;$("#addExpense").onclick=()=>{openModal(`<h2>Nouvelle dépense</h2>${expenseForm()}`);bindExpenseForm()};draw();
}
function bindExpenseRows(){document.querySelectorAll(".edit-exp").forEach(b=>b.onclick=()=>{openModal(`<h2>Modifier la dépense</h2>${expenseForm(state.data.expenses.find(x=>x.id===b.dataset.id))}`);bindExpenseForm()});document.querySelectorAll(".del-exp").forEach(b=>b.onclick=()=>confirmAction("Supprimer cette dépense ?",()=>post("/api/expense",{action:"delete",id:b.dataset.id})))}
function bindExpenseForm(){const f=$("#expenseForm"),calc=()=>$("#expTotal").value=money(Number($("#expQty").value||0)*Number($("#expPu").value||0));$("#expQty").oninput=calc;$("#expPu").oninput=calc;$("#expProject").onchange=()=>$("#expTrade").innerHTML=tradeOptions($("#expProject").value);calc();f.onsubmit=async e=>{e.preventDefault();try{await post("/api/expense",formData(f));closeModal();await reload();render();toast("Dépense enregistrée")}catch(err){toast(err.message,true)}}}

function laborForm(x={}){
  const pid=x.project_id||state.data.projects[0]?.id||"";
  return `<form id="laborForm" class="form-grid"><input type="hidden" name="id" value="${esc(x.id||"")}"><input type="hidden" name="action" value="${x.id?"update":"create"}">
  <label>Projet<select id="labProject" name="project_id" required>${projectOptions(pid)}</select></label><label>Métier<select id="labTrade" name="trade_id">${tradeOptions(pid,x.trade_id||"")}</select></label>
  <label>Date<input name="expense_date" type="date" required value="${esc(x.expense_date||new Date().toISOString().slice(0,10))}"></label><label>Prestataire / ouvrier<input name="worker_name" value="${esc(x.worker_name||"")}"></label>
  <label class="span2">Nature des travaux<input name="work_description" required value="${esc(x.work_description||"")}"></label><label>Montant<input name="amount" type="number" min="0" required value="${esc(x.amount||0)}"></label>
  <label>Mode de paiement<select name="payment_method"><option>Espèces</option><option>Mobile Money</option><option>Virement</option><option>Chèque</option><option>Autre</option></select></label>
  <label>Référence<input name="payment_reference" value="${esc(x.payment_reference||"")}"></label><label class="span2">Observation<textarea name="notes">${esc(x.notes||"")}</textarea></label><button class="btn primary span2">Enregistrer</button></form>`;
}
function renderLabor(c){
  c.innerHTML=`<div class="panel"><div class="panel-head"><h2>Main-d'œuvre</h2><button id="addLabor" class="btn primary">+ Nouvelle main-d'œuvre</button></div>${table(["Date","Projet","Métier","Prestataire","Travaux","Montant","Actions"],state.data.labor.map(x=>`<tr><td>${dateFr(x.expense_date)}</td><td>${esc(x.project_name)}</td><td>${esc(x.trade_name||"—")}</td><td>${esc(x.worker_name||"—")}</td><td>${esc(x.work_description)}</td><td class="money"><strong>${money(x.amount)}</strong></td><td class="actions"><button class="btn small secondary edit-lab" data-id="${x.id}">Modifier</button>${state.session.user.role==="admin"?`<button class="btn small danger del-lab" data-id="${x.id}">Supprimer</button>`:""}</td></tr>`))}</div>`;
  $("#addLabor").onclick=()=>{openModal(`<h2>Nouvelle main-d'œuvre</h2>${laborForm()}`);bindLaborForm()};document.querySelectorAll(".edit-lab").forEach(b=>b.onclick=()=>{openModal(`<h2>Modifier</h2>${laborForm(state.data.labor.find(x=>x.id===b.dataset.id))}`);bindLaborForm()});document.querySelectorAll(".del-lab").forEach(b=>b.onclick=()=>confirmAction("Supprimer cette dépense de main-d'œuvre ?",()=>post("/api/labor",{action:"delete",id:b.dataset.id})));
}
function bindLaborForm(){const f=$("#laborForm");$("#labProject").onchange=()=>$("#labTrade").innerHTML=tradeOptions($("#labProject").value);f.onsubmit=async e=>{e.preventDefault();try{await post("/api/labor",formData(f));closeModal();await reload();render();toast("Main-d'œuvre enregistrée")}catch(err){toast(err.message,true)}}}

function renderTrades(c){
  c.innerHTML=`<div class="panel"><div class="panel-head"><h2>Corps de métier</h2><button id="addTrade" class="btn primary">+ Ajouter</button></div>${table(["Projet","Métier","Description","Actions"],state.data.trades.map(t=>`<tr><td>${esc(state.data.projects.find(p=>p.id===t.project_id)?.name||"")}</td><td><strong>${esc(t.name)}</strong></td><td>${esc(t.description||"")}</td><td>${state.session.user.role==="admin"?`<button class="btn small danger del-trade" data-id="${t.id}">Supprimer</button>`:"—"}</td></tr>`))}</div>`;
  $("#addTrade").onclick=()=>openModal(`<h2>Nouveau corps de métier</h2><form id="tradeForm" class="form-grid"><label>Projet<select name="project_id" required>${projectOptions()}</select></label><label>Nom<input name="name" placeholder="Maçonnerie, Plomberie..." required></label><label class="span2">Description<textarea name="description"></textarea></label><button class="btn primary span2">Ajouter</button></form>`);
  document.addEventListener("submit",tradeSubmit,{once:true});document.querySelectorAll(".del-trade").forEach(b=>b.onclick=()=>confirmAction("Supprimer ce métier ?",()=>post("/api/trade",{action:"delete",id:b.dataset.id,project_id:state.data.trades.find(t=>t.id===b.dataset.id)?.project_id})));
}
async function tradeSubmit(e){if(e.target.id!=="tradeForm")return;e.preventDefault();try{await post("/api/trade",formData(e.target));closeModal();await reload();render();toast("Métier ajouté")}catch(err){toast(err.message,true)}}

function supplierForm(x={}){return `<form id="supplierForm" class="form-grid"><input type="hidden" name="id" value="${esc(x.id||"")}"><input type="hidden" name="action" value="${x.id?"update":"create"}"><label>Nom / raison sociale<input name="name" required value="${esc(x.name||"")}"></label><label>Téléphone<input name="phone" value="${esc(x.phone||"")}"></label><label>E-mail<input name="email" type="email" value="${esc(x.email||"")}"></label><label>Ville<input name="city" value="${esc(x.city||"")}"></label><label class="span2">Adresse<input name="address" value="${esc(x.address||"")}"></label><label>Spécialité<input name="specialty" value="${esc(x.specialty||"")}"></label><label class="span2">Notes<textarea name="notes">${esc(x.notes||"")}</textarea></label><button class="btn primary span2">Enregistrer</button></form>`}
function renderSuppliers(c){
  c.innerHTML=`<div class="panel"><div class="panel-head"><h2>Fournisseurs</h2><button id="addSupplier" class="btn primary">+ Nouveau fournisseur</button></div>${table(["Nom","Contact","Ville","Spécialité","Actions"],state.data.suppliers.map(s=>`<tr><td><strong>${esc(s.name)}</strong></td><td>${esc(s.phone||"")}<br><small>${esc(s.email||"")}</small></td><td>${esc(s.city||"")}</td><td>${esc(s.specialty||"")}</td><td class="actions"><button class="btn small secondary edit-sup" data-id="${s.id}">Modifier</button>${state.session.user.role==="admin"?`<button class="btn small danger del-sup" data-id="${s.id}">Supprimer</button>`:""}</td></tr>`))}</div>`;
  $("#addSupplier").onclick=()=>{openModal(`<h2>Nouveau fournisseur</h2>${supplierForm()}`);bindSupplierForm()};document.querySelectorAll(".edit-sup").forEach(b=>b.onclick=()=>{openModal(`<h2>Modifier fournisseur</h2>${supplierForm(state.data.suppliers.find(x=>x.id===b.dataset.id))}`);bindSupplierForm()});document.querySelectorAll(".del-sup").forEach(b=>b.onclick=()=>confirmAction("Supprimer ce fournisseur ?",()=>post("/api/supplier",{action:"delete",id:b.dataset.id})));
}
function bindSupplierForm(){const f=$("#supplierForm");f.onsubmit=async e=>{e.preventDefault();try{await post("/api/supplier",formData(f));closeModal();await reload();render();toast("Fournisseur enregistré")}catch(err){toast(err.message,true)}}}

async function renderReports(c){
  c.innerHTML=`<div class="panel"><div class="panel-head"><h2>Rapports financiers</h2><div class="toolbar"><button id="runReport" class="btn primary">Actualiser</button><button id="printReport" class="btn secondary">Imprimer / PDF</button></div></div><div class="filters"><select id="repProject">${projectOptions()}</select><input id="repStart" type="date"><input id="repEnd" type="date"></div><div id="reportBody" class="empty">Cliquez sur Actualiser.</div></div>`;
  $("#runReport").onclick=runReport;$("#printReport").onclick=()=>window.print();await runReport();
}
async function runReport(){
  try{const q=new URLSearchParams();if($("#repProject")?.value)q.set("project_id",$("#repProject").value);if($("#repStart")?.value)q.set("start",$("#repStart").value);if($("#repEnd")?.value)q.set("end",$("#repEnd").value);state.reports=await api("/api/reports?"+q);const by=state.reports.byTrade.map(x=>({...x,total:Number(x.materials)+Number(x.labor)}));const totalMat=by.reduce((a,x)=>a+Number(x.materials),0),totalLab=by.reduce((a,x)=>a+Number(x.labor),0);$("#reportBody").innerHTML=`<div class="kpis">${kpi("Total matériaux",money(totalMat))}${kpi("Total main-d'œuvre",money(totalLab))}${kpi("Total général",money(totalMat+totalLab))}</div><div class="grid2"><div class="panel"><h3>Répartition par métier</h3>${barChart(by,"name","total")}</div><div class="panel"><h3>Évolution mensuelle</h3>${barChart([...state.reports.monthly].reverse(),"month","total")}</div></div>${table(["Métier","Matériaux","Main-d'œuvre","Total"],by.map(x=>`<tr><td>${esc(x.name)}</td><td class="money">${money(x.materials)}</td><td class="money">${money(x.labor)}</td><td class="money"><strong>${money(x.total)}</strong></td></tr>`))}`}catch(err){toast(err.message,true)}
}

function renderUsers(c){
  c.innerHTML=`<div class="panel"><div class="panel-head"><h2>Utilisateurs de l'entreprise</h2><button id="addAgent" class="btn primary">+ Nouvel Agent</button></div>${table(["Nom","E-mail","Téléphone","Rôle","Statut","Actions"],(state.data.users||[]).map(u=>`<tr><td>${esc(u.full_name)}</td><td>${esc(u.email)}</td><td>${esc(u.phone||"")}</td><td>${esc(u.role)}</td><td><span class="status ${u.status}">${statusText(u.status)}</span></td><td class="actions">${u.role==="agent"?`<button class="btn small warning reset-agent" data-id="${u.id}">Réinitialiser</button><button class="btn small secondary toggle-agent" data-id="${u.id}" data-action="${u.status==="active"?"disable":"activate"}">${u.status==="active"?"Désactiver":"Activer"}</button><button class="btn small danger del-agent" data-id="${u.id}">Supprimer</button>`:"—"}</td></tr>`))}</div><div class="panel"><div class="panel-head"><h3>Demandes mot de passe Agent</h3><button id="loadAgentResets" class="btn secondary small">Actualiser</button></div><div id="agentResets"></div></div>`;
  $("#addAgent").onclick=()=>openModal(`<h2>Créer un Agent</h2><form id="agentForm" class="form-grid"><label>Nom complet<input name="full_name" required></label><label>E-mail<input name="email" type="email" required></label><label>Téléphone<input name="phone"></label><label>Mot de passe initial<input name="password" type="password" minlength="12" required></label><button class="btn primary span2">Créer</button></form>`);
  document.addEventListener("submit",agentSubmit,{once:true});document.querySelectorAll(".toggle-agent").forEach(b=>b.onclick=async()=>doUserAction({action:b.dataset.action,user_id:b.dataset.id}));document.querySelectorAll(".del-agent").forEach(b=>b.onclick=()=>confirmAction("Supprimer cet Agent ?",()=>post("/api/user-action",{action:"delete",user_id:b.dataset.id})));document.querySelectorAll(".reset-agent").forEach(b=>b.onclick=()=>passwordResetModal(b.dataset.id,"/api/user-action"));
  $("#loadAgentResets").onclick=loadAgentResets;loadAgentResets();
}
async function agentSubmit(e){if(e.target.id!=="agentForm")return;e.preventDefault();try{await post("/api/user-action",{action:"create",...formData(e.target)});closeModal();await reload();render();toast("Agent créé")}catch(err){toast(err.message,true)}}
async function doUserAction(obj){try{await post("/api/user-action",obj);await reload();render();toast("Compte mis à jour")}catch(err){toast(err.message,true)}}
async function loadAgentResets(){try{const r=await api("/api/admin/reset-requests");$("#agentResets").innerHTML=table(["Date","Agent","E-mail","Statut"],r.requests.map(x=>`<tr><td>${dateFr(x.created_at)}</td><td>${esc(x.full_name||"")}</td><td>${esc(x.email)}</td><td>${esc(x.status)}</td></tr>`))}catch{}}

function renderImport(c){
  c.innerHTML=`<div class="panel"><h2>Importer l'ancien fichier Excel bt.xlsx</h2><p>Feuilles reconnues : <strong>MACON, MENUISIER, ELECTRICIEN, PEINTRE</strong>. Les titres et totaux sont ignorés.</p><div class="form-grid"><label>Fichier .xlsx<input id="excelFile" type="file" accept=".xlsx,.xls"></label><label>Importer dans un projet existant<select id="importProject">${projectOptions()}</select></label><label>Ou nom du nouveau projet<input id="importProjectName" value="Construction Bâtiment A"></label><label>Localité<input id="importLocation" value="Koko 1"></label></div><div class="toolbar" style="margin-top:14px"><button id="analyzeExcel" class="btn secondary">Analyser le fichier</button><button id="sendExcel" class="btn primary hidden">Importer dans D1</button></div><div id="excelPreview" class="panel"></div></div>`;
  let rows=[];$("#analyzeExcel").onclick=async()=>{const file=$("#excelFile").files[0];if(!file)return toast("Sélectionnez un fichier Excel",true);const buf=await file.arrayBuffer(),wb=XLSX.read(buf,{type:"array",cellDates:true});const map={MACON:"Maçonnerie",MENUISIER:"Menuiserie",ELECTRICIEN:"Électricité",PEINTRE:"Peinture"};rows=[];for(const [sheet,trade] of Object.entries(map)){if(!wb.Sheets[sheet])continue;const raw=XLSX.utils.sheet_to_json(wb.Sheets[sheet],{header:1,defval:""});for(const r of raw){const joined=r.map(String).join(" ").toLowerCase();if(joined.includes("prix unitaire")||joined.includes("matériaux fourni")||joined.includes("cout total")||joined.includes("dépense totale"))continue;const date=r.find(v=>v instanceof Date)||r[1];const desc=String(r[2]||"").trim();const qty=Number(r[3]||0),pu=Number(r[4]||0),labor=Number(r[6]||0);if(!desc&&!(labor>0))continue;if(!(qty>0||pu>0||labor>0))continue;let ds="";if(date instanceof Date)ds=date.toISOString().slice(0,10);else{const d=new Date(date);ds=Number.isNaN(+d)?new Date().toISOString().slice(0,10):d.toISOString().slice(0,10)}rows.push({trade,date:ds,description:desc,quantity:qty,unit_price:pu,labor})}}
    $("#excelPreview").innerHTML=`<h3>${rows.length} lignes détectées</h3>${table(["Métier","Date","Désignation","Qté","PU","Main-d'œuvre"],rows.slice(0,30).map(r=>`<tr><td>${esc(r.trade)}</td><td>${dateFr(r.date)}</td><td>${esc(r.description)}</td><td>${r.quantity}</td><td>${money(r.unit_price)}</td><td>${money(r.labor)}</td></tr>`))}${rows.length>30?`<p class="muted">Aperçu limité aux 30 premières lignes.</p>`:""}`;$("#sendExcel").classList.toggle("hidden",!rows.length)};
  $("#sendExcel").onclick=async()=>{try{const r=await post("/api/import-excel",{rows,project_id:$("#importProject").value||null,project_name:$("#importProjectName").value,location:$("#importLocation").value});toast(`Import terminé : ${r.materials} matériaux, ${r.labor} main-d'œuvre`);await reload();render()}catch(err){toast(err.message,true)}};
}
function renderSettings(c){
  c.innerHTML=`<div class="grid2"><div class="panel"><h2>Mon compte</h2><p><strong>${esc(state.session.user.full_name)}</strong><br>${esc(state.session.user.email)}</p><button id="changePwd" class="btn primary">Changer mon mot de passe</button></div><div class="panel"><h2>Abonnement</h2><p>Plan : <strong>${esc(state.session.company.plan.toUpperCase())}</strong></p><p>Expiration : <strong>${dateFr(state.session.company.plan_expires_at)}</strong></p>${state.session.company.plan==="free"?`<a class="btn gold-btn" href="${esc(state.session.businessPaymentUrl)}" target="_blank" rel="noopener">Acheter mon plan Business</a>`:""}</div></div>`;$("#changePwd").onclick=()=>showChangePassword(false);
}
function showChangePassword(forced){openModal(`<h2>${forced?"Nouveau mot de passe requis":"Changer mon mot de passe"}</h2><form id="changePwdForm" class="form-grid"><label class="span2">Mot de passe actuel<input name="current_password" type="password" required></label><label class="span2">Nouveau mot de passe<input name="new_password" type="password" minlength="12" required></label><button class="btn primary span2">Modifier</button></form>${forced?'<p class="notice">Le mot de passe initial doit être remplacé.</p>':""}`);$("#changePwdForm").onsubmit=async e=>{e.preventDefault();try{await post("/api/change-password",formData(e.target));toast("Mot de passe modifié. Reconnectez-vous.");setTimeout(()=>location.reload(),900)}catch(err){toast(err.message,true)}}}

function maybePromo(force){
  const c=state.session?.company;if(!c||c.plan!=="free")return;const now=Date.now();
  if(force||now-state.promoAt>=15*60*1000){state.promoAt=now;openModal(`<div class="promo-box"><span class="eyebrow gold">PLAN FREE</span><h2>Passez au Plan Business</h2><p>Vous bénéficiez d'un accès complet à GLOBAL BT pendant 21 jours. Passez au Plan Business pour conserver l'accès complet pendant 365 jours.</p><p><strong>20 600 FCFA</strong></p><div class="promo-actions"><button class="btn secondary" id="promoOk">Compris</button><a class="btn gold-btn" target="_blank" rel="noopener" href="${esc(state.session.businessPaymentUrl)}">Acheter mon plan Business</a></div></div>`);$("#promoOk").onclick=closeModal}
}
setInterval(()=>maybePromo(false),60000);

function renderSuper(c){
  ({superDashboard:renderSuperDashboard,companies:renderCompanies,superUsers:renderSuperUsers,subscriptions:renderSubscriptions,resets:renderResets,audit:renderAudit}[state.view]||renderSuperDashboard)(c);
}
async function renderSuperDashboard(c){
  try{const r=await api("/api/super/dashboard"),s=r.summary;c.innerHTML=`<div class="kpis">${kpi("Entreprises",s.companies)}${kpi("Membres",s.users)}${kpi("Plan Free",s.free)}${kpi("Plan Business",s.business)}${kpi("Réinitialisations",s.pending)}${kpi("Abonnements expirés",s.expired,s.expired?"alert":"")}</div><div class="panel"><h2>Administration générale</h2><p>Les abonnements, statuts et comptes sont contrôlés exclusivement côté serveur.</p></div>`}catch(err){toast(err.message,true)}
}
async function renderCompanies(c){
  const r=await api("/api/super/companies");c.innerHTML=`<div class="panel"><div class="panel-head"><h2>Entreprises membres</h2><button id="newCompany" class="btn primary">+ Nouvelle entreprise</button></div>${table(["Entreprise","Plan","Expiration","Utilisateurs","Projets","Statut","Actions"],r.companies.map(x=>`<tr><td><strong>${esc(x.name)}</strong><br><small>${esc(x.city||"")}</small></td><td><span class="status ${x.plan}">${esc(x.plan)}</span></td><td>${dateFr(x.plan_expires_at)}</td><td>${x.user_count}</td><td>${x.project_count}</td><td><span class="status ${x.status}">${statusText(x.status)}</span></td><td class="actions"><button class="btn small secondary company-plan" data-id="${x.id}" data-plan="${x.plan==="free"?"business":"free"}">→ ${x.plan==="free"?"Business":"Free"}</button><button class="btn small warning company-toggle" data-id="${x.id}" data-action="${x.status==="active"?"disable":"activate"}">${x.status==="active"?"Désactiver":"Activer"}</button><button class="btn small danger company-delete" data-id="${x.id}">Supprimer</button></td></tr>`))}</div>`;
  $("#newCompany").onclick=()=>openModal(`<h2>Créer une entreprise</h2><form id="companyForm" class="form-grid"><label>Nom entreprise<input name="name" required></label><label>Code<input name="code"></label><label>Téléphone<input name="phone"></label><label>E-mail entreprise<input name="email" type="email"></label><label>Ville<input name="city"></label><label>Adresse<input name="address"></label><label>Plan<select name="plan"><option value="free">Free · 21 jours</option><option value="business">Business · 365 jours</option></select></label><hr class="span2"><label>Nom Administrateur<input name="admin_name" required></label><label>E-mail Administrateur<input name="admin_email" type="email" required></label><label>Téléphone Administrateur<input name="admin_phone"></label><label>Mot de passe initial<input name="admin_password" type="password" minlength="12" required></label><button class="btn primary span2">Créer l'entreprise</button></form>`);
  document.addEventListener("submit",companySubmit,{once:true});document.querySelectorAll(".company-plan").forEach(b=>b.onclick=()=>confirmAction(`Basculer vers le plan ${b.dataset.plan} ? La durée repart à compter d'aujourd'hui.`,()=>post("/api/super/company-action",{action:"set_plan",company_id:b.dataset.id,plan:b.dataset.plan}),true));document.querySelectorAll(".company-toggle").forEach(b=>b.onclick=()=>confirmAction("Confirmer cette modification de statut ?",()=>post("/api/super/company-action",{action:b.dataset.action,company_id:b.dataset.id}),true));document.querySelectorAll(".company-delete").forEach(b=>b.onclick=()=>confirmAction("Supprimer logiquement cette entreprise ?",()=>post("/api/super/company-action",{action:"delete",company_id:b.dataset.id}),true));
}
async function companySubmit(e){if(e.target.id!=="companyForm")return;e.preventDefault();try{await post("/api/super/company-action",{action:"create",...formData(e.target)});closeModal();await reload();navigate("companies");toast("Entreprise créée")}catch(err){toast(err.message,true)}}
async function renderSuperUsers(c){
  const r=await api("/api/super/users");c.innerHTML=`<div class="panel"><h2>Tous les membres</h2>${table(["Nom","Entreprise","E-mail","Rôle","Statut","Actions"],r.users.map(u=>`<tr><td>${esc(u.full_name)}</td><td>${esc(u.company_name||"Administration")}</td><td>${esc(u.email)}</td><td>${esc(u.role)}</td><td><span class="status ${u.status}">${statusText(u.status)}</span></td><td>${u.role!=="superadmin"?`<div class="actions"><button class="btn small warning super-reset-user" data-id="${u.id}">Réinitialiser</button><button class="btn small secondary super-toggle-user" data-id="${u.id}" data-action="${u.status==="active"?"disable":"activate"}">${u.status==="active"?"Désactiver":"Activer"}</button><button class="btn small danger super-delete-user" data-id="${u.id}">Supprimer</button></div>`:"Compte protégé"}</td></tr>`))}</div>`;
  document.querySelectorAll(".super-reset-user").forEach(b=>b.onclick=()=>passwordResetModal(b.dataset.id,"/api/super/user-action"));document.querySelectorAll(".super-toggle-user").forEach(b=>b.onclick=()=>confirmAction("Modifier ce compte ?",()=>post("/api/super/user-action",{action:b.dataset.action,user_id:b.dataset.id}),true));document.querySelectorAll(".super-delete-user").forEach(b=>b.onclick=()=>confirmAction("Supprimer logiquement ce membre ?",()=>post("/api/super/user-action",{action:"delete",user_id:b.dataset.id}),true));
}
async function renderSubscriptions(c){const r=await api("/api/super/companies");c.innerHTML=`<div class="panel"><h2>Gestion des abonnements</h2><p class="notice">Free : 21 jours complets · Business : 365 jours complets. Une activation de plan redémarre sa durée à la date du changement.</p>${table(["Entreprise","Plan","Début","Expiration","État"],r.companies.map(x=>`<tr><td>${esc(x.name)}</td><td><span class="status ${x.plan}">${esc(x.plan)}</span></td><td>${dateFr(x.plan_started_at)}</td><td>${dateFr(x.plan_expires_at)}</td><td>${Date.parse(x.plan_expires_at)<Date.now()?'<span class="status expired">Expiré</span>':'<span class="status active">Valide</span>'}</td></tr>`))}</div>`}
async function renderResets(c){const r=await api("/api/super/resets");c.innerHTML=`<div class="panel"><h2>Demandes de réinitialisation</h2>${table(["Date","Membre","Entreprise","Rôle","E-mail","Statut","Actions"],r.requests.map(x=>`<tr><td>${dateFr(x.created_at)}</td><td>${esc(x.full_name||"")}</td><td>${esc(x.company_name||"")}</td><td>${esc(x.target_role||"")}</td><td>${esc(x.email)}</td><td>${esc(x.status)}</td><td>${x.status==="pending"?`<div class="actions"><button class="btn small warning resolve-reset" data-id="${x.id}" data-user="${x.user_id}">Réinitialiser</button><button class="btn small danger reject-reset" data-id="${x.id}">Rejeter</button></div>`:"—"}</td></tr>`))}</div>`;document.querySelectorAll(".resolve-reset").forEach(b=>b.onclick=()=>resetRequestModal(b.dataset.id));document.querySelectorAll(".reject-reset").forEach(b=>b.onclick=()=>confirmAction("Rejeter cette demande ?",()=>post("/api/super/reset-action",{action:"reject",request_id:b.dataset.id}),true))}
async function renderAudit(c){const r=await api("/api/super/audit?limit=500");c.innerHTML=`<div class="panel"><div class="panel-head"><h2>Journal des actions sensibles</h2><button class="btn secondary" onclick="window.print()">Imprimer</button></div>${table(["Date","Acteur","Entreprise","Action","Cible","IP"],r.logs.map(x=>`<tr><td>${dateFr(x.created_at)}</td><td>${esc(x.actor_name||"Système")}</td><td>${esc(x.company_name||"—")}</td><td><strong>${esc(x.action)}</strong></td><td>${esc(x.target_type||"")} ${esc(x.target_id||"")}</td><td>${esc(x.ip||"")}</td></tr>`))}</div>`}
function passwordResetModal(userId,path){openModal(`<h2>Réinitialiser le mot de passe</h2><form id="resetDirectForm" class="form-grid"><input type="hidden" name="user_id" value="${esc(userId)}"><label class="span2">Nouveau mot de passe temporaire<input name="new_password" type="password" minlength="12" required></label><button class="btn primary span2">Réinitialiser</button></form>`);$("#resetDirectForm").onsubmit=async e=>{e.preventDefault();try{await post(path,{action:"reset_password",...formData(e.target)});closeModal();toast("Mot de passe réinitialisé")}catch(err){toast(err.message,true)}}}
function resetRequestModal(requestId){openModal(`<h2>Assistance mot de passe</h2><form id="resetReqForm" class="form-grid"><label class="span2">Nouveau mot de passe temporaire<input name="new_password" type="password" minlength="12" required></label><button class="btn primary span2">Réinitialiser</button></form>`);$("#resetReqForm").onsubmit=async e=>{e.preventDefault();try{await post("/api/super/reset-action",{action:"reset",request_id:requestId,...formData(e.target)});closeModal();navigate("resets");toast("Demande traitée")}catch(err){toast(err.message,true)}}}
function confirmAction(text,fn,superRefresh=false){openModal(`<h2>Confirmation</h2><p>${esc(text)}</p><div class="toolbar"><button id="confirmNo" class="btn secondary">Annuler</button><button id="confirmYes" class="btn danger">Confirmer</button></div>`);$("#confirmNo").onclick=closeModal;$("#confirmYes").onclick=async()=>{try{await fn();closeModal();await reload();render();toast("Opération effectuée")}catch(err){toast(err.message,true)}}}

init();
