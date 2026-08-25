const $=s=>document.querySelector(s);
const S={session:null,data:null,view:null,promo:0};
const names={dashboard:"Tableau de bord",projects:"Projets",expenses:"Matériaux",labor:"Main-d'œuvre",trades:"Corps de métier",suppliers:"Fournisseurs",users:"Utilisateurs",reports:"Rapports",settings:"Paramètres",super:"Tableau de bord",companies:"Entreprises",members:"Membres",subscriptions:"Abonnements",resets:"Mots de passe",audit:"Journal"};

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
function printA4(title,subtitle,body,orientation="portrait"){
  const w=window.open("","_blank","width=1200,height=850");if(!w){toast("Autorisez les popups pour imprimer.",true);return}
  const company=S.session?.company?.name||"GLOBAL BT",place=subtitle||"Document de gestion de chantier",stamp=new Date().toLocaleString("fr-FR");
  w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
  @page{size:A4 ${orientation==="landscape"?"landscape":"portrait"};margin:12mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#172522;font-size:10px;margin:0}.print-head{display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center;padding:0 0 12px;border-bottom:3px solid #07594f;margin-bottom:14px}.brand{width:54px;height:54px;border-radius:12px;background:#07594f;color:#fff;display:grid;place-items:center;font-weight:900;font-size:16px;letter-spacing:.5px}.head-main h1{margin:0;color:#073b37;font-size:20px}.head-main p{margin:4px 0 0;color:#60716e}.head-meta{text-align:right;color:#60716e;font-size:9px}.head-meta strong{display:block;color:#073b37;font-size:10px;margin-bottom:4px}table{width:100%;border-collapse:collapse;font-size:9px}th,td{border:1px solid #cfdad7;padding:6px 7px;vertical-align:top;text-align:left}th{background:#07594f;color:#fff;font-weight:700}tbody tr:nth-child(even){background:#f6f9f8}tr{break-inside:avoid}.money{text-align:right}.footer{margin-top:12px;padding-top:7px;border-top:1px solid #d8e1df;text-align:right;font-size:8px;color:#71807d}</style></head><body><div class="print-head"><div class="brand">GBT</div><div class="head-main"><h1>${esc(title)}</h1><p>${esc(place)}</p></div><div class="head-meta"><strong>${esc(company)}</strong><span>Édité le ${esc(stamp)}</span></div></div>${body}<div class="footer">GLOBAL BT · Gestion professionnelle de chantier</div><script>window.onload=()=>window.print()<\/script></body></html>`);
  w.document.close();
}

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
async function enter(){$("#authScreen").classList.add("hidden");$("#appShell").classList.remove("hidden");enterHeader();$("#spaceLabel").textContent=S.session.user.role==="superadmin"?"SUPER ADMINISTRATION":"ESPACE ENTREPRISE";nav();await reload();go(S.session.user.role==="superadmin"?"super":"dashboard");if(S.session.user.must_change_password)changePassword()}
async function reload(){S.data=await api("/api/load")}
function nav(){const superA=S.session.user.role==="superadmin",admin=S.session.user.role==="admin";const n=superA?[["super","Tableau de bord"],["companies","Entreprises"],["members","Membres"],["subscriptions","Abonnements"],["resets","Mots de passe"],["audit","Journal"]]:[["dashboard","Tableau de bord"],["projects","Projets"],["expenses","Matériaux"],["labor","Main-d'œuvre"],["trades","Métiers"],["suppliers","Fournisseurs"],["reports","Rapports"],...(admin?[["users","Utilisateurs"]]:[]),["settings","Paramètres"]];$("#mainNav").innerHTML=n.map(([i,l])=>`<button data-nav="${i}">${l}</button>`).join("")+`<button id="logout" class="logout">Déconnexion</button>`;$("#mainNav").classList.remove("hidden");document.querySelectorAll("[data-nav]").forEach(b=>b.onclick=()=>go(b.dataset.nav));$("#logout").onclick=async()=>{try{await post("/api/logout",{})}catch{}location.reload()}}
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
        <p>Suivez en temps réel la consommation budgétaire, les matériaux, l'avancement des projets et les postes les plus coûteux.</p>
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
        <div><small>Matériaux totaux</small><strong>${cash(total)}</strong><em>${rate}% du budget consommé</em></div>
      </div>
      <div class="kpi performance-card ${alertClass}">
        <div class="kpi-icon">◎</div>
        <div><small>Budget restant</small><strong>${cash(remain)}</strong><em>${budgetState}</em></div>
      </div>
      <div class="kpi performance-card">
        <div class="kpi-icon">▤</div>
        <div><small>Matériaux du mois</small><strong>${cash(monthSpend)}</strong><em>Matériaux + main-d'œuvre</em></div>
      </div>
      <div class="kpi performance-card">
        <div class="kpi-icon">⚒</div>
        <div><small>Main-d'œuvre</small><strong>${cash(lab)}</strong><em>${total?Math.round(lab*100/total):0}% des matériaux</em></div>
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
        <div class="panelhead"><div><h2>Répartition des matériaux</h2><p class="muted">Matériaux vs main-d'œuvre</p></div></div>
        <div class="split-metrics">
          <div class="split-box"><strong>${cash(mat)}</strong><span>Matériaux</span><div class="mini-meter"><i style="width:${total?Math.round(mat*100/total):0}%"></i></div></div>
          <div class="split-box"><strong>${cash(lab)}</strong><span>Main-d'œuvre</span><div class="mini-meter"><i style="width:${total?Math.round(lab*100/total):0}%"></i></div></div>
        </div>
      </div>
    </div>

    <div class="dashboard-grid">
      <div class="panel dashboard-panel">
        <div class="panelhead"><div><h2>Évolution des matériaux</h2><p class="muted">6 derniers mois enregistrés</p></div></div>
        <div class="bar-chart-pro">
          ${monthSeries.length?monthSeries.map(x=>`<div class="bar-item"><div class="bar-value">${cash(x.total)}</div><div class="bar-track"><span style="height:${Math.max(8,Math.round(x.total*150/maxMonth))}px"></span></div><small>${esc(x.month)}</small></div>`).join(""):`<div class="empty">Pas encore assez de données</div>`}
        </div>
      </div>

      <div class="panel dashboard-panel">
        <div class="panelhead"><div><h2>Matériaux par métier</h2><p class="muted">Top postes de coût</p></div></div>
        <div class="trade-ranking">
          ${byTrade.length?byTrade.slice(0,6).map((x,i)=>`<div class="trade-row"><div class="trade-name"><b>${i+1}. ${esc(x.name)}</b><span>${cash(x.total)}</span></div><div class="rank-meter"><i style="width:${Math.max(4,Math.round(x.total*100/maxTrade))}%"></i></div></div>`).join(""):`<div class="empty">Aucune dépense par métier</div>`}
        </div>
      </div>
    </div>

    <div class="panel dashboard-panel">
      <div class="panelhead">
        <div><h2>Performance des projets</h2><p class="muted">Budget, matériaux et taux de consommation par chantier</p></div>
        <button class="btn secondary" onclick="window.print()">Imprimer / PDF</button>
      </div>
      ${table(["Projet","Statut","Budget","Matériaux","Reste","Consommation"],projectRows.map(x=>`
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
function expenses(){$("#content").innerHTML=`<div class="panel"><div class="panelhead"><h2>Matériaux matériaux</h2><button id="addExpense" class="btn primary">+ Nouveaux matériaux</button></div>${table(["Date","Projet","Métier","Désignation","Total","Actions"],S.data.expenses.map(x=>`<tr><td>${df(x.expense_date)}</td><td>${esc(x.project_name)}</td><td>${esc(x.trade_name||"—")}</td><td>${esc(x.description)}</td><td class="money"><strong>${cash(x.total_price)}</strong></td><td>${S.session.user.role==="admin"?`<button class="btn small danger del-exp" data-id="${x.id}">Supprimer</button>`:""}</td></tr>`))}</div>`;$("#addExpense").onclick=()=>modal(`<h2>Nouveaux matériaux</h2><form id="expenseForm" class="formgrid"><label>Projet<select name="project_id" required>${opts(S.data.projects)}</select></label><label>Métier<select name="trade_id">${opts(S.data.trades)}</select></label><label>Fournisseur<select name="supplier_id">${opts(S.data.suppliers)}</select></label><label>Date<input name="expense_date" type="date" value="${new Date().toISOString().slice(0,10)}"></label><label class="span2">Désignation<input name="description" required></label><label>Quantité<input name="quantity" type="number" step=".01" value="1"></label><label>Unité<input name="unit"></label><label>Prix unitaire<input name="unit_price" type="number" min="0"></label><label>Référence<input name="reference"></label><label class="span2">Notes<textarea name="notes"></textarea></label><button class="btn primary span2">Enregistrer</button></form>`);document.querySelectorAll(".del-exp").forEach(b=>b.onclick=()=>confirmBox("Supprimer cette dépense ?",()=>post("/api/save",{entity:"expense",action:"delete",record:{id:b.dataset.id}})))}
document.addEventListener("submit",async e=>{if(e.target.id==="expenseForm"){e.preventDefault();try{await post("/api/save",{entity:"expense",action:"create",record:fd(e.target)});closeModal();await reload();expenses();toast("Matériaux enregistrés")}catch(x){toast(x.message,true)}}});
function labor(){$("#content").innerHTML=`<div class="panel"><div class="panelhead"><h2>Main-d'œuvre</h2><button id="addLabor" class="btn primary">+ Ajouter</button></div>${table(["Date","Projet","Prestataire","Travaux","Montant","Actions"],S.data.labor.map(x=>`<tr><td>${df(x.expense_date)}</td><td>${esc(x.project_name)}</td><td>${esc(x.worker_name||"")}</td><td>${esc(x.description)}</td><td class="money">${cash(x.amount)}</td><td>${S.session.user.role==="admin"?`<button class="btn small danger del-labor" data-id="${x.id}">Supprimer</button>`:""}</td></tr>`))}</div>`;$("#addLabor").onclick=()=>modal(`<h2>Main-d'œuvre</h2><form id="laborForm" class="formgrid"><label>Projet<select name="project_id" required>${opts(S.data.projects)}</select></label><label>Métier<select name="trade_id">${opts(S.data.trades)}</select></label><label>Date<input name="expense_date" type="date" value="${new Date().toISOString().slice(0,10)}"></label><label>Prestataire<input name="worker_name"></label><label class="span2">Travaux<input name="description" required></label><label>Montant<input name="amount" type="number" min="0"></label><label>Mode de paiement<select name="payment_method"><option>Espèces</option><option>Mobile Money</option><option>Virement</option><option>Chèque</option></select></label><label>Référence<input name="reference"></label><label class="span2">Notes<textarea name="notes"></textarea></label><button class="btn primary span2">Enregistrer</button></form>`);document.querySelectorAll(".del-labor").forEach(b=>b.onclick=()=>confirmBox("Supprimer cette main-d'œuvre ?",()=>post("/api/save",{entity:"labor",action:"delete",record:{id:b.dataset.id}})))}
document.addEventListener("submit",async e=>{if(e.target.id==="laborForm"){e.preventDefault();try{await post("/api/save",{entity:"labor",action:"create",record:fd(e.target)});closeModal();await reload();labor();toast("Main-d'œuvre enregistrée")}catch(x){toast(x.message,true)}}});

const PROFESSIONAL_TRADE_GROUPS=[
  {key:"conception_etudes",label:"Conception, Études et Gestion de Projet",activities:[
    ["Architecte","Conçoit les plans, l'esthétique et gère les demandes de permis de construire."],
    ["Ingénieur structure / Béton armé","Calcule la résistance des matériaux et valide la solidité du bâtiment."],
    ["Métreur / Économiste de la construction","Estime le coût global des matériaux et des travaux."],
    ["Coordonnateur SPS","Assure la sécurité et la protection de la santé sur le chantier."],
    ["Géomètre-expert","Délimite les terrains et réalise les relevés topographiques précis."],
    ["Dessinateur-projeteur","Réalise les plans techniques détaillés pour les ouvriers."],["Autre",""]]},
  {key:"gros_oeuvre",label:"Le Gros Œuvre (Structure, fondations et viabilisation)",activities:[
    ["Terrassier","Prépare le terrain en déplaçant la terre et en creusant les tranchées."],
    ["Maçon","Coule les fondations, monte les murs (briques, parpaings) et réalise les dalles de béton."],
    ["Charpentier bois / métal","Fabrique et pose l'ossature qui soutiendra la toiture."],
    ["Ferrailleur","Prépare et installe les armatures métalliques pour le béton armé."],
    ["Coffreur-bancheur","Réalise les moules en bois ou en métal dans lesquels est coulé le béton."],
    ["Démolisseur","Déconstruit les structures existantes en toute sécurité."],["Autre",""]]},
  {key:"enveloppe_batiment",label:"L'Enveloppe du Bâtiment (Clos et couvert)",activities:[
    ["Couvreur","Pose les matériaux de toiture (ardoises, tuiles, zinc) pour rendre le toit étanche."],
    ["Étancheur","Applique des revêtements imperméables sur les toits-terrasses et les fondations."],
    ["Façadier / Ragréeur","Nettoie, répare et applique les enduits de protection sur les murs extérieurs."],
    ["Menuisier extérieur","Installe les portes d'entrée, les fenêtres, les volets et les vérandas."],
    ["Bardeur","Pose les revêtements métalliques ou composites sur les façades extérieures."],["Autre",""]]},
  {key:"second_oeuvre",label:"Le Second Œuvre (Réseaux et finitions intérieures)",activities:[
    ["Électricien","Installe les câbles, le tableau électrique, l'éclairage et la domotique."],
    ["Plombier","Pose les tuyauteries, les sanitaires et gère l'évacuation des eaux usées."],
    ["Chauffagiste / Climaticien","Installe les pompes à chaleur, radiateurs et systèmes de ventilation (VMC)."],
    ["Plâtrier / Plaquiste","Monte les cloisons en plaques de plâtre (Placo) et lisse les surfaces."],
    ["Isolateur","Pose les isolants thermiques et acoustiques dans les murs, combles et planchers."],
    ["Menuisier intérieur","Fabrique et pose les parquets, les portes intérieures, les placards et les escaliers."],
    ["Carreleur-mosaïste","Habille les sols et les murs des pièces humides (cuisines, salles de bains)."],
    ["Peintre en bâtiment","Prépare les murs et applique les peintures, vernis ou papiers peints."],
    ["Solier-moquettiste","Pose les revêtements de sol souples (linoleum, PVC, moquette)."],
    ["Serrurier-métallier","Fabrique et pose les blindages de portes, rampes d'escalier et gardes-corps."],
    ["Vitrier / Miroitier","Découpe et installe les vitrages simples, doubles ou de sécurité."],["Autre",""]]},
  {key:"travaux_publics",label:"Les Travaux Publics (Infrastructures, routes et réseaux)",activities:[
    ["Canalisateur","Pose les tuyaux souterrains pour l'eau potable, le gaz et l'assainissement."],
    ["Conducteur d'engins","Pilote les pelles hydrauliques, bulldozers, compacteurs et chargeuses."],
    ["Constructeur de routes","Prépare les sous-couches et applique l'enrobé ou le bitume sur les chaussées."],
    ["Grutier","Manœuvre les grues à tour de grande hauteur pour déplacer les charges lourdes."],
    ["Constructeur en ouvrages d'art","Participe à la construction des ponts, tunnels et barrages."],
    ["Poseur de bordures et pavés","Réalise les trottoirs, les zones piétonnes et les aménagements urbains."],
    ["Monteurs de réseaux électriques","Installe les lignes haute tension et l'éclairage public extérieur."],["Autre",""]]},
  {key:"encadrement_chantier",label:"L'Encadrement de Chantier",activities:[
    ["Conducteur de travaux","Planifie le chantier, gère les budgets, les achats et les plannings."],
    ["Chef de chantier","Présent au quotidien, il encadre les ouvriers et organise le travail sur le terrain."],
    ["Chef d'équipe","Dirige un petit groupe d'ouvriers sur une tâche précise."],["Autre",""]]},
  {key:"autres",label:"Autres",activities:[]}
];
function renderProfessionalTradeForm(){
  return `<form id="v38CatalogTradeForm">
    <label>Corps principal<select id="v37TradeGroup" required>${PROFESSIONAL_TRADE_GROUPS.map(g=>`<option value="${esc(g.key)}">${esc(g.label)}</option>`).join("")}</select></label>
    <label id="v37CustomGroupWrap" class="hidden">Autre corps principal<input id="v37CustomGroup" type="text" placeholder="Précisez le corps principal"></label>
    <label id="v37ActivityWrap">Activité<select id="v37Activity" required></select></label>
    <label id="v37CustomActivityWrap" class="hidden">Autre activité<input id="v37CustomActivity" type="text" placeholder="Précisez l'activité"></label>
    <button class="btn primary full" type="submit">Ajouter le sous-corps de métier</button>
  </form>`;
}
function initProfessionalTradeForm(root=document){
  const group=root.querySelector("#v37TradeGroup"),activity=root.querySelector("#v37Activity"),activityWrap=root.querySelector("#v37ActivityWrap"),customGroupWrap=root.querySelector("#v37CustomGroupWrap"),customGroup=root.querySelector("#v37CustomGroup"),customActivityWrap=root.querySelector("#v37CustomActivityWrap"),customActivity=root.querySelector("#v37CustomActivity");
  if(!group)return;
  const refresh=()=>{
    const g=PROFESSIONAL_TRADE_GROUPS.find(x=>x.key===group.value)||PROFESSIONAL_TRADE_GROUPS[0],other=g.key==="autres";
    customGroupWrap.classList.toggle("hidden",!other);activityWrap.classList.toggle("hidden",other);customActivityWrap.classList.toggle("hidden",!other);
    if(other){activity.removeAttribute("required");return}
    activity.setAttribute("required","");activity.innerHTML=g.activities.map(([n])=>`<option value="${esc(n)}">${esc(n)}</option>`).join("");
    customActivityWrap.classList.add("hidden");customActivity.value="";
  };
  const changeActivity=()=>{const custom=activity.value==="Autre";customActivityWrap.classList.toggle("hidden",!custom);if(!custom)customActivity.value=""};
  group.addEventListener("change",refresh);activity.addEventListener("change",changeActivity);refresh();
  root.addEventListener("submit",e=>{
    const f=e.target;if(f.id!=="v38CatalogTradeForm")return;
    const g=PROFESSIONAL_TRADE_GROUPS.find(x=>x.key===group.value);
    if(group.value==="autres"){
      if(!customGroup.value.trim()||!customActivity.value.trim()){e.preventDefault();e.stopImmediatePropagation();toast("Renseignez le corps principal et l'activité personnalisés.",true);releaseForm(f);return}
      f.dataset.resolvedPhase=customGroup.value.trim();f.dataset.resolvedName=customActivity.value.trim();
    }else if(activity.value==="Autre"){
      if(!customActivity.value.trim()){e.preventDefault();e.stopImmediatePropagation();toast("Renseignez l'activité personnalisée.",true);releaseForm(f);return}
      f.dataset.resolvedPhase=g.label;f.dataset.resolvedName=customActivity.value.trim();
    }else{f.dataset.resolvedPhase=g.label;f.dataset.resolvedName=activity.value}
  },true);
}
function catalogTradeOptions(selected=""){
  const list=(S.data.tradeCatalog||[]);
  return list.map(x=>`<option value="${esc(x.id)}" ${String(x.id)===String(selected)?"selected":""}>${esc(x.phase||"Autres")} — ${esc(x.name)}</option>`).join("");
}
function renderProjectTradeCatalogForm(projectId,trade=null){
  const list=S.data.tradeCatalog||[];
  if(!list.length)return `<div class="empty"><strong>Aucun métier enregistré.</strong><br>Ajoutez d'abord le métier depuis le menu principal <b>Métiers</b>, puis revenez dans ce projet.</div>`;
  const selected=trade?.catalog_id||list.find(c=>String(c.name).toLowerCase()===String(trade?.name||"").toLowerCase()&&String(c.phase||"").toLowerCase()===String(trade?.phase||"").toLowerCase())?.id||"";
  return `<form id="${trade?"v38ProjectTradeEditForm":"v38ProjectTradeForm"}" data-project="${esc(projectId)}" ${trade?`data-id="${esc(trade.id)}"`:""}>
    <label>Métier / Corps principal<select name="catalog_id" required>${catalogTradeOptions(selected)}</select></label>
    <label>Description activité<textarea name="description" rows="4" placeholder="Décrivez les travaux ou l'activité à réaliser">${esc(trade?.description||"")}</textarea></label>
    <button class="btn primary full" type="submit">${trade?"Enregistrer":"Ajouter au projet"}</button>
  </form>`;
}
function trades(){
  const catalog=S.data.tradeCatalog||[];
  const rows=catalog.map(x=>`<tr><td><span class="phase-badge">${esc(x.phase||"")}</span></td><td><strong>${esc(x.name)}</strong></td><td class="v38-actions-cell"><div class="actions v38-actions"><button class="btn small secondary v38EditCatalogTrade" data-id="${x.id}">Modifier</button>${S.session.user.role==="admin"?`<button class="btn small danger v38DeleteCatalogTrade" data-id="${x.id}">Supprimer</button>`:""}</div></td></tr>`);
  $("#content").innerHTML=`<div class="panel"><div class="panelhead"><div><h2>Métiers</h2><p class="muted">Liste générale des métiers disponibles. Un métier doit être enregistré ici avant de pouvoir être ajouté à un projet.</p></div><div class="toolbar"><button id="v38PrintTrades" class="btn secondary">Imprimer / PDF</button><button id="v37AddTrade" class="btn primary">+ Ajouter un sous-corps de métier</button></div></div><div class="v38-catalog-table">${table(["Métier / Corps principal","Activité","Actions"],rows)}</div></div>`;
  $("#v38PrintTrades").onclick=()=>printA4("Liste générale des métiers",S.session.company?.name||"",`<table><tr><th>Métier / Corps principal</th><th>Activité</th></tr>${catalog.map(x=>`<tr><td>${esc(x.phase||"")}</td><td>${esc(x.name)}</td></tr>`).join("")}</table>`);
  $("#v37AddTrade").onclick=()=>{modal(`<h2>Ajouter un sous-corps de métier</h2>${renderProfessionalTradeForm()}`);initProfessionalTradeForm($("#modalBody"))};
  document.querySelectorAll(".v38EditCatalogTrade").forEach(b=>b.onclick=()=>{const x=catalog.find(t=>t.id===b.dataset.id);if(!x)return;modal(`<h2>Modifier le sous-corps de métier</h2><form id="v38CatalogTradeEditForm" data-id="${x.id}"><label>Métier / Corps principal<input name="phase" value="${esc(x.phase||"")}" required></label><label>Activité<input name="name" value="${esc(x.name)}" required></label><button class="btn primary full">Enregistrer</button></form>`)});
  document.querySelectorAll(".v38DeleteCatalogTrade").forEach(b=>b.onclick=()=>confirmBox("Supprimer ce métier de la liste générale ?",async()=>{await post("/api/save",{entity:"trade_catalog",action:"delete",record:{id:b.dataset.id}});await reload();trades();toast("Métier supprimé de la liste générale")}));
}

function suppliers(){
  $("#content").innerHTML=`<div class="panel"><div class="panelhead"><h2>Fournisseurs</h2><div class="toolbar"><button id="v37PrintSuppliers" class="btn secondary">Imprimer / PDF</button><button id="addSupplier" class="btn primary">+ Ajouter</button></div></div>${table(["Nom","Contact","Ville","Spécialité","Actions"],S.data.suppliers.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.phone||"")}</td><td>${esc(x.city||"")}</td><td>${esc(x.specialty||"")}</td><td class="v38-actions-cell">${S.session.user.role==="admin"?`<button class="btn small danger del-sup" data-id="${x.id}">Supprimer</button>`:""}</td></tr>`))}</div>`;
  $("#addSupplier").onclick=()=>modal(`<h2>Nouveau fournisseur</h2><form id="supplierForm" class="formgrid"><label>Nom<input name="name" required></label><label>Téléphone<input name="phone"></label><label>E-mail<input name="email" type="email"></label><label>Ville<input name="city"></label><label>Adresse<input name="address"></label><label>Spécialité<input name="specialty"></label><label class="span2">Notes<textarea name="notes"></textarea></label><button class="btn primary span2">Ajouter</button></form>`);
  document.querySelectorAll(".del-sup").forEach(b=>b.onclick=()=>confirmBox("Supprimer ce fournisseur de la liste générale ?",async()=>{await post("/api/save",{entity:"supplier",action:"delete",record:{id:b.dataset.id}});await reload();suppliers();toast("Fournisseur supprimé")}));
}
document.addEventListener("submit",async e=>{if(e.target.id==="supplierForm"){e.preventDefault();try{await post("/api/save",{entity:"supplier",action:"create",record:fd(e.target)});closeModal();await reload();suppliers();toast("Fournisseur ajouté")}catch(x){toast(x.message,true)}}});
function users(){$("#content").innerHTML=`<div class="panel"><div class="panelhead"><h2>Agents</h2><div class="toolbar"><button id="v37PrintUsers" class="btn secondary">Imprimer / PDF</button><button id="addAgent" class="btn primary">+ Nouvel Agent</button></div></div>${table(["Nom","E-mail","Rôle","Statut","Actions"],S.data.users.map(x=>`<tr><td>${esc(x.full_name)}</td><td>${esc(x.email)}</td><td>${esc(x.role)}</td><td><span class="status ${x.status}">${esc(x.status)}</span><br><small>${Number(x.credential_ready)?"Accès prêt":"Mot de passe à réinitialiser"}</small></td><td>${x.role==="agent"?`<div class="actions"><button class="btn small secondary reset-agent" data-id="${x.id}">Mot de passe</button><button class="btn small secondary toggle-agent" data-id="${x.id}" data-act="${x.status==="active"?"disable":"activate"}">${x.status==="active"?"Désactiver":"Activer"}</button><button class="btn small danger del-agent" data-id="${x.id}">Supprimer</button></div>`:"—"}</td></tr>`))}<h3 style="margin-top:18px">Demandes mot de passe</h3>${table(["Date","Agent","E-mail","Statut","Action"],S.data.resets.map(x=>`<tr><td>${df(x.created_at)}</td><td>${esc(x.full_name||"")}</td><td>${esc(x.email)}</td><td>${esc(x.status)}</td><td>${x.status==="pending"?`<button class="btn small secondary reset-request" data-id="${x.user_id}" data-rid="${x.id}">Réinitialiser</button>`:"—"}</td></tr>`))}</div>`;$("#addAgent").onclick=()=>modal(`<h2>Nouvel Agent</h2><form id="agentForm"><label>Nom<input name="full_name" required></label><label>E-mail<input name="email" type="email" required></label><label>Téléphone<input name="phone"></label><label>Mot de passe initial<input name="password" type="password" minlength="12" required></label><button class="btn primary full">Créer</button></form>`);document.querySelectorAll(".toggle-agent").forEach(b=>b.onclick=()=>postSaveUser(b.dataset.id,b.dataset.act));document.querySelectorAll(".del-agent").forEach(b=>b.onclick=()=>confirmBox("Supprimer cet Agent ?",()=>post("/api/save",{entity:"user",action:"delete",record:{id:b.dataset.id}})));document.querySelectorAll(".reset-agent").forEach(b=>b.onclick=()=>resetModal(b.dataset.id,null,false));document.querySelectorAll(".reset-request").forEach(b=>b.onclick=()=>resetModal(b.dataset.id,b.dataset.rid,false))}
document.addEventListener("submit",async e=>{if(e.target.id==="agentForm"){e.preventDefault();try{await post("/api/save",{entity:"user",action:"create",record:fd(e.target)});closeModal();await reload();users();toast("Agent créé")}catch(x){toast(x.message,true)}}});
async function postSaveUser(id,action){try{await post("/api/save",{entity:"user",action,record:{id}});await reload();users();toast("Compte mis à jour")}catch(x){toast(x.message,true)}}
function reports(){const mat=S.data.expenses.reduce((a,x)=>a+Number(x.total_price),0),lab=S.data.labor.reduce((a,x)=>a+Number(x.amount),0);const by=S.data.trades.map(t=>({name:t.name,m:S.data.expenses.filter(x=>x.trade_id===t.id).reduce((a,x)=>a+Number(x.total_price),0),l:S.data.labor.filter(x=>x.trade_id===t.id).reduce((a,x)=>a+Number(x.amount),0)}));$("#content").innerHTML=`<div class="kpis">${kpi("Matériaux",cash(mat))}${kpi("Main-d'œuvre",cash(lab))}${kpi("Total",cash(mat+lab))}</div><div class="panel"><div class="panelhead"><h2>Bilan par métier</h2><button onclick="window.print()" class="btn secondary">Imprimer / PDF</button></div>${table(["Métier","Matériaux","Main-d'œuvre","Total"],by.map(x=>`<tr><td>${esc(x.name)}</td><td class="money">${cash(x.m)}</td><td class="money">${cash(x.l)}</td><td class="money"><strong>${cash(x.m+x.l)}</strong></td></tr>`))}</div>`}
function paidPlanActive(){const c=S.session?.company;return !!c&&["standard","business"].includes(String(c.plan||"").toLowerCase())&&Date.parse(c.plan_expires_at)>Date.now()}
function pendingSubscriptionRequest(){return (S.data?.subscriptionRequests||[]).find(x=>x.status==="pending")||null}
function settings(){
  const c=S.session.company,u=S.session.user,admin=u.role==="admin",plan=String(c.plan||"free").toLowerCase(),paidActive=paidPlanActive(),pending=pendingSubscriptionRequest();
  const subscriptionAction=!admin
    ?`<div class="notice">La gestion de l’abonnement est réservée à l’Administrateur de l’entreprise.</div>`
    :paidActive
      ?`<div class="subscription-lock"><strong>✓ Abonnement ${esc(plan.toUpperCase())} actif</strong><span>Aucune nouvelle demande d’activation ni paiement n’est autorisé avant l’expiration de cette formule.</span></div>`
      :pending
        ?`<div class="subscription-pending"><strong>⏳ Demande en attente</strong><span>${esc(pending.requested_plan.toUpperCase())} · envoyée le ${df(pending.created_at)}. Le support doit la traiter avant toute nouvelle demande.</span></div>`
        :`<button id="activateSubscription" class="btn gold subscription-main-btn">Activer mon abonnement</button>`;
  $("#content").innerHTML=`<div class="settings-pro">
    <div class="panel settings-account-card"><div class="settings-card-icon">🏢</div><div><h2>Compte entreprise</h2><p><strong>${esc(c.name)}</strong><br>${esc(u.full_name)} · ${esc(u.email)}</p>${admin?`<button id="myAccountBtn" class="btn primary">Mon compte</button>`:`<span class="muted">Modification réservée à l’Administrateur.</span>`}</div></div>
    <div class="panel settings-subscription-card"><div class="panelhead"><div><h2>Abonnement</h2><p class="muted">Gérez votre formule GLOBAL BT.</p></div><span class="plan-pill ${esc(plan)}">${esc(plan.toUpperCase())}</span></div><div class="subscription-summary"><span>Expiration</span><strong>${df(c.plan_expires_at)}</strong></div><div class="notice">Free : 10 jours · 0 FCFA<br>Standard : 30 jours · 2 100 FCFA<br>Business : 365 jours · 20 600 FCFA</div>${subscriptionAction}</div>
    <div class="panel settings-security-card"><h2>Sécurité</h2><p class="muted">Modifiez le mot de passe de l’Administrateur connecté.</p><button id="changePwd" class="btn secondary">Changer le mot de passe</button></div>
  </div>`;
  if($("#myAccountBtn"))$("#myAccountBtn").onclick=openMyAccount;
  $("#changePwd").onclick=changePassword;
  if($("#activateSubscription"))$("#activateSubscription").onclick=openSubscriptionActivation;
}
function openMyAccount(){const c=S.session.company,u=S.session.user;if(u.role!=="admin")return toast("Modification réservée à l’Administrateur.",true);modal(`<div class="account-modal"><div class="modal-pro-head"><div><small>PARAMÈTRES</small><h2>Mon compte</h2><p>Informations de l’entreprise et de son Administrateur.</p></div><span class="modal-pro-icon">🏢</span></div><form id="accountForm" class="formgrid account-form"><h3 class="span2">Entreprise</h3><label>Nom de l’entreprise<input name="company_name" value="${esc(c.name||"")}" required maxlength="180"></label><label>Téléphone entreprise<input name="company_phone" value="${esc(c.phone||u.phone||"")}" maxlength="50"></label><label>E-mail entreprise<input name="company_email" type="email" value="${esc(c.email||u.email||"")}" maxlength="180"></label><label>Ville<input name="city" value="${esc(c.city||"")}" maxlength="120"></label><label class="span2">Adresse<input name="address" value="${esc(c.address||"")}" maxlength="240"></label><h3 class="span2 account-separator">Administrateur</h3><label>Nom et prénoms<input name="admin_name" value="${esc(u.full_name||"")}" required maxlength="160"></label><label>Téléphone Administrateur<input name="admin_phone" value="${esc(u.phone||"")}" maxlength="50"></label><label class="span2">E-mail de connexion<input name="admin_email" type="email" value="${esc(u.email||"")}" required maxlength="180"></label><div class="span2 modal-form-actions"><button type="button" id="cancelAccount" class="btn secondary">Annuler</button><button class="btn primary">Enregistrer les modifications</button></div></form></div>`);$("#cancelAccount").onclick=closeModal;$("#accountForm").onsubmit=async e=>{e.preventDefault();try{await post("/api/save",{entity:"account",action:"update",record:fd(e.target)});S.session=await api("/api/session");await reload();closeModal();enterHeader();settings();toast("Informations du compte mises à jour")}catch(x){toast(x.message,true)}finally{releaseForm(e.target)}}}
function enterHeader(){if(!S.session)return;$("#userBadge").textContent=`${S.session.user.full_name} · ${S.session.user.role}`;$("#planBadge").textContent=S.session.company?`${S.session.company.plan.toUpperCase()} · ${df(S.session.company.plan_expires_at)}`:"SUPER ADMIN";$("#pageSub").textContent=S.session.company?.name||"Administration générale"}
function openSubscriptionActivation(){
  if(S.session?.user?.role!=="admin")return toast("Activation réservée à l’Administrateur.",true);
  if(paidPlanActive())return toast("Votre abonnement payant est déjà actif.",true);
  const pending=pendingSubscriptionRequest();if(pending)return toast("Une demande d’activation est déjà en attente.",true);
  modal(`<div class="subscription-modal"><div class="modal-pro-head subscription-head"><div><small>ABONNEMENT GLOBAL BT</small><h2>Activer mon abonnement</h2><p>Effectuez votre paiement puis transmettez les références au support pour validation.</p></div><span class="modal-pro-icon">◆</span></div><div class="subscription-plans"><label class="subscription-plan-choice"><input type="radio" name="plan_preview" value="standard" checked><span><b>Standard</b><small>30 jours</small><strong>2 100 FCFA</strong></span></label><label class="subscription-plan-choice"><input type="radio" name="plan_preview" value="business"><span><b>Business</b><small>365 jours</small><strong>20 600 FCFA</strong></span></label></div><div class="payment-cta"><div><small>Montant à payer</small><strong id="subscriptionAmount">2 100 FCFA</strong></div><a id="subscriptionPayLink" class="btn gold" target="_blank" rel="noopener" href="${esc(S.session.standardPaymentUrl)}">Payer avec Wave</a></div><form id="subscriptionActivationForm"><input id="requestedPlan" name="requested_plan" type="hidden" value="standard"><label>Numéro de téléphone utilisé pour le paiement<input name="payment_phone" type="tel" required maxlength="50" placeholder="Ex. 07 00 00 00 00"></label><label>ID / référence de la transaction<input name="transaction_id" required maxlength="120" placeholder="Saisissez l’identifiant exact de la transaction"></label><div class="support-info">Ces informations seront envoyées directement dans la section <strong>Abonnements</strong> du Super Admin pour vérification et activation.</div><button class="btn primary full support-send">Envoyer au support</button></form></div>`);
  const syncPlan=()=>{const selected=$("#modalBody input[name='plan_preview']:checked")?.value||"standard",business=selected==="business";$("#requestedPlan").value=selected;$("#subscriptionAmount").textContent=business?"20 600 FCFA":"2 100 FCFA";$("#subscriptionPayLink").href=business?S.session.businessPaymentUrl:S.session.standardPaymentUrl};
  document.querySelectorAll("#modalBody input[name='plan_preview']").forEach(x=>x.onchange=syncPlan);syncPlan();
  $("#subscriptionActivationForm").onsubmit=async e=>{e.preventDefault();try{await post("/api/save",{entity:"subscription_request",action:"create",record:fd(e.target)});await reload();closeModal();settings();toast("Demande d’activation envoyée au support") }catch(x){toast(x.message,true)}finally{releaseForm(e.target)}};
}
function changePassword(){modal(`<h2>Changer mon mot de passe</h2><form id="pwdForm"><label>Mot de passe actuel<input name="current_password" type="password" required></label><label>Nouveau mot de passe<input name="new_password" type="password" minlength="12" required></label><button class="btn primary full">Modifier</button></form>`);$("#pwdForm").onsubmit=async e=>{e.preventDefault();try{await post("/api/change-password",fd(e.target));toast("Mot de passe modifié. Reconnexion requise.");setTimeout(()=>location.reload(),900)}catch(x){toast(x.message,true)}}}
function promo(){const pending=pendingSubscriptionRequest(),admin=S.session?.user?.role==="admin";const action=!admin?`<div class="notice">Contactez l’Administrateur de l’entreprise pour gérer l’abonnement.</div>`:pending?`<div class="subscription-pending"><strong>⏳ Activation en attente</strong><span>Votre demande ${esc(String(pending.requested_plan||"").toUpperCase())} a déjà été envoyée au support. Aucun nouveau paiement n’est proposé pendant son traitement.</span></div>`:`<button id="promoActivate" class="btn gold">Activer mon abonnement</button>`;modal(`<div class="promo"><h2>Choisissez votre abonnement GLOBAL BT</h2><p>Votre Plan Free donne un accès complet pendant <strong>10 jours</strong>.</p><div class="notice">Free : accès complet 10 jours · <strong>0 FCFA</strong><br>Standard : accès complet 30 jours · <strong>2 100 FCFA</strong><br>Business : accès complet 365 jours · <strong>20 600 FCFA</strong></div><div class="promoactions"><button id="promoOk" class="btn secondary">Continuer en Free</button>${action}</div></div>`);$("#promoOk").onclick=closeModal;if($("#promoActivate"))$("#promoActivate").onclick=()=>{closeModal();openSubscriptionActivation()};S.promo=Date.now()}
setInterval(()=>{if(S.session?.company?.plan==="free"&&Date.now()-S.promo>=15*60*1000)promo()},60000);

function renderSuper(){({super:superDash,companies:superCompanies,members:superMembers,subscriptions:superSubscriptions,resets:superResets,audit:superAudit}[S.view]||superDash)()}
function superDash(){const c=S.data.companies||[],u=S.data.users||[],r=S.data.resets||[],sr=S.data.subscriptionRequests||[];$("#content").innerHTML=`<div class="kpis">${kpi("Entreprises",c.length)}${kpi("Membres",u.length)}${kpi("Free",c.filter(x=>x.plan==="free").length)}${kpi("Standard",c.filter(x=>x.plan==="standard").length)}${kpi("Business",c.filter(x=>x.plan==="business").length)}${kpi("Activations en attente",sr.filter(x=>x.status==="pending").length)}${kpi("Demandes mot de passe",r.filter(x=>x.status==="pending").length)}</div><div class="panel"><h2>Super Administration GLOBAL BT</h2><p>Gestion centrale des entreprises, membres, abonnements et actions sensibles.</p></div>`}
function superCompanies(){$("#content").innerHTML=`<div class="panel"><div class="panelhead"><h2>Entreprises</h2><button id="newCompany" class="btn primary">+ Nouvelle entreprise</button></div>${table(["Entreprise","Plan","Expiration","Statut","Actions"],S.data.companies.map(x=>`<tr><td>${esc(x.name)}</td><td><select class="plan-choice" data-id="${x.id}"><option value="free" ${x.plan==="free"?"selected":""}>Free · 10 jours</option><option value="standard" ${x.plan==="standard"?"selected":""}>Standard · 30 jours</option><option value="business" ${x.plan==="business"?"selected":""}>Business · 365 jours</option></select></td><td>${df(x.plan_expires_at)}</td><td><span class="status ${x.status}">${esc(x.status)}</span></td><td><div class="actions"><button class="btn small secondary set-plan" data-id="${x.id}">Appliquer le plan</button><button class="btn small secondary toggle-company" data-id="${x.id}" data-act="${x.status==="active"?"disable":"activate"}">${x.status==="active"?"Désactiver":"Activer"}</button><button class="btn small danger del-company" data-id="${x.id}">Supprimer</button></div></td></tr>`))}</div>`;$("#newCompany").onclick=()=>modal(`<h2>Nouvelle entreprise</h2><form id="companyForm" class="formgrid"><label>Entreprise<input name="name" required></label><label>Ville<input name="city"></label><label>Plan<select name="plan"><option value="free">Free · 10 jours · 0 FCFA</option><option value="standard">Standard · 30 jours · 2 100 FCFA</option><option value="business">Business · 365 jours · 20 600 FCFA</option></select></label><label>Nom Administrateur<input name="admin_name" required></label><label>E-mail Administrateur<input name="admin_email" type="email" required></label><label>Téléphone<input name="admin_phone"></label><label class="span2">Mot de passe initial<input name="admin_password" type="password" minlength="12" required></label><button class="btn primary span2">Créer</button></form>`);document.querySelectorAll(".set-plan").forEach(b=>b.onclick=()=>{const sel=document.querySelector(`.plan-choice[data-id="${b.dataset.id}"]`);confirmBox("Changer le plan et redémarrer sa durée ?",()=>post("/api/save",{entity:"company",action:"set_plan",record:{id:b.dataset.id,plan:sel?.value||"free"}}))});document.querySelectorAll(".toggle-company").forEach(b=>b.onclick=()=>confirmBox("Modifier le statut de cette entreprise ?",()=>post("/api/save",{entity:"company",action:b.dataset.act,record:{id:b.dataset.id}})));document.querySelectorAll(".del-company").forEach(b=>b.onclick=()=>confirmBox("Supprimer logiquement cette entreprise ?",()=>post("/api/save",{entity:"company",action:"delete",record:{id:b.dataset.id}})))}
document.addEventListener("submit",async e=>{if(e.target.id==="companyForm"){e.preventDefault();try{await post("/api/save",{entity:"company",action:"create",record:fd(e.target)});closeModal();await reload();superCompanies();toast("Entreprise créée")}catch(x){toast(x.message,true)}}});
function superMembers(){$("#content").innerHTML=`<div class="panel"><h2>Tous les membres</h2>${table(["Nom","Entreprise","E-mail","Rôle","Statut","Actions"],S.data.users.map(x=>`<tr><td>${esc(x.full_name)}</td><td>${esc(x.company_name||"Administration")}</td><td>${esc(x.email)}</td><td>${esc(x.role)}</td><td><span class="status ${x.status}">${esc(x.status)}</span><br><small>${Number(x.credential_ready)?"Accès prêt":"Mot de passe à réinitialiser"}</small></td><td>${x.role!=="superadmin"?`<div class="actions"><button class="btn small secondary reset-member" data-id="${x.id}">Mot de passe</button><button class="btn small secondary toggle-member" data-id="${x.id}" data-act="${x.status==="active"?"disable":"activate"}">${x.status==="active"?"Désactiver":"Activer"}</button><button class="btn small danger del-member" data-id="${x.id}">Supprimer</button></div>`:"Compte protégé"}</td></tr>`))}</div>`;document.querySelectorAll(".reset-member").forEach(b=>b.onclick=()=>resetModal(b.dataset.id,null,true));document.querySelectorAll(".toggle-member").forEach(b=>b.onclick=()=>superUserAction(b.dataset.id,b.dataset.act));document.querySelectorAll(".del-member").forEach(b=>b.onclick=()=>confirmBox("Supprimer ce membre ?",()=>post("/api/save",{entity:"user",action:"delete",record:{id:b.dataset.id}})))}
async function superUserAction(id,action){try{await post("/api/save",{entity:"user",action,record:{id}});await reload();superMembers();toast("Compte mis à jour")}catch(x){toast(x.message,true)}}
function resetModal(id,rid,superA){modal(`<h2>Réinitialiser le mot de passe</h2><form id="resetDirect"><label>Nouveau mot de passe temporaire<input name="new_password" type="password" minlength="12" required></label><button class="btn primary full">Réinitialiser</button></form>`);$("#resetDirect").onsubmit=async e=>{e.preventDefault();try{await post("/api/save",{entity:"user",action:"reset_password",record:{id,new_password:e.target.new_password.value,reset_request_id:rid||null}});closeModal();await reload();render();toast("Mot de passe réinitialisé")}catch(x){toast(x.message,true)}}}
function superSubscriptions(){const requests=S.data.subscriptionRequests||[];const statusLabel=s=>s==="pending"?"En attente":s==="approved"?"Activée":"Rejetée";$("#content").innerHTML=`<div class="panel"><div class="panelhead"><div><h2>Demandes d’activation</h2><p class="muted">Paiements transmis par les Administrateurs pour vérification.</p></div><span class="pending-count">${requests.filter(x=>x.status==="pending").length} en attente</span></div>${table(["Date","Entreprise","Formule","Téléphone paiement","ID transaction","Statut","Actions"],requests.map(x=>`<tr><td>${df(x.created_at)}</td><td><strong>${esc(x.company_name)}</strong><br><small>${esc(x.requester_name||x.requester_email||"")}</small></td><td><span class="plan-pill ${esc(x.requested_plan)}">${esc(String(x.requested_plan||"").toUpperCase())}</span></td><td>${esc(x.payment_phone)}</td><td><code class="transaction-code">${esc(x.transaction_id)}</code></td><td><span class="status ${esc(x.status)}">${esc(statusLabel(x.status))}</span>${x.support_note?`<br><small>${esc(x.support_note)}</small>`:""}</td><td>${x.status==="pending"?`<div class="actions"><button class="btn small primary approve-subscription" data-id="${x.id}">Activer</button><button class="btn small danger reject-subscription" data-id="${x.id}">Rejeter</button></div>`:"—"}</td></tr>`))}</div><div class="panel"><h2>Abonnements des entreprises</h2><div class="notice">Free : 10 jours · 0 FCFA &nbsp;|&nbsp; Standard : 30 jours · 2 100 FCFA &nbsp;|&nbsp; Business : 365 jours · 20 600 FCFA.</div>${table(["Entreprise","Plan","Début","Expiration","État"],S.data.companies.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.plan)}</td><td>${df(x.plan_started_at)}</td><td>${df(x.plan_expires_at)}</td><td>${Date.parse(x.plan_expires_at)>Date.now()?"Valide":"Expiré"}</td></tr>`))}</div>`;document.querySelectorAll(".approve-subscription").forEach(b=>b.onclick=()=>subscriptionDecision(b.dataset.id,"approve"));document.querySelectorAll(".reject-subscription").forEach(b=>b.onclick=()=>subscriptionDecision(b.dataset.id,"reject"))}
function subscriptionDecision(id,action){const title=action==="approve"?"Activer l’abonnement":"Rejeter la demande",button=action==="approve"?"Confirmer l’activation":"Confirmer le rejet";modal(`<h2>${title}</h2><p class="muted">Vous pouvez ajouter une note de traitement.</p><form id="subscriptionDecisionForm"><label>Note support<textarea name="support_note" maxlength="500"></textarea></label><button class="btn ${action==="approve"?"primary":"danger"} full">${button}</button></form>`);$("#subscriptionDecisionForm").onsubmit=async e=>{e.preventDefault();try{await post("/api/save",{entity:"subscription_request",action,record:{id,support_note:e.target.support_note.value}});await reload();closeModal();superSubscriptions();toast(action==="approve"?"Abonnement activé":"Demande rejetée")}catch(x){toast(x.message,true)}finally{releaseForm(e.target)}}}
function superResets(){$("#content").innerHTML=`<div class="panel"><h2>Demandes Administrateurs</h2>${table(["Date","Membre","Entreprise","E-mail","Statut","Action"],S.data.resets.map(x=>`<tr><td>${df(x.created_at)}</td><td>${esc(x.full_name||"")}</td><td>${esc(x.company_name||"")}</td><td>${esc(x.email)}</td><td>${esc(x.status)}</td><td>${x.status==="pending"?`<div class="actions"><button class="btn small secondary reset-request-super" data-id="${x.user_id}" data-rid="${x.id}">Réinitialiser</button><button class="btn small danger reject-reset" data-id="${x.id}">Rejeter</button></div>`:"—"}</td></tr>`))}</div>`;document.querySelectorAll(".reset-request-super").forEach(b=>b.onclick=()=>resetModal(b.dataset.id,b.dataset.rid,true));document.querySelectorAll(".reject-reset").forEach(b=>b.onclick=()=>confirmBox("Rejeter la demande ?",()=>post("/api/save",{entity:"reset",action:"reject",record:{id:b.dataset.id}})))}
function superAudit(){$("#content").innerHTML=`<div class="panel"><div class="panelhead"><h2>Journal des actions sensibles</h2><button onclick="window.print()" class="btn secondary">Imprimer</button></div>${table(["Date","Acteur","Entreprise","Action","Cible","IP"],S.data.logs.map(x=>`<tr><td>${df(x.created_at)}</td><td>${esc(x.actor_name||"Système")}</td><td>${esc(x.company_name||"—")}</td><td><strong>${esc(x.action)}</strong></td><td>${esc(x.target_type||"")} ${esc(x.target_id||"")}</td><td>${esc(x.ip||"")}</td></tr>`))}</div>`}



