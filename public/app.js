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
function statusLabel(v){return ({preparation:"Préparation",in_progress:"En cours",suspended:"Suspendu",completed:"Terminé",closed:"Clôturé"}[v]||String(v||""))}
function projectPrintInfo(p){return [{label:"Projet",value:p?.name||"—"},{label:"Code projet",value:p?.project_number||"—"},{label:"Date d’édition",value:new Date().toLocaleDateString("fr-FR")},{label:"Édité par",value:S.session?.user?.full_name||"Administrateur"}]}
function printStatus(v){
  const raw=String(v||"").toLowerCase();
  const cls=raw.includes("completed")||raw.includes("closed")||raw.includes("termin")||raw.includes("clôt")?"done":raw.includes("suspend")||raw.includes("annul")?"hold":raw.includes("prepar")||raw.includes("plan")?"planned":"active";
  return `<span class="print-status ${cls}">${esc(statusLabel(v)||v||"—")}</span>`;
}
function companyCustomLogo(){const c=S.session?.company;if(!c)return "";const plan=String(c.plan||"free").toLowerCase(),exp=Date.parse(c.plan_expires_at||"");return ["standard","business"].includes(plan)&&Number.isFinite(exp)&&exp>Date.now()&&/^data:image\/jpeg;base64,/i.test(String(c.logo_data||""))?String(c.logo_data):""}
function dataUrlBytes(dataUrl){const m=/^data:image\/jpeg;base64,(.+)$/i.exec(String(dataUrl||""));if(!m)return null;try{const bin=atob(m[1]),out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out}catch{return null}}
function jpegDimensions(bytes){if(!bytes||bytes.length<4||bytes[0]!==0xff||bytes[1]!==0xd8)return null;let i=2;while(i+9<bytes.length){if(bytes[i]!==0xff){i++;continue}const marker=bytes[i+1];i+=2;if(marker===0xd8||marker===0xd9)continue;if(i+1>=bytes.length)break;const len=(bytes[i]<<8)+bytes[i+1];if(len<2||i+len>bytes.length)break;if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){return {height:(bytes[i+3]<<8)+bytes[i+4],width:(bytes[i+5]<<8)+bytes[i+6]}}i+=len}return null}
async function normalizeCompanyLogo(file){
  if(!file)return null;
  if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw new Error("Format du logo non accepté. Utilisez JPG, PNG ou WebP.");
  if(file.size>6*1024*1024)throw new Error("Le fichier du logo est trop volumineux (maximum 6 Mo).");
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error("Impossible de lire cette image."));im.src=url});
    const maxW=600,maxH=240,scale=Math.min(1,maxW/img.naturalWidth,maxH/img.naturalHeight),w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale));
    const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;const ctx=canvas.getContext("2d");ctx.fillStyle="#ffffff";ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);
    let out=canvas.toDataURL("image/jpeg",.9);
    if(out.length>390000)out=canvas.toDataURL("image/jpeg",.72);
    if(out.length>390000)throw new Error("Le logo reste trop volumineux après optimisation. Choisissez une image plus simple.");
    return out;
  }finally{URL.revokeObjectURL(url)}
}
const PDF_GREEN=[0.024,0.247,0.216],PDF_GREEN_2=[0.025,0.282,0.247],PDF_GOLD=[0.79,0.57,0.14],PDF_TEXT=[0.08,0.18,0.16],PDF_GRAY=[0.72,0.77,0.75],PDF_LIGHT=[0.973,0.98,0.98];
function pdfNum(n){return Number(n||0).toFixed(2).replace(/\.00$/,'')}
function pdfEsc(s){return String(s??'').replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)').replace(/\r?\n/g,' ')}
function pdfColor(c){return c.map(v=>Number(v).toFixed(3)).join(' ')}
function pdfTextWidth(text,size,bold=false){let u=0;for(const ch of String(text??'')){if('MW@%&'.includes(ch))u+=0.86;else if('ilI.,:;!|\' '.includes(ch))u+=0.28;else if(/[A-Z0-9]/.test(ch))u+=0.59;else u+=0.5}return u*size*(bold?1.035:1)}
function pdfFitTextSize(text,maxWidth,startSize=18,minSize=10,bold=true){const raw=String(text??'').replace(/\s+/g,' ').trim();if(!raw||maxWidth<=0)return startSize;const width=pdfTextWidth(raw,startSize,bold);if(width<=maxWidth)return startSize;return Math.max(minSize,startSize*(maxWidth/width))}
function pdfWrap(text,maxWidth,size,bold=false){const raw=String(text??'—').replace(/\s+/g,' ').trim()||'—';if(pdfTextWidth(raw,size,bold)<=maxWidth)return [raw];const words=raw.split(' '),lines=[];let line='';for(const word0 of words){let word=word0;if(pdfTextWidth(word,size,bold)>maxWidth){if(line){lines.push(line);line=''}let part='';for(const ch of word){const test=part+ch;if(part&&pdfTextWidth(test,size,bold)>maxWidth){lines.push(part);part=ch}else part=test}if(part)line=part;continue}const test=line?`${line} ${word}`:word;if(line&&pdfTextWidth(test,size,bold)>maxWidth){lines.push(line);line=word}else line=test}if(line)lines.push(line);return lines.length?lines:['—']}
function pdfWinAnsiBytes(str){const map={'€':0x80,'‚':0x82,'ƒ':0x83,'„':0x84,'…':0x85,'†':0x86,'‡':0x87,'ˆ':0x88,'‰':0x89,'Š':0x8A,'‹':0x8B,'Œ':0x8C,'Ž':0x8E,'‘':0x91,'’':0x92,'“':0x93,'”':0x94,'•':0x95,'–':0x96,'—':0x97,'˜':0x98,'™':0x99,'š':0x9A,'›':0x9B,'œ':0x9C,'ž':0x9E,'Ÿ':0x9F,' ':0x20,' ':0x20};const out=[];for(const ch of String(str)){const cp=ch.codePointAt(0);if(cp<=255)out.push(cp);else if(map[ch]!==undefined)out.push(map[ch]);else out.push(63)}return new Uint8Array(out)}
function pdfConcat(parts){let n=parts.reduce((a,p)=>a+p.length,0),out=new Uint8Array(n),o=0;for(const p of parts){out.set(p,o);o+=p.length}return out}
class CorporatePdf{
  constructor(orientation='landscape'){this.orientation='landscape';this.w=841.89;this.h=595.28;this.pages=[];this.images=[]}
  page(){const p={ops:[]};this.pages.push(p);return p}
  op(p,s){p.ops.push(s)}
  fill(p,c){this.op(p,`${pdfColor(c)} rg\n`)} stroke(p,c){this.op(p,`${pdfColor(c)} RG\n`)}
  rect(p,x,y,w,h,{fill=null,stroke=null,lw=.7}={}){if(fill)this.fill(p,fill);if(stroke)this.stroke(p,stroke);this.op(p,`${pdfNum(lw)} w ${pdfNum(x)} ${pdfNum(this.h-y-h)} ${pdfNum(w)} ${pdfNum(h)} re ${fill&&stroke?'B':fill?'f':'S'}\n`)}
  line(p,x1,y1,x2,y2,c=PDF_GREEN,lw=.7){this.stroke(p,c);this.op(p,`${pdfNum(lw)} w ${pdfNum(x1)} ${pdfNum(this.h-y1)} m ${pdfNum(x2)} ${pdfNum(this.h-y2)} l S\n`)}
  imageJpeg(p,dataUrl,x,y,boxW,boxH){const bytes=dataUrlBytes(dataUrl),dim=jpegDimensions(bytes);if(!bytes||!dim)return false;let img=this.images.find(v=>v.dataUrl===dataUrl);if(!img){img={name:`Im${this.images.length+1}`,dataUrl,bytes,width:dim.width,height:dim.height};this.images.push(img)}const scale=Math.min(boxW/img.width,boxH/img.height),w=img.width*scale,h=img.height*scale,dx=x+(boxW-w)/2,dy=y+(boxH-h)/2;this.op(p,`q ${pdfNum(w)} 0 0 ${pdfNum(h)} ${pdfNum(dx)} ${pdfNum(this.h-dy-h)} cm /${img.name} Do Q\n`);return true}
  text(p,text,x,y,size=9,{font='F1',color=PDF_TEXT,align='left',maxWidth=0}={}){let t=String(text??'');if(maxWidth){while(t.length>1&&pdfTextWidth(t,size,font==='F2')>maxWidth)t=t.slice(0,-1);if(t!==String(text??''))t=t.replace(/[ .,-]+$/,'')+'…'}let tx=x;if(align==='center')tx=x-pdfTextWidth(t,size,font==='F2')/2;else if(align==='right')tx=x-pdfTextWidth(t,size,font==='F2');this.fill(p,color);this.op(p,`BT /${font} ${pdfNum(size)} Tf 1 0 0 1 ${pdfNum(tx)} ${pdfNum(this.h-y-size*.82)} Tm (${pdfEsc(t)}) Tj ET\n`)}
  toBlob(){const objs=[];const add=b=>{objs.push(typeof b==='string'?pdfWinAnsiBytes(b):b);return objs.length};const font1=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');const font2=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');const font3=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>');const imageRefs={};for(const img of this.images){imageRefs[img.name]=add(pdfConcat([pdfWinAnsiBytes(`<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.bytes.length} >>\nstream\n`),img.bytes,pdfWinAnsiBytes('\nendstream')]))}const pagesObj=add('');const xobj=Object.entries(imageRefs).map(([name,id])=>`/${name} ${id} 0 R`).join(' ');const pageIds=[];for(const pg of this.pages){const content=pdfWinAnsiBytes(pg.ops.join(''));const contentObj=add(pdfConcat([pdfWinAnsiBytes(`<< /Length ${content.length} >>\nstream\n`),content,pdfWinAnsiBytes('\nendstream')]));const pageObj=add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${pdfNum(this.w)} ${pdfNum(this.h)}] /Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R /F3 ${font3} 0 R >> ${xobj?`/XObject << ${xobj} >>`:''} >> /Contents ${contentObj} 0 R >>`);pageIds.push(pageObj)}objs[pagesObj-1]=pdfWinAnsiBytes(`<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] >>`);const catalog=add(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`);const header=pdfWinAnsiBytes('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');const parts=[header],offsets=[0];let offset=header.length;for(let i=0;i<objs.length;i++){offsets[i+1]=offset;const pre=pdfWinAnsiBytes(`${i+1} 0 obj\n`),post=pdfWinAnsiBytes('\nendobj\n');parts.push(pre,objs[i],post);offset+=pre.length+objs[i].length+post.length}const xref=offset;let trailer=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`;for(let i=1;i<=objs.length;i++)trailer+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;trailer+=`trailer\n<< /Size ${objs.length+1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;parts.push(pdfWinAnsiBytes(trailer));return new Blob(parts,{type:'application/pdf'})}
}
function extractPdfBlocks(html){const root=document.createElement('div');root.innerHTML=html||'';const blocks=[];const walk=el=>{for(const node of [...el.children]){const tag=node.tagName?.toLowerCase();if(tag==='h2'||tag==='h3'){blocks.push({type:'heading',text:node.textContent.trim()})}else if(tag==='table'){const head=[...node.querySelectorAll('thead th')].map(x=>x.textContent.trim());let headers=head;if(!headers.length){const first=node.querySelector('tr');headers=first?[...first.children].map(x=>x.textContent.trim()):[]}const trs=[...node.querySelectorAll('tr')];const start=head.length?0:1;const rows=trs.slice(start).filter(tr=>tr.querySelectorAll('td').length).map(tr=>[...tr.querySelectorAll('td')].map(td=>({text:td.textContent.replace(/\s+/g,' ').trim()||'—',status:td.querySelector('.print-status')?.className||''})));blocks.push({type:'table',headers,rows})}else walk(node)}};walk(root);return blocks}
function corporatePdfFilename(title,options={}){const info=Array.isArray(options.info)?options.info:[];const code=info.find(x=>String(x.label||'').toLowerCase()==='code projet')?.value||'';const date=new Date().toISOString().slice(0,10);return `${String(title||'document').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_+|_+$/g,'')}${code?'_'+String(code).replace(/[^a-zA-Z0-9-]+/g,'_'):''}_${date}.pdf`}
function downloadBlob(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.style.display='none';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(url);a.remove()},1500)}
function printA4(title,subtitle,body,orientation='landscape',options={}){
  try{
    const c=S.session?.company||{},u=S.session?.user||{},pdf=new CorporatePdf('landscape');
    const W=pdf.w,H=pdf.h,land=true,M=18;
    const company=c.name||'GLOBAL BT',companyLogo=companyCustomLogo(),slogan=c.slogan||'La qualité, notre engagement',phone=c.phone||u.phone||'—',mail=c.email||u.email||'—',address=[c.address,c.city].filter(Boolean).join(', ')||"Côte d’Ivoire",taxpayer=c.taxpayer_account||'—',rccm=c.rccm||'—',capital=Number(c.capital||0)>0?cash(c.capital):'—',editor=u.full_name||'Administrateur';
    const now=new Date(),dateText=now.toLocaleDateString('fr-FR'),period=now.toLocaleDateString('fr-FR',{month:'long',year:'numeric'}),info=Array.isArray(options.info)?options.info:[],infoMap=Object.fromEntries(info.map(x=>[String(x.label||'').trim().toLowerCase(),x.value])),projectName=infoMap['projet']||'',projectCode=infoMap['code projet']||'',project=(S.data?.projects||[]).find(p=>(projectCode&&p.project_number===projectCode)||(projectName&&p.name===projectName)),projectState=project?statusLabel(project.status):'',portfolio=options.portfolio||(projectCode?projectCode:(subtitle||'Gestion BTP')),summaryOneLabel=projectName?'Projet':'Entreprise / Client',summaryOne=projectName||company,summaryTwoLabel=projectCode?'Code projet':'Période',summaryTwo=projectCode||period,summaryThreeLabel=projectState?'Statut projet':'Statut global',summaryThree=projectState||options.status||'Suivi en cours',totalText=options.totalLabel&&options.total!==undefined?`${options.totalLabel} : ${options.total}`:`Document : ${title}`;
    const headerH=land?82:92,titleH=42,metaH=38,sumH=44,footerH=31,signH=105;
    const drawBuilding=(p,x,y,s=1)=>{pdf.rect(p,x,y+18*s,13*s,34*s,{fill:PDF_GREEN});pdf.rect(p,x+15*s,y+8*s,14*s,44*s,{fill:PDF_GREEN});pdf.rect(p,x+31*s,y+24*s,12*s,28*s,{fill:PDF_GOLD});pdf.line(p,x-2*s,y+53*s,x+47*s,y+53*s,PDF_GREEN,1.2);pdf.line(p,x+20*s,y+7*s,x+40*s,y-1*s,PDF_GOLD,.8);pdf.line(p,x+39*s,y,x+39*s,y+28*s,PDF_GOLD,.8);pdf.line(p,x+39*s,y+8*s,x+51*s,y+14*s,PDF_GOLD,.8)};
    const baseHeader=(p)=>{pdf.rect(p,0,0,W,H,{fill:[1,1,1]});const c1=land?W*.40:W*.43,c2=land?W*.70:W*.72;pdf.line(p,M,headerH,W-M,headerH,PDF_GREEN,1.4);pdf.line(p,c1,12,c1,headerH-12,[.15,.25,.23],.7);pdf.line(p,c2,12,c2,headerH-12,[.15,.25,.23],.7);if(companyLogo){pdf.rect(p,M+3,13,55,55,{fill:[1,1,1],stroke:PDF_GRAY,lw:.45});pdf.imageJpeg(p,companyLogo,M+5,15,51,51)}else drawBuilding(p,M+4,15,land?.95:.82);pdf.text(p,company,M+66,19,land?18:15,{font:'F2',color:PDF_GREEN,maxWidth:c1-M-74});pdf.text(p,'Gestion BTP Professionnelle',M+66,42,land?10:8.5,{font:'F2',color:PDF_GOLD,maxWidth:c1-M-74});pdf.text(p,slogan,M+66,59,land?8:7,{font:'F3',color:[.15,.27,.24],maxWidth:c1-M-74});pdf.line(p,M+66,73,Math.min(c1-18,M+175),73,PDF_GOLD,1);const mx=c1+18;pdf.text(p,'Adresse',mx,20,7,{font:'F2',color:PDF_GREEN});pdf.text(p,address,mx+42,20,8,{maxWidth:c2-mx-46});pdf.text(p,'Téléphone',mx,39,7,{font:'F2',color:PDF_GREEN});pdf.text(p,phone,mx+42,39,8,{maxWidth:c2-mx-46});pdf.text(p,'Email',mx,58,7,{font:'F2',color:PDF_GREEN});pdf.text(p,mail,mx+42,58,8,{maxWidth:c2-mx-46});const rx=c2+18;pdf.text(p,'N° Contribuable :',rx,20,7.5,{font:'F2',color:PDF_GREEN});pdf.text(p,taxpayer,rx+68,20,8,{maxWidth:W-M-rx-70});pdf.text(p,'RCCM :',rx,39,7.5,{font:'F2',color:PDF_GREEN});pdf.text(p,rccm,rx+68,39,8,{maxWidth:W-M-rx-70});pdf.text(p,'Capital :',rx,58,7.5,{font:'F2',color:PDF_GREEN});pdf.text(p,capital,rx+68,58,8,{maxWidth:W-M-rx-70});let y=headerH+14;const titleText=String(title||'DOCUMENT').replace(/\s+/g,' ').trim().toUpperCase(),titleLineOuter=M+30,titleLineMin=28,titleGap=14,titleMaxWidth=Math.max(180,W-2*(titleLineOuter+titleLineMin+titleGap)),titleSize=pdfFitTextSize(titleText,titleMaxWidth,land?18:15,10,true),titleWidth=pdfTextWidth(titleText,titleSize,true),titleLeft=W/2-titleWidth/2,titleRight=W/2+titleWidth/2,leftLineEnd=titleLeft-titleGap,rightLineStart=titleRight+titleGap;if(leftLineEnd-titleLineOuter>=titleLineMin)pdf.line(p,titleLineOuter,y+14,leftLineEnd,y+14,PDF_GOLD,.9);if(W-M-30-rightLineStart>=titleLineMin)pdf.line(p,rightLineStart,y+14,W-M-30,y+14,PDF_GOLD,.9);pdf.text(p,titleText,W/2,y,titleSize,{font:'F2',color:PDF_GREEN,align:'center'});if(subtitle)pdf.text(p,subtitle,W/2,y+23,6.8,{font:'F1',color:[.42,.48,.46],align:'center',maxWidth:260});y+=titleH;const metaY=y;pdf.rect(p,M,metaY,W-2*M,metaH,{fill:PDF_LIGHT,stroke:PDF_GRAY,lw:.7});const meta=[['Date d’édition',dateText],['Imprimé par',editor],['Portefeuille',portfolio],[options.totalLabel||'Document',options.total!==undefined?String(options.total):title]],mw=(W-2*M)/4;meta.forEach((it,i)=>{if(i)pdf.line(p,M+i*mw,metaY+8,M+i*mw,metaY+metaH-8,PDF_GRAY,.6);pdf.text(p,it[0]+' :',M+i*mw+10,metaY+10,6.4,{font:'F2',color:PDF_GREEN});pdf.text(p,it[1],M+i*mw+10,metaY+23,7.2,{maxWidth:mw-20})});y+=metaH+8;const sy=y,sw=(W-2*M)/3;pdf.rect(p,M,sy,W-2*M,sumH,{stroke:PDF_GOLD,lw:1});[[summaryOneLabel,summaryOne],[summaryTwoLabel,summaryTwo],[summaryThreeLabel,summaryThree]].forEach((it,i)=>{if(i)pdf.line(p,M+i*sw,sy+7,M+i*sw,sy+sumH-7,[.58,.61,.60],.6);pdf.text(p,it[0],M+i*sw+15,sy+10,6.4,{font:'F2',color:[.15,.26,.23]});pdf.text(p,it[1],M+i*sw+15,sy+24,land?9:8,{font:'F2',color:PDF_GREEN,maxWidth:sw-30})});return sy+sumH+10};
    const footer=(p,index,count)=>{const y=H-footerH;pdf.text(p,`Page ${index} / ${count}`,W/2,y-13,7.5,{font:'F2',color:PDF_GREEN,align:'center'});pdf.line(p,W/2-67,y-8,W/2-25,y-8,PDF_GOLD,.8);pdf.line(p,W/2+25,y-8,W/2+67,y-8,PDF_GOLD,.8);pdf.rect(p,M,y,W-2*M,footerH-5,{fill:PDF_GREEN});pdf.text(p,`${company} — Gestion BTP Professionnelle`,W/2,y+8,8.5,{font:'F2',color:[1,1,1],align:'center',maxWidth:W-2*M-90});pdf.rect(p,M,y,35,footerH-5,{fill:PDF_GOLD});pdf.rect(p,W-M-35,y,35,footerH-5,{fill:PDF_GOLD})};
    const signatures=(p,y)=>{pdf.text(p,'Préparé par',M+10,y,8,{font:'F2',color:PDF_GREEN});pdf.line(p,M+10,y+13,M+62,y+13,PDF_GOLD,.7);['Nom :','Fonction :','Date :'].forEach((t,i)=>{pdf.text(p,t,M+10,y+24+i*18,7);pdf.line(p,M+48,y+31+i*18,M+180,y+31+i*18,[.3,.35,.34],.6)});const rx=W-M-190;pdf.text(p,'Approuvé par',rx,y,8,{font:'F2',color:PDF_GREEN});pdf.line(p,rx,y+13,rx+55,y+13,PDF_GOLD,.7);['Nom :','Fonction :','Date :'].forEach((t,i)=>{pdf.text(p,t,rx,y+24+i*18,7);pdf.line(p,rx+38,y+31+i*18,W-M-10,y+31+i*18,[.3,.35,.34],.6)})};
    const blocks=extractPdfBlocks(body);let p=pdf.page(),y=baseHeader(p),pageContentStart=y;
    const newPage=()=>{p=pdf.page();pdf.rect(p,0,0,W,H,{fill:[1,1,1]});y=M+8;pageContentStart=y};
    const maxY=()=>H-footerH-34;
    const tableBlock=(blk)=>{if(!blk.headers.length)return;const cols=blk.headers.length,tableW=W-2*M,fontSize=Math.max(5.6,Math.min(7.5,(land?8:7.4)-(Math.max(0,cols-(land?7:5))*.35))),pad=4,lineH=fontSize+2.2;const weights=blk.headers.map((h,i)=>{let m=Math.min(24,Math.max(6,String(h).length));for(const r of blk.rows.slice(0,30))m=Math.max(m,Math.min(28,String(r[i]?.text||'').length));return m});let widths=weights.map(w=>w/weights.reduce((a,b)=>a+b,0)*tableW);const minW=land?44:48;for(let z=0;z<2;z++){let deficit=0,free=0;widths=widths.map(v=>{if(v<minW){deficit+=minW-v;return minW}free+=Math.max(0,v-minW);return v});if(deficit&&free)widths=widths.map(v=>v>minW?v-deficit*((v-minW)/free):v)}const sum=widths.reduce((a,b)=>a+b,0);if(sum!==tableW)widths[widths.length-1]+=tableW-sum;const headerHeight=Math.max(24,...blk.headers.map((h,i)=>pdfWrap(h,widths[i]-2*pad,fontSize,true).length*lineH+8));const drawHeader=()=>{if(y+headerHeight>maxY())newPage();let x=M;blk.headers.forEach((h,i)=>{pdf.rect(p,x,y,widths[i],headerHeight,{fill:PDF_GREEN_2,stroke:[.62,.69,.67],lw:.45});const lines=pdfWrap(h,widths[i]-2*pad,fontSize,true);lines.forEach((ln,j)=>pdf.text(p,ln,x+widths[i]/2,y+6+j*lineH,fontSize,{font:'F2',color:[1,1,1],align:'center'}));x+=widths[i]});y+=headerHeight};drawHeader();for(const row of blk.rows){const lineSets=row.map((cell,i)=>pdfWrap(cell?.text||'—',widths[i]-2*pad,fontSize,false)),rh=Math.max(22,...lineSets.map(ls=>ls.length*lineH+8));if(y+rh>maxY()){newPage();drawHeader()}let x=M;row.forEach((cell,i)=>{pdf.rect(p,x,y,widths[i],rh,{fill:[1,1,1],stroke:[.72,.76,.75],lw:.4});if(cell?.status){const tw=Math.min(widths[i]-8,Math.max(34,pdfTextWidth(cell.text,fontSize,true)+14)),cls=cell.status;const fill=cls.includes('hold')?[.98,.90,.84]:cls.includes('planned')?[.93,.93,.94]:[.89,.96,.92];pdf.rect(p,x+(widths[i]-tw)/2,y+(rh-17)/2,tw,17,{fill,stroke:null});pdf.text(p,cell.text,x+widths[i]/2,y+(rh-fontSize)/2,fontSize,{font:'F2',color:PDF_GREEN,align:'center',maxWidth:tw-8})}else lineSets[i].forEach((ln,j)=>pdf.text(p,ln,x+pad,y+5+j*lineH,fontSize,{maxWidth:widths[i]-2*pad}));x+=widths[i]});y+=rh}};
    for(const blk of blocks){if(blk.type==='heading'){if(y+26>maxY())newPage();pdf.text(p,blk.text,M,y+4,9,{font:'F2',color:PDF_GREEN});pdf.line(p,M,y+18,M+115,y+18,PDF_GOLD,.7);y+=26}else if(blk.type==='table'){if(y+32>maxY())newPage();tableBlock(blk);y+=10}}
    if(y+signH+28>maxY())newPage();pdf.text(p,totalText,M+8,y+5,8.5,{font:'F2',color:PDF_GREEN});y+=26;signatures(p,y);
    const count=pdf.pages.length;pdf.pages.forEach((pg,i)=>footer(pg,i+1,count));const blob=pdf.toBlob();downloadBlob(blob,corporatePdfFilename(title,options));toast(`PDF A4 généré : ${title}`)
  }catch(err){console.error('PDF_A4_ERROR',err);toast('Impossible de générer le PDF A4. Réessayez.',true)}
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
function confirmBox(txt,fn){
  const projectContext=document.querySelector(".project-page-pro")&&S.currentProjectId?{id:S.currentProjectId,view:S.currentProjectView||"suppliers"}:null;
  const currentView=S.view;
  modal(`<h2>Confirmation</h2><p>${esc(txt)}</p><div class="toolbar"><button id="no" class="btn secondary">Annuler</button><button id="yes" class="btn danger">Confirmer</button></div>`);
  $("#no").onclick=closeModal;
  $("#yes").onclick=async()=>{try{
    await fn();closeModal();await reload();
    if(projectContext&&S.data.projects.some(p=>p.id===projectContext.id))v36ProjectPage(projectContext.id,projectContext.view);
    else{S.view=currentView;render()}
    toast("Opération effectuée");
  }catch(e){toast(e.message,true)}}
}

$("#tabLogin").onclick=()=>authMode(true);$("#tabRegister").onclick=()=>authMode(false);
function authMode(login){$("#loginForm").classList.toggle("hidden",!login);$("#registerForm").classList.toggle("hidden",login);$("#tabLogin").classList.toggle("active",login);$("#tabRegister").classList.toggle("active",!login);$("#authMessage").textContent="";$("#authPanel")?.scrollIntoView({behavior:"smooth",block:"center"})}
[["#landingLogin",true],["#heroLogin",true],["#landingRegister",false],["#heroRegister",false]].forEach(([id,login])=>{const b=$(id);if(b)b.onclick=()=>authMode(login)});
document.querySelectorAll("[data-open-register]").forEach(a=>a.addEventListener("click",()=>setTimeout(()=>authMode(false),0)));
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
async function enter(){$("#authScreen").classList.add("hidden");$("#landingNav")?.classList.add("hidden");$("#landingActions")?.classList.add("hidden");$("#landingBrand")?.classList.add("hidden");$("#appBrand")?.classList.remove("hidden");document.querySelector(".topbar")?.classList.remove("landing-topbar");$("#appShell").classList.remove("hidden");enterHeader();$("#spaceLabel").textContent=S.session.user.role==="superadmin"?"SUPER ADMINISTRATION":"ESPACE ENTREPRISE";nav();await reload();go(S.session.user.role==="superadmin"?"super":"dashboard");if(S.session.user.must_change_password)changePassword()}
async function reload(){S.data=await api("/api/load")}
function nav(){const superA=S.session.user.role==="superadmin",admin=S.session.user.role==="admin";const n=superA?[["home","Accueil"],["super","Tableau de bord"],["companies","Entreprises"],["members","Membres"],["subscriptions","Abonnements"],["resets","Mots de passe"],["audit","Journal"]]:[["home","Accueil"],["dashboard","Tableau de bord"],["projects","Projets"],["expenses","Matériaux"],["labor","Main-d'œuvre"],["reports","Rapports"],...(admin?[["users","Utilisateurs"]]:[]),["settings","Paramètres"]];$("#mainNav").innerHTML=n.map(([i,l])=>`<button data-nav="${i}">${l}</button>`).join("")+`<button id="logout" class="logout">Déconnexion</button>`;$("#mainNav").classList.remove("hidden");document.querySelectorAll("[data-nav]").forEach(b=>b.onclick=()=>go(b.dataset.nav));$("#logout").onclick=async()=>{try{await post("/api/logout",{})}catch{}location.reload()}}
function go(v){
  S.view=v;
  document.querySelectorAll("[data-nav]").forEach(b=>b.classList.toggle("active",b.dataset.nav===v));
  if(v==="home"){
    $("#appShell").classList.add("hidden");
    $("#authScreen").classList.remove("hidden");
    $("#authScreen").classList.add("connected-home");
    $("#landingNav")?.classList.add("hidden");
    $("#landingActions")?.classList.add("hidden");
    $("#landingBrand")?.classList.add("hidden");
    $("#appBrand")?.classList.remove("hidden");
    document.querySelector(".topbar")?.classList.remove("landing-topbar");
    window.scrollTo({top:0,behavior:"smooth"});
    return;
  }
  $("#authScreen").classList.add("hidden");
  $("#authScreen").classList.remove("connected-home");
  $("#appShell").classList.remove("hidden");
  $("#pageTitle").textContent=names[v]||"GLOBAL BT";
  $("#pageSub").textContent=S.session.company?.name||"Administration générale";
  render();
  if(S.session.company?.plan==="free")promo();
}
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
        <button id="v41PrintDashboard" class="btn secondary">PDF A4</button>
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
  $('#content').innerHTML=`<div class="panel"><div class="panelhead"><div><h2>Projets</h2><p class="muted">Du lancement à la livraison : métiers, modification et export PDF A4.</p></div><div class="toolbar"><button id="printProjects" class="btn secondary">PDF A4</button><button id="addProject" class="btn primary">+ Nouveau projet</button></div></div>${table(['Projet','Localité','Budget','Statut','Métiers','Actions'],rows)}</div>`;
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
  return `<form id="${trade?"v38ProjectTradeEditForm":"v38ProjectTradeForm"}" data-project="${esc(projectId)}" ${trade?`data-id="${esc(trade.id)}"`:""} class="formgrid">
    <label>Métier<input name="trade_name" value="${esc(trade?.phase||"")}" required placeholder="Ex. Maçonnerie"></label>
    <label>Domaine / spécialité<input name="specialty" value="${esc(trade?.name||"")}" required placeholder="Ex. Gros œuvre"></label>
    <label>Nom du prestataire / artisan<input name="provider_name" value="${esc(trade?.provider_name||"")}" required></label>
    <label>Contact<input name="provider_contact" value="${esc(trade?.provider_contact||"")}" required></label>
    <label>Localisation<input name="provider_city" value="${esc(trade?.provider_city||"")}" required></label>
    <label>Main-d'œuvre convenue (FCFA)<input name="labor_amount" type="number" min="0" value="${Number(trade?.labor_amount||0)}" required></label>
    <label class="span2">Travaux fournis / description<textarea name="description" rows="4" required placeholder="Décrivez les travaux fournis ou à réaliser">${esc(trade?.description||"")}</textarea></label>
    <button class="btn primary span2" type="submit">${trade?"Enregistrer les modifications":"Ajouter l’ouvrage"}</button>
  </form>`;
}
function projectOuvrageLabor(projectId,trade){
  const configured=Number(trade?.labor_amount||0);
  if(configured>0)return configured;
  return (S.data.labor||[]).filter(x=>x.project_id===projectId&&x.trade_id===trade?.id).reduce((a,x)=>a+Number(x.amount||0),0);
}
function projectTargetPayments(projectId,type,targetId){
  return (S.data.payments||[]).filter(x=>x.project_id===projectId&&x.target_type===type&&x.target_id===targetId).reduce((a,x)=>a+Number(x.amount||0),0);
}
function projectPaymentOptions(projectId,type){
  if(type==="supplier")return (S.data.projectSuppliers||[]).filter(x=>x.project_id===projectId).map(x=>({id:x.supplier_id,name:x.supplier_name||"Fournisseur"}));
  return (S.data.trades||[]).filter(x=>x.project_id===projectId).map(x=>({id:x.id,name:`${x.provider_name||x.name||"Ouvrage"} — ${x.phase||""} / ${x.name||""}`}));
}
function openProjectPaymentModal(projectId){
  const p=S.data.projects.find(x=>x.id===projectId);if(!p)return;
  modal(`<h2>Faire un paiement · ${esc(p.name)}</h2><form id="v47PaymentForm" data-project="${esc(projectId)}" class="formgrid">
    <label>Section visée<select id="v47PaymentType" name="target_type" required><option value="supplier">Fournisseur de matériaux</option><option value="ouvrage">Ouvrage</option></select></label>
    <label>Bénéficiaire<select id="v47PaymentTarget" name="target_id" required></select></label>
    <label>Montant versé (FCFA)<input name="amount" type="number" min="1" required></label>
    <label>Date du paiement<input name="payment_date" type="date" value="${new Date().toISOString().slice(0,10)}" required></label>
    <label>Mode de paiement<input name="payment_method" placeholder="Espèces, virement, Mobile Money..."></label>
    <label>Référence<input name="reference" placeholder="N° reçu / transaction"></label>
    <label class="span2">Notes<textarea name="notes" rows="3"></textarea></label>
    <div id="v47PaymentHint" class="notice span2"></div>
    <button class="btn primary span2" type="submit">Enregistrer le paiement</button>
  </form>`);
  const type=$("#v47PaymentType"),target=$("#v47PaymentTarget"),hint=$("#v47PaymentHint");
  const refresh=()=>{
    const options=projectPaymentOptions(projectId,type.value);
    target.innerHTML=`<option value="">— Sélectionner —</option>`+options.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("");
    hint.textContent=options.length?"Sélectionnez le bénéficiaire. Le système contrôlera automatiquement le reste à payer.":"Aucun bénéficiaire disponible dans cette section.";
  };
  type.onchange=refresh;
  target.onchange=()=>{
    const id=target.value;if(!id)return;
    let due=0,paid=0;
    if(type.value==="supplier"){
      due=(S.data.expenses||[]).filter(x=>x.project_id===projectId&&x.supplier_id===id).reduce((a,x)=>a+Number(x.total_price||0),0);
      paid=projectTargetPayments(projectId,"supplier",id);
    }else{
      const t=(S.data.trades||[]).find(x=>x.id===id);due=projectOuvrageLabor(projectId,t);paid=projectTargetPayments(projectId,"ouvrage",id);
    }
    hint.innerHTML=`Valeur due : <strong>${cash(due)}</strong> · Déjà versé : <strong>${cash(paid)}</strong> · Reste : <strong>${cash(Math.max(0,due-paid))}</strong>`;
  };
  refresh();
}
function trades(){
  const catalog=S.data.tradeCatalog||[];
  const rows=catalog.map(x=>`<tr><td><span class="phase-badge">${esc(x.phase||"")}</span></td><td><strong>${esc(x.name)}</strong></td><td class="v38-actions-cell"><div class="actions v38-actions"><button class="btn small secondary v38EditCatalogTrade" data-id="${x.id}">Modifier</button>${S.session.user.role==="admin"?`<button class="btn small danger v38DeleteCatalogTrade" data-id="${x.id}">Supprimer</button>`:""}</div></td></tr>`);
  $("#content").innerHTML=`<div class="panel"><div class="panelhead"><div><h2>Métiers</h2><p class="muted">Liste générale des métiers disponibles. Un métier doit être enregistré ici avant de pouvoir être ajouté à un projet.</p></div><div class="toolbar"><button id="v38PrintTrades" class="btn secondary">PDF A4</button><button id="v37AddTrade" class="btn primary">+ Ajouter un sous-corps de métier</button></div></div><div class="v38-catalog-table">${table(["Métier / Corps principal","Activité","Actions"],rows)}</div></div>`;
  $("#v38PrintTrades").onclick=()=>printA4("Liste générale des métiers","Référentiel général de l’entreprise",`<table><tr><th>Métier / Corps principal</th><th>Activité</th></tr>${catalog.map(x=>`<tr><td>${esc(x.phase||"")}</td><td>${esc(x.name)}</td></tr>`).join("")}</table>`,"landscape",{info:[{label:"Document",value:"Référentiel des métiers"},{label:"Date d’édition",value:new Date().toLocaleDateString("fr-FR")},{label:"Édité par",value:S.session.user.full_name||"Administrateur"},{label:"Entreprise",value:S.session.company?.name||"GLOBAL BT"}],totalLabel:"Total métiers",total:catalog.length});
  $("#v37AddTrade").onclick=()=>{modal(`<h2>Ajouter un sous-corps de métier</h2>${renderProfessionalTradeForm()}`);initProfessionalTradeForm($("#modalBody"))};
  document.querySelectorAll(".v38EditCatalogTrade").forEach(b=>b.onclick=()=>{const x=catalog.find(t=>t.id===b.dataset.id);if(!x)return;modal(`<h2>Modifier le sous-corps de métier</h2><form id="v38CatalogTradeEditForm" data-id="${x.id}"><label>Métier / Corps principal<input name="phase" value="${esc(x.phase||"")}" required></label><label>Activité<input name="name" value="${esc(x.name)}" required></label><button class="btn primary full">Enregistrer</button></form>`)});
  document.querySelectorAll(".v38DeleteCatalogTrade").forEach(b=>b.onclick=()=>confirmBox("Supprimer ce métier de la liste générale ?",async()=>{await post("/api/save",{entity:"trade_catalog",action:"delete",record:{id:b.dataset.id}});await reload();trades();toast("Métier supprimé de la liste générale")}));
}

