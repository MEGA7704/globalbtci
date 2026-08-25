const $=s=>document.querySelector(s);
const S={session:null,data:null,view:null,promo:0};
const names={dashboard:"Tableau de bord",projects:"Projets",expenses:"Dépenses",labor:"Main-d'œuvre",trades:"Corps de métier",suppliers:"Fournisseurs",users:"Utilisateurs",reports:"Rapports",settings:"Paramètres",super:"Tableau de bord",companies:"Entreprises",members:"Membres",subscriptions:"Abonnements",resets:"Mots de passe",audit:"Journal"};

function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]))}
function cash(v){return new Intl.NumberFormat("fr-FR").format(Number(v||0))+" FCFA"}
function df(v){if(!v)return"";const d=new Date(v.length===10?v+"T00:00:00":v);return Number.isNaN(+d)?v:d.toLocaleDateString("fr-FR")}
function toast(m,bad=false){const t=$("#toast");t.textContent=m;t.style.background=bad?"#8d3037":"#16433e";t.classList.remove("hidden");setTimeout(()=>t.classList.add("hidden"),3000)}
function modal(h){$("#modalBody").innerHTML=h;$("#modal").classList.remove("hidden")}function closeModal(){$("#modal").classList.add("hidden")}
$("#modalClose").onclick=closeModal;$("#modal").onclick=e=>{if(e.target===$("#modal"))closeModal()};
async function api(path,opt={},retry=true){
  const headers={...(opt.body?{"content-type":"application/json"}:{}),...(opt.headers||{})};
  if(S.session?.csrf&&opt.method&&opt.method!=="GET")headers["X-CSRF-Token"]=S.session.csrf;

  let r=await fetch(path,{credentials:"same-origin",...opt,headers});
  let b=await r.json().catch(()=>({}));

  if(r.status===403 && String(b.error||"").toLowerCase().includes("csrf") && retry){
    try{
      const cr=await fetch("/api/csrf",{credentials:"same-origin"});
      const cb=await cr.json().catch(()=>({}));
      if(cr.ok&&cb.csrf){
        S.session.csrf=cb.csrf;
        const headers2={...headers,"X-CSRF-Token":cb.csrf};
        r=await fetch(path,{credentials:"same-origin",...opt,headers:headers2});
        b=await r.json().catch(()=>({}));
      }
    }catch{}
  }

  if(!r.ok){
    const extra=[b.entity,b.action,b.code].filter(Boolean).join(" · ");
    const e=new Error((b.error||"Erreur serveur")+(extra?" · "+extra:""));
    e.stage=b.stage||"";
    e.code=b.code||"";
    throw e;
  }
  return b
}
const post=(p,o)=>api(p,{method:"POST",body:JSON.stringify(o)});
function fd(f){return Object.fromEntries(new FormData(f).entries())}
function opts(a,sel=""){return `<option value="">— Sélectionner —</option>`+(a||[]).map(x=>`<option value="${esc(x.id)}" ${x.id===sel?"selected":""}>${esc(x.name||x.full_name)}</option>`).join("")}
function table(h,rows){return `<div class="tablewrap"><table><thead><tr>${h.map(x=>`<th>${x}</th>`).join("")}</tr></thead><tbody>${rows.join("")||`<tr><td colspan="${h.length}">Aucune donnée</td></tr>`}</tbody></table></div>`}
function kpi(l,v){return `<div class="kpi"><small>${esc(l)}</small><strong>${v}</strong></div>`}
function confirmBox(txt,fn){modal(`<h2>Confirmation</h2><p>${esc(txt)}</p><div class="toolbar"><button id="no" class="btn secondary">Annuler</button><button id="yes" class="btn danger">Confirmer</button></div>`);$("#no").onclick=closeModal;$("#yes").onclick=async()=>{try{await fn();closeModal();await reload();render();toast("Opération effectuée")}catch(e){toast(e.message,true)}}}

$("#tabLogin").onclick=()=>authMode(true);$("#tabRegister").onclick=()=>authMode(false);
function authMode(login){$("#loginForm").classList.toggle("hidden",!login);$("#registerForm").classList.toggle("hidden",login);$("#tabLogin").classList.toggle("active",login);$("#tabRegister").classList.toggle("active",!login);$("#authMessage").textContent=""}
$("#showLoginPassword").onclick=()=>{const i=$("#loginPassword");i.type=i.type==="password"?"text":"password";$("#showLoginPassword").textContent=i.type==="password"?"Voir":"Masquer"};
$("#loginForm").onsubmit=async e=>{e.preventDefault();try{S.session=await post("/api/login",{email:$("#loginEmail").value,password:$("#loginPassword").value});await enter()}catch(x){$("#authMessage").textContent=x.message}};
$("#registerForm").onsubmit=async e=>{e.preventDefault();if($("#regPassword").value!==$("#regPassword2").value)return $("#authMessage").textContent="Les mots de passe ne correspondent pas.";try{S.session=await post("/api/register",{company_name:$("#regCompany").value,city:$("#regCity").value,full_name:$("#regName").value,phone:$("#regPhone").value,email:$("#regEmail").value,password:$("#regPassword").value});await enter()}catch(x){$("#authMessage").textContent=x.message+(x.stage?` · étape ${x.stage}`:"")+(x.code?` · ${x.code}`:"")}};
$("#forgotBtn").onclick=()=>modal(`<h2>Mot de passe oublié</h2><p>Administrateur : demande envoyée au Super Admin. Agent : demande envoyée à votre Administrateur.</p><form id="forgotForm"><label>E-mail<input name="email" type="email" required></label><button class="btn primary full">Envoyer</button></form><div id="forgotMsg" class="message"></div>`);
document.addEventListener("submit",async e=>{if(e.target.id==="forgotForm"){e.preventDefault();try{const r=await post("/api/password-reset/request",fd(e.target));$("#forgotMsg").textContent=r.message}catch(x){$("#forgotMsg").textContent=x.message}}});