/* ===== V27 PROJETS CENTRALISÉS ===== */
function nav(){
  const superA=S.session.user.role==="superadmin",admin=S.session.user.role==="admin";
  const n=superA?[["super","Tableau de bord"],["companies","Entreprises"],["members","Membres"],["subscriptions","Abonnements"],["resets","Mots de passe"],["audit","Journal"]]:[["dashboard","Tableau de bord"],["projects","Projets"],["trades","Métiers"],["suppliers","Fournisseurs"],["reports","Rapports"],...(admin?[["users","Utilisateurs"]]:[]),["settings","Paramètres"]];
  $("#mainNav").innerHTML=n.map(([i,l])=>`<button data-nav="${i}">${l}</button>`).join("")+`<button id="logout" class="logout">Déconnexion</button>`;
  $("#mainNav").classList.remove("hidden");document.querySelectorAll("[data-nav]").forEach(b=>b.onclick=()=>go(b.dataset.nav));$("#logout").onclick=async()=>{try{await post("/api/logout",{})}catch{}location.reload()};
}
function render(){if(S.session.user.role==="superadmin")return renderSuper();({dashboard,projects,trades,suppliers,users,reports,settings}[S.view]||dashboard)()}
function adminGate(title,callback){modal(`<h2>${esc(title)}</h2><p class="muted">Mot de passe de l'Administrateur connecté requis.</p><form id="v27AdminGate"><label>Mot de passe<input name="admin_password" type="password" required></label><button class="btn primary full">Confirmer</button></form>`);$("#v27AdminGate").onsubmit=async e=>{e.preventDefault();try{await callback(e.target.admin_password.value)}catch(x){toast(x.message,true)}finally{releaseForm(e.target)}}}
function v27ProjectTrades(id){const p=S.data.projects.find(x=>x.id===id);if(!p)return;const ts=S.data.trades.filter(x=>x.project_id===id);modal(`<h2>Métiers · ${esc(p.name)}</h2><button id="v27AddTrade" class="btn primary">+ Ajouter</button>${table(["Métier","Phase","Main-d'œuvre","Action"],ts.map(t=>{const mt=S.data.labor.filter(l=>l.project_id===id&&l.trade_id===t.id).reduce((a,x)=>a+Number(x.amount||0),0);return `<tr><td>${esc(t.name)}</td><td>${esc(phaseShort(t.phase||phaseForTrade(t.name)))}</td><td class="money">${cash(mt)}</td><td><button class="btn small secondary v27Labor" data-trade="${t.id}">Main-d'œuvre</button></td></tr>`}))}`);$("#v27AddTrade").onclick=()=>modal(`<h2>Ajouter un métier</h2><form id="v27TradeForm" data-project="${id}"><label>Phase<select name="phase">${TRADE_PHASES.map(ph=>`<option value="${ph.key}">${esc(ph.label)}</option>`).join("")}</select></label><label>Métier<input name="name" required></label><label>Description<textarea name="description"></textarea></label><button class="btn primary full">Ajouter</button></form>`);document.querySelectorAll('.v27Labor').forEach(b=>b.onclick=()=>v27ProjectLabor(id,b.dataset.trade))}
function v27ProjectLabor(pid,tid){const p=S.data.projects.find(x=>x.id===pid),t=S.data.trades.find(x=>x.id===tid);const rs=S.data.labor.filter(x=>x.project_id===pid&&x.trade_id===tid);modal(`<h2>Main-d'œuvre · ${esc(t?.name||'')}</h2><button id="v27AddLabor" class="btn primary">+ Ajouter</button>${table(["Date","Prestataire","Travaux","Montant"],rs.map(x=>`<tr><td>${df(x.expense_date)}</td><td>${esc(x.worker_name||'')}</td><td>${esc(x.description||'')}</td><td class="money">${cash(x.amount)}</td></tr>`))}`);$("#v27AddLabor").onclick=()=>modal(`<h2>Nouvelle main-d'œuvre</h2><form id="v27LaborForm" data-project="${pid}" data-trade="${tid}"><label>Date<input name="expense_date" type="date" value="${new Date().toISOString().slice(0,10)}"></label><label>Prestataire<input name="worker_name"></label><label>Travaux<input name="description" required></label><label>Montant<input name="amount" type="number" min="0"></label><label>Mode de paiement<input name="payment_method"></label><label>Référence<input name="reference"></label><button class="btn primary full">Enregistrer</button></form>`)}
function v27ProjectExpenses(id){const p=S.data.projects.find(x=>x.id===id),rs=S.data.expenses.filter(x=>x.project_id===id),ts=S.data.trades.filter(x=>x.project_id===id);modal(`<h2>Matériaux · ${esc(p.name)}</h2><button id="v27AddExpense" class="btn primary">+ Ajouter</button>${table(["Date","Métier","Désignation","Fournisseur","Total"],rs.map(x=>`<tr><td>${df(x.expense_date)}</td><td>${esc(x.trade_name||'—')}</td><td>${esc(x.description)}</td><td>${esc(x.supplier_name||'—')}</td><td class="money">${cash(x.total_price)}</td></tr>`))}`);$("#v27AddExpense").onclick=()=>modal(`<h2>Nouveaux matériaux</h2><form id="v27ExpenseForm" data-project="${id}"><label>Métier<select name="trade_id">${opts(ts)}</select></label><label>Fournisseur<select name="supplier_id">${opts(S.data.suppliers)}</select></label><label>Date<input name="expense_date" type="date" value="${new Date().toISOString().slice(0,10)}"></label><label>Désignation<input name="description" required></label><label>Quantité<input name="quantity" type="number" step=".01" value="1"></label><label>Unité<input name="unit"></label><label>Prix unitaire<input name="unit_price" type="number" min="0"></label><label>Référence<input name="reference"></label><button class="btn primary full">Enregistrer</button></form>`)}
function v27ProjectSuppliers(id){const p=S.data.projects.find(x=>x.id===id),links=(S.data.projectSuppliers||[]).filter(x=>x.project_id===id);modal(`<h2>Fournisseurs · ${esc(p.name)}</h2><button id="v27AddSupplier" class="btn primary">+ Affecter</button>${table(["Fournisseur","Contact","Spécialité","Matériaux"],links.map(x=>{const amt=S.data.expenses.filter(e=>e.project_id===id&&e.supplier_id===x.supplier_id).reduce((a,e)=>a+Number(e.total_price||0),0);return `<tr><td>${esc(x.supplier_name)}</td><td>${esc(x.phone||'')}</td><td>${esc(x.specialty||'')}</td><td class="money">${cash(amt)}</td></tr>`}))}`);$("#v27AddSupplier").onclick=()=>modal(`<h2>Affecter un fournisseur</h2><form id="v27SupplierForm" data-project="${id}"><label>Fournisseur<select name="supplier_id" required>${opts(S.data.suppliers)}</select></label><label>Notes<textarea name="notes"></textarea></label><button class="btn primary full">Affecter</button></form>`)}


function v29TradeIcon(name){
  const n=String(name||"").toLowerCase();
  if(n.includes("maçon"))return "🧱";
  if(n.includes("étude")||n.includes("faisabilité"))return "📋";
  if(n.includes("élect"))return "⚡";
  if(n.includes("plomb"))return "🔧";
  if(n.includes("peint"))return "🖌️";
  if(n.includes("carrel"))return "◫";
  if(n.includes("terrass"))return "🚜";
  return "🛠";
}

function v36ProjectPage(projectId,initialView="trades"){
  const p=S.data.projects.find(x=>x.id===projectId);if(!p)return projects();
  S.currentProjectId=projectId;S.currentProjectView=initialView;
  const trades=(S.data.trades||[]).filter(x=>x.project_id===projectId);
  const expenses=(S.data.expenses||[]).filter(x=>x.project_id===projectId);
  const suppliers=(S.data.projectSuppliers||[]).filter(x=>x.project_id===projectId);
  const laborRows=(S.data.labor||[]).filter(x=>x.project_id===projectId);
  const expenseTotal=expenses.reduce((a,x)=>a+Number(x.total_price||0),0),laborTotal=laborRows.reduce((a,x)=>a+Number(x.amount||0),0);
  const updated=df(p.updated_at||p.created_at||"");
  const pages={trades:0,expenses:0,suppliers:0},pageSize=6;
  let expenseQuery="";

  $("#content").innerHTML=`
    <section class="project-page-pro">
      <div class="project-page-toolbar">
        <button id="projectBack" class="btn secondary">← Retour aux projets</button>
        <div class="project-page-titlebar"><span class="eyebrow">ESPACE PROJET</span><span class="project-page-update">Mis à jour le ${esc(updated)}</span></div>
      </div>
      <div class="project-page-hero">
        <div class="project-page-identity"><div class="project-page-icon">▥</div><div><h1>${esc(p.name)}</h1><p>⌖ ${esc(p.location||"Localité non renseignée")}</p><span class="status">${esc({preparation:"Préparation",in_progress:"En cours",suspended:"Suspendu",completed:"Terminé",closed:"Clôturé"}[p.status]||p.status)}</span></div></div>
        <div class="project-page-kpis"><div class="project-page-kpi"><small>Budget</small><strong>${cash(p.budget)}</strong></div><div class="project-page-kpi gold"><small>Matériaux</small><strong>${cash(expenseTotal)}</strong></div><div class="project-page-kpi blue"><small>Main-d'œuvre</small><strong>${cash(laborTotal)}</strong></div></div>
      </div>
      <div class="project-page-tabs"><button class="project-page-tab ${initialView==="trades"?"active":""}" data-view="trades">Métiers <b>${trades.length}</b></button><button class="project-page-tab ${initialView==="expenses"?"active":""}" data-view="expenses">Matériaux <b>${expenses.length}</b></button><button class="project-page-tab ${initialView==="suppliers"?"active":""}" data-view="suppliers">Fournisseurs <b>${suppliers.length}</b></button></div>
      <div id="projectPageContent" class="project-page-content"></div>
    </section>`;
  $("#projectBack").onclick=()=>{S.currentProjectId=null;projects()};
  const content=$("#projectPageContent"),tabs=[...document.querySelectorAll(".project-page-tab")];
  const pager=(view,total)=>{const count=Math.max(1,Math.ceil(total/pageSize)),page=Math.min(pages[view],count-1);pages[view]=page;if(count<=1)return "";return `<div class="project-page-pager"><button class="btn small secondary project-page-prev" ${page===0?"disabled":""}>←</button><span>Page ${page+1} / ${count}</span><button class="btn small secondary project-page-next" ${page===count-1?"disabled":""}>→</button></div>`};
  const slice=(view,arr)=>arr.slice(pages[view]*pageSize,pages[view]*pageSize+pageSize);
  const bindPager=(view,total)=>{const max=Math.max(0,Math.ceil(total/pageSize)-1);content.querySelector(".project-page-prev")?.addEventListener("click",()=>{pages[view]=Math.max(0,pages[view]-1);show(view)});content.querySelector(".project-page-next")?.addEventListener("click",()=>{pages[view]=Math.min(max,pages[view]+1);show(view)})};
  const materialRows=()=>{const q=expenseQuery.trim().toLowerCase();if(!q)return expenses;return expenses.filter(x=>[x.trade_phase,x.trade_name,x.expense_date,df(x.expense_date),x.supplier_name].some(v=>String(v||"").toLowerCase().includes(q)))};

  const show=view=>{
    S.currentProjectView=view;tabs.forEach(b=>b.classList.toggle("active",b.dataset.view===view));
    if(view==="trades"){
      const rows=slice(view,trades);
      content.innerHTML=`<div class="project-page-section-head"><div><h2>Métiers du projet</h2><p>Seuls les métiers déjà enregistrés dans la liste générale peuvent être affectés à ce projet.</p></div><div class="toolbar"><button id="v37PrintProjectTrades" class="btn secondary">Imprimer / PDF</button><button id="projectAddTrade" class="btn primary">+ Ajouter un métier</button></div></div>
      <div class="project-page-card v38-trades-table">${table(["Métier / Corps principal","Activité","Description activité","Main-d'œuvre","Actions"],rows.map(t=>{const mt=laborRows.filter(l=>l.trade_id===t.id).reduce((a,x)=>a+Number(x.amount||0),0);return `<tr><td><strong>${esc(t.phase||"—")}</strong></td><td>${esc(t.name||"—")}</td><td>${esc(t.description||"—")}</td><td class="money">${cash(mt)}</td><td class="v38-actions-cell"><div class="actions v38-actions"><button class="btn small secondary page-edit-trade" data-id="${t.id}">Modifier</button>${S.session.user.role==="admin"?`<button class="btn small danger page-delete-trade" data-id="${t.id}">Supprimer</button>`:""}</div></td></tr>`}))}</div>${pager(view,trades.length)}`;
      $("#projectAddTrade").onclick=()=>{if(!(S.data.tradeCatalog||[]).length)return toast("Enregistrez d'abord ce métier dans le menu principal Métiers.",true);modal(`<h2>Ajouter un métier · ${esc(p.name)}</h2>${renderProjectTradeCatalogForm(projectId)}`)};
      document.querySelectorAll(".page-edit-trade").forEach(b=>b.onclick=()=>{const t=trades.find(x=>x.id===b.dataset.id);if(!t)return;modal(`<h2>Modifier le métier du projet</h2>${renderProjectTradeCatalogForm(projectId,t)}`)});
      document.querySelectorAll(".page-delete-trade").forEach(b=>b.onclick=()=>confirmBox("Supprimer ce métier de ce projet ?",async()=>{await post("/api/save",{entity:"trade",action:"delete",record:{id:b.dataset.id,project_id:projectId}});await reload();v36ProjectPage(projectId,"trades");toast("Métier retiré du projet")}));bindPager(view,trades.length);
    }
    if(view==="expenses"){
      const filtered=materialRows();const rows=slice(view,filtered);
      content.innerHTML=`<div class="project-page-section-head"><div><h2>Matériaux du projet</h2><p>Suivez les matériaux par métier, date et fournisseur.</p></div><div class="toolbar"><button id="v37PrintProjectMaterials" class="btn secondary">Imprimer / PDF</button><button id="projectAddExpense" class="btn primary">+ Ajouter des matériaux</button></div></div>
      <div class="v38-material-search"><span>⌕</span><input id="v38MaterialSearch" type="search" placeholder="Rechercher par métier, date ou fournisseur..." value="${esc(expenseQuery)}"><small>${filtered.length} résultat(s)</small></div>
      <div class="project-page-card v38-materials-table">${table(["Date","Métier / Corps principal","Activité","Désignation","Fournisseur","Quantité","Prix unitaire","Prix total","Actions"],rows.map(x=>`<tr><td>${df(x.expense_date)}</td><td>${esc(x.trade_phase||"—")}</td><td>${esc(x.trade_name||"—")}</td><td><strong>${esc(x.description||"")}</strong></td><td>${esc(x.supplier_name||"—")}</td><td class="money">${Number(x.quantity||0).toLocaleString("fr-FR")}${x.unit?` ${esc(x.unit)}`:""}</td><td class="money">${cash(x.unit_price)}</td><td class="money">${cash(x.total_price)}</td><td class="v38-actions-cell"><div class="actions v38-actions"><button class="btn small secondary page-edit-expense" data-id="${x.id}">Modifier</button>${S.session.user.role==="admin"?`<button class="btn small danger page-delete-expense" data-id="${x.id}">Supprimer</button>`:""}</div></td></tr>`))}</div>${pager(view,filtered.length)}`;
      const search=$("#v38MaterialSearch");search?.addEventListener("input",()=>{expenseQuery=search.value;pages.expenses=0;show("expenses");const next=$("#v38MaterialSearch");next?.focus();if(next)next.setSelectionRange(next.value.length,next.value.length)});
      $("#projectAddExpense").onclick=()=>modal(`<h2>Nouveaux matériaux · ${esc(p.name)}</h2><form id="v36ExpenseForm" data-project="${projectId}"><label>Métier<select name="trade_id" required>${opts(trades)}</select></label><label>Fournisseur<select name="supplier_id">${opts(S.data.suppliers||[])}</select></label><label>Date<input name="expense_date" type="date" value="${new Date().toISOString().slice(0,10)}"></label><label>Désignation<input name="description" required></label><label>Quantité<input name="quantity" type="number" step=".01" value="1"></label><label>Unité<input name="unit"></label><label>Prix unitaire<input name="unit_price" type="number" min="0"></label><label>Référence<input name="reference"></label><button class="btn primary full">Enregistrer</button></form>`);
      document.querySelectorAll(".page-edit-expense").forEach(b=>b.onclick=()=>{const x=expenses.find(e=>e.id===b.dataset.id);if(!x)return;modal(`<h2>Modifier les matériaux</h2><form id="v38ExpenseEditForm" data-id="${x.id}" data-project="${projectId}"><label>Métier<select name="trade_id" required>${opts(trades,x.trade_id)}</select></label><label>Fournisseur<select name="supplier_id">${opts(S.data.suppliers||[],x.supplier_id)}</select></label><label>Date<input name="expense_date" type="date" value="${esc(x.expense_date||"")}"></label><label>Désignation<input name="description" value="${esc(x.description||"")}" required></label><label>Quantité<input name="quantity" type="number" step=".01" value="${Number(x.quantity||0)}"></label><label>Unité<input name="unit" value="${esc(x.unit||"")}"></label><label>Prix unitaire<input name="unit_price" type="number" min="0" value="${Number(x.unit_price||0)}"></label><label>Référence<input name="reference" value="${esc(x.reference||"")}"></label><button class="btn primary full">Enregistrer</button></form>`)});
      document.querySelectorAll(".page-delete-expense").forEach(b=>b.onclick=()=>confirmBox("Supprimer définitivement ces matériaux ?",async()=>{await post("/api/save",{entity:"expense",action:"delete",record:{id:b.dataset.id,project_id:projectId}});await reload();v36ProjectPage(projectId,"expenses");toast("Matériaux supprimés")}));bindPager(view,filtered.length);
    }
    if(view==="suppliers"){
      const rows=slice(view,suppliers);content.innerHTML=`<div class="project-page-section-head"><div><h2>Fournisseurs du projet</h2><p>Consultez et gérez les fournisseurs affectés à ce projet.</p></div><div class="toolbar"><button id="v37PrintProjectSuppliers" class="btn secondary">Imprimer / PDF</button><button id="projectAddSupplier" class="btn primary">+ Affecter un fournisseur</button></div></div><div class="project-page-card">${table(["Fournisseur","Contact","Spécialité","Matériaux","Actions"],rows.map(x=>{const spent=expenses.filter(e=>e.supplier_id===x.supplier_id).reduce((a,e)=>a+Number(e.total_price||0),0);return `<tr><td><strong>${esc(x.supplier_name)}</strong></td><td>${esc(x.phone||"—")}</td><td>${esc(x.specialty||"—")}</td><td class="money">${cash(spent)}</td><td class="v38-actions-cell">${S.session.user.role==="admin"?`<button class="btn small danger page-delete-project-supplier" data-id="${x.id}">Retirer</button>`:"—"}</td></tr>`}))}</div>${pager(view,suppliers.length)}`;
      $("#projectAddSupplier").onclick=()=>modal(`<h2>Affecter un fournisseur · ${esc(p.name)}</h2><form id="v36SupplierForm" data-project="${projectId}"><label>Fournisseur<select name="supplier_id" required>${opts(S.data.suppliers||[])}</select></label><label>Notes<textarea name="notes"></textarea></label><button class="btn primary full">Affecter</button></form>`);
      document.querySelectorAll(".page-delete-project-supplier").forEach(b=>b.onclick=()=>confirmBox("Retirer ce fournisseur du projet ?",async()=>{await post("/api/save",{entity:"project_supplier",action:"delete",record:{id:b.dataset.id,project_id:projectId}});await reload();v36ProjectPage(projectId,"suppliers");toast("Fournisseur retiré du projet")}));bindPager(view,suppliers.length);
    }
  };
  tabs.forEach(b=>b.onclick=()=>show(b.dataset.view));show(initialView);
}
function projects(){
  const rows=S.data.projects.map(x=>`<tr class="clickable-row v28-project-row" data-id="${x.id}"><td><strong>${esc(x.name)}</strong><br><small>${esc(x.location||'')}</small></td><td><span class="status">${esc({preparation:'Préparation',in_progress:'En cours',suspended:'Suspendu',completed:'Terminé',closed:'Clôturé'}[x.status]||x.status)}</span></td><td class="money">${cash(x.budget)}</td><td>${Number(x.locked)?'<span class="status disabled">Verrouillé</span>':'<span class="status">Déverrouillé</span>'}</td><td><div class="project-actions v28-actions"><button class="btn small secondary v28Edit" data-id="${x.id}">Modifier</button>${S.session.user.role==='admin'?`<button class="btn small secondary v28Lock" data-id="${x.id}" data-act="${Number(x.locked)?'unlock':'lock'}">${Number(x.locked)?'Déverrouiller':'Verrouiller'}</button><button class="btn small secondary v28Status" data-id="${x.id}">Statut</button><button class="btn small danger v28Delete" data-id="${x.id}">Supprimer</button>`:''}</div></td></tr>`);
  $('#content').innerHTML=`<div class="panel"><div class="panelhead"><div><h2>Projets</h2><p class="muted">Cliquez sur une ligne pour ouvrir l'espace du projet.</p></div>${S.session.user.role==='admin'?'<button id="v28NewProject" class="btn primary">+ Nouveau projet</button>':''}</div>${table(['Projet','Statut','Budget','Sécurité','Actions'],rows)}</div>`;
  $('#v28NewProject')?.addEventListener('click',()=>modal(`<h2>Nouveau projet</h2><form id="v28ProjectCreate" class="formgrid"><label>Nom<input name="name" required></label><label>Type<input name="project_type" value="Bâtiment"></label><label>Localité<input name="location"></label><label>Budget<input name="budget" type="number" min="0"></label><label>Maître d'ouvrage<input name="owner_name"></label><label>Responsable<input name="manager_name"></label><label>Date début<input name="start_date" type="date"></label><label>Date fin<input name="end_date" type="date"></label><label class="span2">Description<textarea name="description"></textarea></label><button class="btn primary span2">Créer</button></form>`));
  document.querySelectorAll('.v28-project-row').forEach(r=>r.onclick=e=>{if(e.target.closest('button'))return;v36ProjectPage(r.dataset.id)});
  document.querySelectorAll('.v28Edit').forEach(b=>b.onclick=e=>{e.stopPropagation();const x=S.data.projects.find(p=>p.id===b.dataset.id);if(S.session.user.role!=='admin')return toast('Modification réservée à l’Administrateur',true);modal(`<h2>Modifier le projet</h2><form id="v28ProjectEdit" data-id="${x.id}" class="formgrid"><label>Nom<input name="name" value="${esc(x.name)}" required></label><label>Type<input name="project_type" value="${esc(x.project_type||'')}"></label><label>Localité<input name="location" value="${esc(x.location||'')}"></label><label>Budget<input name="budget" type="number" value="${Number(x.budget||0)}"></label><label>Maître d'ouvrage<input name="owner_name" value="${esc(x.owner_name||'')}"></label><label>Responsable<input name="manager_name" value="${esc(x.manager_name||'')}"></label><label>Date début<input name="start_date" type="date" value="${esc(x.start_date||'')}"></label><label>Date fin<input name="end_date" type="date" value="${esc(x.end_date||'')}"></label><label class="span2">Description<textarea name="description">${esc(x.description||'')}</textarea></label><label class="span2">Mot de passe Administrateur<input name="admin_password" type="password" required></label><button class="btn primary span2">Enregistrer</button></form>`)});
  document.querySelectorAll('.v28Lock').forEach(b=>b.onclick=e=>{e.stopPropagation();adminGate(b.dataset.act==='lock'?'Verrouiller le projet':'Déverrouiller le projet',async pw=>{await post('/api/save',{entity:'project',action:b.dataset.act,record:{id:b.dataset.id,admin_password:pw}});closeModal();await reload();projects();toast('Projet mis à jour')})});
  document.querySelectorAll('.v28Status').forEach(b=>b.onclick=e=>{e.stopPropagation();const x=S.data.projects.find(p=>p.id===b.dataset.id);modal(`<h2>Statut du projet</h2><form id="v28StatusForm" data-id="${x.id}"><label>Statut<select name="status"><option value="preparation" ${x.status==='preparation'?'selected':''}>Préparation</option><option value="in_progress" ${x.status==='in_progress'?'selected':''}>En cours</option><option value="suspended" ${x.status==='suspended'?'selected':''}>Suspendu</option><option value="completed" ${x.status==='completed'?'selected':''}>Terminé</option><option value="closed" ${x.status==='closed'?'selected':''}>Clôturé</option></select></label><button class="btn primary full">Mettre à jour</button></form>`)});
  document.querySelectorAll('.v28Delete').forEach(b=>b.onclick=e=>{e.stopPropagation();adminGate('Supprimer le projet',async pw=>{await post('/api/save',{entity:'project',action:'delete',record:{id:b.dataset.id,admin_password:pw}});closeModal();await reload();projects();toast('Projet supprimé')})});
}

function reports(){const rows=S.data.projects.map(p=>{const mat=S.data.expenses.filter(x=>x.project_id===p.id).reduce((a,x)=>a+Number(x.total_price||0),0),lab=S.data.labor.filter(x=>x.project_id===p.id).reduce((a,x)=>a+Number(x.amount||0),0),total=mat+lab,b=Number(p.budget||0);return {p,mat,lab,total,b,remain:b-total,trades:S.data.trades.filter(x=>x.project_id===p.id).length,sup:(S.data.projectSuppliers||[]).filter(x=>x.project_id===p.id).length}});const t=rows.reduce((a,x)=>({b:a.b+x.b,mat:a.mat+x.mat,lab:a.lab+x.lab,total:a.total+x.total,remain:a.remain+x.remain}),{b:0,mat:0,lab:0,total:0,remain:0});$('#content').innerHTML=`<div class="kpis">${kpi('Budget total',cash(t.b))}${kpi('Matériaux',cash(t.mat))}${kpi("Main-d'œuvre",cash(t.lab))}${kpi('Coût total',cash(t.total))}${kpi('Reste',cash(t.remain))}</div><div class="panel"><div class="panelhead"><h2>Bilan général de tous les projets</h2><button onclick="window.print()" class="btn secondary">PDF A4</button></div>${table(['Projet','Statut','Budget','Matériaux',"Main-d'œuvre",'Total','Reste','Métiers','Fournisseurs'],rows.map(x=>`<tr><td>${esc(x.p.name)}</td><td>${esc(x.p.status)}</td><td class="money">${cash(x.b)}</td><td class="money">${cash(x.mat)}</td><td class="money">${cash(x.lab)}</td><td class="money">${cash(x.total)}</td><td class="money">${cash(x.remain)}</td><td>${x.trades}</td><td>${x.sup}</td></tr>`))}</div>`}
document.addEventListener('submit',async e=>{const f=e.target;try{if(f.id==='v27ProjectCreate'){e.preventDefault();await post('/api/save',{entity:'project',action:'create',record:fd(f)});closeModal();await reload();projects();toast('Projet créé')}else if(f.id==='v27ProjectEdit'){e.preventDefault();await post('/api/save',{entity:'project',action:'update',record:{id:f.dataset.id,...fd(f)}});closeModal();await reload();projects();toast('Projet modifié')}else if(f.id==='v27TradeForm'){e.preventDefault();await post('/api/save',{entity:'trade',action:'create',record:{project_id:f.dataset.project,...fd(f)}});await reload();v27ProjectTrades(f.dataset.project);toast('Métier ajouté')}else if(f.id==='v27LaborForm'){e.preventDefault();await post('/api/save',{entity:'labor',action:'create',record:{project_id:f.dataset.project,trade_id:f.dataset.trade,...fd(f)}});await reload();v27ProjectLabor(f.dataset.project,f.dataset.trade);toast("Main-d'œuvre enregistrée")}else if(f.id==='v27ExpenseForm'){e.preventDefault();await post('/api/save',{entity:'expense',action:'create',record:{project_id:f.dataset.project,...fd(f)}});await reload();v27ProjectExpenses(f.dataset.project);toast('Matériaux enregistrés')}else if(f.id==='v27SupplierForm'){e.preventDefault();await post('/api/save',{entity:'project_supplier',action:'create',record:{project_id:f.dataset.project,...fd(f)}});await reload();v27ProjectSuppliers(f.dataset.project);toast('Fournisseur affecté')}else if(f.id==='v27StatusForm'){e.preventDefault();await post('/api/save',{entity:'project',action:'set_status',record:{id:f.dataset.id,...fd(f)}});closeModal();await reload();projects();toast('Statut mis à jour')}}catch(x){toast(x.message,true)}finally{if(f.id?.startsWith('v27'))releaseForm(f)}},true);


document.addEventListener('submit',async e=>{const f=e.target;if(!f.id?.startsWith('v28'))return;e.preventDefault();try{if(f.id==='v28ProjectCreate'){await post('/api/save',{entity:'project',action:'create',record:fd(f)});closeModal();await reload();projects();toast('Projet créé')}else if(f.id==='v28ProjectEdit'){await post('/api/save',{entity:'project',action:'update',record:{id:f.dataset.id,...fd(f)}});closeModal();await reload();projects();toast('Projet modifié')}else if(f.id==='v28StatusForm'){await post('/api/save',{entity:'project',action:'set_status',record:{id:f.dataset.id,...fd(f)}});closeModal();await reload();projects();toast('Statut mis à jour')}else if(f.id==='v28TradeForm'){await post('/api/save',{entity:'trade',action:'create',record:{project_id:f.dataset.project,...fd(f)}});await reload();closeModal();v36ProjectPage(f.dataset.project);toast('Métier ajouté')}else if(f.id==='v28ExpenseForm'){await post('/api/save',{entity:'expense',action:'create',record:{project_id:f.dataset.project,...fd(f)}});await reload();closeModal();v36ProjectPage(f.dataset.project);toast('Matériaux enregistrés')}else if(f.id==='v28SupplierForm'){await post('/api/save',{entity:'project_supplier',action:'create',record:{project_id:f.dataset.project,...fd(f)}});await reload();closeModal();v36ProjectPage(f.dataset.project);toast('Fournisseur affecté')}}catch(x){toast(x.message,true)}finally{releaseForm(f)}},true);


document.addEventListener("submit",async e=>{
  const f=e.target;
  if(!f.id?.startsWith("v29"))return;
  e.preventDefault();
  try{
    if(f.id==="v29TradeForm"){
      await post("/api/save",{entity:"trade",action:"create",record:{project_id:f.dataset.project,...fd(f)}});
      await reload();closeModal();v36ProjectPage(f.dataset.project);toast("Métier ajouté");
    }else if(f.id==="v29TradeEditForm"){
      await post("/api/save",{entity:"trade",action:"update",record:{id:f.dataset.id,project_id:f.dataset.project,...fd(f)}});
      await reload();closeModal();v36ProjectPage(f.dataset.project);toast("Métier modifié");
    }else if(f.id==="v29ExpenseForm"){
      await post("/api/save",{entity:"expense",action:"create",record:{project_id:f.dataset.project,...fd(f)}});
      await reload();closeModal();v36ProjectPage(f.dataset.project);toast("Matériaux enregistrés");
    }else if(f.id==="v29SupplierForm"){
      await post("/api/save",{entity:"project_supplier",action:"create",record:{project_id:f.dataset.project,...fd(f)}});
      await reload();closeModal();v36ProjectPage(f.dataset.project);toast("Fournisseur affecté");
    }
  }catch(x){toast(x.message,true)}
  finally{releaseForm(f)}
},true);


document.addEventListener("submit",async e=>{
  const f=e.target;if(!f.id?.startsWith("v36"))return;e.preventDefault();
  try{
    if(f.id==="v36TradeForm"){await post("/api/save",{entity:"trade",action:"create",record:{project_id:f.dataset.project,...fd(f)}});closeModal();await reload();v36ProjectPage(f.dataset.project,"trades");toast("Métier ajouté")}
    else if(f.id==="v36TradeEditForm"){await post("/api/save",{entity:"trade",action:"update",record:{id:f.dataset.id,project_id:f.dataset.project,...fd(f)}});closeModal();await reload();v36ProjectPage(f.dataset.project,"trades");toast("Métier modifié")}
    else if(f.id==="v36ExpenseForm"){await post("/api/save",{entity:"expense",action:"create",record:{project_id:f.dataset.project,...fd(f)}});closeModal();await reload();v36ProjectPage(f.dataset.project,"expenses");toast("Matériaux enregistrés")}
    else if(f.id==="v36SupplierForm"){await post("/api/save",{entity:"project_supplier",action:"create",record:{project_id:f.dataset.project,...fd(f)}});closeModal();await reload();v36ProjectPage(f.dataset.project,"suppliers");toast("Fournisseur affecté")}
  }catch(x){toast(x.message,true)}
  finally{releaseForm(f)}
},true);


document.addEventListener("click",e=>{
  if(e.target?.id==="v37PrintSuppliers")printA4("Liste des fournisseurs",S.session.company?.name||"",`<table><tr><th>Fournisseur</th><th>Téléphone</th><th>Email</th><th>Ville</th><th>Spécialité</th></tr>${(S.data.suppliers||[]).map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.phone||"")}</td><td>${esc(x.email||"")}</td><td>${esc(x.city||"")}</td><td>${esc(x.specialty||"")}</td></tr>`).join("")}</table>`);
  if(e.target?.id==="v37PrintUsers")printA4("Liste des utilisateurs",S.session.company?.name||"",`<table><tr><th>Nom</th><th>E-mail</th><th>Rôle</th><th>Statut</th></tr>${(S.data.users||[]).map(x=>`<tr><td>${esc(x.full_name||"")}</td><td>${esc(x.email||"")}</td><td>${esc(x.role||"")}</td><td>${esc(x.status||"")}</td></tr>`).join("")}</table>`);
  const pid=S.currentProjectId,p=pid?S.data.projects.find(x=>x.id===pid):null;if(!p)return;
  if(e.target?.id==="v37PrintProjectTrades"){
    const rows=(S.data.trades||[]).filter(x=>x.project_id===pid),labor=S.data.labor||[];
    printA4(`Liste des métiers · ${p.name}`,p.location||"",`<table><tr><th>Métier / Corps principal</th><th>Activité</th><th>Description activité</th><th>Main-d'œuvre</th></tr>${rows.map(x=>`<tr><td>${esc(x.phase||"")}</td><td>${esc(x.name||"")}</td><td>${esc(x.description||"")}</td><td>${cash(labor.filter(l=>l.trade_id===x.id).reduce((a,l)=>a+Number(l.amount||0),0))}</td></tr>`).join("")}</table>`)
  }
  if(e.target?.id==="v37PrintProjectMaterials"){
    const rows=(S.data.expenses||[]).filter(x=>x.project_id===pid);
    printA4(`Liste des matériaux · ${p.name}`,p.location||"",`<table><tr><th>Date</th><th>Métier / Corps principal</th><th>Activité</th><th>Désignation</th><th>Fournisseur</th><th>Quantité</th><th>Prix unitaire</th><th>Prix total</th></tr>${rows.map(x=>`<tr><td>${df(x.expense_date)}</td><td>${esc(x.trade_phase||"")}</td><td>${esc(x.trade_name||"")}</td><td>${esc(x.description||"")}</td><td>${esc(x.supplier_name||"")}</td><td>${Number(x.quantity||0).toLocaleString("fr-FR")}${x.unit?` ${esc(x.unit)}`:""}</td><td>${cash(x.unit_price)}</td><td>${cash(x.total_price)}</td></tr>`).join("")}</table>`,"landscape")
  }
  if(e.target?.id==="v37PrintProjectSuppliers"){const rows=(S.data.projectSuppliers||[]).filter(x=>x.project_id===pid);printA4(`Fournisseurs · ${p.name}`,p.location||"",`<table><tr><th>Fournisseur</th><th>Contact</th><th>Spécialité</th></tr>${rows.map(x=>`<tr><td>${esc(x.supplier_name||"")}</td><td>${esc(x.phone||"")}</td><td>${esc(x.specialty||"")}</td></tr>`).join("")}</table>`)}
},true);