function suppliers(){
  $("#content").innerHTML=`<div class="panel"><div class="panelhead"><h2>Fournisseurs</h2><div class="toolbar"><button id="v37PrintSuppliers" class="btn secondary">PDF A4</button><button id="addSupplier" class="btn primary">+ Ajouter</button></div></div>${table(["Nom","Contact","Ville","Spécialité","Actions"],S.data.suppliers.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.phone||"")}</td><td>${esc(x.city||"")}</td><td>${esc(x.specialty||"")}</td><td class="v38-actions-cell">${S.session.user.role==="admin"?`<button class="btn small danger del-sup" data-id="${x.id}">Supprimer</button>`:""}</td></tr>`))}</div>`;
  $("#addSupplier").onclick=()=>modal(`<h2>Nouveau fournisseur</h2><form id="supplierForm" class="formgrid"><label>Nom<input name="name" required></label><label>Téléphone<input name="phone"></label><label>E-mail<input name="email" type="email"></label><label>Ville<input name="city"></label><label>Adresse<input name="address"></label><label>Spécialité<input name="specialty"></label><label class="span2">Notes<textarea name="notes"></textarea></label><button class="btn primary span2">Ajouter</button></form>`);
  document.querySelectorAll(".del-sup").forEach(b=>b.onclick=()=>confirmBox("Supprimer ce fournisseur de la liste générale ?",async()=>{await post("/api/save",{entity:"supplier",action:"delete",record:{id:b.dataset.id}});await reload();suppliers();toast("Fournisseur supprimé")}));
}
document.addEventListener("submit",async e=>{if(e.target.id==="supplierForm"){e.preventDefault();try{await post("/api/save",{entity:"supplier",action:"create",record:fd(e.target)});closeModal();await reload();suppliers();toast("Fournisseur ajouté")}catch(x){toast(x.message,true)}}});
function users(){$("#content").innerHTML=`<div class="panel"><div class="panelhead"><h2>Agents</h2><div class="toolbar"><button id="v37PrintUsers" class="btn secondary">PDF A4</button><button id="addAgent" class="btn primary">+ Nouvel Agent</button></div></div>${table(["Nom","E-mail","Rôle","Statut","Actions"],S.data.users.map(x=>`<tr><td>${esc(x.full_name)}</td><td>${esc(x.email)}</td><td>${esc(x.role)}</td><td><span class="status ${x.status}">${esc(x.status)}</span><br><small>${Number(x.credential_ready)?"Accès prêt":"Mot de passe à réinitialiser"}</small></td><td>${x.role==="agent"?`<div class="actions"><button class="btn small secondary reset-agent" data-id="${x.id}">Mot de passe</button><button class="btn small secondary toggle-agent" data-id="${x.id}" data-act="${x.status==="active"?"disable":"activate"}">${x.status==="active"?"Désactiver":"Activer"}</button><button class="btn small danger del-agent" data-id="${x.id}">Supprimer</button></div>`:"—"}</td></tr>`))}<h3 style="margin-top:18px">Demandes mot de passe</h3>${table(["Date","Agent","E-mail","Statut","Action"],S.data.resets.map(x=>`<tr><td>${df(x.created_at)}</td><td>${esc(x.full_name||"")}</td><td>${esc(x.email)}</td><td>${esc(x.status)}</td><td>${x.status==="pending"?`<button class="btn small secondary reset-request" data-id="${x.user_id}" data-rid="${x.id}">Réinitialiser</button>`:"—"}</td></tr>`))}</div>`;$("#addAgent").onclick=()=>modal(`<h2>Nouvel Agent</h2><form id="agentForm"><label>Nom<input name="full_name" required></label><label>E-mail<input name="email" type="email" required></label><label>Téléphone<input name="phone"></label><label>Mot de passe initial<input name="password" type="password" minlength="12" required></label><button class="btn primary full">Créer</button></form>`);document.querySelectorAll(".toggle-agent").forEach(b=>b.onclick=()=>postSaveUser(b.dataset.id,b.dataset.act));document.querySelectorAll(".del-agent").forEach(b=>b.onclick=()=>confirmBox("Supprimer cet Agent ?",()=>post("/api/save",{entity:"user",action:"delete",record:{id:b.dataset.id}})));document.querySelectorAll(".reset-agent").forEach(b=>b.onclick=()=>resetModal(b.dataset.id,null,false));document.querySelectorAll(".reset-request").forEach(b=>b.onclick=()=>resetModal(b.dataset.id,b.dataset.rid,false))}
document.addEventListener("submit",async e=>{if(e.target.id==="agentForm"){e.preventDefault();try{await post("/api/save",{entity:"user",action:"create",record:fd(e.target)});closeModal();await reload();users();toast("Agent créé")}catch(x){toast(x.message,true)}}});
async function postSaveUser(id,action){try{await post("/api/save",{entity:"user",action,record:{id}});await reload();users();toast("Compte mis à jour")}catch(x){toast(x.message,true)}}
function reports(){const mat=S.data.expenses.reduce((a,x)=>a+Number(x.total_price),0),lab=S.data.labor.reduce((a,x)=>a+Number(x.amount),0);const by=S.data.trades.map(t=>({name:t.name,m:S.data.expenses.filter(x=>x.trade_id===t.id).reduce((a,x)=>a+Number(x.total_price),0),l:S.data.labor.filter(x=>x.trade_id===t.id).reduce((a,x)=>a+Number(x.amount),0)}));$("#content").innerHTML=`<div class="kpis">${kpi("Matériaux",cash(mat))}${kpi("Main-d'œuvre",cash(lab))}${kpi("Total",cash(mat+lab))}</div><div class="panel"><div class="panelhead"><h2>Bilan par métier</h2><button onclick="printA4('Bilan par métier','Rapport de gestion',this.closest('.panel').querySelector('.tablewrap')?.outerHTML||'', 'landscape')" class="btn secondary">PDF A4</button></div>${table(["Métier","Matériaux","Main-d'œuvre","Total"],by.map(x=>`<tr><td>${esc(x.name)}</td><td class="money">${cash(x.m)}</td><td class="money">${cash(x.l)}</td><td class="money"><strong>${cash(x.m+x.l)}</strong></td></tr>`))}</div>`}
function enterHeader(){
  if(!S.session)return;
  const user=S.session.user||{},company=S.session.company||null;
  const userBadge=$("#userBadge"),planBadge=$("#planBadge"),pageSub=$("#pageSub"),appBrand=$("#appBrand");
  if(userBadge)userBadge.textContent=`${user.full_name||"Utilisateur"} · ${user.role||""}`;
  if(planBadge)planBadge.textContent=company?`${String(company.plan||"free").toUpperCase()} · ${df(company.plan_expires_at)}`:"SUPER ADMIN";
  if(pageSub)pageSub.textContent=company?.name||"Administration générale";
  if(appBrand){
    const mark=appBrand.querySelector(".brandmark");
    const title=appBrand.querySelector("strong");
    if(title)title.textContent=company?.name||"GLOBAL BT";
    if(mark){
      const logo=companyCustomLogo();
      if(logo){mark.classList.add("has-logo");mark.innerHTML=`<img src="${esc(logo)}" alt="Logo entreprise">`;}
      else{mark.classList.remove("has-logo");mark.textContent="GBT";}
    }
  }
}
function paidPlanActive(){const c=S.session?.company;return !!c&&["standard","business"].includes(String(c.plan||"").toLowerCase())&&Date.parse(c.plan_expires_at)>Date.now()}
function pendingSubscriptionRequest(){return (S.data?.subscriptionRequests||[]).find(x=>x.status==="pending")||null}
function pendingClosureRequest(){return (S.data?.closureRequests||[]).find(x=>x.status==="pending")||null}
function settings(){
  const c=S.session.company,u=S.session.user,admin=u.role==="admin",plan=String(c.plan||"free").toLowerCase(),paidActive=paidPlanActive(),pending=pendingSubscriptionRequest(),closurePending=pendingClosureRequest();
  const subscriptionAction=!admin
    ?`<div class="notice">La gestion de l’abonnement est réservée à l’Administrateur de l’entreprise.</div>`
    :paidActive
      ?`<div class="subscription-lock"><strong>✓ Abonnement ${esc(plan.toUpperCase())} actif</strong><span>À l’expiration, le compte bascule automatiquement sur Free pendant 10 jours à compter de la date d’expiration.</span></div>`
      :pending
        ?`<div class="subscription-pending"><strong>⏳ Demande en attente</strong><span>${esc(pending.requested_plan.toUpperCase())} · envoyée le ${df(pending.created_at)}. Le support doit la traiter avant toute nouvelle demande.</span></div>`
        :`<button id="activateSubscription" class="btn gold subscription-main-btn">Activer mon abonnement</button>`;
  const closureAction=!admin
    ?`<span class="muted">Seul l’Administrateur peut transmettre une demande de fermeture.</span>`
    :closurePending
      ?`<div class="subscription-pending"><strong>⏳ Demande de fermeture en attente</strong><span>Envoyée au support le ${df(closurePending.created_at)}. Le compte reste actif jusqu’au traitement de la demande.</span></div>`
      :`<button id="requestClosureBtn" class="btn danger">Demander la fermeture du compte</button>`;
  $("#content").innerHTML=`<div class="settings-pro">
    <div class="panel settings-account-card"><div class="settings-card-icon">🏢</div><div><h2>Compte entreprise</h2><p><strong>${esc(c.name)}</strong><br>${esc(u.full_name)} · ${esc(u.email)}</p>${admin?`<button id="myAccountBtn" class="btn primary">Mon compte</button>`:`<span class="muted">Modification réservée à l’Administrateur.</span>`}</div></div>
    <div class="panel settings-subscription-card"><div class="panelhead"><div><h2>Abonnement</h2><p class="muted">Gérez votre formule GLOBAL BT.</p></div><span class="plan-pill ${esc(plan)}">${esc(plan.toUpperCase())}</span></div><div class="subscription-summary"><span>Expiration</span><strong>${df(c.plan_expires_at)}</strong></div><div class="notice">Free : 10 jours · 0 FCFA<br>Standard : 30 jours · 2 100 FCFA<br>Business : 365 jours · 20 600 FCFA<br><strong>Après expiration d’un abonnement payant :</strong> passage automatique en Free pendant 10 jours à compter de cette date.</div>${subscriptionAction}</div>
    <div class="panel settings-security-card"><h2>Sécurité</h2><p class="muted">Modifiez le mot de passe de l’Administrateur connecté.</p><button id="changePwd" class="btn secondary">Changer le mot de passe</button></div>
    <div class="panel settings-closure-card"><div class="settings-danger-icon">!</div><div><h2>Fermeture du compte</h2><p class="muted">L’entreprise peut demander la fermeture de son espace en contactant le support. La demande est protégée par le mot de passe Administrateur et doit comporter un motif.</p>${closureAction}</div></div>
  </div>`;
  if($("#myAccountBtn"))$("#myAccountBtn").onclick=openMyAccount;
  $("#changePwd").onclick=changePassword;
  if($("#activateSubscription"))$("#activateSubscription").onclick=openSubscriptionActivation;
  if($("#requestClosureBtn"))$("#requestClosureBtn").onclick=requestAccountClosure;
}
function requestAccountClosure(){
  if(S.session?.user?.role!=="admin")return toast("Demande réservée à l’Administrateur.",true);
  if(pendingClosureRequest())return toast("Une demande de fermeture est déjà en attente.",true);
  adminGate("Accès sécurisé · fermeture du compte",async adminPassword=>{
    await post("/api/save",{entity:"account_closure",action:"verify",record:{admin_password:adminPassword}});
    closeModal();
    openAccountClosureForm(adminPassword);
  });
}
function openAccountClosureForm(adminPassword){
  modal(`<div class="closure-modal"><div class="modal-pro-head closure-head"><div><small>SUPPORT GLOBAL BT</small><h2>Demande de fermeture du compte</h2><p>Votre compte ne sera pas fermé automatiquement. La demande sera transmise au support pour traitement.</p></div><span class="modal-pro-icon">!</span></div><div class="closure-warning"><strong>Action sensible</strong><span>Les données et l’accès de l’entreprise restent disponibles tant que le support n’a pas traité la demande.</span></div><form id="accountClosureForm"><label>Motif de la demande<textarea name="reason" required minlength="5" maxlength="1500" rows="6" placeholder="Expliquez la raison de votre demande de fermeture..."></textarea></label><div class="support-info">Demande initiée par <strong>${esc(S.session.user.full_name||"Administrateur")}</strong> pour <strong>${esc(S.session.company?.name||"l’entreprise")}</strong>.</div><div class="modal-form-actions"><button type="button" id="cancelClosure" class="btn secondary">Annuler</button><button class="btn danger">Envoyer la demande au support</button></div></form></div>`);
  $("#cancelClosure").onclick=closeModal;
  $("#accountClosureForm").onsubmit=async e=>{e.preventDefault();try{await post("/api/save",{entity:"account_closure",action:"create",record:{reason:e.target.reason.value,admin_password:adminPassword}});await reload();closeModal();settings();toast("Demande de fermeture envoyée au support")}catch(x){toast(x.message,true)}finally{releaseForm(e.target)}};
}
function openMyAccount(){
  const c=S.session.company,u=S.session.user;if(u.role!=="admin")return toast("Modification réservée à l’Administrateur.",true);
  const canLogo=paidPlanActive(),logo=companyCustomLogo();
  const logoBlock=canLogo
    ?`<h3 class="span2 account-separator">Logo de l’entreprise</h3><div class="span2 company-logo-editor"><div id="companyLogoPreview" class="company-logo-preview">${logo?`<img src="${esc(logo)}" alt="Logo entreprise">`:`<span class="brandmark logo-system-preview">GBT</span>`}</div><div class="company-logo-controls"><label>Ajouter / remplacer le logo<input id="companyLogoInput" name="company_logo" type="file" accept="image/jpeg,image/png,image/webp"></label><small>Réservé aux abonnements Standard et Business actifs. Formats : JPG, PNG ou WebP. L’image est automatiquement optimisée.</small>${logo?`<button type="button" id="removeCompanyLogo" class="btn secondary small">Retirer mon logo</button>`:""}</div></div>`
    :`<h3 class="span2 account-separator">Logo de l’entreprise</h3><div class="span2 logo-free-lock"><span class="brandmark logo-system-preview">GBT</span><div><strong>Logo GLOBAL BT prédéfini</strong><p>La personnalisation du logo est disponible uniquement avec un abonnement Standard ou Business actif. La formule Free conserve automatiquement le logo du système.</p></div></div>`;
  modal(`<div class="account-modal"><div class="modal-pro-head"><div><small>PARAMÈTRES</small><h2>Mon compte</h2><p>Identité, coordonnées et informations légales utilisées dans les documents officiels.</p></div><span class="modal-pro-icon">🏢</span></div><form id="accountForm" class="formgrid account-form"><h3 class="span2">Entreprise</h3><label>Nom de l’entreprise<input name="company_name" value="${esc(c.name||"")}" required maxlength="180"></label><label>Téléphone entreprise<input name="company_phone" value="${esc(c.phone||u.phone||"")}" maxlength="50"></label><label>E-mail entreprise<input name="company_email" type="email" value="${esc(c.email||u.email||"")}" maxlength="180"></label><label>Ville<input name="city" value="${esc(c.city||"")}" maxlength="120"></label><label class="span2">Adresse<input name="address" value="${esc(c.address||"")}" maxlength="240"></label><label class="span2">Slogan de l’entreprise<input name="slogan" value="${esc(c.slogan||"")}" maxlength="220" placeholder="Ex. La qualité, notre engagement"></label>${logoBlock}<h3 class="span2 account-separator">Informations légales</h3><label>Compte contribuable<input name="taxpayer_account" value="${esc(c.taxpayer_account||"")}" maxlength="120"></label><label>RCCM<input name="rccm" value="${esc(c.rccm||"")}" maxlength="120"></label><label class="span2">Capital social (FCFA)<input name="capital" type="number" min="0" step="1" value="${Number(c.capital||0)}"></label><h3 class="span2 account-separator">Administrateur</h3><label>Nom et prénoms<input name="admin_name" value="${esc(u.full_name||"")}" required maxlength="160"></label><label>Téléphone Administrateur<input name="admin_phone" value="${esc(u.phone||"")}" maxlength="50"></label><label class="span2">E-mail de connexion<input name="admin_email" type="email" value="${esc(u.email||"")}" required maxlength="180"></label><div class="span2 modal-form-actions"><button type="button" id="cancelAccount" class="btn secondary">Annuler</button><button class="btn primary">Enregistrer les modifications</button></div></form></div>`);
  $("#cancelAccount").onclick=closeModal;
  const form=$("#accountForm"),input=$("#companyLogoInput"),preview=$("#companyLogoPreview"),remove=$("#removeCompanyLogo");
  if(input)input.onchange=async()=>{const f=input.files?.[0];if(!f)return;try{const data=await normalizeCompanyLogo(f);form.dataset.pendingLogo=data;if(preview)preview.innerHTML=`<img src="${data}" alt="Aperçu du logo">`;form.dataset.removeLogo="0"}catch(err){input.value="";toast(err.message,true)}};
  if(remove)remove.onclick=()=>{form.dataset.removeLogo="1";delete form.dataset.pendingLogo;if(input)input.value="";if(preview)preview.innerHTML=`<span class="brandmark logo-system-preview">GBT</span>`;remove.classList.add("hidden")};
  form.onsubmit=async e=>{e.preventDefault();try{const record=fd(e.target);delete record.company_logo;if(e.target.dataset.pendingLogo)record.logo_data=e.target.dataset.pendingLogo;if(e.target.dataset.removeLogo==="1")record.logo_remove=true;await post("/api/save",{entity:"account",action:"update",record});S.session=await api("/api/session");await reload();closeModal();enterHeader();settings();toast("Informations du compte mises à jour")}catch(x){toast(x.message,true)}finally{releaseForm(e.target)}};
}
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
function superCompanies(){
  const closureRequests=S.data.closureRequests||[],closureLabel=s=>s==="pending"?"En attente":s==="resolved"?"Traitée":"Rejetée";
  const closurePanel=`<div class="panel"><div class="panelhead"><div><h2>Demandes de fermeture de compte</h2><p class="muted">Demandes sécurisées transmises par les Administrateurs des entreprises.</p></div><span class="pending-count">${closureRequests.filter(x=>x.status==="pending").length} en attente</span></div>${closureRequests.length?table(["Date","Entreprise","Administrateur","Motif","Statut","Actions"],closureRequests.map(x=>`<tr><td>${df(x.created_at)}</td><td><strong>${esc(x.company_name||"")}</strong></td><td>${esc(x.requester_name||x.requester_email||"")}</td><td class="closure-reason-cell">${esc(x.reason||"")}</td><td><span class="status ${esc(x.status)}">${esc(closureLabel(x.status))}</span>${x.support_note?`<br><small>${esc(x.support_note)}</small>`:""}</td><td>${x.status==="pending"?`<div class="actions"><button class="btn small secondary resolve-closure" data-id="${x.id}">Marquer traitée</button><button class="btn small danger reject-closure" data-id="${x.id}">Rejeter</button></div>`:"—"}</td></tr>`)):`<div class="empty"><strong>Aucune demande de fermeture.</strong></div>`}</div>`;
  $("#content").innerHTML=`${closurePanel}<div class="panel"><div class="panelhead"><h2>Entreprises</h2><button id="newCompany" class="btn primary">+ Nouvelle entreprise</button></div>${table(["Entreprise","Plan","Expiration","Statut","Actions"],S.data.companies.map(x=>`<tr><td>${esc(x.name)}</td><td><select class="plan-choice" data-id="${x.id}"><option value="free" ${x.plan==="free"?"selected":""}>Free · 10 jours</option><option value="standard" ${x.plan==="standard"?"selected":""}>Standard · 30 jours</option><option value="business" ${x.plan==="business"?"selected":""}>Business · 365 jours</option></select></td><td>${df(x.plan_expires_at)}</td><td><span class="status ${x.status}">${esc(x.status)}</span></td><td><div class="actions"><button class="btn small secondary set-plan" data-id="${x.id}">Appliquer le plan</button><button class="btn small secondary toggle-company" data-id="${x.id}" data-act="${x.status==="active"?"disable":"activate"}">${x.status==="active"?"Désactiver":"Activer"}</button><button class="btn small danger del-company" data-id="${x.id}">Supprimer</button></div></td></tr>`))}</div>`;
  $("#newCompany").onclick=()=>modal(`<h2>Nouvelle entreprise</h2><form id="companyForm" class="formgrid"><label>Entreprise<input name="name" required></label><label>Ville<input name="city"></label><label>Plan<select name="plan"><option value="free">Free · 10 jours · 0 FCFA</option><option value="standard">Standard · 30 jours · 2 100 FCFA</option><option value="business">Business · 365 jours · 20 600 FCFA</option></select></label><label>Nom Administrateur<input name="admin_name" required></label><label>E-mail Administrateur<input name="admin_email" type="email" required></label><label>Téléphone<input name="admin_phone"></label><label class="span2">Mot de passe initial<input name="admin_password" type="password" minlength="12" required></label><button class="btn primary span2">Créer</button></form>`);
  document.querySelectorAll(".set-plan").forEach(b=>b.onclick=()=>{const sel=document.querySelector(`.plan-choice[data-id="${b.dataset.id}"]`);confirmBox("Changer le plan et redémarrer sa durée ?",()=>post("/api/save",{entity:"company",action:"set_plan",record:{id:b.dataset.id,plan:sel?.value||"free"}}))});
  document.querySelectorAll(".toggle-company").forEach(b=>b.onclick=()=>confirmBox("Modifier le statut de cette entreprise ?",()=>post("/api/save",{entity:"company",action:b.dataset.act,record:{id:b.dataset.id}})));
  document.querySelectorAll(".del-company").forEach(b=>b.onclick=()=>confirmBox("Supprimer logiquement cette entreprise ?",()=>post("/api/save",{entity:"company",action:"delete",record:{id:b.dataset.id}})));
  document.querySelectorAll(".resolve-closure").forEach(b=>b.onclick=()=>accountClosureDecision(b.dataset.id,"resolve"));
  document.querySelectorAll(".reject-closure").forEach(b=>b.onclick=()=>accountClosureDecision(b.dataset.id,"reject"));
}
function accountClosureDecision(id,action){const title=action==="resolve"?"Marquer la demande comme traitée":"Rejeter la demande de fermeture",button=action==="resolve"?"Confirmer le traitement":"Confirmer le rejet";modal(`<h2>${title}</h2><p class="muted">Cette action traite la demande du support mais ne supprime pas automatiquement l’entreprise.</p><form id="closureDecisionForm"><label>Note support<textarea name="support_note" maxlength="500"></textarea></label><button class="btn ${action==="resolve"?"primary":"danger"} full">${button}</button></form>`);$("#closureDecisionForm").onsubmit=async e=>{e.preventDefault();try{await post("/api/save",{entity:"account_closure",action,record:{id,support_note:e.target.support_note.value}});await reload();closeModal();superCompanies();toast(action==="resolve"?"Demande marquée comme traitée":"Demande rejetée")}catch(x){toast(x.message,true)}finally{releaseForm(e.target)}}}
document.addEventListener("submit",async e=>{if(e.target.id==="companyForm"){e.preventDefault();try{await post("/api/save",{entity:"company",action:"create",record:fd(e.target)});closeModal();await reload();superCompanies();toast("Entreprise créée")}catch(x){toast(x.message,true)}}});
function superMembers(){$("#content").innerHTML=`<div class="panel"><h2>Tous les membres</h2>${table(["Nom","Entreprise","E-mail","Rôle","Statut","Actions"],S.data.users.map(x=>`<tr><td>${esc(x.full_name)}</td><td>${esc(x.company_name||"Administration")}</td><td>${esc(x.email)}</td><td>${esc(x.role)}</td><td><span class="status ${x.status}">${esc(x.status)}</span><br><small>${Number(x.credential_ready)?"Accès prêt":"Mot de passe à réinitialiser"}</small></td><td>${x.role!=="superadmin"?`<div class="actions"><button class="btn small secondary reset-member" data-id="${x.id}">Mot de passe</button><button class="btn small secondary toggle-member" data-id="${x.id}" data-act="${x.status==="active"?"disable":"activate"}">${x.status==="active"?"Désactiver":"Activer"}</button><button class="btn small danger del-member" data-id="${x.id}">Supprimer</button></div>`:"Compte protégé"}</td></tr>`))}</div>`;document.querySelectorAll(".reset-member").forEach(b=>b.onclick=()=>resetModal(b.dataset.id,null,true));document.querySelectorAll(".toggle-member").forEach(b=>b.onclick=()=>superUserAction(b.dataset.id,b.dataset.act));document.querySelectorAll(".del-member").forEach(b=>b.onclick=()=>confirmBox("Supprimer ce membre ?",()=>post("/api/save",{entity:"user",action:"delete",record:{id:b.dataset.id}})))}
async function superUserAction(id,action){try{await post("/api/save",{entity:"user",action,record:{id}});await reload();superMembers();toast("Compte mis à jour")}catch(x){toast(x.message,true)}}
function resetModal(id,rid,superA){modal(`<h2>Réinitialiser le mot de passe</h2><form id="resetDirect"><label>Nouveau mot de passe temporaire<input name="new_password" type="password" minlength="12" required></label><button class="btn primary full">Réinitialiser</button></form>`);$("#resetDirect").onsubmit=async e=>{e.preventDefault();try{await post("/api/save",{entity:"user",action:"reset_password",record:{id,new_password:e.target.new_password.value,reset_request_id:rid||null}});closeModal();await reload();render();toast("Mot de passe réinitialisé")}catch(x){toast(x.message,true)}}}
function superSubscriptions(){const requests=S.data.subscriptionRequests||[];const statusLabel=s=>s==="pending"?"En attente":s==="approved"?"Activée":"Rejetée";$("#content").innerHTML=`<div class="panel"><div class="panelhead"><div><h2>Demandes d’activation</h2><p class="muted">Paiements transmis par les Administrateurs pour vérification.</p></div><span class="pending-count">${requests.filter(x=>x.status==="pending").length} en attente</span></div>${table(["Date","Entreprise","Formule","Téléphone paiement","ID transaction","Statut","Actions"],requests.map(x=>`<tr><td>${df(x.created_at)}</td><td><strong>${esc(x.company_name)}</strong><br><small>${esc(x.requester_name||x.requester_email||"")}</small></td><td><span class="plan-pill ${esc(x.requested_plan)}">${esc(String(x.requested_plan||"").toUpperCase())}</span></td><td>${esc(x.payment_phone)}</td><td><code class="transaction-code">${esc(x.transaction_id)}</code></td><td><span class="status ${esc(x.status)}">${esc(statusLabel(x.status))}</span>${x.support_note?`<br><small>${esc(x.support_note)}</small>`:""}</td><td>${x.status==="pending"?`<div class="actions"><button class="btn small primary approve-subscription" data-id="${x.id}">Activer</button><button class="btn small danger reject-subscription" data-id="${x.id}">Rejeter</button></div>`:"—"}</td></tr>`))}</div><div class="panel"><h2>Abonnements des entreprises</h2><div class="notice">Free : 10 jours · 0 FCFA &nbsp;|&nbsp; Standard : 30 jours · 2 100 FCFA &nbsp;|&nbsp; Business : 365 jours · 20 600 FCFA.</div>${table(["Entreprise","Plan","Début","Expiration","État"],S.data.companies.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.plan)}</td><td>${df(x.plan_started_at)}</td><td>${df(x.plan_expires_at)}</td><td>${Date.parse(x.plan_expires_at)>Date.now()?"Valide":"Expiré"}</td></tr>`))}</div>`;document.querySelectorAll(".approve-subscription").forEach(b=>b.onclick=()=>subscriptionDecision(b.dataset.id,"approve"));document.querySelectorAll(".reject-subscription").forEach(b=>b.onclick=()=>subscriptionDecision(b.dataset.id,"reject"))}
function subscriptionDecision(id,action){const title=action==="approve"?"Activer l’abonnement":"Rejeter la demande",button=action==="approve"?"Confirmer l’activation":"Confirmer le rejet";modal(`<h2>${title}</h2><p class="muted">Vous pouvez ajouter une note de traitement.</p><form id="subscriptionDecisionForm"><label>Note support<textarea name="support_note" maxlength="500"></textarea></label><button class="btn ${action==="approve"?"primary":"danger"} full">${button}</button></form>`);$("#subscriptionDecisionForm").onsubmit=async e=>{e.preventDefault();try{await post("/api/save",{entity:"subscription_request",action,record:{id,support_note:e.target.support_note.value}});await reload();closeModal();superSubscriptions();toast(action==="approve"?"Abonnement activé":"Demande rejetée")}catch(x){toast(x.message,true)}finally{releaseForm(e.target)}}}
function superResets(){$("#content").innerHTML=`<div class="panel"><h2>Demandes Administrateurs</h2>${table(["Date","Membre","Entreprise","E-mail","Statut","Action"],S.data.resets.map(x=>`<tr><td>${df(x.created_at)}</td><td>${esc(x.full_name||"")}</td><td>${esc(x.company_name||"")}</td><td>${esc(x.email)}</td><td>${esc(x.status)}</td><td>${x.status==="pending"?`<div class="actions"><button class="btn small secondary reset-request-super" data-id="${x.user_id}" data-rid="${x.id}">Réinitialiser</button><button class="btn small danger reject-reset" data-id="${x.id}">Rejeter</button></div>`:"—"}</td></tr>`))}</div>`;document.querySelectorAll(".reset-request-super").forEach(b=>b.onclick=()=>resetModal(b.dataset.id,b.dataset.rid,true));document.querySelectorAll(".reject-reset").forEach(b=>b.onclick=()=>confirmBox("Rejeter la demande ?",()=>post("/api/save",{entity:"reset",action:"reject",record:{id:b.dataset.id}})))}
function superAudit(){$("#content").innerHTML=`<div class="panel"><div class="panelhead"><h2>Journal des actions sensibles</h2><button id="v41PrintAudit" class="btn secondary">PDF A4</button></div>${table(["Date","Acteur","Entreprise","Action","Cible","IP"],S.data.logs.map(x=>`<tr><td>${df(x.created_at)}</td><td>${esc(x.actor_name||"Système")}</td><td>${esc(x.company_name||"—")}</td><td><strong>${esc(x.action)}</strong></td><td>${esc(x.target_type||"")} ${esc(x.target_id||"")}</td><td>${esc(x.ip||"")}</td></tr>`))}</div>`;$("#v41PrintAudit").onclick=()=>printA4("Journal des actions sensibles","Super Administration",`<table><tr><th>Date</th><th>Acteur</th><th>Entreprise</th><th>Action</th><th>Cible</th><th>IP</th></tr>${S.data.logs.map(x=>`<tr><td>${df(x.created_at)}</td><td>${esc(x.actor_name||"Système")}</td><td>${esc(x.company_name||"—")}</td><td>${esc(x.action)}</td><td>${esc(x.target_type||"")} ${esc(x.target_id||"")}</td><td>${esc(x.ip||"")}</td></tr>`).join("")}</table>`,"landscape",{totalLabel:"Total actions",total:S.data.logs.length})}



