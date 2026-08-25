const $=s=>document.querySelector(s);
const S={session:null,data:null,view:null,promo:0};
const names={dashboard:"Tableau de bord",projects:"Projets",expenses:"Dépenses",labor:"Main-d'œuvre",trades:"Corps de métier",suppliers:"Fournisseurs",users:"Utilisateurs",reports:"Rapports",settings:"Paramètres",super:"Tableau de bord",companies:"Entreprises",members:"Membres",subscriptions:"Abonnements",resets:"Mots de passe",audit:"Journal"};

const actionLocks=new WeakMap();

const TRADE_PHASES=[
  {key:"01_acquisition_etudes",label:"1. Acquisition, études & préparation administrative",short:"Acquisition & études",trades:["Prospection / acquisition du chantier","Étude de faisabilité","Architecture","Géomètre","Topographie","Étude géotechnique","Bureau d’études techniques","Étude structure béton","Étude électricité","Étude plomberie / assainissement","Métré / devis quantitatif","Planification de chantier","Contrôle technique","Suivi de chantier","Démarches administratives / autorisations"]},
  {key:"02_installation_preparation",label:"2. Installation & préparation du terrain",short:"Préparation du terrain",trades:["Installation de chantier","Clôture / sécurisation du chantier","Nettoyage du terrain","Démolition","Évacuation des gravats","Implantation","Décapage","Terrassement","Fouilles","Remblai / compactage","Nivellement","Location d’engins","Transport de matériaux"]},
  {key:"03_fondations_infrastructures",label:"3. Fondations & infrastructures",short:"Fondations",trades:["Fondation","Béton de propreté","Semelles","Longrines","Ferraillage fondations","Coffrage fondations","Béton armé fondations","Soubassement","Drainage","Assainissement enterré","Canalisation enterrée"]},
  {key:"04_gros_oeuvre",label:"4. Gros œuvre & structure",short:"Gros œuvre",trades:["Gros œuvre","Maçonnerie","Béton armé","Ferraillage","Coffrage","Poteaux / poutres","Dalles / planchers","Escaliers béton","Murs porteurs","Enduit gros œuvre"]},
  {key:"05_charpente_couverture",label:"5. Charpente, couverture & étanchéité",short:"Charpente & couverture",trades:["Charpente bois","Charpente métallique","Couverture","Étanchéité","Gouttières / descentes EP","Isolation thermique toiture","Isolation acoustique"]},
  {key:"06_second_oeuvre_technique",label:"6. Second œuvre technique",short:"Lots techniques",trades:["Plomberie sanitaire","Électricité bâtiment","Climatisation","Ventilation","Réseau informatique","Vidéosurveillance","Contrôle d’accès","Sécurité incendie","Installation solaire","Groupe électrogène","Ascenseur","Forage","Installation de château d’eau"]},
  {key:"07_menuiseries_fermetures",label:"7. Menuiseries, serrurerie & fermetures",short:"Menuiseries",trades:["Menuiserie bois","Menuiserie aluminium","Menuiserie métallique","Serrurerie","Vitrerie","Portes / fenêtres","Garde-corps","Grilles / portails"]},
  {key:"08_finitions_interieures",label:"8. Revêtements & finitions intérieures",short:"Finitions intérieures",trades:["Carrelage","Faïence","Revêtement de sol","Enduit","Plâtrerie","Faux plafond","Staff / décoration","Peinture","Décoration intérieure"]},
  {key:"09_facades_exterieurs",label:"9. Façades & aménagements extérieurs",short:"Extérieurs",trades:["Ravalement de façade","Peinture extérieure","Pavage","Voirie et réseaux divers (VRD)","Électricité extérieure","Éclairage extérieur","Aménagement extérieur","Aménagement paysager","Clôture définitive","Portail extérieur"]},
  {key:"10_essais_livraison",label:"10. Essais, nettoyage & livraison",short:"Réception & livraison",trades:["Essais électriques","Essais plomberie","Essais climatisation","Contrôle qualité","Levée des réserves","Nettoyage de chantier","Nettoyage de fin de travaux","Réception provisoire","Réception définitive","Remise des clés / livraison"]},
  {key:"11_autres",label:"11. Autres travaux",short:"Autres",trades:["Autres travaux"]}
];
const DEFAULT_TRADES=[...new Set(TRADE_PHASES.flatMap(p=>p.trades))];
function phaseForTrade(name){const n=String(name||"").trim().toLowerCase();return TRADE_PHASES.find(p=>p.trades.some(t=>t.toLowerCase()===n))?.key||"11_autres"}
function phaseLabel(key){return TRADE_PHASES.find(p=>p.key===key)?.label||"Autres travaux"}
function phaseShort(key){return TRADE_PHASES.find(p=>p.key===key)?.short||"Autres"}
function renderTradePicker(selected=[]){
  const selectedSet=new Set(selected.map(x=>typeof x==="string"?x:x.name));
  return `<div class="trade-picker hierarchical-picker">
    <div class="trade-picker-head"><div><strong>Corps de métier du projet</strong><small>Choisissez le corps principal, puis les sous-corps à réaliser.</small></div><span id="tradeSelectedCount" class="trade-count">${selectedSet.size} sélectionné(s)</span></div>
    <div class="phase-selector"><label>Corps principal / phase<select id="tradePhaseSelect">${TRADE_PHASES.map((p,i)=>`<option value="${esc(p.key)}" ${i===0?"selected":""}>${esc(p.label)}</option>`).join("")}</select></label><label>Rechercher<input id="tradeSearch" type="search" placeholder="Rechercher un sous-corps..."></label></div>
    <div id="tradeLibrary" class="trade-library hierarchical-list">${TRADE_PHASES.flatMap((p,pi)=>p.trades.map(t=>`<label class="trade-option ${pi===0?"":"hidden"}" data-phase="${esc(p.key)}" data-trade-name="${esc(t.toLowerCase())}"><input type="checkbox" name="project_trades" value="${esc(t)}" data-phase="${esc(p.key)}" ${selectedSet.has(t)?"checked":""}><span><b>${esc(t)}</b><small>${esc(p.short)}</small></span></label>`)).join("")}</div>
    <div class="custom-trade-box"><select id="customTradePhase">${TRADE_PHASES.map(p=>`<option value="${esc(p.key)}">${esc(p.short)}</option>`).join("")}</select><input id="customTradeInput" type="text" placeholder="Ajouter un sous-corps personnalisé..."><button id="addCustomTrade" class="btn secondary" type="button">+ Ajouter</button></div>
    <div id="customTradeList" class="custom-trade-list"></div></div>`;
}
function initTradePicker(root=document){
  const phase=root.querySelector('#tradePhaseSelect'),search=root.querySelector('#tradeSearch'),lib=root.querySelector('#tradeLibrary'),count=root.querySelector('#tradeSelectedCount'),ci=root.querySelector('#customTradeInput'),cp=root.querySelector('#customTradePhase'),add=root.querySelector('#addCustomTrade'),cl=root.querySelector('#customTradeList'); if(!lib)return;
  const refresh=()=>{const ph=phase?.value||TRADE_PHASES[0].key,q=(search?.value||'').trim().toLowerCase();lib.querySelectorAll('.trade-option').forEach(el=>el.classList.toggle('hidden',!(el.dataset.phase===ph&&(!q||el.dataset.tradeName.includes(q)))))};
  const update=()=>{const n=lib.querySelectorAll('input[name="project_trades"]:checked').length+(cl?.querySelectorAll('[data-custom-trade]').length||0);if(count)count.textContent=`${n} sélectionné(s)`};
  phase?.addEventListener('change',()=>{if(cp)cp.value=phase.value;refresh()}); search?.addEventListener('input',refresh); lib.querySelectorAll('input[name="project_trades"]').forEach(i=>i.addEventListener('change',update));
  const addCustom=()=>{const raw=(ci?.value||'').trim();if(!raw)return;const ph=cp?.value||phase?.value||'11_autres';const exists=[...lib.querySelectorAll('input[name="project_trades"]')].some(i=>i.value.toLowerCase()===raw.toLowerCase())||[...cl.querySelectorAll('[data-custom-trade]')].some(i=>i.dataset.customTrade.toLowerCase()===raw.toLowerCase());if(exists){toast('Ce métier est déjà dans la sélection.',true);return}const chip=document.createElement('span');chip.className='custom-trade-chip';chip.dataset.customTrade=raw;chip.dataset.phase=ph;chip.innerHTML=`${esc(raw)} <small>${esc(phaseShort(ph))}</small> <button type="button">×</button>`;chip.querySelector('button').onclick=()=>{chip.remove();update()};cl.appendChild(chip);ci.value='';update()};
  add?.addEventListener('click',addCustom);ci?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addCustom()}});refresh();update();
}
function collectProjectTrades(root=document){const base=[...root.querySelectorAll('input[name="project_trades"]:checked')].map(i=>({name:i.value.trim(),phase:i.dataset.phase||phaseForTrade(i.value)}));const custom=[...root.querySelectorAll('[data-custom-trade]')].map(i=>({name:i.dataset.customTrade.trim(),phase:i.dataset.phase||'11_autres'}));const seen=new Set();return [...base,...custom].filter(x=>{const k=x.name.toLowerCase();if(!x.name||seen.has(k))return false;seen.add(k);return true})}
function printA4(title,subtitle,body){const w=window.open('','_blank','width=1100,height=800');if(!w){toast('Autorisez les popups pour imprimer.',true);return}w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page{size:A4 portrait;margin:14mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#172522;font-size:11px}.head{border-bottom:3px solid #0d5c54;padding-bottom:9px;margin-bottom:14px}.head h1{margin:0;color:#073b37;font-size:20px}.head p{margin:4px 0;color:#60716e}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #ccd8d5;padding:6px;vertical-align:top}th{background:#073b37;color:#fff}tr{break-inside:avoid}.phase{font-weight:bold;color:#0d5c54}.footer{margin-top:10px;text-align:right;font-size:9px;color:#71807d}</style></head><body><div class="head"><h1>${esc(title)}</h1><p>${esc(subtitle||'')}</p></div>${body}<div class="footer">GLOBAL BT · ${new Date().toLocaleString('fr-FR')}</div><script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close()}

function setBusy(el,busy,label="Traitement..."){
  if(!el)return;
  if(busy){
    if(actionLocks.get(el))return false;
    actionLocks.set(el,true);
    el.dataset.originalText=el.innerHTML;
    el.disabled=true;
    el.classList.add("is-busy");
    if(el.tagName==="BUTTON" && label)el.innerHTML=`<span class="btn-spinner"></span>${esc(label)}`;
    return true;
  }
  actionLocks.delete(el);
  el.disabled=false;
  el.classList.remove("is-busy");
  if(el.dataset.originalText!==undefined){
    el.innerHTML=el.dataset.originalText;
    delete el.dataset.originalText;
  }
  return true;
}

async function guardAction(el,fn,label="Traitement..."){
  if(el && actionLocks.get(el))return;
  if(el && !setBusy(el,true,label))return;
  try{return await fn()}
  finally{if(el)setBusy(el,false)}
}

function enhancePasswordFields(root=document){
  root.querySelectorAll('input[type="password"]:not([data-password-enhanced])').forEach(input=>{
    input.dataset.passwordEnhanced="1";
    const parent=input.parentElement;
    if(parent?.classList.contains("pw") || parent?.classList.contains("password-field-wrap")){
      if(!parent.querySelector(".password-toggle")){
        const b=document.createElement("button");
        b.type="button";
        b.className="password-toggle";
        b.textContent="Voir";
        b.setAttribute("aria-label","Afficher le mot de passe");
        b.onclick=()=>{
          const show=input.type==="password";
          input.type=show?"text":"password";
          b.textContent=show?"Masquer":"Voir";
          b.setAttribute("aria-label",show?"Masquer le mot de passe":"Afficher le mot de passe");
        };
        parent.appendChild(b);
      }
      return;
    }
    const wrap=document.createElement("div");
    wrap.className="password-field-wrap";
    input.parentNode.insertBefore(wrap,input);
    wrap.appendChild(input);
    const b=document.createElement("button");
    b.type="button";
    b.className="password-toggle";
    b.textContent="Voir";
    b.setAttribute("aria-label","Afficher le mot de passe");
    b.onclick=()=>{
      const show=input.type==="password";
      input.type=show?"text":"password";
      b.textContent=show?"Masquer":"Voir";
      b.setAttribute("aria-label",show?"Masquer le mot de passe":"Afficher le mot de passe");
    };
    wrap.appendChild(b);
  });
}

const uiObserver=new MutationObserver(()=>enhancePasswordFields(document));
document.addEventListener("DOMContentLoaded",()=>enhancePasswordFields(document));
uiObserver.observe(document.documentElement,{subtree:true,childList:true});

document.addEventListener("click",e=>{
  const btn=e.target.closest("button");
  if(!btn)return;
  if(btn.disabled || btn.classList.contains("is-busy")){
    e.preventDefault();
    e.stopImmediatePropagation();
  }
},true);

document.addEventListener("submit",e=>{
  const form=e.target;
  if(!(form instanceof HTMLFormElement))return;
  if(form.dataset.submitting==="1"){
    e.preventDefault();
    e.stopImmediatePropagation();
    return;
  }
  form.dataset.submitting="1";
  const submit=form.querySelector('button[type="submit"],button:not([type])');
  if(submit)setBusy(submit,true,"Enregistrement...");
  setTimeout(()=>{
    if(form.isConnected && form.dataset.submitting==="1"){
      form.dataset.submitting="0";
      if(submit)setBusy(submit,false);
    }
  },12000);
},true);

function releaseForm(form){
  if(!form)return;
  form.dataset.submitting="0";
  const submit=form.querySelector('button[type="submit"],button:not([type])');
  if(submit)setBusy(submit,false);
}

function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]))}
function cash(v){return new Intl.NumberFormat("fr-FR").format(Number(v||0))+" FCFA"}
function df(v){if(!v)return"";const d=new Date(v.length===10?v+"T00:00:00":v);return Number.isNaN(+d)?v:d.toLocaleDateString("fr-FR")}
function toast(m,bad=false){const t=$("#toast");t.textContent=m;t.style.background=bad?"#8d3037":"#16433e";t.classList.remove("hidden");setTimeout(()=>t.classList.add("hidden"),3000)}
function modal(h){$("#modalBody").innerHTML=h;$("#modal").classList.remove("hidden");enhancePasswordFields($("#modalBody"))}function closeModal(){$("#modal").classList.add("hidden")}
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
$("#loginForm").onsubmit=async e=>{e.preventDefault();try{S.session=await post("/api/login",{email:$("#loginEmail").value,password:$("#loginPassword").value});await enter()}catch(x){$("#authMessage").textContent=x.message}finally{releaseForm(e.target)}};
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
function projects(){
  const rows=S.data.projects.map(x=>{const ts=(S.data.trades||[]).filter(t=>t.project_id===x.id);return `<tr class="clickable-row project-row" data-id="${x.id}"><td><strong>${esc(x.name)}</strong></td><td>${esc(x.location||'')}</td><td class="money">${cash(x.budget)}</td><td><span class="status">${esc(x.status)}</span></td><td>${ts.length} métier(s)</td><td><div class="actions"><button class="btn small secondary edit-project" data-id="${x.id}">Modifier</button><button class="btn small secondary print-project" data-id="${x.id}">PDF A4</button>${S.session.user.role==='admin'?`<button class="btn small danger del-project" data-id="${x.id}">Supprimer</button>`:''}</div></td></tr>`});
  $('#content').innerHTML=`<div class="panel"><div class="panelhead"><div><h2>Projets</h2><p class="muted">Du lancement à la livraison : métiers, modification et impression.</p></div><div class="toolbar"><button id="printProjects" class="btn secondary">Imprimer A4</button><button id="addProject" class="btn primary">+ Nouveau projet</button></div></div>${table(['Projet','Localité','Budget','Statut','Métiers','Actions'],rows)}</div>`;
  const openEdit=id=>{const x=S.data.projects.find(p=>p.id===id);if(!x)return;const ts=(S.data.trades||[]).filter(t=>t.project_id===id);modal(`<h2>Modifier le projet</h2><form id="projectEditForm" class="formgrid" data-id="${esc(id)}"><label>Nom<input name="name" value="${esc(x.name)}" required></label><label>Type<input name="project_type" value="${esc(x.project_type||'')}"></label><label>Localité<input name="location" value="${esc(x.location||'')}"></label><label>Budget<input name="budget" type="number" min="0" value="${Number(x.budget||0)}"></label><label>Maître d'ouvrage<input name="owner_name" value="${esc(x.owner_name||'')}"></label><label>Responsable<input name="manager_name" value="${esc(x.manager_name||'')}"></label><label>Date début<input name="start_date" type="date" value="${esc(x.start_date||'')}"></label><label>Date fin<input name="end_date" type="date" value="${esc(x.end_date||'')}"></label><label>Statut<select name="status"><option value="preparation" ${x.status==='preparation'?'selected':''}>Préparation</option><option value="in_progress" ${x.status==='in_progress'?'selected':''}>En cours</option><option value="suspended" ${x.status==='suspended'?'selected':''}>Suspendu</option><option value="completed" ${x.status==='completed'?'selected':''}>Terminé</option></select></label><label class="span2">Description<textarea name="description">${esc(x.description||'')}</textarea></label><div class="span2 current-trades"><strong>Métiers affectés</strong>${ts.length?ts.map(t=>`<span>${esc(t.name)} <small>${esc(phaseShort(t.phase||phaseForTrade(t.name)))}</small></span>`).join(''):'<em>Aucun métier</em>'}</div><button class="btn primary span2" type="submit">Enregistrer</button></form>`)};
  $('#addProject').onclick=()=>{modal(`<h2>Nouveau projet</h2><form id="projectForm" class="formgrid"><label>Nom<input name="name" required></label><label>Type<input name="project_type" value="Bâtiment"></label><label>Localité<input name="location"></label><label>Budget<input name="budget" type="number" min="0"></label><label>Maître d'ouvrage<input name="owner_name"></label><label>Responsable<input name="manager_name"></label><label>Date début<input name="start_date" type="date"></label><label>Date fin<input name="end_date" type="date"></label><label>Statut<select name="status"><option value="preparation">Préparation</option><option value="in_progress" selected>En cours</option><option value="suspended">Suspendu</option><option value="completed">Terminé</option></select></label><label class="span2">Description<textarea name="description"></textarea></label><div class="span2">${renderTradePicker()}</div><button class="btn primary span2" type="submit">Créer le projet et ses métiers</button></form>`);initTradePicker($('#modalBody'))};
  document.querySelectorAll('.project-row').forEach(r=>r.onclick=e=>{if(!e.target.closest('button'))openEdit(r.dataset.id)});document.querySelectorAll('.edit-project').forEach(b=>b.onclick=e=>{e.stopPropagation();openEdit(b.dataset.id)});
  document.querySelectorAll('.print-project').forEach(b=>b.onclick=e=>{e.stopPropagation();const x=S.data.projects.find(p=>p.id===b.dataset.id);if(!x)return;const ts=(S.data.trades||[]).filter(t=>t.project_id===x.id);const body=`<table><tr><th>Information</th><th>Détail</th></tr><tr><td>Type</td><td>${esc(x.project_type||'')}</td></tr><tr><td>Localité</td><td>${esc(x.location||'')}</td></tr><tr><td>Budget</td><td>${cash(x.budget)}</td></tr><tr><td>Responsable</td><td>${esc(x.manager_name||'')}</td></tr></table><h3>Corps de métier</h3><table><tr><th>Phase principale</th><th>Sous-corps</th></tr>${ts.sort((a,b)=>String(a.phase||phaseForTrade(a.name)).localeCompare(String(b.phase||phaseForTrade(b.name)))).map(t=>`<tr><td>${esc(phaseLabel(t.phase||phaseForTrade(t.name)))}</td><td>${esc(t.name)}</td></tr>`).join('')}</table>`;printA4(`Projet : ${x.name}`,x.location||'',body)});
  $('#printProjects').onclick=()=>printA4('Liste des projets',S.session.company?.name||'',`<table><tr><th>Projet</th><th>Localité</th><th>Budget</th><th>Statut</th><th>Métiers</th></tr>${S.data.projects.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.location||'')}</td><td>${cash(x.budget)}</td><td>${esc(x.status)}</td><td>${(S.data.trades||[]).filter(t=>t.project_id===x.id).length}</td></tr>`).join('')}</table>`);
  document.querySelectorAll('.del-project').forEach(b=>b.onclick=e=>{e.stopPropagation();confirmBox('Supprimer ce projet ?',()=>post('/api/save',{entity:'project',action:'delete',record:{id:b.dataset.id}}))});
}
document.addEventListener('submit',async e=>{
  if(e.target.id==='projectForm'){e.preventDefault();const form=e.target,trades=collectProjectTrades(form);try{const project=await post('/api/save',{entity:'project',action:'create',record:fd(form)});let created=0,failed=0;for(const t of trades){try{await post('/api/save',{entity:'trade',action:'create',record:{project_id:project.id,name:t.name,phase:t.phase,description:''}});created++}catch{failed++}}closeModal();await reload();projects();toast(`Projet créé · ${created} métier(s) ajouté(s)${failed?` · ${failed} échec(s)`:''}`,!!failed)}catch(x){toast(x.message,true)}finally{releaseForm(form)}}
  if(e.target.id==='projectEditForm'){e.preventDefault();const form=e.target;try{await post('/api/save',{entity:'project',action:'update',record:{id:form.dataset.id,...fd(form)}});closeModal();await reload();projects();toast('Projet modifié')}catch(x){toast(x.message,true)}finally{releaseForm(form)}}
});
function expenses(){$("#content").innerHTML=`<div class="panel"><div class="panelhead"><h2>Dépenses matériaux</h2><button id="addExpense" class="btn primary">+ Nouvelle dépense</button></div>${table(["Date","Projet","Métier","Désignation","Total","Actions"],S.data.expenses.map(x=>`<tr><td>${df(x.expense_date)}</td><td>${esc(x.project_name)}</td><td>${esc(x.trade_name||"—")}</td><td>${esc(x.description)}</td><td class="money"><strong>${cash(x.total_price)}</strong></td><td>${S.session.user.role==="admin"?`<button class="btn small danger del-exp" data-id="${x.id}">Supprimer</button>`:""}</td></tr>`))}</div>`;$("#addExpense").onclick=()=>modal(`<h2>Nouvelle dépense</h2><form id="expenseForm" class="formgrid"><label>Projet<select name="project_id" required>${opts(S.data.projects)}</select></label><label>Métier<select name="trade_id">${opts(S.data.trades)}</select></label><label>Fournisseur<select name="supplier_id">${opts(S.data.suppliers)}</select></label><label>Date<input name="expense_date" type="date" value="${new Date().toISOString().slice(0,10)}"></label><label class="span2">Désignation<input name="description" required></label><label>Quantité<input name="quantity" type="number" step=".01" value="1"></label><label>Unité<input name="unit"></label><label>Prix unitaire<input name="unit_price" type="number" min="0"></label><label>Référence<input name="reference"></label><label class="span2">Notes<textarea name="notes"></textarea></label><button class="btn primary span2">Enregistrer</button></form>`);document.querySelectorAll(".del-exp").forEach(b=>b.onclick=()=>confirmBox("Supprimer cette dépense ?",()=>post("/api/save",{entity:"expense",action:"delete",record:{id:b.dataset.id}})))}
document.addEventListener("submit",async e=>{if(e.target.id==="expenseForm"){e.preventDefault();try{await post("/api/save",{entity:"expense",action:"create",record:fd(e.target)});closeModal();await reload();expenses();toast("Dépense enregistrée")}catch(x){toast(x.message,true)}}});
function labor(){$("#content").innerHTML=`<div class="panel"><div class="panelhead"><h2>Main-d'œuvre</h2><button id="addLabor" class="btn primary">+ Ajouter</button></div>${table(["Date","Projet","Prestataire","Travaux","Montant","Actions"],S.data.labor.map(x=>`<tr><td>${df(x.expense_date)}</td><td>${esc(x.project_name)}</td><td>${esc(x.worker_name||"")}</td><td>${esc(x.description)}</td><td class="money">${cash(x.amount)}</td><td>${S.session.user.role==="admin"?`<button class="btn small danger del-labor" data-id="${x.id}">Supprimer</button>`:""}</td></tr>`))}</div>`;$("#addLabor").onclick=()=>modal(`<h2>Main-d'œuvre</h2><form id="laborForm" class="formgrid"><label>Projet<select name="project_id" required>${opts(S.data.projects)}</select></label><label>Métier<select name="trade_id">${opts(S.data.trades)}</select></label><label>Date<input name="expense_date" type="date" value="${new Date().toISOString().slice(0,10)}"></label><label>Prestataire<input name="worker_name"></label><label class="span2">Travaux<input name="description" required></label><label>Montant<input name="amount" type="number" min="0"></label><label>Mode de paiement<select name="payment_method"><option>Espèces</option><option>Mobile Money</option><option>Virement</option><option>Chèque</option></select></label><label>Référence<input name="reference"></label><label class="span2">Notes<textarea name="notes"></textarea></label><button class="btn primary span2">Enregistrer</button></form>`);document.querySelectorAll(".del-labor").forEach(b=>b.onclick=()=>confirmBox("Supprimer cette main-d'œuvre ?",()=>post("/api/save",{entity:"labor",action:"delete",record:{id:b.dataset.id}})))}
document.addEventListener("submit",async e=>{if(e.target.id==="laborForm"){e.preventDefault();try{await post("/api/save",{entity:"labor",action:"create",record:fd(e.target)});closeModal();await reload();labor();toast("Main-d'œuvre enregistrée")}catch(x){toast(x.message,true)}}});
function trades(){
  const rows=(S.data.trades||[]).map(x=>`<tr class="clickable-row trade-row" data-id="${x.id}"><td>${esc(S.data.projects.find(p=>p.id===x.project_id)?.name||'')}</td><td><span class="phase-badge">${esc(phaseShort(x.phase||phaseForTrade(x.name)))}</span></td><td><strong>${esc(x.name)}</strong></td><td>${esc(x.description||'')}</td><td><div class="actions"><button class="btn small secondary edit-trade" data-id="${x.id}">Modifier</button><button class="btn small secondary print-trade" data-id="${x.id}">PDF</button>${S.session.user.role==='admin'?`<button class="btn small danger del-trade" data-id="${x.id}">Supprimer</button>`:''}</div></td></tr>`);
  $('#content').innerHTML=`<div class="panel"><div class="panelhead"><div><h2>Corps de métier</h2><p class="muted">Phases principales et sous-corps, de l'acquisition à la livraison.</p></div><div class="toolbar"><button id="printTrades" class="btn secondary">Imprimer A4</button><button id="addTrade" class="btn primary">+ Ajouter</button></div></div>${table(['Projet','Corps principal','Sous-corps de métier','Description','Actions'],rows)}</div>`;
  const openEdit=id=>{const x=S.data.trades.find(t=>t.id===id);if(!x)return;const ph=x.phase||phaseForTrade(x.name);modal(`<h2>Modifier le corps de métier</h2><form id="tradeEditForm" data-id="${esc(id)}"><label>Projet<select name="project_id" required>${opts(S.data.projects,x.project_id)}</select></label><label>Corps principal<select name="phase">${TRADE_PHASES.map(p=>`<option value="${esc(p.key)}" ${p.key===ph?'selected':''}>${esc(p.label)}</option>`).join('')}</select></label><label>Sous-corps<input name="name" value="${esc(x.name)}" required></label><label>Description<textarea name="description">${esc(x.description||'')}</textarea></label><button class="btn primary full" type="submit">Enregistrer</button></form>`)};
  $('#addTrade').onclick=()=>{modal(`<h2>Ajouter un sous-corps de métier</h2><form id="tradeForm"><label>Projet<select name="project_id" required>${opts(S.data.projects)}</select></label><label>Corps principal<select id="singleTradePhase" name="phase">${TRADE_PHASES.map(p=>`<option value="${esc(p.key)}">${esc(p.label)}</option>`).join('')}</select></label><label>Recherche<input id="singleTradeSearch" type="search" placeholder="Rechercher..."></label><div id="singleTradeLibrary" class="single-trade-library"></div><label>Sous-corps sélectionné ou personnalisé<input id="tradeNameInput" name="name" required></label><label>Description<textarea name="description"></textarea></label><button class="btn primary full" type="submit">Ajouter</button></form>`);const ps=$('#singleTradePhase'),s=$('#singleTradeSearch'),lib=$('#singleTradeLibrary'),inp=$('#tradeNameInput');const render=()=>{const p=TRADE_PHASES.find(x=>x.key===ps.value)||TRADE_PHASES[0],q=(s.value||'').toLowerCase();lib.innerHTML=p.trades.filter(t=>!q||t.toLowerCase().includes(q)).map(t=>`<button type="button" class="single-trade-choice" data-name="${esc(t)}">${esc(t)}</button>`).join('');lib.querySelectorAll('.single-trade-choice').forEach(b=>b.onclick=()=>{inp.value=b.dataset.name;lib.querySelectorAll('.single-trade-choice').forEach(x=>x.classList.toggle('selected',x===b))})};ps.onchange=render;s.oninput=render;render()};
  document.querySelectorAll('.trade-row').forEach(r=>r.onclick=e=>{if(!e.target.closest('button'))openEdit(r.dataset.id)});document.querySelectorAll('.edit-trade').forEach(b=>b.onclick=e=>{e.stopPropagation();openEdit(b.dataset.id)});
  document.querySelectorAll('.print-trade').forEach(b=>b.onclick=e=>{e.stopPropagation();const x=S.data.trades.find(t=>t.id===b.dataset.id);if(!x)return;printA4(`Corps de métier : ${x.name}`,S.data.projects.find(p=>p.id===x.project_id)?.name||'',`<table><tr><th>Corps principal</th><td>${esc(phaseLabel(x.phase||phaseForTrade(x.name)))}</td></tr><tr><th>Sous-corps</th><td>${esc(x.name)}</td></tr><tr><th>Description</th><td>${esc(x.description||'')}</td></tr></table>`)});
  $('#printTrades').onclick=()=>{const sorted=[...(S.data.trades||[])].sort((a,b)=>String(a.phase||phaseForTrade(a.name)).localeCompare(String(b.phase||phaseForTrade(b.name)))||a.name.localeCompare(b.name));printA4('Corps de métier',S.session.company?.name||'',`<table><tr><th>Projet</th><th>Corps principal</th><th>Sous-corps</th><th>Description</th></tr>${sorted.map(x=>`<tr><td>${esc(S.data.projects.find(p=>p.id===x.project_id)?.name||'')}</td><td>${esc(phaseLabel(x.phase||phaseForTrade(x.name)))}</td><td>${esc(x.name)}</td><td>${esc(x.description||'')}</td></tr>`).join('')}</table>`)};
  document.querySelectorAll('.del-trade').forEach(b=>b.onclick=e=>{e.stopPropagation();confirmBox('Supprimer ce métier ?',()=>post('/api/save',{entity:'trade',action:'delete',record:{id:b.dataset.id}}))});
}
document.addEventListener('submit',async e=>{
  if(e.target.id==='tradeForm'){e.preventDefault();try{await post('/api/save',{entity:'trade',action:'create',record:fd(e.target)});closeModal();await reload();trades();toast('Métier ajouté')}catch(x){toast(x.message,true)}finally{releaseForm(e.target)}}
  if(e.target.id==='tradeEditForm'){e.preventDefault();try{await post('/api/save',{entity:'trade',action:'update',record:{id:e.target.dataset.id,...fd(e.target)}});closeModal();await reload();trades();toast('Métier modifié')}catch(x){toast(x.message,true)}finally{releaseForm(e.target)}}
});
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

document.addEventListener("submit",e=>{
  const form=e.target;
  if(!(form instanceof HTMLFormElement))return;
  setTimeout(()=>{if(form.isConnected)releaseForm(form)},2500);
});