document.addEventListener("submit",async e=>{
  const f=e.target;if(!["v38CatalogTradeForm","v38CatalogTradeEditForm","v38ProjectTradeForm","v38ProjectTradeEditForm","v38ExpenseEditForm"].includes(f.id))return;
  e.preventDefault();
  try{
    if(f.id==="v38CatalogTradeForm"){
      await post("/api/save",{entity:"trade_catalog",action:"create",record:{phase:f.dataset.resolvedPhase,name:f.dataset.resolvedName}});closeModal();await reload();trades();toast("Sous-corps de métier ajouté à la liste générale");
    }else if(f.id==="v38CatalogTradeEditForm"){
      await post("/api/save",{entity:"trade_catalog",action:"update",record:{id:f.dataset.id,...fd(f)}});closeModal();await reload();trades();toast("Métier modifié");
    }else if(f.id==="v38ProjectTradeForm"){
      await post("/api/save",{entity:"trade",action:"create",record:{project_id:f.dataset.project,...fd(f)}});closeModal();await reload();v36ProjectPage(f.dataset.project,"trades");toast("Métier ajouté au projet");
    }else if(f.id==="v38ProjectTradeEditForm"){
      await post("/api/save",{entity:"trade",action:"update",record:{id:f.dataset.id,project_id:f.dataset.project,...fd(f)}});closeModal();await reload();v36ProjectPage(f.dataset.project,"trades");toast("Métier modifié");
    }else if(f.id==="v38ExpenseEditForm"){
      await post("/api/save",{entity:"expense",action:"update",record:{id:f.dataset.id,project_id:f.dataset.project,...fd(f)}});closeModal();await reload();v36ProjectPage(f.dataset.project,"expenses");toast("Matériaux modifiés");
    }
  }catch(x){toast(x.message,true)}finally{releaseForm(f)}
});

init();

document.addEventListener("submit",e=>{
  const form=e.target;
  if(!(form instanceof HTMLFormElement))return;
  setTimeout(()=>{if(form.isConnected)releaseForm(form)},2500);
});