/* ===== V27 PROJETS CENTRALISÉS ===== */
function nav(){
  const superA=S.session.user.role==="superadmin",admin=S.session.user.role==="admin";
  const n=superA?[["home","Accueil"],["super","Tableau de bord"],["companies","Entreprises"],["members","Membres"],["subscriptions","Abonnements"],["resets","Mots de passe"],["audit","Journal"]]:[["home","Accueil"],["dashboard","Tableau de bord"],["projects","Projets"],["reports","Rapports"],...(admin?[["users","Utilisateurs"]]:[]),["settings","Paramètres"]];
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

function v36ProjectPage(projectId,initialView="suppliers"){
  if(initialView==="trades")initialView="works";
  if(initialView==="expenses")initialView="materials";
  if(!["suppliers","works","materials","finance"].includes(initialView))initialView="suppliers";
  const p=S.data.projects.find(x=>x.id===projectId);if(!p)return projects();
  S.currentProjectId=projectId;S.currentProjectView=initialView;
  const trades=(S.data.trades||[]).filter(x=>x.project_id===projectId);
  const expenses=(S.data.expenses||[]).filter(x=>x.project_id===projectId);
  const suppliers=(S.data.projectSuppliers||[]).filter(x=>x.project_id===projectId);
  const payments=(S.data.payments||[]).filter(x=>x.project_id===projectId);
  const materialTotal=expenses.reduce((a,x)=>a+Number(x.total_price||0),0);
  const laborTotal=trades.reduce((a,x)=>a+projectOuvrageLabor(projectId,x),0);
  const paymentTotal=payments.reduce((a,x)=>a+Number(x.amount||0),0);
  const totalExpense=materialTotal+laborTotal,totalRemaining=Math.max(0,totalExpense-paymentTotal);
  const updated=df(p.updated_at||p.created_at||"");
  const pages={suppliers:0,works:0,materials:0},pageSize=8;

  $("#content").innerHTML=`
    <section class="project-page-pro v47-project-finance">
      <div class="project-page-toolbar">
        <button id="projectBack" class="btn secondary">← Retour aux projets</button>
        <div class="project-page-titlebar"><span class="eyebrow">ESPACE PROJET</span><span class="project-page-update">Mis à jour le ${esc(updated)}</span></div>
      </div>
      <div class="project-page-hero">
        <div class="project-page-identity"><div class="project-page-icon">▥</div><div><span class="project-code">${esc(p.project_number||"PRJ")}</span><h1>${esc(p.name)}</h1><p>⌖ ${esc(p.location||"Localité non renseignée")}</p><span class="status">${esc(statusLabel(p.status))}</span></div></div>
        <div class="project-page-kpis"><div class="project-page-kpi"><small>Dépenses totales</small><strong>${cash(totalExpense)}</strong></div><div class="project-page-kpi gold"><small>Versements</small><strong>${cash(paymentTotal)}</strong></div><div class="project-page-kpi blue"><small>Reste à payer</small><strong>${cash(totalRemaining)}</strong></div></div>
      </div>
      <div class="project-page-tabs v47-project-tabs">
        <button class="project-page-tab ${initialView==="suppliers"?"active":""}" data-view="suppliers">Fournisseurs de matériaux <b>${suppliers.length}</b></button>
        <button class="project-page-tab ${initialView==="works"?"active":""}" data-view="works">Ouvrage <b>${trades.length}</b></button>
        <button class="project-page-tab ${initialView==="materials"?"active":""}" data-view="materials">Matériaux fournis <b>${expenses.length}</b></button>
        <button class="project-page-tab ${initialView==="finance"?"active":""}" data-view="finance">État financier</button>
      </div>
      <div id="projectPageContent" class="project-page-content"></div>
    </section>`;
  $("#projectBack").onclick=()=>{S.currentProjectId=null;projects()};
  const content=$("#projectPageContent"),tabs=[...document.querySelectorAll(".project-page-tab[data-view]")];
  const pager=(view,total)=>{const count=Math.max(1,Math.ceil(total/pageSize)),page=Math.min(pages[view]||0,count-1);pages[view]=page;if(count<=1)return "";return `<div class="project-page-pager"><button class="btn small secondary project-page-prev" ${page===0?"disabled":""}>←</button><span>Page ${page+1} / ${count}</span><button class="btn small secondary project-page-next" ${page===count-1?"disabled":""}>→</button></div>`};
  const slice=(view,arr)=>arr.slice((pages[view]||0)*pageSize,(pages[view]||0)*pageSize+pageSize);
  const bindPager=(view,total)=>{const max=Math.max(0,Math.ceil(total/pageSize)-1);content.querySelector(".project-page-prev")?.addEventListener("click",()=>{pages[view]=Math.max(0,(pages[view]||0)-1);show(view)});content.querySelector(".project-page-next")?.addEventListener("click",()=>{pages[view]=Math.min(max,(pages[view]||0)+1);show(view)})};
  const supplierPurchased=id=>expenses.filter(x=>x.supplier_id===id).reduce((a,x)=>a+Number(x.total_price||0),0);
  const supplierPaid=id=>projectTargetPayments(projectId,"supplier",id);
  const workPaid=id=>projectTargetPayments(projectId,"ouvrage",id);
  const supplierOptions=selected=>`<option value="">— Sélectionner —</option>`+suppliers.map(x=>`<option value="${esc(x.supplier_id)}" ${x.supplier_id===selected?"selected":""}>${esc(x.supplier_name||"")}</option>`).join("");
  const workOptions=selected=>`<option value="">— Sélectionner —</option>`+trades.map(x=>`<option value="${esc(x.id)}" ${x.id===selected?"selected":""}>${esc((x.provider_name?x.provider_name+" — ":"")+(x.phase||"")+" / "+(x.name||""))}</option>`).join("");
  const totalRow=(cols,label,cells)=>`<tr class="project-total-row"><td colspan="${cols}"><strong>${esc(label)}</strong></td>${cells.map(x=>`<td class="money"><strong>${x}</strong></td>`).join("")}<td></td></tr>`;

  const printSupplier=sp=>{
    const mats=expenses.filter(x=>x.supplier_id===sp.supplier_id),pays=payments.filter(x=>x.target_type==="supplier"&&x.target_id===sp.supplier_id),purchased=supplierPurchased(sp.supplier_id),paid=supplierPaid(sp.supplier_id),remain=Math.max(0,purchased-paid);
    const body=`<table><tr><th>Domaine / spécialité</th><th>Nom</th><th>Contact</th><th>Localisation</th><th>Valeur totale achetée</th><th>Versements reçus</th><th>Reste à payer</th></tr><tr><td>${esc(sp.specialty||"—")}</td><td>${esc(sp.supplier_name||"—")}</td><td>${esc(sp.phone||"—")}</td><td>${esc(sp.city||"—")}</td><td class="money">${cash(purchased)}</td><td class="money">${cash(paid)}</td><td class="money">${cash(remain)}</td></tr></table><h3>Matériaux fournis</h3><table><tr><th>Date</th><th>Désignation</th><th>Destination / ouvrage</th><th>Quantité</th><th>Prix unité</th><th>Prix total</th></tr>${mats.map(x=>{const t=trades.find(t=>t.id===x.trade_id);return `<tr><td>${df(x.expense_date)}</td><td>${esc(x.description||"")}</td><td>${esc(t?`${t.phase||""} / ${t.name||""}`:(x.trade_name||"—"))}</td><td>${Number(x.quantity||0).toLocaleString("fr-FR")}${x.unit?` ${esc(x.unit)}`:""}</td><td class="money">${cash(x.unit_price)}</td><td class="money">${cash(x.total_price)}</td></tr>`}).join("")||`<tr><td colspan="6">Aucun matériau fourni</td></tr>`}</table><h3>Versements</h3><table><tr><th>Date</th><th>Mode</th><th>Référence</th><th>Montant</th></tr>${pays.map(x=>`<tr><td>${df(x.payment_date)}</td><td>${esc(x.payment_method||"—")}</td><td>${esc(x.reference||"—")}</td><td class="money">${cash(x.amount)}</td></tr>`).join("")||`<tr><td colspan="4">Aucun versement</td></tr>`}</table>`;
    printA4(`Fournisseur de matériaux : ${sp.supplier_name||""}`,p.name,body,"landscape",{info:projectPrintInfo(p),totalLabel:"Reste à payer",total:cash(remain)});
  };
  const printWork=t=>{
    const labor=projectOuvrageLabor(projectId,t),paid=workPaid(t.id),remain=Math.max(0,labor-paid),pays=payments.filter(x=>x.target_type==="ouvrage"&&x.target_id===t.id);
    const body=`<table><tr><th>Métier</th><th>Domaine / spécialité</th><th>Nom</th><th>Contact</th><th>Ville</th><th>Main-d'œuvre</th><th>Versements reçus</th><th>Reste à payer</th></tr><tr><td>${esc(t.phase||"—")}</td><td>${esc(t.name||"—")}</td><td>${esc(t.provider_name||"—")}</td><td>${esc(t.provider_contact||"—")}</td><td>${esc(t.provider_city||"—")}</td><td class="money">${cash(labor)}</td><td class="money">${cash(paid)}</td><td class="money">${cash(remain)}</td></tr></table><h3>Travaux fournis</h3><table><tr><th>Description des travaux</th></tr><tr><td>${esc(t.description||"—")}</td></tr></table><h3>Versements</h3><table><tr><th>Date</th><th>Mode</th><th>Référence</th><th>Montant</th></tr>${pays.map(x=>`<tr><td>${df(x.payment_date)}</td><td>${esc(x.payment_method||"—")}</td><td>${esc(x.reference||"—")}</td><td class="money">${cash(x.amount)}</td></tr>`).join("")||`<tr><td colspan="4">Aucun versement</td></tr>`}</table>`;
    printA4(`Ouvrage : ${t.phase||""} / ${t.name||""}`,p.name,body,"landscape",{info:projectPrintInfo(p),totalLabel:"Reste à payer",total:cash(remain)});
  };

  const printSupplierList=()=>{
    const sumPurchased=suppliers.reduce((a,x)=>a+supplierPurchased(x.supplier_id),0),sumPaid=suppliers.reduce((a,x)=>a+supplierPaid(x.supplier_id),0),sumRemain=Math.max(0,sumPurchased-sumPaid);
    const rows=suppliers.map(x=>{const bought=supplierPurchased(x.supplier_id),paid=supplierPaid(x.supplier_id),remain=Math.max(0,bought-paid);return `<tr><td>${esc(x.specialty||"—")}</td><td>${esc(x.supplier_name||"—")}</td><td>${esc(x.phone||"—")}</td><td class="money">${cash(bought)}</td><td class="money">${cash(paid)}</td><td class="money">${cash(remain)}</td></tr>`}).join("")||`<tr><td>—</td><td>Aucun fournisseur</td><td>—</td><td class="money">${cash(0)}</td><td class="money">${cash(0)}</td><td class="money">${cash(0)}</td></tr>`;
    const total=`<tr><td><strong>TOTAL</strong></td><td>—</td><td>—</td><td class="money"><strong>${cash(sumPurchased)}</strong></td><td class="money"><strong>${cash(sumPaid)}</strong></td><td class="money"><strong>${cash(sumRemain)}</strong></td></tr>`;
    printA4("Liste générale des fournisseurs de matériaux",p.location||p.name,`<table><tr><th>Domaine / spécialité</th><th>Nom</th><th>Contact</th><th>Valeur totale achetée</th><th>Versement reçu</th><th>Versement restant</th></tr>${rows}${total}</table>`,"landscape",{info:projectPrintInfo(p),totalLabel:"Fournisseurs",total:suppliers.length});
  };
  const printWorkList=()=>{
    const sumLabor=trades.reduce((a,t)=>a+projectOuvrageLabor(projectId,t),0),sumPaid=trades.reduce((a,t)=>a+workPaid(t.id),0),sumRemain=Math.max(0,sumLabor-sumPaid);
    const rows=trades.map(t=>{const labor=projectOuvrageLabor(projectId,t),paid=workPaid(t.id),remain=Math.max(0,labor-paid);return `<tr><td>${esc(t.phase||"—")}</td><td>${esc(t.name||"—")}</td><td>${esc(t.provider_name||"—")}</td><td>${esc(t.provider_contact||"—")}</td><td>${esc(t.provider_city||"—")}</td><td class="money">${cash(labor)}</td><td class="money">${cash(paid)}</td><td class="money">${cash(remain)}</td></tr>`}).join("")||`<tr><td>—</td><td>—</td><td>Aucun ouvrage</td><td>—</td><td>—</td><td class="money">${cash(0)}</td><td class="money">${cash(0)}</td><td class="money">${cash(0)}</td></tr>`;
    const total=`<tr><td><strong>TOTAL</strong></td><td>—</td><td>—</td><td>—</td><td>—</td><td class="money"><strong>${cash(sumLabor)}</strong></td><td class="money"><strong>${cash(sumPaid)}</strong></td><td class="money"><strong>${cash(sumRemain)}</strong></td></tr>`;
    printA4("Liste générale des ouvrages du projet",p.location||p.name,`<table><tr><th>Métiers</th><th>Domaine / spécialité</th><th>Nom</th><th>Contact</th><th>Ville</th><th>Main-d'œuvre</th><th>Versement reçu</th><th>Versement restant</th></tr>${rows}${total}</table>`,"landscape",{info:projectPrintInfo(p),totalLabel:"Ouvrages",total:trades.length});
  };
  const printMaterialList=()=>{
    const sum=expenses.reduce((a,x)=>a+Number(x.total_price||0),0);
    const rows=expenses.map(x=>{const t=trades.find(t=>t.id===x.trade_id);return `<tr><td>${df(x.expense_date)}</td><td>${esc(x.description||"—")}</td><td>${esc(x.supplier_name||"—")}</td><td>${esc(t?`${t.phase||""} / ${t.name||""}`:(x.trade_name||"—"))}</td><td>${Number(x.quantity||0).toLocaleString("fr-FR")}${x.unit?` ${esc(x.unit)}`:""}</td><td class="money">${cash(x.unit_price)}</td><td class="money">${cash(x.total_price)}</td></tr>`}).join("")||`<tr><td>—</td><td>Aucun matériau fourni</td><td>—</td><td>—</td><td>—</td><td class="money">${cash(0)}</td><td class="money">${cash(0)}</td></tr>`;
    const total=`<tr><td><strong>TOTAL</strong></td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td class="money"><strong>${cash(sum)}</strong></td></tr>`;
    printA4("Liste générale des matériaux fournis",p.location||p.name,`<table><tr><th>Date</th><th>Désignation</th><th>Fournisseur de matériaux</th><th>Destination / ouvrage</th><th>Quantité</th><th>Prix unité</th><th>Prix total</th></tr>${rows}${total}</table>`,"landscape",{info:projectPrintInfo(p),totalLabel:"Lignes matériaux",total:expenses.length});
  };
  const printFinanceState=()=>{
    const supplierDebt=suppliers.reduce((a,x)=>a+Math.max(0,supplierPurchased(x.supplier_id)-supplierPaid(x.supplier_id)),0),workDebt=trades.reduce((a,t)=>a+Math.max(0,projectOuvrageLabor(projectId,t)-workPaid(t.id)),0);
    const history=payments.map(x=>`<tr><td>${df(x.payment_date)}</td><td>${x.target_type==="supplier"?"Fournisseur de matériaux":"Ouvrage"}</td><td>${esc(x.target_label||"—")}</td><td>${esc(x.payment_method||"—")}</td><td>${esc(x.reference||"—")}</td><td class="money">${cash(x.amount)}</td></tr>`).join("")||`<tr><td>—</td><td>—</td><td>Aucun versement</td><td>—</td><td>—</td><td class="money">${cash(0)}</td></tr>`;
    const body=`<h3>Résumé financier</h3><table><tr><th>Total des dépenses</th><th>Total des versements</th><th>Total reste à payer</th><th>Dette fournisseurs</th><th>Dette ouvrages</th></tr><tr><td class="money">${cash(totalExpense)}</td><td class="money">${cash(paymentTotal)}</td><td class="money">${cash(totalRemaining)}</td><td class="money">${cash(supplierDebt)}</td><td class="money">${cash(workDebt)}</td></tr></table><h3>Historique des versements</h3><table><tr><th>Date</th><th>Section</th><th>Bénéficiaire</th><th>Mode</th><th>Référence</th><th>Versement</th></tr>${history}<tr><td><strong>TOTAL</strong></td><td>—</td><td>—</td><td>—</td><td>—</td><td class="money"><strong>${cash(paymentTotal)}</strong></td></tr></table>`;
    printA4("État financier du projet",p.location||p.name,body,"landscape",{info:projectPrintInfo(p),totalLabel:"Reste à payer",total:cash(totalRemaining)});
  };

  const show=view=>{
    S.currentProjectView=view;tabs.forEach(b=>b.classList.toggle("active",b.dataset.view===view));
    if(view==="suppliers"){
      const rows=slice(view,suppliers),sumPurchased=suppliers.reduce((a,x)=>a+supplierPurchased(x.supplier_id),0),sumPaid=suppliers.reduce((a,x)=>a+supplierPaid(x.supplier_id),0),sumRemain=Math.max(0,sumPurchased-sumPaid);
      const available=(S.data.suppliers||[]).filter(x=>!suppliers.some(sp=>sp.supplier_id===x.id));
      const bodyRows=rows.map(x=>{const bought=supplierPurchased(x.supplier_id),paid=supplierPaid(x.supplier_id),remain=Math.max(0,bought-paid);return `<tr><td>${esc(x.specialty||"—")}</td><td><strong>${esc(x.supplier_name||"—")}</strong></td><td>${esc(x.phone||"—")}</td><td class="money">${cash(bought)}</td><td class="money">${cash(paid)}</td><td class="money">${cash(remain)}</td><td class="v38-actions-cell"><div class="actions v38-actions"><button class="btn small secondary v47-edit-supplier" data-id="${x.supplier_id}">Modifier</button><button class="btn small secondary v47-print-supplier" data-id="${x.supplier_id}">Imprimer</button>${S.session.user.role==="admin"?`<button class="btn small danger v47-delete-supplier" data-link="${x.id}">Supprimer</button>`:""}</div></td></tr>`});
      bodyRows.push(totalRow(3,"TOTAL",[cash(sumPurchased),cash(sumPaid),cash(sumRemain)]));
      content.innerHTML=`<div class="project-page-section-head"><div><h2>Fournisseurs de matériaux</h2><p>Valeurs achetées, versements reçus et soldes calculés automatiquement.</p></div><div class="project-page-section-actions"><button id="v49PrintSuppliers" class="btn secondary">Imprimer la liste PDF A4</button><button id="v47AddSupplier" class="btn primary">+ Ajouter un fournisseur</button></div></div><div class="project-page-card v47-supplier-table">${table(["Domaine / spécialité","Nom","Contact","Valeur totale achetée","Versement reçu","Versement restant","Actions"],bodyRows)}</div>${pager(view,suppliers.length)}`;
      $("#v49PrintSuppliers").onclick=printSupplierList;
      $("#v47AddSupplier").onclick=()=>modal(`<h2>Ajouter un fournisseur de matériaux · ${esc(p.name)}</h2><form id="v36SupplierForm" data-project="${projectId}" class="formgrid"><label>Nom du fournisseur<input name="name" required></label><label>Domaine / spécialité<input name="specialty" required></label><label>Contact<input name="phone" required></label><label>Localisation<input name="city" required></label><button class="btn primary span2" type="submit">Ajouter le fournisseur</button></form>`);
      document.querySelectorAll(".v47-edit-supplier").forEach(b=>b.onclick=()=>{const x=(S.data.suppliers||[]).find(sp=>sp.id===b.dataset.id);if(!x)return;modal(`<h2>Modifier le fournisseur</h2><form id="v47SupplierEditForm" data-id="${x.id}" data-project="${projectId}" class="formgrid"><label>Nom du fournisseur<input name="name" value="${esc(x.name||"")}" required></label><label>Domaine / spécialité<input name="specialty" value="${esc(x.specialty||"")}" required></label><label>Contact<input name="phone" value="${esc(x.phone||"")}" required></label><label>Localisation<input name="city" value="${esc(x.city||"")}" required></label><button class="btn primary span2">Enregistrer</button></form>`) });
      document.querySelectorAll(".v47-print-supplier").forEach(b=>b.onclick=()=>{const x=suppliers.find(sp=>sp.supplier_id===b.dataset.id);if(x)printSupplier(x)});
      document.querySelectorAll(".v47-delete-supplier").forEach(b=>b.onclick=()=>confirmBox("Supprimer ce fournisseur de matériaux du projet ?",async()=>{await post("/api/save",{entity:"project_supplier",action:"delete",record:{id:b.dataset.link,project_id:projectId}});await reload();v36ProjectPage(projectId,"suppliers");toast("Fournisseur retiré du projet")}));
      bindPager(view,suppliers.length);
    }
    if(view==="works"){
      const rows=slice(view,trades),sumLabor=trades.reduce((a,t)=>a+projectOuvrageLabor(projectId,t),0),sumPaid=trades.reduce((a,t)=>a+workPaid(t.id),0),sumRemain=Math.max(0,sumLabor-sumPaid);
      const bodyRows=rows.map(t=>{const labor=projectOuvrageLabor(projectId,t),paid=workPaid(t.id),remain=Math.max(0,labor-paid);return `<tr><td><strong>${esc(t.phase||"—")}</strong></td><td>${esc(t.name||"—")}</td><td>${esc(t.provider_name||"—")}</td><td>${esc(t.provider_contact||"—")}</td><td>${esc(t.provider_city||"—")}</td><td class="money">${cash(labor)}</td><td class="money">${cash(paid)}</td><td class="money">${cash(remain)}</td><td class="v38-actions-cell"><div class="actions v38-actions"><button class="btn small secondary v47-edit-work" data-id="${t.id}">Modifier</button><button class="btn small secondary v47-print-work" data-id="${t.id}">Imprimer</button>${S.session.user.role==="admin"?`<button class="btn small danger v47-delete-work" data-id="${t.id}">Supprimer</button>`:""}</div></td></tr>`});
      bodyRows.push(totalRow(5,"TOTAL",[cash(sumLabor),cash(sumPaid),cash(sumRemain)]));
      content.innerHTML=`<div class="project-page-section-head"><div><h2>Ouvrages du projet</h2><p>Enregistrez directement le métier, le domaine ou la spécialité, le prestataire, la main-d'œuvre et les travaux convenus.</p></div><div class="project-page-section-actions"><button id="v49PrintWorks" class="btn secondary">Imprimer la liste PDF A4</button><button id="v47AddWork" class="btn primary">+ Ajouter un ouvrage</button></div></div><div class="project-page-card v47-work-table">${table(["Métiers","Domaine / spécialité","Nom","Contact","Localisation","Main-d'œuvre","Versement reçu","Versement restant","Actions"],bodyRows)}</div>${pager(view,trades.length)}`;
      $("#v49PrintWorks").onclick=printWorkList;
      $("#v47AddWork").onclick=()=>modal(`<h2>Ajouter un ouvrage · ${esc(p.name)}</h2>${renderProjectTradeCatalogForm(projectId)}`);
      document.querySelectorAll(".v47-edit-work").forEach(b=>b.onclick=()=>{const t=trades.find(x=>x.id===b.dataset.id);if(t)modal(`<h2>Modifier l’ouvrage</h2>${renderProjectTradeCatalogForm(projectId,t)}`)});
      document.querySelectorAll(".v47-print-work").forEach(b=>b.onclick=()=>{const t=trades.find(x=>x.id===b.dataset.id);if(t)printWork(t)});
      document.querySelectorAll(".v47-delete-work").forEach(b=>b.onclick=()=>confirmBox("Supprimer cet ouvrage du projet ?",async()=>{await post("/api/save",{entity:"trade",action:"delete",record:{id:b.dataset.id,project_id:projectId}});await reload();v36ProjectPage(projectId,"works");toast("Ouvrage supprimé")}));
      bindPager(view,trades.length);
    }
    if(view==="materials"){
      const rows=slice(view,expenses),sum=expenses.reduce((a,x)=>a+Number(x.total_price||0),0),bodyRows=rows.map(x=>{const t=trades.find(t=>t.id===x.trade_id);return `<tr><td>${df(x.expense_date)}</td><td><strong>${esc(x.description||"")}</strong></td><td>${esc(x.supplier_name||"—")}</td><td>${esc(t?`${t.phase||""} / ${t.name||""}`:(x.trade_name||"—"))}</td><td class="money">${Number(x.quantity||0).toLocaleString("fr-FR")}${x.unit?` ${esc(x.unit)}`:""}</td><td class="money">${cash(x.unit_price)}</td><td class="money">${cash(x.total_price)}</td><td class="v38-actions-cell"><div class="actions v38-actions"><button class="btn small secondary v47-edit-material" data-id="${x.id}">Modifier</button>${S.session.user.role==="admin"?`<button class="btn small danger v47-delete-material" data-id="${x.id}">Supprimer</button>`:""}</div></td></tr>`});
      bodyRows.push(`<tr class="project-total-row"><td colspan="6"><strong>TOTAL</strong></td><td class="money"><strong>${cash(sum)}</strong></td><td></td></tr>`);
      content.innerHTML=`<div class="project-page-section-head"><div><h2>Matériaux fournis</h2><p>Chaque ligne choisit un fournisseur de matériaux et un ouvrage de destination.</p></div><div class="project-page-section-actions"><button id="v49PrintMaterials" class="btn secondary">Imprimer la liste PDF A4</button><button id="v47AddMaterial" class="btn primary">+ Ajouter des matériaux</button></div></div><div class="project-page-card v47-material-table">${table(["Date","Désignation","Fournisseurs de matériaux","Destination","Quantité","Prix unité","Prix total","Actions"],bodyRows)}</div>${pager(view,expenses.length)}`;
      $("#v49PrintMaterials").onclick=printMaterialList;
      $("#v47AddMaterial").onclick=()=>{if(!suppliers.length)return toast("Ajoutez d'abord un fournisseur de matériaux au projet.",true);if(!trades.length)return toast("Ajoutez d'abord un ouvrage au projet.",true);modal(`<h2>Ajouter des matériaux · ${esc(p.name)}</h2><form id="v36ExpenseForm" data-project="${projectId}" class="formgrid"><label>Date<input name="expense_date" type="date" value="${new Date().toISOString().slice(0,10)}" required></label><label>Désignation<input name="description" required></label><label>Fournisseur de matériaux<select name="supplier_id" required>${supplierOptions("")}</select></label><label>Destination / ouvrage<select name="trade_id" required>${workOptions("")}</select></label><label>Quantité<input name="quantity" type="number" step=".01" min="0" value="1" required></label><label>Unité<input name="unit" placeholder="sac, tonne, unité..."></label><label>Prix unité<input name="unit_price" type="number" min="0" required></label><label>Référence<input name="reference"></label><button class="btn primary span2">Enregistrer</button></form>`)};
      document.querySelectorAll(".v47-edit-material").forEach(b=>b.onclick=()=>{const x=expenses.find(e=>e.id===b.dataset.id);if(!x)return;modal(`<h2>Modifier les matériaux</h2><form id="v38ExpenseEditForm" data-id="${x.id}" data-project="${projectId}" class="formgrid"><label>Date<input name="expense_date" type="date" value="${esc(x.expense_date||"")}" required></label><label>Désignation<input name="description" value="${esc(x.description||"")}" required></label><label>Fournisseur de matériaux<select name="supplier_id" required>${supplierOptions(x.supplier_id)}</select></label><label>Destination / ouvrage<select name="trade_id" required>${workOptions(x.trade_id)}</select></label><label>Quantité<input name="quantity" type="number" step=".01" min="0" value="${Number(x.quantity||0)}" required></label><label>Unité<input name="unit" value="${esc(x.unit||"")}"></label><label>Prix unité<input name="unit_price" type="number" min="0" value="${Number(x.unit_price||0)}" required></label><label>Référence<input name="reference" value="${esc(x.reference||"")}"></label><button class="btn primary span2">Enregistrer</button></form>`)});
      document.querySelectorAll(".v47-delete-material").forEach(b=>b.onclick=()=>confirmBox("Supprimer définitivement ces matériaux ?",async()=>{await post("/api/save",{entity:"expense",action:"delete",record:{id:b.dataset.id,project_id:projectId}});await reload();v36ProjectPage(projectId,"materials");toast("Matériaux supprimés")}));
      bindPager(view,expenses.length);
    }
    if(view==="finance"){
      const supplierDebt=suppliers.reduce((a,x)=>a+Math.max(0,supplierPurchased(x.supplier_id)-supplierPaid(x.supplier_id)),0),workDebt=trades.reduce((a,t)=>a+Math.max(0,projectOuvrageLabor(projectId,t)-workPaid(t.id)),0);
      const history=payments.map(x=>`<tr><td>${df(x.payment_date)}</td><td>${x.target_type==="supplier"?"Fournisseur de matériaux":"Ouvrage"}</td><td><strong>${esc(x.target_label||"—")}</strong></td><td>${esc(x.payment_method||"—")}</td><td>${esc(x.reference||"—")}</td><td class="money">${cash(x.amount)}</td></tr>`);
      history.push(`<tr class="project-total-row"><td colspan="5"><strong>TOTAL DES VERSEMENTS</strong></td><td class="money"><strong>${cash(paymentTotal)}</strong></td></tr>`);
      content.innerHTML=`<div class="project-page-section-head"><div><h2>État financier</h2><p>Résumé automatique de toutes les dépenses et de tous les versements du projet.</p></div><div class="project-page-section-actions"><button id="v49PrintFinance" class="btn secondary">Imprimer l’état financier PDF A4</button><button id="projectMakePayment" class="btn primary">Faire un paiement</button></div></div><div class="finance-summary-grid"><div class="finance-summary-card"><small>Total des dépenses</small><strong>${cash(totalExpense)}</strong><span>Matériaux ${cash(materialTotal)} + main-d'œuvre ${cash(laborTotal)}</span></div><div class="finance-summary-card"><small>Total des versements</small><strong>${cash(paymentTotal)}</strong><span>Paiements enregistrés</span></div><div class="finance-summary-card emphasis"><small>Total reste à payer</small><strong>${cash(totalRemaining)}</strong><span>Fournisseurs ${cash(supplierDebt)} + ouvrages ${cash(workDebt)}</span></div></div><div class="project-page-card"><div class="finance-history-title"><h3>Historique des versements</h3></div>${table(["Date","Section","Bénéficiaire","Mode","Référence","Versement"],history)}</div>`;
      $("#projectMakePayment").onclick=()=>openProjectPaymentModal(projectId);
      $("#v49PrintFinance").onclick=printFinanceState;
    }
  };
  tabs.forEach(b=>b.onclick=()=>show(b.dataset.view));show(initialView);
}
function projects(){
  const admin=S.session.user.role==="admin";
  let query=String(S.projectSearch||"");
  const projectMatches=x=>{
    const q=query.trim().toLowerCase();if(!q)return true;
    return [x.project_number,x.name,x.status,statusLabel(x.status)].some(v=>String(v||"").toLowerCase().includes(q));
  };
  const rowHtml=x=>`<tr class="clickable-row v28-project-row" data-id="${x.id}">
    <td class="project-number-cell"><strong>${esc(x.project_number||"—")}</strong></td>
    <td><strong>${esc(x.name)}</strong></td>
    <td>${esc(x.project_type||"—")}</td>
    <td>${esc(x.location||"—")}</td>
    <td>${esc(x.owner_name||"—")}</td>
    <td>${esc(x.manager_name||"—")}</td>
    <td class="project-dates"><span>${df(x.start_date)||"—"}</span><small>→</small><span>${df(x.end_date)||"—"}</span></td>
    <td class="center"><span class="status">${esc(statusLabel(x.status))}</span></td>
    <td class="v41-project-actions-cell"><div class="project-actions v28-actions"><button class="btn small secondary v41PrintProject" data-id="${x.id}">PDF A4</button>${admin?`<button class="btn small secondary v28Edit" data-id="${x.id}">Modifier</button><button class="btn small secondary v28Lock" data-id="${x.id}" data-act="${Number(x.locked)?'unlock':'lock'}">${Number(x.locked)?'Déverrouiller':'Verrouiller'}</button><button class="btn small secondary v28Status" data-id="${x.id}">Statut</button><button class="btn small danger v28Delete" data-id="${x.id}">Supprimer</button>`:""}</div></td>
  </tr>`;
  const visible=()=>S.data.projects.filter(projectMatches);
  $('#content').innerHTML=`<div class="panel v41-projects-panel">
    <div class="panelhead"><div><h2>Liste des projets</h2><p class="muted">Chaque nouveau projet reçoit automatiquement un numéro unique au format PRJ-AAAA-001.</p></div><div class="toolbar"><button id="v41PrintProjects" class="btn secondary">PDF A4</button>${admin?'<button id="v28NewProject" class="btn primary">+ Nouveau projet</button>':''}</div></div>
    <div class="v41-project-search"><span>⌕</span><input id="v41ProjectSearch" type="search" placeholder="Rechercher par statut, nom ou n° projet..." value="${esc(query)}"><small id="v41ProjectSearchCount">${visible().length} projet(s)</small></div>
    <div class="v41-project-table">${table(['N° projet','Nom du projet','Type','Localité',"Maître d'ouvrage",'Responsable','Date début / Date fin','Statut','Actions'],visible().map(rowHtml))}</div>
  </div>`;
  const tbody=$(".v41-project-table tbody"),counter=$("#v41ProjectSearchCount");
  const bindRows=()=>{
    document.querySelectorAll('.v28-project-row').forEach(r=>r.onclick=e=>{if(e.target.closest('button'))return;v36ProjectPage(r.dataset.id)});
    document.querySelectorAll('.v41PrintProject').forEach(b=>b.onclick=e=>{e.stopPropagation();const x=S.data.projects.find(p=>p.id===b.dataset.id);if(!x)return;const projectTrades=(S.data.trades||[]).filter(t=>t.project_id===x.id),projectSuppliers=(S.data.projectSuppliers||[]).filter(sp=>sp.project_id===x.id);const body=`<table><tr><th>N° projet</th><th>Nom du projet</th><th>Type</th><th>Localité</th></tr><tr><td><strong>${esc(x.project_number||"—")}</strong></td><td>${esc(x.name)}</td><td>${esc(x.project_type||"—")}</td><td>${esc(x.location||"—")}</td></tr></table><h3>Informations du projet</h3><table><tr><th>Maître d'ouvrage</th><th>Responsable</th><th>Date début</th><th>Date fin</th><th>Statut</th></tr><tr><td>${esc(x.owner_name||"—")}</td><td>${esc(x.manager_name||"—")}</td><td>${df(x.start_date)||"—"}</td><td>${df(x.end_date)||"—"}</td><td class="center">${printStatus(x.status)}</td></tr></table>`;printA4("Fiche projet",x.name,body,"landscape",{info:[{label:"Projet",value:x.name},{label:"Code projet",value:x.project_number||"—"},{label:"Date d’édition",value:new Date().toLocaleDateString("fr-FR")},{label:"Édité par",value:S.session.user.full_name||"Administrateur"}],totalLabel:"Métiers / Fournisseurs",total:`${projectTrades.length} / ${projectSuppliers.length}`})});
    document.querySelectorAll('.v28Edit').forEach(b=>b.onclick=e=>{e.stopPropagation();const x=S.data.projects.find(p=>p.id===b.dataset.id);if(S.session.user.role!=='admin')return toast('Modification réservée à l’Administrateur',true);modal(`<h2>Modifier le projet</h2><form id="v28ProjectEdit" data-id="${x.id}" class="formgrid"><label>N° projet<input value="${esc(x.project_number||"")}" disabled></label><label>Nom<input name="name" value="${esc(x.name)}" required></label><label>Type<input name="project_type" value="${esc(x.project_type||'')}"></label><label>Localité<input name="location" value="${esc(x.location||'')}"></label><label>Budget<input name="budget" type="number" value="${Number(x.budget||0)}"></label><label>Maître d'ouvrage<input name="owner_name" value="${esc(x.owner_name||'')}"></label><label>Responsable<input name="manager_name" value="${esc(x.manager_name||'')}"></label><label>Date début<input name="start_date" type="date" value="${esc(x.start_date||'')}"></label><label>Date fin<input name="end_date" type="date" value="${esc(x.end_date||'')}"></label><label class="span2">Description<textarea name="description">${esc(x.description||'')}</textarea></label><label class="span2">Mot de passe Administrateur<input name="admin_password" type="password" required></label><button class="btn primary span2">Enregistrer</button></form>`)});
    document.querySelectorAll('.v28Lock').forEach(b=>b.onclick=e=>{e.stopPropagation();adminGate(b.dataset.act==='lock'?'Verrouiller le projet':'Déverrouiller le projet',async pw=>{await post('/api/save',{entity:'project',action:b.dataset.act,record:{id:b.dataset.id,admin_password:pw}});closeModal();await reload();projects();toast('Projet mis à jour')})});
    document.querySelectorAll('.v28Status').forEach(b=>b.onclick=e=>{e.stopPropagation();const x=S.data.projects.find(p=>p.id===b.dataset.id);modal(`<h2>Statut du projet</h2><form id="v28StatusForm" data-id="${x.id}"><label>Statut<select name="status"><option value="preparation" ${x.status==='preparation'?'selected':''}>Préparation</option><option value="in_progress" ${x.status==='in_progress'?'selected':''}>En cours</option><option value="suspended" ${x.status==='suspended'?'selected':''}>Suspendu</option><option value="completed" ${x.status==='completed'?'selected':''}>Terminé</option><option value="closed" ${x.status==='closed'?'selected':''}>Clôturé</option></select></label><button class="btn primary full">Mettre à jour</button></form>`)});
    document.querySelectorAll('.v28Delete').forEach(b=>b.onclick=e=>{e.stopPropagation();adminGate('Supprimer le projet',async pw=>{await post('/api/save',{entity:'project',action:'delete',record:{id:b.dataset.id,admin_password:pw}});closeModal();await reload();projects();toast('Projet supprimé')})});
  };
  const refreshRows=()=>{const list=visible();tbody.innerHTML=list.map(rowHtml).join("")||`<tr><td colspan="9">Aucun projet correspondant.</td></tr>`;counter.textContent=`${list.length} projet(s)`;bindRows()};
  $("#v41ProjectSearch").oninput=e=>{query=e.target.value;S.projectSearch=query;refreshRows()};
  $("#v41PrintProjects").onclick=()=>{const list=visible();const body=`<table><tr><th>N° projet</th><th>Nom du projet</th><th>Type</th><th>Localité</th><th>Maître d'ouvrage</th><th>Responsable</th><th>Date début / Date fin</th><th>Statut</th></tr>${list.map(x=>`<tr><td class="nowrap"><strong>${esc(x.project_number||"—")}</strong></td><td>${esc(x.name)}</td><td>${esc(x.project_type||"—")}</td><td>${esc(x.location||"—")}</td><td>${esc(x.owner_name||"—")}</td><td>${esc(x.manager_name||"—")}</td><td class="nowrap">${df(x.start_date)||"—"} / ${df(x.end_date)||"—"}</td><td class="center">${printStatus(x.status)}</td></tr>`).join("")}</table>`;printA4("Liste des projets",query?`Filtre : ${query}`:"Tous les projets",body,"landscape",{info:[{label:"Document",value:"Registre des projets"},{label:"Recherche",value:query||"Aucun filtre"},{label:"Date d’édition",value:new Date().toLocaleDateString("fr-FR")},{label:"Édité par",value:S.session.user.full_name||"Administrateur"}],portfolio:query?"Projets filtrés":"Projets actifs",status:"Suivi en cours",totalLabel:"Total projets affichés",total:list.length})};
  $('#v28NewProject')?.addEventListener('click',()=>modal(`<h2>Nouveau projet</h2><div class="notice">Le numéro du projet sera généré automatiquement à l’enregistrement.</div><form id="v28ProjectCreate" class="formgrid"><label>Nom<input name="name" required></label><label>Type<input name="project_type" value="Bâtiment"></label><label>Localité<input name="location"></label><label>Budget<input name="budget" type="number" min="0"></label><label>Maître d'ouvrage<input name="owner_name"></label><label>Responsable<input name="manager_name"></label><label>Date début<input name="start_date" type="date"></label><label>Date fin<input name="end_date" type="date"></label><label class="span2">Description<textarea name="description"></textarea></label><button class="btn primary span2">Créer le projet</button></form>`));
  bindRows();
}
function reports(){const rows=S.data.projects.map(p=>{const mat=S.data.expenses.filter(x=>x.project_id===p.id).reduce((a,x)=>a+Number(x.total_price||0),0),lab=S.data.labor.filter(x=>x.project_id===p.id).reduce((a,x)=>a+Number(x.amount||0),0),total=mat+lab,b=Number(p.budget||0);return {p,mat,lab,total,b,remain:b-total,trades:S.data.trades.filter(x=>x.project_id===p.id).length,sup:(S.data.projectSuppliers||[]).filter(x=>x.project_id===p.id).length}});const t=rows.reduce((a,x)=>({b:a.b+x.b,mat:a.mat+x.mat,lab:a.lab+x.lab,total:a.total+x.total,remain:a.remain+x.remain}),{b:0,mat:0,lab:0,total:0,remain:0});$('#content').innerHTML=`<div class="kpis">${kpi('Budget total',cash(t.b))}${kpi('Matériaux',cash(t.mat))}${kpi("Main-d'œuvre",cash(t.lab))}${kpi('Coût total',cash(t.total))}${kpi('Reste',cash(t.remain))}</div><div class="panel"><div class="panelhead"><h2>Bilan général de tous les projets</h2><button id="v41PrintReports" class="btn secondary">PDF A4</button></div>${table(['N° projet','Projet','Statut','Budget','Matériaux',"Main-d'œuvre",'Total','Reste','Métiers','Fournisseurs'],rows.map(x=>`<tr><td>${esc(x.p.project_number||"—")}</td><td>${esc(x.p.name)}</td><td class="center">${printStatus(x.p.status)}</td><td class="money">${cash(x.b)}</td><td class="money">${cash(x.mat)}</td><td class="money">${cash(x.lab)}</td><td class="money">${cash(x.total)}</td><td class="money">${cash(x.remain)}</td><td>${x.trades}</td><td>${x.sup}</td></tr>`))}</div>`;$("#v41PrintReports").onclick=()=>{const body=`<table><tr><th>N° projet</th><th>Projet</th><th>Statut</th><th>Budget</th><th>Matériaux</th><th>Main-d'œuvre</th><th>Total</th><th>Reste</th><th>Métiers</th><th>Fourn.</th></tr>${rows.map(x=>`<tr><td>${esc(x.p.project_number||"—")}</td><td>${esc(x.p.name)}</td><td class="center">${printStatus(x.p.status)}</td><td class="money">${cash(x.b)}</td><td class="money">${cash(x.mat)}</td><td class="money">${cash(x.lab)}</td><td class="money">${cash(x.total)}</td><td class="money">${cash(x.remain)}</td><td class="center">${x.trades}</td><td class="center">${x.sup}</td></tr>`).join("")}</table>`;printA4("Bilan général des projets","Situation budgétaire et opérationnelle",body,"landscape",{info:[{label:"Budget total",value:cash(t.b)},{label:"Coût total",value:cash(t.total)},{label:"Reste",value:cash(t.remain)},{label:"Date d’édition",value:new Date().toLocaleDateString("fr-FR")}],totalLabel:"Total projets",total:rows.length})}}
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
    if(f.id==="v36TradeForm"){await post("/api/save",{entity:"trade",action:"create",record:{project_id:f.dataset.project,...fd(f)}});closeModal();await reload();v36ProjectPage(f.dataset.project,"works");toast("Ouvrage ajouté")}
    else if(f.id==="v36TradeEditForm"){await post("/api/save",{entity:"trade",action:"update",record:{id:f.dataset.id,project_id:f.dataset.project,...fd(f)}});closeModal();await reload();v36ProjectPage(f.dataset.project,"works");toast("Ouvrage modifié")}
    else if(f.id==="v36ExpenseForm"){await post("/api/save",{entity:"expense",action:"create",record:{project_id:f.dataset.project,...fd(f)}});closeModal();await reload();v36ProjectPage(f.dataset.project,"materials");toast("Matériaux enregistrés")}
    else if(f.id==="v36SupplierForm"){await post("/api/save",{entity:"project_supplier",action:"create",record:{project_id:f.dataset.project,...fd(f)}});closeModal();await reload();v36ProjectPage(f.dataset.project,"suppliers");toast("Fournisseur ajouté")}
  }catch(x){toast(x.message,true)}
  finally{releaseForm(f)}
},true);