async function init(){
  try{await post("/api/bootstrap",{})}
  catch(e){
    try{
      const h=await api("/api/health");
      $("#authMessage").textContent=`Configuration : ${e.message} · Version ${h.app_version||"?"} · Super Admin ${h.superadmin_ready?"créé":"absent"} · Identifiant ${h.superadmin_credential_ready?"prêt":"absent"}`;
    }catch{$("#authMessage").textContent="Configuration : "+e.message}
  }
  try{S.session=await api("/api/session");await enter()}catch{}
}
async function enter(){$("#authScreen").classList.add("hidden");$("#appShell").classList.remove("hidden");$("#userBadge").textContent=`${S.session.user.full_name} · ${S.session.user.role}`;$("#planBadge").textContent=S.session.company?`${S.session.company.plan.toUpperCase()} · ${df(S.session.company.plan_expires_at)}`:"SUPER ADMIN";$("#spaceLabel").textContent=S.session.user.role==="superadmin"?"SUPER ADMINISTRATION":"ESPACE ENTREPRISE";nav();await reload();go(S.session.user.role==="superadmin"?"super":"dashboard");if(S.session.user.must_change_password)changePassword()}
async function reload(){S.data=await api("/api/load")}
function nav(){const superA=S.session.user.role==="superadmin",admin=S.session.user.role==="admin";const n=superA?[["super","Tableau de bord"],["companies","Entreprises"],["members","Membres"],["subscriptions","Abonnements"],["resets","Mots de passe"],["audit","Journal"]]:[["dashboard","Tableau de bord"],["projects","Projets"],["expenses","Dépenses"],["labor","Main-d'œuvre"],["trades","Métiers"],["suppliers","Fournisseurs"],["reports","Rapports"],...(admin?[["users","Utilisateurs"]]:[]),["settings","Paramètres"]];$("#mainNav").innerHTML=n.map(([i,l])=>`<button data-nav="${i}">${l}</button>`).join("")+`<button id="logout" class="logout">Déconnexion</button>`;$("#mainNav").classList.remove("hidden");document.querySelectorAll("[data-nav]").forEach(b=>b.onclick=()=>go(b.dataset.nav));$("#logout").onclick=async()=>{try{await post("/api/logout",{})}catch{}location.reload()}}
function go(v){S.view=v;document.querySelectorAll("[data-nav]").forEach(b=>b.classList.toggle("active",b.dataset.nav===v));$("#pageTitle").textContent=names[v]||"GLOBAL BT";$("#pageSub").textContent=S.session.company?.name||"Administration générale";render();if(S.session.company?.plan==="free")promo()}
function render(){if(S.session.user.role==="superadmin")return renderSuper();({dashboard,projects,expenses,labor,trades,suppliers,users,reports,settings}[S.view]||dashboard)()}
function dashboard(){
  const p=S.data.projects||[],e=S.data.expenses||[],l=S.data.labor||[],tr=S.data.trades||[];
  const mat=e.reduce((a,x)=>a+Number(x.total_price||0),0);
  const lab=l.reduce((a,x)=>a+Number(x.amount||0),0);
  const total=mat+lab;
  const budget=p.reduce((a,x)=>a+Number(x.budget||0),0);
  const remain=budget-total;
  const rate=budget>0?Math.round((total/budget)*100):0;
  const active=p.filter(x=>x.status==="in_progress").length;
  const done=p.filter(x=>x.status==="completed").length;
  const suspended=p.filter(x=>x.status==="suspended").length;

  const nowDate=new Date();
  const ym=nowDate.toISOString().slice(0,7);
  const monthMat=e.filter(x=>String(x.expense_date||"").slice(0,7)===ym).reduce((a,x)=>a+Number(x.total_price||0),0);
  const monthLab=l.filter(x=>String(x.expense_date||"").slice(0,7)===ym).reduce((a,x)=>a+Number(x.amount||0),0);
  const monthSpend=monthMat+monthLab;

  const projectRows=p.map(pr=>{
    const pm=e.filter(x=>x.project_id===pr.id).reduce((a,x)=>a+Number(x.total_price||0),0);
    const pl=l.filter(x=>x.project_id===pr.id).reduce((a,x)=>a+Number(x.amount||0),0);
    const spent=pm+pl;
    const b=Number(pr.budget||0);
    const pct=b>0?Math.round(spent*100/b):0;
    return {...pr,spent,pct,remaining:b-spent};
  }).sort((a,b)=>b.spent-a.spent);

  const byTrade=tr.map(t=>{
    const m=e.filter(x=>x.trade_id===t.id).reduce((a,x)=>a+Number(x.total_price||0),0);
    const w=l.filter(x=>x.trade_id===t.id).reduce((a,x)=>a+Number(x.amount||0),0);
    return {name:t.name,total:m+w,materials:m,labor:w};
  }).filter(x=>x.total>0).sort((a,b)=>b.total-a.total);

  const months={};
  for(const x of e){
    const k=String(x.expense_date||"").slice(0,7);
    if(k)months[k]=(months[k]||0)+Number(x.total_price||0);
  }
  for(const x of l){
    const k=String(x.expense_date||"").slice(0,7);
    if(k)months[k]=(months[k]||0)+Number(x.amount||0);
  }
  const monthSeries=Object.entries(months).sort((a,b)=>a[0].localeCompare(b[0])).slice(-6).map(([month,total])=>({month,total}));
  const maxMonth=Math.max(1,...monthSeries.map(x=>x.total));
  const maxTrade=Math.max(1,...byTrade.map(x=>x.total));

  const alertClass=remain<0?"danger-card":rate>=85?"warn-card":"";
  const budgetState=remain<0?"Budget dépassé":rate>=85?"Budget sous surveillance":"Budget maîtrisé";

  $("#content").innerHTML=`
    <section class="dash-hero">
      <div>
        <span class="eyebrow">PILOTAGE GLOBAL</span>
        <h2>Vue de performance de vos chantiers</h2>
        <p>Suivez en temps réel la consommation budgétaire, les dépenses, l'avancement des projets et les postes les plus coûteux.</p>
      </div>
      <div class="dash-hero-badge">
        <span>${new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"2-digit",month:"long",year:"numeric"})}</span>
      </div>
    </section>

    <div class="kpis performance-grid">
      <div class="kpi performance-card">
        <div class="kpi-icon">◫</div>
        <div><small>Projets totaux</small><strong>${p.length}</strong><em>${active} en cours · ${done} terminés</em></div>
      </div>
      <div class="kpi performance-card">
        <div class="kpi-icon">₣</div>
        <div><small>Budget global</small><strong>${cash(budget)}</strong><em>Prévision totale</em></div>
      </div>
      <div class="kpi performance-card">
        <div class="kpi-icon">↘</div>
        <div><small>Dépenses totales</small><strong>${cash(total)}</strong><em>${rate}% du budget consommé</em></div>
      </div>
      <div class="kpi performance-card ${alertClass}">
        <div class="kpi-icon">◎</div>
        <div><small>Budget restant</small><strong>${cash(remain)}</strong><em>${budgetState}</em></div>
      </div>
      <div class="kpi performance-card">
        <div class="kpi-icon">▤</div>
        <div><small>Dépenses du mois</small><strong>${cash(monthSpend)}</strong><em>Matériaux + main-d'œuvre</em></div>
      </div>
      <div class="kpi performance-card">
        <div class="kpi-icon">⚒</div>
        <div><small>Main-d'œuvre</small><strong>${cash(lab)}</strong><em>${total?Math.round(lab*100/total):0}% des dépenses</em></div>
      </div>
    </div>

    <div class="dashboard-grid">
      <div class="panel dashboard-panel">
        <div class="panelhead">
          <div><h2>Consommation budgétaire</h2><p class="muted">Budget utilisé sur l'ensemble des projets</p></div>
          <strong class="metric-big">${rate}%</strong>
        </div>
        <div class="budget-meter"><span style="width:${Math.min(100,Math.max(0,rate))}%"></span></div>
        <div class="budget-summary">
          <span><b>${cash(total)}</b><small>Consommé</small></span>
          <span><b>${cash(remain)}</b><small>Disponible</small></span>
        </div>
      </div>

      <div class="panel dashboard-panel">
        <div class="panelhead"><div><h2>Répartition des dépenses</h2><p class="muted">Matériaux vs main-d'œuvre</p></div></div>
        <div class="split-metrics">
          <div class="split-box"><strong>${cash(mat)}</strong><span>Matériaux</span><div class="mini-meter"><i style="width:${total?Math.round(mat*100/total):0}%"></i></div></div>
          <div class="split-box"><strong>${cash(lab)}</strong><span>Main-d'œuvre</span><div class="mini-meter"><i style="width:${total?Math.round(lab*100/total):0}%"></i></div></div>
        </div>
      </div>
    </div>

    <div class="dashboard-grid">
      <div class="panel dashboard-panel">
        <div class="panelhead"><div><h2>Évolution des dépenses</h2><p class="muted">6 derniers mois enregistrés</p></div></div>
        <div class="bar-chart-pro">
          ${monthSeries.length?monthSeries.map(x=>`<div class="bar-item"><div class="bar-value">${cash(x.total)}</div><div class="bar-track"><span style="height:${Math.max(8,Math.round(x.total*150/maxMonth))}px"></span></div><small>${esc(x.month)}</small></div>`).join(""):`<div class="empty">Pas encore assez de données</div>`}
        </div>
      </div>

      <div class="panel dashboard-panel">
        <div class="panelhead"><div><h2>Dépenses par métier</h2><p class="muted">Top postes de coût</p></div></div>
        <div class="trade-ranking">
          ${byTrade.length?byTrade.slice(0,6).map((x,i)=>`<div class="trade-row"><div class="trade-name"><b>${i+1}. ${esc(x.name)}</b><span>${cash(x.total)}</span></div><div class="rank-meter"><i style="width:${Math.max(4,Math.round(x.total*100/maxTrade))}%"></i></div></div>`).join(""):`<div class="empty">Aucune dépense par métier</div>`}
        </div>
      </div>
    </div>

    <div class="panel dashboard-panel">
      <div class="panelhead">
        <div><h2>Performance des projets</h2><p class="muted">Budget, dépenses et taux de consommation par chantier</p></div>
        <button class="btn secondary" onclick="window.print()">Imprimer / PDF</button>
      </div>
      ${table(["Projet","Statut","Budget","Dépenses","Reste","Consommation"],projectRows.map(x=>`
        <tr>
          <td><strong>${esc(x.name)}</strong><br><small>${esc(x.location||"")}</small></td>
          <td><span class="status">${esc(x.status)}</span></td>
          <td class="money">${cash(x.budget)}</td>
          <td class="money">${cash(x.spent)}</td>
          <td class="money ${x.remaining<0?"negative":""}">${cash(x.remaining)}</td>
          <td>
            <div class="table-progress"><span style="width:${Math.min(100,Math.max(0,x.pct))}%"></span></div>
            <small>${x.pct}%</small>
          </td>
        </tr>`))}
    </div>

    ${suspended?`<div class="panel alert-panel"><strong>Attention :</strong> ${suspended} projet(s) suspendu(s) nécessitent un suivi.</div>`:""}
  `;
}
function projects(){$("#content").innerHTML=`<div class="panel"><div class="panelhead"><h2>Projets</h2><button id="addProject" class="btn primary">+ Nouveau projet</button></div>${table(["Projet","Localité","Budget","Statut","Actions"],S.data.projects.map(x=>`<tr><td><strong>${esc(x.name)}</strong></td><td>${esc(x.location||"")}</td><td class="money">${cash(x.budget)}</td><td><span class="status">${esc(x.status)}</span></td><td>${S.session.user.role==="admin"?`<button class="btn small danger del-project" data-id="${x.id}">Supprimer</button>`:""}</td></tr>`))}</div>`;$("#addProject").onclick=()=>modal(`<h2>Nouveau projet</h2><form id="projectForm" class="formgrid"><label>Nom<input name="name" required></label><label>Type<input name="project_type" value="Bâtiment"></label><label>Localité<input name="location"></label><label>Budget<input name="budget" type="number" min="0"></label><label>Maître d'ouvrage<input name="owner_name"></label><label>Responsable<input name="manager_name"></label><label>Date début<input name="start_date" type="date"></label><label>Date fin<input name="end_date" type="date"></label><label>Statut<select name="status"><option value="preparation">Préparation</option><option value="in_progress" selected>En cours</option><option value="suspended">Suspendu</option><option value="completed">Terminé</option></select></label><label class="span2">Description<textarea name="description"></textarea></label><button class="btn primary span2">Enregistrer</button></form>`);document.querySelectorAll(".del-project").forEach(b=>b.onclick=()=>confirmBox("Supprimer ce projet ?",()=>post("/api/save",{entity:"project",action:"delete",record:{id:b.dataset.id}})))}
document.addEventListener("submit",async e=>{if(e.target.id==="projectForm"){e.preventDefault();try{await post("/api/save",{entity:"project",action:"create",record:fd(e.target)});closeModal();await reload();projects();toast("Projet créé")}catch(x){toast(x.message,true)}}});
function expenses(){$("#content").innerHTML=`<div class="panel"><div class="panelhead"><h2>Dépenses matériaux</h2><button id="addExpense" class="btn primary">+ Nouvelle dépense</button></div>${table(["Date","Projet","Métier","Désignation","Total","Actions"],S.data.expenses.map(x=>`<tr><td>${df(x.expense_date)}</td><td>${esc(x.project_name)}</td><td>${esc(x.trade_name||"—")}</td><td>${esc(x.description)}</td><td class="money"><strong>${cash(x.total_price)}</strong></td><td>${S.session.user.role==="admin"?`<button class="btn small danger del-exp" data-id="${x.id}">Supprimer</button>`:""}</td></tr>`))}</div>`;$("#addExpense").onclick=()=>modal(`<h2>Nouvelle dépense</h2><form id="expenseForm" class="formgrid"><label>Projet<select name="project_id" required>${opts(S.data.projects)}</select></label><label>Métier<select name="trade_id">${opts(S.data.trades)}</select></label><label>Fournisseur<select name="supplier_id">${opts(S.data.suppliers)}</select></label><label>Date<input name="expense_date" type="date" value="${new Date().toISOString().slice(0,10)}"></label><label class="span2">Désignation<input name="description" required></label><label>Quantité<input name="quantity" type="number" step=".01" value="1"></label><label>Unité<input name="unit"></label><label>Prix unitaire<input name="unit_price" type="number" min="0"></label><label>Référence<input name="reference"></label><label class="span2">Notes<textarea name="notes"></textarea></label><button class="btn primary span2">Enregistrer</button></form>`);document.querySelectorAll(".del-exp").forEach(b=>b.onclick=()=>confirmBox("Supprimer cette dépense ?",()=>post("/api/save",{entity:"expense",action:"delete",record:{id:b.dataset.id}})))}
document.addEventListener("submit",async e=>{if(e.target.id==="expenseForm"){e.preventDefault();try{await post("/api/save",{entity:"expense",action:"create",record:fd(e.target)});closeModal();await reload();expenses();toast("Dépense enregistrée")}catch(x){toast(x.message,true)}}});
function labor(){$("#content").innerHTML=`<div class="panel"><div class="panelhead"><h2>Main-d'œuvre</h2><button id="addLabor" class="btn primary">+ Ajouter</button></div>${table(["Date","Projet","Prestataire","Travaux","Montant","Actions"],S.data.labor.map(x=>`<tr><td>${df(x.expense_date)}</td><td>${esc(x.project_name)}</td><td>${esc(x.worker_name||"")}</td><td>${esc(x.description)}</td><td class="money">${cash(x.amount)}</td><td>${S.session.user.role==="admin"?`<button class="btn small danger del-labor" data-id="${x.id}">Supprimer</button>`:""}</td></tr>`))}</div>`;$("#addLabor").onclick=()=>modal(`<h2>Main-d'œuvre</h2><form id="laborForm" class="formgrid"><label>Projet<select name="project_id" required>${opts(S.data.projects)}</select></label><label>Métier<select name="trade_id">${opts(S.data.trades)}</select></label><label>Date<input name="expense_date" type="date" value="${new Date().toISOString().slice(0,10)}"></label><label>Prestataire<input name="worker_name"></label><label class="span2">Travaux<input name="description" required></label><label>Montant<input name="amount" type="number" min="0"></label><label>Mode de paiement<select name="payment_method"><option>Espèces</option><option>Mobile Money</option><option>Virement</option><option>Chèque</option></select></label><label>Référence<input name="reference"></label><label class="span2">Notes<textarea name="notes"></textarea></label><button class="btn primary span2">Enregistrer</button></form>`);document.querySelectorAll(".del-labor").forEach(b=>b.onclick=()=>confirmBox("Supprimer cette main-d'œuvre ?",()=>post("/api/save",{entity:"labor",action:"delete",record:{id:b.dataset.id}})))}
document.addEventListener("submit",async e=>{if(e.target.id==="laborForm"){e.preventDefault();try{await post("/api/save",{entity:"labor",action:"create",record:fd(e.target)});closeModal();await reload();labor();toast("Main-d'œuvre enregistrée")}catch(x){toast(x.message,true)}}});
function trades(){$("#content").innerHTML=`<div class="panel"><div class="panelhead"><h2>Corps de métier</h2><button id="addTrade" class="btn primary">+ Ajouter</button></div>${table(["Projet","Métier","Description","Actions"],S.data.trades.map(x=>`<tr><td>${esc(S.data.projects.find(p=>p.id===x.project_id)?.name||"")}</td><td>${esc(x.name)}</td><td>${esc(x.description||"")}</td><td>${S.session.user.role==="admin"?`<button class="btn small danger del-trade" data-id="${x.id}">Supprimer</button>`:""}</td></tr>`))}</div>`;$("#addTrade").onclick=()=>modal(`<h2>Nouveau métier</h2><form id="tradeForm"><label>Projet<select name="project_id" required>${opts(S.data.projects)}</select></label><label>Nom<input name="name" required></label><label>Description<textarea name="description"></textarea></label><button class="btn primary full">Ajouter</button></form>`);document.querySelectorAll(".del-trade").forEach(b=>b.onclick=()=>confirmBox("Supprimer ce métier ?",()=>post("/api/save",{entity:"trade",action:"delete",record:{id:b.dataset.id}})))}
document.addEventListener("submit",async e=>{if(e.target.id==="tradeForm"){e.preventDefault();try{await post("/api/save",{entity:"trade",action:"create",record:fd(e.target)});closeModal();await reload();trades();toast("Métier ajouté")}catch(x){toast(x.message,true)}}});
function suppliers(){$("#content").innerHTML=`<div class="panel"><div class="panelhead"><h2>Fournisseurs</h2><button id="addSupplier" class="btn primary">+ Ajouter</button></div>${table(["Nom","Contact","Ville","Spécialité","Actions"],S.data.suppliers.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.phone||"")}</td><td>${esc(x.city||"")}</td><td>${esc(x.specialty||"")}</td><td>${S.session.user.role==="admin"?`<button class="btn small danger del-sup" data-id="${x.id}">Supprimer</button>`:""}</td></tr>`))}</div>`;$("#addSupplier").onclick=()=>modal(`<h2>Nouveau fournisseur</h2><form id="supplierForm" class="formgrid"><label>Nom<input name="name" required></label><label>Téléphone<input name="phone"></label><label>E-mail<input name="email" type="email"></label><label>Ville<input name="city"></label><label>Adresse<input name="address"></label><label>Spécialité<input name="specialty"></label><label class="span2">Notes<textarea name="notes"></textarea></label><button class="btn primary span2">Ajouter</button></form>`);document.querySelectorAll(".del-sup").forEach(b=>b.onclick=()=>confirmBox("Supprimer ce fournisseur ?",()=>post("/api/save",{entity:"supplier",action:"delete",record:{id:b.dataset.id}})))}
document.addEventListener("submit",async e=>{if(e.target.id==="supplierForm"){e.preventDefault();try{await post("/api/save",{entity:"supplier",action:"create",record:fd(e.target)});closeModal();await reload();suppliers();toast("Fournisseur ajouté")}catch(x){toast(x.message,true)}}});
function users(){$("#content").innerHTML=`<div class="panel"><div class="panelhead"><h2>Agents</h2><button id="addAgent" class="btn primary">+ Nouvel Agent</button></div>${table(["Nom","E-mail","Rôle","Statut","Actions"],S.data.users.map(x=>`<tr><td>${esc(x.full_name)}</td><td>${esc(x.email)}</td><td>${esc(x.role)}</td><td><span class="status ${x.status}">${esc(x.status)}</span><br><small>${Number(x.credential_ready)?"Accès prêt":"Mot de passe à réinitialiser"}</small></td><td>${x.role==="agent"?`<div class="actions"><button class="btn small secondary reset-agent" data-id="${x.id}">Mot de passe</button><button class="btn small secondary toggle-agent" data-id="${x.id}" data-act="${x.status==="active"?"disable":"activate"}">${x.status==="active"?"Désactiver":"Activer"}</button><button class="btn small danger del-agent" data-id="${x.id}">Supprimer</button></div>`:"—"}</td></tr>`))}<h3 style="margin-top:18px">Demandes mot de passe</h3>${table(["Date","Agent","E-mail","Statut","Action"],S.data.resets.map(x=>`<tr><td>${df(x.created_at)}</td><td>${esc(x.full_name||"")}</td><td>${esc(x.email)}</td><td>${esc(x.status)}</td><td>${x.status==="pending"?`<button class="btn small secondary reset-request" data-id="${x.user_id}" data-rid="${x.id}">Réinitialiser</button>`:"—"}</td></tr>`))}</div>`;$("#addAgent").onclick=()=>modal(`<h2>Nouvel Agent</h2><form id="agentForm"><label>Nom<input name="full_name" required></label><label>E-mail<input name="email" type="email" required></label><label>Téléphone<input name="phone"></label><label>Mot de passe initial<input name="password" type="password" minlength="12" required></label><button class="btn primary full">Créer</button></form>`);document.querySelectorAll(".toggle-agent").forEach(b=>b.onclick=()=>postSaveUser(b.dataset.id,b.dataset.act));document.querySelectorAll(".del-agent").forEach(b=>b.onclick=()=>confirmBox("Supprimer cet Agent ?",()=>post("/api/save",{entity:"user",action:"delete",record:{id:b.dataset.id}})));document.querySelectorAll(".reset-agent").forEach(b=>b.onclick=()=>resetModal(b.dataset.id,null,false));document.querySelectorAll(".reset-request").forEach(b=>b.onclick=()=>resetModal(b.dataset.id,b.dataset.rid,false))}
document.addEventListener("submit",async e=>{if(e.target.id==="agentForm"){e.preventDefault();try{await post("/api/save",{entity:"user",action:"create",record:fd(e.target)});closeModal();await reload();users();toast("Agent créé")}catch(x){toast(x.message,true)}}});
async function postSaveUser(id,action){try{await post("/api/save",{entity:"user",action,record:{id}});await reload();users();toast("Compte mis à jour")}catch(x){toast(x.message,true)}}
function reports(){const mat=S.data.expenses.reduce((a,x)=>a+Number(x.total_price),0),lab=S.data.labor.reduce((a,x)=>a+Number(x.amount),0);const by=S.data.trades.map(t=>({name:t.name,m:S.data.expenses.filter(x=>x.trade_id===t.id).reduce((a,x)=>a+Number(x.total_price),0),l:S.data.labor.filter(x=>x.trade_id===t.id).reduce((a,x)=>a+Number(x.amount),0)}));$("#content").innerHTML=`<div class="kpis">${kpi("Matériaux",cash(mat))}${kpi("Main-d'œuvre",cash(lab))}${kpi("Total",cash(mat+lab))}</div><div class="panel"><div class="panelhead"><h2>Bilan par métier</h2><button onclick="window.print()" class="btn secondary">Imprimer / PDF</button></div>${table(["Métier","Matériaux","Main-d'œuvre","Total"],by.map(x=>`<tr><td>${esc(x.name)}</td><td class="money">${cash(x.m)}</td><td class="money">${cash(x.l)}</td><td class="money"><strong>${cash(x.m+x.l)}</strong></td></tr>`))}</div>`}
function settings(){$("#content").innerHTML=`<div class="grid2"><div class="panel"><h2>Mon compte</h2><p>${esc(S.session.user.full_name)}<br>${esc(S.session.user.email)}</p><button id="changePwd" class="btn primary">Changer le mot de passe</button></div><div class="panel"><h2>Abonnement</h2><p>Plan : <strong>${esc(S.session.company.plan.toUpperCase())}</strong><br>Expiration : <strong>${df(S.session.company.plan_expires_at)}</strong></p>${S.session.company.plan==="free"?`<a class="btn gold" target="_blank" rel="noopener" href="${esc(S.session.businessPaymentUrl)}">Acheter mon plan Business</a>`:""}</div></div>`;$("#changePwd").onclick=changePassword}
function changePassword(){modal(`<h2>Changer mon mot de passe</h2><form id="pwdForm"><label>Mot de passe actuel<input name="current_password" type="password" required></label><label>Nouveau mot de passe<input name="new_password" type="password" minlength="12" required></label><button class="btn primary full">Modifier</button></form>`);$("#pwdForm").onsubmit=async e=>{e.preventDefault();try{await post("/api/change-password",fd(e.target));toast("Mot de passe modifié. Reconnexion requise.");setTimeout(()=>location.reload(),900)}catch(x){toast(x.message,true)}}}
function promo(){modal(`<div class="promo"><h2>Passez au Plan Business</h2><p>Votre Plan Free donne accès complet à GLOBAL BT pendant 21 jours. Le Plan Business donne accès complet pendant 365 jours.</p><div class="promoactions"><button id="promoOk" class="btn secondary">Compris</button><a class="btn gold" target="_blank" rel="noopener" href="${esc(S.session.businessPaymentUrl)}">Acheter mon plan Business</a></div></div>`);$("#promoOk").onclick=closeModal;S.promo=Date.now()}
setInterval(()=>{if(S.session?.company?.plan==="free"&&Date.now()-S.promo>=15*60*1000)promo()},60000);

function renderSuper(){({super:superDash,companies:superCompanies,members:superMembers,subscriptions:superSubscriptions,resets:superResets,audit:superAudit}[S.view]||superDash)()}
function superDash(){const c=S.data.companies||[],u=S.data.users||[],r=S.data.resets||[];$("#content").innerHTML=`<div class="kpis">${kpi("Entreprises",c.length)}${kpi("Membres",u.length)}${kpi("Free",c.filter(x=>x.plan==="free").length)}${kpi("Business",c.filter(x=>x.plan==="business").length)}${kpi("Demandes mot de passe",r.filter(x=>x.status==="pending").length)}</div><div class="panel"><h2>Super Administration GLOBAL BT</h2><p>Gestion centrale des entreprises, membres, abonnements et actions sensibles.</p></div>`}
function superCompanies(){$("#content").innerHTML=`<div class="panel"><div class="panelhead"><h2>Entreprises</h2><button id="newCompany" class="btn primary">+ Nouvelle entreprise</button></div>${table(["Entreprise","Plan","Expiration","Statut","Actions"],S.data.companies.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.plan)}</td><td>${df(x.plan_expires_at)}</td><td><span class="status ${x.status}">${esc(x.status)}</span></td><td><div class="actions"><button class="btn small secondary set-plan" data-id="${x.id}" data-plan="${x.plan==="free"?"business":"free"}">→ ${x.plan==="free"?"Business":"Free"}</button><button class="btn small secondary toggle-company" data-id="${x.id}" data-act="${x.status==="active"?"disable":"activate"}">${x.status==="active"?"Désactiver":"Activer"}</button><button class="btn small danger del-company" data-id="${x.id}">Supprimer</button></div></td></tr>`))}</div>`;$("#newCompany").onclick=()=>modal(`<h2>Nouvelle entreprise</h2><form id="companyForm" class="formgrid"><label>Entreprise<input name="name" required></label><label>Ville<input name="city"></label><label>Plan<select name="plan"><option value="free">Free · 21 jours</option><option value="business">Business · 365 jours</option></select></label><label>Nom Administrateur<input name="admin_name" required></label><label>E-mail Administrateur<input name="admin_email" type="email" required></label><label>Téléphone<input name="admin_phone"></label><label class="span2">Mot de passe initial<input name="admin_password" type="password" minlength="12" required></label><button class="btn primary span2">Créer</button></form>`);document.querySelectorAll(".set-plan").forEach(b=>b.onclick=()=>confirmBox("Changer le plan et redémarrer sa durée ?",()=>post("/api/save",{entity:"company",action:"set_plan",record:{id:b.dataset.id,plan:b.dataset.plan}})));document.querySelectorAll(".toggle-company").forEach(b=>b.onclick=()=>confirmBox("Modifier le statut de cette entreprise ?",()=>post("/api/save",{entity:"company",action:b.dataset.act,record:{id:b.dataset.id}})));document.querySelectorAll(".del-company").forEach(b=>b.onclick=()=>confirmBox("Supprimer logiquement cette entreprise ?",()=>post("/api/save",{entity:"company",action:"delete",record:{id:b.dataset.id}})))}
document.addEventListener("submit",async e=>{if(e.target.id==="companyForm"){e.preventDefault();try{await post("/api/save",{entity:"company",action:"create",record:fd(e.target)});closeModal();await reload();superCompanies();toast("Entreprise créée")}catch(x){toast(x.message,true)}}});
function superMembers(){$("#content").innerHTML=`<div class="panel"><h2>Tous les membres</h2>${table(["Nom","Entreprise","E-mail","Rôle","Statut","Actions"],S.data.users.map(x=>`<tr><td>${esc(x.full_name)}</td><td>${esc(x.company_name||"Administration")}</td><td>${esc(x.email)}</td><td>${esc(x.role)}</td><td><span class="status ${x.status}">${esc(x.status)}</span><br><small>${Number(x.credential_ready)?"Accès prêt":"Mot de passe à réinitialiser"}</small></td><td>${x.role!=="superadmin"?`<div class="actions"><button class="btn small secondary reset-member" data-id="${x.id}">Mot de passe</button><button class="btn small secondary toggle-member" data-id="${x.id}" data-act="${x.status==="active"?"disable":"activate"}">${x.status==="active"?"Désactiver":"Activer"}</button><button class="btn small danger del-member" data-id="${x.id}">Supprimer</button></div>`:"Compte protégé"}</td></tr>`))}</div>`;document.querySelectorAll(".reset-member").forEach(b=>b.onclick=()=>resetModal(b.dataset.id,null,true));document.querySelectorAll(".toggle-member").forEach(b=>b.onclick=()=>superUserAction(b.dataset.id,b.dataset.act));document.querySelectorAll(".del-member").forEach(b=>b.onclick=()=>confirmBox("Supprimer ce membre ?",()=>post("/api/save",{entity:"user",action:"delete",record:{id:b.dataset.id}})))}
async function superUserAction(id,action){try{await post("/api/save",{entity:"user",action,record:{id}});await reload();superMembers();toast("Compte mis à jour")}catch(x){toast(x.message,true)}}
function resetModal(id,rid,superA){modal(`<h2>Réinitialiser le mot de passe</h2><form id="resetDirect"><label>Nouveau mot de passe temporaire<input name="new_password" type="password" minlength="12" required></label><button class="btn primary full">Réinitialiser</button></form>`);$("#resetDirect").onsubmit=async e=>{e.preventDefault();try{await post("/api/save",{entity:"user",action:"reset_password",record:{id,new_password:e.target.new_password.value,reset_request_id:rid||null}});closeModal();await reload();render();toast("Mot de passe réinitialisé")}catch(x){toast(x.message,true)}}}
function superSubscriptions(){$("#content").innerHTML=`<div class="panel"><h2>Abonnements</h2><div class="notice">Free : 21 jours complets · Business : 365 jours complets.</div>${table(["Entreprise","Plan","Début","Expiration","État"],S.data.companies.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.plan)}</td><td>${df(x.plan_started_at)}</td><td>${df(x.plan_expires_at)}</td><td>${Date.parse(x.plan_expires_at)>Date.now()?"Valide":"Expiré"}</td></tr>`))}</div>`}
function superResets(){$("#content").innerHTML=`<div class="panel"><h2>Demandes Administrateurs</h2>${table(["Date","Membre","Entreprise","E-mail","Statut","Action"],S.data.resets.map(x=>`<tr><td>${df(x.created_at)}</td><td>${esc(x.full_name||"")}</td><td>${esc(x.company_name||"")}</td><td>${esc(x.email)}</td><td>${esc(x.status)}</td><td>${x.status==="pending"?`<div class="actions"><button class="btn small secondary reset-request-super" data-id="${x.user_id}" data-rid="${x.id}">Réinitialiser</button><button class="btn small danger reject-reset" data-id="${x.id}">Rejeter</button></div>`:"—"}</td></tr>`))}</div>`;document.querySelectorAll(".reset-request-super").forEach(b=>b.onclick=()=>resetModal(b.dataset.id,b.dataset.rid,true));document.querySelectorAll(".reject-reset").forEach(b=>b.onclick=()=>confirmBox("Rejeter la demande ?",()=>post("/api/save",{entity:"reset",action:"reject",record:{id:b.dataset.id}})))}
function superAudit(){$("#content").innerHTML=`<div class="panel"><div class="panelhead"><h2>Journal des actions sensibles</h2><button onclick="window.print()" class="btn secondary">Imprimer</button></div>${table(["Date","Acteur","Entreprise","Action","Cible","IP"],S.data.logs.map(x=>`<tr><td>${df(x.created_at)}</td><td>${esc(x.actor_name||"Système")}</td><td>${esc(x.company_name||"—")}</td><td><strong>${esc(x.action)}</strong></td><td>${esc(x.target_type||"")} ${esc(x.target_id||"")}</td><td>${esc(x.ip||"")}</td></tr>`))}</div>`}

init();