document.addEventListener("click",e=>{
  if(e.target?.id==="v37PrintSuppliers")printA4("Liste des fournisseurs","Répertoire général de l’entreprise",`<table><tr><th>Fournisseur</th><th>Téléphone</th><th>Email</th><th>Ville</th><th>Spécialité</th></tr>${(S.data.suppliers||[]).map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.phone||"")}</td><td>${esc(x.email||"")}</td><td>${esc(x.city||"")}</td><td>${esc(x.specialty||"")}</td></tr>`).join("")}</table>`,"landscape",{info:[{label:"Document",value:"Répertoire fournisseurs"},{label:"Date d’édition",value:new Date().toLocaleDateString("fr-FR")},{label:"Édité par",value:S.session.user.full_name||"Administrateur"},{label:"Entreprise",value:S.session.company?.name||"GLOBAL BT"}],totalLabel:"Total fournisseurs",total:(S.data.suppliers||[]).length});
  if(e.target?.id==="v37PrintUsers")printA4("Liste des utilisateurs","Utilisateurs et accès de l’entreprise",`<table><tr><th>Nom</th><th>E-mail</th><th>Rôle</th><th>Statut</th></tr>${(S.data.users||[]).map(x=>`<tr><td>${esc(x.full_name||"")}</td><td>${esc(x.email||"")}</td><td>${esc(x.role||"")}</td><td>${esc(x.status||"")}</td></tr>`).join("")}</table>`,"landscape",{info:[{label:"Document",value:"Liste des utilisateurs"},{label:"Date d’édition",value:new Date().toLocaleDateString("fr-FR")},{label:"Édité par",value:S.session.user.full_name||"Administrateur"},{label:"Entreprise",value:S.session.company?.name||"GLOBAL BT"}],totalLabel:"Total utilisateurs",total:(S.data.users||[]).length});
  const pid=S.currentProjectId,p=pid?S.data.projects.find(x=>x.id===pid):null;if(!p)return;
  if(e.target?.id==="v37PrintProjectTrades"){
    const rows=(S.data.trades||[]).filter(x=>x.project_id===pid),labor=S.data.labor||[];
    printA4("Liste des métiers",p.location||"",`<table><tr><th>Métier / Corps principal</th><th>Activité</th><th>Description activité</th><th>Main-d'œuvre</th></tr>${rows.map(x=>`<tr><td>${esc(x.phase||"")}</td><td>${esc(x.name||"")}</td><td>${esc(x.description||"")}</td><td class="money">${cash(labor.filter(l=>l.trade_id===x.id).reduce((a,l)=>a+Number(l.amount||0),0))}</td></tr>`).join("")}</table>`,"landscape",{info:projectPrintInfo(p),totalLabel:"Total métiers",total:rows.length})
  }
  if(e.target?.id==="v37PrintProjectMaterials"){
    const rows=(S.data.expenses||[]).filter(x=>x.project_id===pid);
    printA4("Liste des matériaux",p.location||"",`<table><tr><th>Date</th><th>Métier / Corps principal</th><th>Activité</th><th>Désignation</th><th>Fournisseur</th><th>Quantité</th><th>Prix unitaire</th><th>Prix total</th></tr>${rows.map(x=>`<tr><td>${df(x.expense_date)}</td><td>${esc(x.trade_phase||"")}</td><td>${esc(x.trade_name||"")}</td><td>${esc(x.description||"")}</td><td>${esc(x.supplier_name||"")}</td><td>${Number(x.quantity||0).toLocaleString("fr-FR")}${x.unit?` ${esc(x.unit)}`:""}</td><td class="money">${cash(x.unit_price)}</td><td class="money">${cash(x.total_price)}</td></tr>`).join("")}</table>`,"landscape",{info:projectPrintInfo(p),totalLabel:"Total lignes matériaux",total:rows.length})
  }
  if(e.target?.id==="v37PrintProjectSuppliers"){const rows=(S.data.projectSuppliers||[]).filter(x=>x.project_id===pid);printA4("Liste des fournisseurs",p.location||"",`<table><tr><th>Fournisseur</th><th>Contact</th><th>Spécialité</th></tr>${rows.map(x=>`<tr><td>${esc(x.supplier_name||"")}</td><td>${esc(x.phone||"")}</td><td>${esc(x.specialty||"")}</td></tr>`).join("")}</table>`,"landscape",{info:projectPrintInfo(p),totalLabel:"Total fournisseurs",total:rows.length})}
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
      await post("/api/save",{entity:"trade",action:"create",record:{project_id:f.dataset.project,...fd(f)}});closeModal();await reload();v36ProjectPage(f.dataset.project,"works");toast("Ouvrage ajouté");
    }else if(f.id==="v38ProjectTradeEditForm"){
      await post("/api/save",{entity:"trade",action:"update",record:{id:f.dataset.id,project_id:f.dataset.project,...fd(f)}});closeModal();await reload();v36ProjectPage(f.dataset.project,"works");toast("Ouvrage modifié");
    }else if(f.id==="v38ExpenseEditForm"){
      await post("/api/save",{entity:"expense",action:"update",record:{id:f.dataset.id,project_id:f.dataset.project,...fd(f)}});closeModal();await reload();v36ProjectPage(f.dataset.project,"materials");toast("Matériaux modifiés");
    }
  }catch(x){toast(x.message,true)}finally{releaseForm(f)}
});


document.addEventListener("submit",async e=>{
  const f=e.target;if(!["v47SupplierEditForm","v47PaymentForm"].includes(f.id))return;e.preventDefault();
  try{
    if(f.id==="v47SupplierEditForm"){
      await post("/api/save",{entity:"supplier",action:"update",record:{id:f.dataset.id,...fd(f)}});closeModal();await reload();v36ProjectPage(f.dataset.project,"suppliers");toast("Fournisseur modifié");
    }else if(f.id==="v47PaymentForm"){
      await post("/api/save",{entity:"project_payment",action:"create",record:{project_id:f.dataset.project,...fd(f)}});closeModal();await reload();v36ProjectPage(f.dataset.project,"finance");toast("Paiement enregistré");
    }
  }catch(x){toast(x.message,true)}finally{releaseForm(f)}
});

init();

document.addEventListener("submit",e=>{
  const form=e.target;
  if(!(form instanceof HTMLFormElement))return;
  setTimeout(()=>{if(form.isConnected)releaseForm(form)},2500);
});

// V41 — impressions corporate complémentaires.
document.addEventListener("click",e=>{
  if(e.target?.id==="v41PrintDashboard"){
    const projects=S.data.projects||[],expenses=S.data.expenses||[],labor=S.data.labor||[];
    const rows=projects.map(p=>{const spent=expenses.filter(x=>x.project_id===p.id).reduce((a,x)=>a+Number(x.total_price||0),0)+labor.filter(x=>x.project_id===p.id).reduce((a,x)=>a+Number(x.amount||0),0);return {p,spent,remain:Number(p.budget||0)-spent}});
    const body=`<table><tr><th>N° projet</th><th>Projet</th><th>Statut</th><th>Budget</th><th>Consommé</th><th>Reste</th></tr>${rows.map(x=>`<tr><td>${esc(x.p.project_number||"—")}</td><td>${esc(x.p.name)}</td><td>${esc(statusLabel(x.p.status))}</td><td class="money">${cash(x.p.budget)}</td><td class="money">${cash(x.spent)}</td><td class="money">${cash(x.remain)}</td></tr>`).join("")}</table>`;
    printA4("Performance des projets","Tableau de bord de gestion",body,"landscape",{info:[{label:"Nombre de projets",value:projects.length},{label:"Date d’édition",value:new Date().toLocaleDateString("fr-FR")},{label:"Édité par",value:S.session.user.full_name||"Administrateur"},{label:"Entreprise",value:S.session.company?.name||"GLOBAL BT"}],totalLabel:"Total projets",total:projects.length});
  }
});
