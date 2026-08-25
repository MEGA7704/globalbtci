const enc=new TextEncoder();
const ITER=210000, SESSION_TTL=28800, RATE_TTL=900, MAX_FAIL=5;

function json(data,status=200,headers={}){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff",...headers}})}
function ip(req){return req.headers.get("CF-Connecting-IP")||"0.0.0.0"}
function email(v){return String(v||"").trim().toLowerCase()}
function text(v,n=500){return String(v??"").trim().slice(0,n)}
function money(v){const n=Math.round(Number(v||0));return Number.isFinite(n)&&n>=0?n:0}
function qty(v){const n=Number(v||0);return Number.isFinite(n)&&n>=0?n:0}
function today(v){return /^\d{4}-\d{2}-\d{2}$/.test(String(v||""))?String(v):new Date().toISOString().slice(0,10)}
function now(){return new Date().toISOString()}
function plusDays(n){const d=new Date();d.setUTCDate(d.getUTCDate()+n);return d.toISOString()}
function bytes(n){const a=new Uint8Array(n);crypto.getRandomValues(a);return a}
function hex(a){return [...a].map(x=>x.toString(16).padStart(2,"0")).join("")}
function b64(a){return btoa(String.fromCharCode(...a))}
function unb64(s){return Uint8Array.from(atob(String(s)),c=>c.charCodeAt(0))}
async function hashPassword(password,salt,iterations=ITER){const key=await crypto.subtle.importKey("raw",enc.encode(password),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:unb64(salt),iterations},key,256);return b64(new Uint8Array(bits))}
async function safeEq(a,b){const x=new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(String(a)))),y=new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(String(b))));let d=x.length^y.length;for(let i=0;i<Math.min(x.length,y.length);i++)d|=x[i]^y[i];return d===0}
async function sha(s){return hex(new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(s))))}
function cookie(req,name){for(const p of (req.headers.get("cookie")||"").split(";")){const [k,...r]=p.trim().split("=");if(k===name)return r.join("=")}return null}
const setCookie=t=>`gbt_session=${t}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL}`;
const clearCookie=()=>`gbt_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
async function body(req){try{return await req.json()}catch{return {}}}

async function tableInfo(env,t){const r=await env.DB.prepare(`PRAGMA table_info(${t})`).all();return r.results||[]}
async function columns(env,t){return new Set((await tableInfo(env,t)).map(x=>x.name))}
async function ensureColumn(env,t,n,def){const c=await columns(env,t);if(!c.has(n))await env.DB.prepare(`ALTER TABLE ${t} ADD COLUMN ${n} ${def}`).run()}
async function ensureSchema(env){
  const sql=[
`CREATE TABLE IF NOT EXISTS companies(id TEXT PRIMARY KEY,name TEXT NOT NULL,code TEXT,phone TEXT,email TEXT,city TEXT,address TEXT,plan TEXT NOT NULL DEFAULT 'free',plan_started_at TEXT NOT NULL,plan_expires_at TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'active',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,company_id TEXT,email TEXT NOT NULL COLLATE NOCASE UNIQUE,full_name TEXT NOT NULL,phone TEXT,role TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'active',password_version INTEGER NOT NULL DEFAULT 1,must_change_password INTEGER NOT NULL DEFAULT 0,created_by TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
`CREATE TABLE IF NOT EXISTS user_credentials(user_id TEXT PRIMARY KEY,password_hash TEXT NOT NULL,password_salt TEXT NOT NULL,password_iterations INTEGER NOT NULL DEFAULT 210000,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
`CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,company_id TEXT NOT NULL,name TEXT NOT NULL,project_type TEXT,location TEXT,owner_name TEXT,manager_name TEXT,budget INTEGER NOT NULL DEFAULT 0,start_date TEXT,end_date TEXT,status TEXT NOT NULL DEFAULT 'in_progress',description TEXT,created_by TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
`CREATE TABLE IF NOT EXISTS trades(id TEXT PRIMARY KEY,company_id TEXT NOT NULL,project_id TEXT NOT NULL,name TEXT NOT NULL,description TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
`CREATE TABLE IF NOT EXISTS suppliers(id TEXT PRIMARY KEY,company_id TEXT NOT NULL,name TEXT NOT NULL,phone TEXT,email TEXT,city TEXT,address TEXT,specialty TEXT,notes TEXT,created_by TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
`CREATE TABLE IF NOT EXISTS expenses(id TEXT PRIMARY KEY,company_id TEXT NOT NULL,project_id TEXT NOT NULL,trade_id TEXT,supplier_id TEXT,expense_date TEXT NOT NULL,description TEXT NOT NULL,quantity REAL NOT NULL DEFAULT 0,unit TEXT,unit_price INTEGER NOT NULL DEFAULT 0,total_price INTEGER NOT NULL DEFAULT 0,reference TEXT,notes TEXT,created_by TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
`CREATE TABLE IF NOT EXISTS labor_expenses(id TEXT PRIMARY KEY,company_id TEXT NOT NULL,project_id TEXT NOT NULL,trade_id TEXT,expense_date TEXT NOT NULL,worker_name TEXT,description TEXT NOT NULL,amount INTEGER NOT NULL DEFAULT 0,payment_method TEXT,reference TEXT,notes TEXT,created_by TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
`CREATE TABLE IF NOT EXISTS password_reset_requests(id TEXT PRIMARY KEY,company_id TEXT,user_id TEXT,email TEXT NOT NULL,target_role TEXT,status TEXT NOT NULL DEFAULT 'pending',requested_ip TEXT,handled_by TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,handled_at TEXT)`,
`CREATE TABLE IF NOT EXISTS audit_logs(id TEXT PRIMARY KEY,company_id TEXT,actor_user_id TEXT,action TEXT NOT NULL,target_type TEXT,target_id TEXT,ip TEXT,metadata_json TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
`CREATE TABLE IF NOT EXISTS app_meta(key TEXT PRIMARY KEY,value TEXT,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`
  ];
  for(const s of sql)await env.DB.prepare(s).run();

  // Compatibilité avec les anciennes versions de la table users.
  await ensureColumn(env,"users","phone","TEXT");
  await ensureColumn(env,"users","password_version","INTEGER NOT NULL DEFAULT 1");
  await ensureColumn(env,"users","must_change_password","INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(env,"users","created_by","TEXT");
  await ensureColumn(env,"users","updated_at","TEXT");

}
async function migrateLegacyCredentials(env){
  const c=await columns(env,"users");
  if(!(c.has("password_hash")&&c.has("password_salt")))return;
  const iterCol=c.has("password_iterations")?"password_iterations":"210000";
  const rows=await env.DB.prepare(`SELECT id,password_hash,password_salt,${iterCol} AS password_iterations FROM users WHERE password_hash IS NOT NULL AND password_salt IS NOT NULL AND password_hash!='MIGRATED'`).all();
  for(const r of rows.results||[]){
    const exists=await env.DB.prepare("SELECT user_id FROM user_credentials WHERE user_id=?").bind(r.id).first();
    if(!exists)await env.DB.prepare("INSERT INTO user_credentials(user_id,password_hash,password_salt,password_iterations) VALUES(?,?,?,?)").bind(r.id,r.password_hash,r.password_salt,Number(r.password_iterations||ITER)).run();
    await env.DB.prepare("UPDATE users SET password_hash='MIGRATED',password_salt='MIGRATED' WHERE id=?").bind(r.id).run();
  }
}
async function insertUserProfile(env,u){
  const info=await tableInfo(env,"users"),names=[],vals=[],qs=[],supplied=new Set();
  const add=(n,v)=>{if(info.some(x=>x.name===n)){names.push(n);vals.push(v);qs.push("?");supplied.add(n)}};
  add("id",u.id);add("company_id",u.company_id||null);add("email",u.email);add("full_name",u.full_name);add("phone",u.phone||"");add("role",u.role);add("status","active");add("password_version",1);add("must_change_password",u.must_change_password?1:0);add("created_by",u.created_by||null);add("created_at",now());add("updated_at",now());
  // Ancien schéma : satisfaire les colonnes NOT NULL, sans y stocker le vrai hash.
  add("password_hash","MIGRATED");add("password_salt","MIGRATED");add("password_iterations",ITER);
  const bad=info.filter(x=>Number(x.notnull)===1&&x.dflt_value==null&&Number(x.pk)!==1&&!supplied.has(x.name));
  if(bad.length)throw new Error("UNSUPPORTED_USER_COLUMNS:"+bad.map(x=>x.name).join(","));
  await env.DB.prepare(`INSERT INTO users(${names.join(",")}) VALUES(${qs.join(",")})`).bind(...vals).run();
}
async function setCredential(env,userId,password){
  if(String(password).length<12)throw new Error("PASSWORD_TOO_SHORT");
  const salt=b64(bytes(16)),hash=await hashPassword(String(password),salt);
  await env.DB.prepare(`INSERT INTO user_credentials(user_id,password_hash,password_salt,password_iterations,updated_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET password_hash=excluded.password_hash,password_salt=excluded.password_salt,password_iterations=excluded.password_iterations,updated_at=CURRENT_TIMESTAMP`)
    .bind(userId,hash,salt,ITER).run();
}
async function audit(env,actor,action,type=null,id=null,addr=null,meta={}){
  try{await env.DB.prepare("INSERT INTO audit_logs(id,company_id,actor_user_id,action,target_type,target_id,ip,metadata_json) VALUES(?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),actor?.company_id||null,actor?.id||null,action,type,id,addr,JSON.stringify(meta)).run()}catch(e){console.error(JSON.stringify({event:"audit_error",message:e?.message||String(e)}))}
}

async function limited(env,addr,mail){for(const k of [`rl:ip:${addr}`,`rl:acct:${email(mail)}`]){const v=await env.GLOBAL_BT_KV.get(k,"json");if(v?.blockedUntil>Date.now())return true}return false}
async function fail(env,addr,mail){for(const k of [`rl:ip:${addr}`,`rl:acct:${email(mail)}`]){const v=(await env.GLOBAL_BT_KV.get(k,"json"))||{count:0};v.count++;if(v.count>=MAX_FAIL)v.blockedUntil=Date.now()+RATE_TTL*1000;await env.GLOBAL_BT_KV.put(k,JSON.stringify(v),{expirationTtl:RATE_TTL})}}
async function clearFail(env,addr,mail){await Promise.all([env.GLOBAL_BT_KV.delete(`rl:ip:${addr}`),env.GLOBAL_BT_KV.delete(`rl:acct:${email(mail)}`)])}
async function sessionKey(env,t){return "sess:"+await sha(`${t}:${env.SESSION_PEPPER||""}`)}
async function makeSession(env,u){const t=hex(bytes(32)),csrf=hex(bytes(24)),key=await sessionKey(env,t);await env.GLOBAL_BT_KV.put(key,JSON.stringify({userId:u.id,passwordVersion:Number(u.password_version||1),csrf}),{expirationTtl:SESSION_TTL});return {t,csrf}}
async function getSession(req,env){
  const t=cookie(req,"gbt_session");if(!t)return null;const key=await sessionKey(env,t),s=await env.GLOBAL_BT_KV.get(key,"json");if(!s)return null;
  const u=await env.DB.prepare("SELECT id,company_id,email,full_name,phone,role,status,password_version,must_change_password FROM users WHERE id=?").bind(s.userId).first();
  if(!u||u.status!=="active"||Number(u.password_version)!==Number(s.passwordVersion)){await env.GLOBAL_BT_KV.delete(key);return null}
  let c=null;if(u.company_id){c=await env.DB.prepare("SELECT id,name,city,plan,plan_started_at,plan_expires_at,status FROM companies WHERE id=?").bind(u.company_id).first();if(!c||c.status!=="active")return null}
  return {t,key,s,u,c};
}
function csrf(req,s){return !!s?.s?.csrf&&req.headers.get("X-CSRF-Token")===s.s.csrf}
function planOK(s){return !s.c||Date.parse(s.c.plan_expires_at)>Date.now()}
async function auth(req,env,roles=null,write=false){
  const s=await getSession(req,env);if(!s)return {error:json({error:"Session invalide"},401)};
  if(s.u.role!=="superadmin"&&!planOK(s))return {error:json({error:"Abonnement expiré"},403)};
  if(roles&&!roles.includes(s.u.role))return {error:json({error:"Accès refusé"},403)};
  if(write&&!csrf(req,s))return {error:json({error:"CSRF invalide"},403)};
  return {s};
}

async function bootstrap(req,env){
  if(req.method!=="POST")return json({error:"Méthode interdite"},405);
  let stage="start";
  try{
    stage="bindings";
    if(!env.DB)return json({error:"Binding D1 DB manquant",stage,code:"DB_BINDING_MISSING"},503);
    if(!env.GLOBAL_BT_KV)return json({error:"Binding KV GLOBAL_BT_KV manquant",stage,code:"KV_BINDING_MISSING"},503);
    if(!env.SUPERADMIN_EMAIL)return json({error:"Secret SUPERADMIN_EMAIL manquant",stage,code:"SUPERADMIN_EMAIL_MISSING"},503);
    if(!env.SUPERADMIN_INITIAL_PASSWORD)return json({error:"Secret SUPERADMIN_INITIAL_PASSWORD manquant",stage,code:"SUPERADMIN_PASSWORD_MISSING"},503);
    if(!env.SESSION_PEPPER)return json({error:"Secret SESSION_PEPPER manquant",stage,code:"SESSION_PEPPER_MISSING"},503);

    stage="schema";
    await ensureSchema(env);
    const em=email(env.SUPERADMIN_EMAIL);

    stage="lookup_role";
    let su=await env.DB.prepare("SELECT * FROM users WHERE role='superadmin' AND status!='deleted' LIMIT 1").first();

    if(su){
      stage="credential_check";
      const cr=await env.DB.prepare("SELECT user_id FROM user_credentials WHERE user_id=?").bind(su.id).first();
      if(!cr){
        stage="credential_repair";
        await setCredential(env,su.id,env.SUPERADMIN_INITIAL_PASSWORD);
        await env.DB.prepare("UPDATE users SET password_version=password_version+1,status='active',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(su.id).run();
      }
      await clearFail(env,ip(req),su.email||em);
      try{await migrateLegacyCredentials(env)}catch(e){console.error(JSON.stringify({event:"legacy_credentials_warning",message:e?.message||String(e)}))}
      return json({ok:true,alreadyInitialized:true,app_version:"11.0.0"});
    }

    stage="lookup_email";
    su=await env.DB.prepare("SELECT * FROM users WHERE lower(email)=lower(?) LIMIT 1").bind(em).first();

    if(su){
      stage="repair_profile";
      await env.DB.prepare("UPDATE users SET company_id=NULL,email=?,full_name='Super Administrateur',role='superadmin',status='active',password_version=password_version+1,must_change_password=0,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(em,su.id).run();
      stage="repair_credential";
      await setCredential(env,su.id,env.SUPERADMIN_INITIAL_PASSWORD);
      await clearFail(env,ip(req),em);
      await audit(env,{id:su.id,company_id:null},"SUPERADMIN_REPAIRED","user",su.id,ip(req));
      try{await migrateLegacyCredentials(env)}catch(e){console.error(JSON.stringify({event:"legacy_credentials_warning",message:e?.message||String(e)}))}
      return json({ok:true,repaired:true,app_version:"11.0.0"});
    }

    stage="insert_profile";
    const id=crypto.randomUUID();
    await insertUserProfile(env,{id,company_id:null,email:em,full_name:"Super Administrateur",role:"superadmin",created_by:null,must_change_password:false});

    stage="insert_credential";
    await setCredential(env,id,env.SUPERADMIN_INITIAL_PASSWORD);

    stage="finalize";
    await clearFail(env,ip(req),em);
    await audit(env,{id,company_id:null},"SUPERADMIN_CREATED","user",id,ip(req));
    try{await migrateLegacyCredentials(env)}catch(e){console.error(JSON.stringify({event:"legacy_credentials_warning",message:e?.message||String(e)}))}
    return json({ok:true,created:true,app_version:"11.0.0"});
  }catch(e){
    const msg=String(e?.message||"");
    console.error(JSON.stringify({event:"bootstrap_error",stage,message:msg,stack:e?.stack||""}));
    let code="BOOTSTRAP_ERROR";
    if(msg.includes("UNSUPPORTED_USER_COLUMNS"))code=msg;
    else if(msg.includes("UNIQUE constraint"))code="UNIQUE_CONSTRAINT";
    else if(msg.includes("NOT NULL constraint"))code="NOT_NULL_CONSTRAINT";
    else if(msg.includes("CHECK constraint"))code="CHECK_CONSTRAINT";
    else if(msg.includes("FOREIGN KEY constraint"))code="FOREIGN_KEY_CONSTRAINT";
    else if(msg.includes("no such table"))code="MISSING_TABLE";
    else if(msg.includes("no such column"))code="MISSING_COLUMN";
    return json({error:"Initialisation Super Admin impossible",stage,code,app_version:"11.0.0"},500);
  }
}
async function login(req,env){
  if(req.method!=="POST")return json({error:"Méthode interdite"},405);const b=await body(req),em=email(b.email),pw=String(b.password||""),addr=ip(req);
  if(await limited(env,addr,em))return json({error:"Trop de tentatives. Réessayez dans 15 minutes."},429);
  const u=await env.DB.prepare("SELECT * FROM users WHERE lower(email)=lower(?) LIMIT 1").bind(em).first();
  if(!u||u.status!=="active"){await fail(env,addr,em);return json({error:"Identifiants incorrects"},401)}
  let cr=await env.DB.prepare("SELECT * FROM user_credentials WHERE user_id=?").bind(u.id).first();
  if(!cr){
    try{await migrateLegacyCredentials(env)}catch(e){console.error(JSON.stringify({event:"legacy_login_migration_warning",message:e?.message||String(e)}))}
    cr=await env.DB.prepare("SELECT * FROM user_credentials WHERE user_id=?").bind(u.id).first();
  }
  if(!cr){await fail(env,addr,em);return json({error:"Identifiants incorrects"},401)}
  const h=await hashPassword(pw,cr.password_salt,Number(cr.password_iterations||ITER));
  if(!await safeEq(h,cr.password_hash)){await fail(env,addr,em);await audit(env,u,"LOGIN_FAILED","user",u.id,addr);return json({error:"Identifiants incorrects"},401)}
  let c=null;if(u.company_id){c=await env.DB.prepare("SELECT id,name,city,plan,plan_started_at,plan_expires_at,status FROM companies WHERE id=?").bind(u.company_id).first();if(!c||c.status!=="active")return json({error:"Entreprise désactivée"},403);if(Date.parse(c.plan_expires_at)<=Date.now())return json({error:"Abonnement expiré"},403)}
  await clearFail(env,addr,em);const s=await makeSession(env,u);await audit(env,u,"LOGIN","user",u.id,addr);
  return json({authenticated:true,csrf:s.csrf,user:{id:u.id,email:u.email,full_name:u.full_name,phone:u.phone,role:u.role,must_change_password:u.must_change_password},company:c,businessPaymentUrl:env.BUSINESS_PAYMENT_URL},200,{"set-cookie":setCookie(s.t)});
}

async function register(req,env){
  if(req.method!=="POST")return json({error:"Méthode interdite"},405);await ensureSchema(env);const b=await body(req),em=email(b.email),pw=String(b.password||"");
  if(!text(b.company_name,180)||!text(b.full_name,160)||!em)return json({error:"Entreprise, nom et e-mail obligatoires"},400);if(pw.length<12)return json({error:"Mot de passe : 12 caractères minimum"},400);
  if(await env.DB.prepare("SELECT id FROM users WHERE lower(email)=lower(?)").bind(em).first())return json({error:"Cette adresse e-mail existe déjà"},409);
  const cid=crypto.randomUUID(),uid=crypto.randomUUID(),start=now(),end=plusDays(21);
  await env.DB.prepare("INSERT INTO companies(id,name,city,plan,plan_started_at,plan_expires_at,status) VALUES(?,?,?,'free',?,?,'active')").bind(cid,text(b.company_name,180),text(b.city,120),start,end).run();
  await insertUserProfile(env,{id:uid,company_id:cid,email:em,full_name:text(b.full_name,160),phone:text(b.phone,50),role:"admin",created_by:uid});await setCredential(env,uid,pw);
  const u=await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(uid).first(),s=await makeSession(env,u);await audit(env,u,"SELF_REGISTER","company",cid,ip(req),{plan:"free"});
  return json({authenticated:true,csrf:s.csrf,user:{id:uid,email:em,full_name:u.full_name,phone:u.phone,role:"admin"},company:{id:cid,name:text(b.company_name,180),city:text(b.city,120),plan:"free",plan_started_at:start,plan_expires_at:end,status:"active"},businessPaymentUrl:env.BUSINESS_PAYMENT_URL},201,{"set-cookie":setCookie(s.t)});
}

async function session(req,env){const a=await auth(req,env);if(a.error)return a.error;return json({authenticated:true,csrf:a.s.s.csrf,user:a.s.u,company:a.s.c,businessPaymentUrl:env.BUSINESS_PAYMENT_URL})}
async function logout(req,env){const a=await auth(req,env,null,true);if(!a.error){await env.GLOBAL_BT_KV.delete(a.s.key);await audit(env,a.s.u,"LOGOUT","user",a.s.u.id,ip(req))}return json({ok:true},200,{"set-cookie":clearCookie()})}

async function load(req,env){
  const a=await auth(req,env);if(a.error)return a.error;const s=a.s;
  if(s.u.role==="superadmin"){
    const [companies,users,resets,logs]=await Promise.all([
      env.DB.prepare("SELECT id,name,city,plan,plan_started_at,plan_expires_at,status,created_at FROM companies WHERE status!='deleted' ORDER BY created_at DESC").all(),
      env.DB.prepare("SELECT u.id,u.company_id,u.email,u.full_name,u.phone,u.role,u.status,u.created_at,c.name company_name FROM users u LEFT JOIN companies c ON c.id=u.company_id WHERE u.status!='deleted' ORDER BY u.created_at DESC").all(),
      env.DB.prepare("SELECT r.*,u.full_name,c.name company_name FROM password_reset_requests r LEFT JOIN users u ON u.id=r.user_id LEFT JOIN companies c ON c.id=r.company_id WHERE r.target_role='admin' ORDER BY r.created_at DESC LIMIT 300").all(),
      env.DB.prepare("SELECT a.*,u.full_name actor_name,c.name company_name FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_user_id LEFT JOIN companies c ON c.id=a.company_id ORDER BY a.created_at DESC LIMIT 400").all()
    ]);
    return json({mode:"superadmin",companies:companies.results,users:users.results,resets:resets.results,logs:logs.results});
  }
  const c=s.u.company_id;
  const [projects,trades,suppliers,expenses,labor,users,resets]=await Promise.all([
    env.DB.prepare("SELECT * FROM projects WHERE company_id=? ORDER BY created_at DESC").bind(c).all(),
    env.DB.prepare("SELECT * FROM trades WHERE company_id=? ORDER BY name").bind(c).all(),
    env.DB.prepare("SELECT * FROM suppliers WHERE company_id=? ORDER BY name").bind(c).all(),
    env.DB.prepare("SELECT e.*,p.name project_name,t.name trade_name,sp.name supplier_name FROM expenses e JOIN projects p ON p.id=e.project_id LEFT JOIN trades t ON t.id=e.trade_id LEFT JOIN suppliers sp ON sp.id=e.supplier_id WHERE e.company_id=? ORDER BY e.expense_date DESC,e.created_at DESC").bind(c).all(),
    env.DB.prepare("SELECT l.*,p.name project_name,t.name trade_name FROM labor_expenses l JOIN projects p ON p.id=l.project_id LEFT JOIN trades t ON t.id=l.trade_id WHERE l.company_id=? ORDER BY l.expense_date DESC,l.created_at DESC").bind(c).all(),
    s.u.role==="admin"?env.DB.prepare("SELECT id,email,full_name,phone,role,status,created_at FROM users WHERE company_id=? AND status!='deleted' ORDER BY created_at DESC").bind(c).all():Promise.resolve({results:[]}),
    s.u.role==="admin"?env.DB.prepare("SELECT r.*,u.full_name FROM password_reset_requests r LEFT JOIN users u ON u.id=r.user_id WHERE r.company_id=? AND r.target_role='agent' ORDER BY r.created_at DESC LIMIT 200").bind(c).all():Promise.resolve({results:[]})
  ]);
  return json({mode:"company",projects:projects.results,trades:trades.results,suppliers:suppliers.results,expenses:expenses.results,labor:labor.results,users:users.results,resets:resets.results});
}

async function save(req,env){
  const a=await auth(req,env,null,true);if(a.error)return a.error;const s=a.s,b=await body(req),entity=b.entity,action=b.action||"create",r=b.record||{};
  if(s.u.role==="superadmin")return saveSuper(req,env,s,entity,action,r);
  return saveCompany(req,env,s,entity,action,r);
}
async function saveCompany(req,env,s,entity,action,r){
  const c=s.u.company_id,actor=s.u;
  if(["company","plan","subscription"].includes(entity))return json({error:"Champ protégé par le Super Admin"},403);
  if(entity==="project"){
    if(action==="create"){const id=crypto.randomUUID();await env.DB.prepare("INSERT INTO projects(id,company_id,name,project_type,location,owner_name,manager_name,budget,start_date,end_date,status,description,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id,c,text(r.name,180),text(r.project_type,100),text(r.location,140),text(r.owner_name,160),text(r.manager_name,160),money(r.budget),r.start_date||null,r.end_date||null,r.status||"in_progress",text(r.description,1000),actor.id).run();await audit(env,actor,"CREATE_PROJECT","project",id,ip(req));return json({ok:true,id})}
    const own=await env.DB.prepare("SELECT id FROM projects WHERE id=? AND company_id=?").bind(r.id,c).first();if(!own)return json({error:"Projet introuvable"},404);
    if(action==="update"){await env.DB.prepare("UPDATE projects SET name=?,project_type=?,location=?,owner_name=?,manager_name=?,budget=?,start_date=?,end_date=?,status=?,description=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND company_id=?").bind(text(r.name,180),text(r.project_type,100),text(r.location,140),text(r.owner_name,160),text(r.manager_name,160),money(r.budget),r.start_date||null,r.end_date||null,r.status||"in_progress",text(r.description,1000),r.id,c).run();await audit(env,actor,"UPDATE_PROJECT","project",r.id,ip(req));return json({ok:true})}
    if(action==="delete"&&actor.role==="admin"){const used=await env.DB.prepare("SELECT (SELECT COUNT(*) FROM expenses WHERE project_id=? AND company_id=?)+(SELECT COUNT(*) FROM labor_expenses WHERE project_id=? AND company_id=?) n").bind(r.id,c,r.id,c).first();if(used.n)return json({error:"Projet contenant des dépenses : suppression refusée"},409);await env.DB.prepare("DELETE FROM trades WHERE project_id=? AND company_id=?").bind(r.id,c).run();await env.DB.prepare("DELETE FROM projects WHERE id=? AND company_id=?").bind(r.id,c).run();await audit(env,actor,"DELETE_PROJECT","project",r.id,ip(req));return json({ok:true})}
  }
  if(entity==="trade"){
    if(action==="create"){const p=await env.DB.prepare("SELECT id FROM projects WHERE id=? AND company_id=?").bind(r.project_id,c).first();if(!p)return json({error:"Projet invalide"},400);const id=crypto.randomUUID();await env.DB.prepare("INSERT INTO trades(id,company_id,project_id,name,description) VALUES(?,?,?,?,?)").bind(id,c,r.project_id,text(r.name,120),text(r.description,500)).run();return json({ok:true,id})}
    if(action==="delete"&&actor.role==="admin"){await env.DB.prepare("DELETE FROM trades WHERE id=? AND company_id=?").bind(r.id,c).run();return json({ok:true})}
  }
  if(entity==="supplier"){
    if(action==="create"){const id=crypto.randomUUID();await env.DB.prepare("INSERT INTO suppliers(id,company_id,name,phone,email,city,address,specialty,notes,created_by) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(id,c,text(r.name,180),text(r.phone,50),email(r.email)||null,text(r.city,120),text(r.address,240),text(r.specialty,160),text(r.notes,800),actor.id).run();return json({ok:true,id})}
    if(action==="delete"&&actor.role==="admin"){await env.DB.prepare("UPDATE expenses SET supplier_id=NULL WHERE supplier_id=? AND company_id=?").bind(r.id,c).run();await env.DB.prepare("DELETE FROM suppliers WHERE id=? AND company_id=?").bind(r.id,c).run();return json({ok:true})}
  }
  if(entity==="expense"){
    if(action==="create"){const p=await env.DB.prepare("SELECT id FROM projects WHERE id=? AND company_id=?").bind(r.project_id,c).first();if(!p)return json({error:"Projet invalide"},400);const total=Math.round(qty(r.quantity)*money(r.unit_price)),id=crypto.randomUUID();await env.DB.prepare("INSERT INTO expenses(id,company_id,project_id,trade_id,supplier_id,expense_date,description,quantity,unit,unit_price,total_price,reference,notes,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id,c,r.project_id,r.trade_id||null,r.supplier_id||null,today(r.expense_date),text(r.description,500),qty(r.quantity),text(r.unit,40),money(r.unit_price),total,text(r.reference,120),text(r.notes,800),actor.id).run();await audit(env,actor,"CREATE_EXPENSE","expense",id,ip(req),{total});return json({ok:true,id,total})}
    if(action==="delete"&&actor.role==="admin"){await env.DB.prepare("DELETE FROM expenses WHERE id=? AND company_id=?").bind(r.id,c).run();await audit(env,actor,"DELETE_EXPENSE","expense",r.id,ip(req));return json({ok:true})}
  }
  if(entity==="labor"){
    if(action==="create"){const p=await env.DB.prepare("SELECT id FROM projects WHERE id=? AND company_id=?").bind(r.project_id,c).first();if(!p)return json({error:"Projet invalide"},400);const id=crypto.randomUUID();await env.DB.prepare("INSERT INTO labor_expenses(id,company_id,project_id,trade_id,expense_date,worker_name,description,amount,payment_method,reference,notes,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").bind(id,c,r.project_id,r.trade_id||null,today(r.expense_date),text(r.worker_name,160),text(r.description,500),money(r.amount),text(r.payment_method,80),text(r.reference,120),text(r.notes,800),actor.id).run();await audit(env,actor,"CREATE_LABOR","labor",id,ip(req),{amount:money(r.amount)});return json({ok:true,id})}
    if(action==="delete"&&actor.role==="admin"){await env.DB.prepare("DELETE FROM labor_expenses WHERE id=? AND company_id=?").bind(r.id,c).run();return json({ok:true})}
  }
  if(entity==="user"&&actor.role==="admin"){
    if(action==="create"){const em=email(r.email);if(!em||String(r.password||"").length<12)return json({error:"E-mail et mot de passe 12 caractères minimum"},400);if(await env.DB.prepare("SELECT id FROM users WHERE lower(email)=lower(?)").bind(em).first())return json({error:"E-mail déjà utilisé"},409);const id=crypto.randomUUID();await insertUserProfile(env,{id,company_id:c,email:em,full_name:text(r.full_name,160),phone:text(r.phone,50),role:"agent",created_by:actor.id,must_change_password:true});await setCredential(env,id,r.password);await audit(env,actor,"CREATE_AGENT","user",id,ip(req));return json({ok:true,id})}
    const u=await env.DB.prepare("SELECT * FROM users WHERE id=? AND company_id=? AND role='agent'").bind(r.id,c).first();if(!u)return json({error:"Agent introuvable"},404);
    if(["activate","disable","delete"].includes(action)){const st={activate:"active",disable:"disabled",delete:"deleted"}[action];await env.DB.prepare("UPDATE users SET status=?,password_version=password_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(st,u.id).run();await audit(env,actor,"AGENT_"+action.toUpperCase(),"user",u.id,ip(req));return json({ok:true})}
    if(action==="reset_password"){await setCredential(env,u.id,r.new_password);await env.DB.prepare("UPDATE users SET password_version=password_version+1,must_change_password=1,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(u.id).run();if(r.reset_request_id)await env.DB.prepare("UPDATE password_reset_requests SET status='resolved',handled_by=?,handled_at=CURRENT_TIMESTAMP WHERE id=? AND company_id=?").bind(actor.id,r.reset_request_id,c).run();await audit(env,actor,"RESET_AGENT_PASSWORD","user",u.id,ip(req));return json({ok:true})}
  }
  return json({error:"Action non autorisée"},403);
}
async function saveSuper(req,env,s,entity,action,r){
  const actor=s.u;
  if(entity==="company"){
    if(action==="create"){const plan=r.plan==="business"?"business":"free",start=now(),end=plusDays(plan==="business"?365:21),cid=crypto.randomUUID(),uid=crypto.randomUUID(),em=email(r.admin_email);if(!text(r.name,180)||!em||String(r.admin_password||"").length<12)return json({error:"Entreprise, administrateur et mot de passe requis"},400);if(await env.DB.prepare("SELECT id FROM users WHERE lower(email)=lower(?)").bind(em).first())return json({error:"E-mail déjà utilisé"},409);await env.DB.prepare("INSERT INTO companies(id,name,city,plan,plan_started_at,plan_expires_at,status) VALUES(?,?,?,?,?,?,'active')").bind(cid,text(r.name,180),text(r.city,120),plan,start,end).run();await insertUserProfile(env,{id:uid,company_id:cid,email:em,full_name:text(r.admin_name,160),phone:text(r.admin_phone,50),role:"admin",created_by:actor.id,must_change_password:true});await setCredential(env,uid,r.admin_password);await audit(env,actor,"CREATE_COMPANY","company",cid,ip(req),{plan});return json({ok:true,id:cid})}
    const c=await env.DB.prepare("SELECT * FROM companies WHERE id=?").bind(r.id).first();if(!c)return json({error:"Entreprise introuvable"},404);
    if(action==="set_plan"){const plan=r.plan==="business"?"business":"free",start=now(),end=plusDays(plan==="business"?365:21);await env.DB.prepare("UPDATE companies SET plan=?,plan_started_at=?,plan_expires_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(plan,start,end,c.id).run();await audit(env,actor,"SET_PLAN","company",c.id,ip(req),{plan});return json({ok:true})}
    if(["activate","disable","delete"].includes(action)){const st={activate:"active",disable:"disabled",delete:"deleted"}[action];await env.DB.prepare("UPDATE companies SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(st,c.id).run();if(st!=="active")await env.DB.prepare("UPDATE users SET status='disabled',password_version=password_version+1 WHERE company_id=? AND status='active'").bind(c.id).run();await audit(env,actor,"COMPANY_"+action.toUpperCase(),"company",c.id,ip(req));return json({ok:true})}
  }
  if(entity==="user"){
    const u=await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(r.id).first();if(!u||u.role==="superadmin")return json({error:"Compte protégé ou introuvable"},400);
    if(["activate","disable","delete"].includes(action)){const st={activate:"active",disable:"disabled",delete:"deleted"}[action];await env.DB.prepare("UPDATE users SET status=?,password_version=password_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(st,u.id).run();await audit(env,actor,"MEMBER_"+action.toUpperCase(),"user",u.id,ip(req));return json({ok:true})}
    if(action==="reset_password"){await setCredential(env,u.id,r.new_password);await env.DB.prepare("UPDATE users SET password_version=password_version+1,must_change_password=1,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(u.id).run();if(r.reset_request_id)await env.DB.prepare("UPDATE password_reset_requests SET status='resolved',handled_by=?,handled_at=CURRENT_TIMESTAMP WHERE id=?").bind(actor.id,r.reset_request_id).run();await audit(env,actor,"RESET_MEMBER_PASSWORD","user",u.id,ip(req));return json({ok:true})}
  }
  if(entity==="reset"&&action==="reject"){await env.DB.prepare("UPDATE password_reset_requests SET status='rejected',handled_by=?,handled_at=CURRENT_TIMESTAMP WHERE id=?").bind(actor.id,r.id).run();return json({ok:true})}
  return json({error:"Action Super Admin non autorisée"},403);
}

async function resetRequest(req,env){
  if(req.method!=="POST")return json({error:"Méthode interdite"},405);await ensureSchema(env);const b=await body(req),em=email(b.email),u=await env.DB.prepare("SELECT id,company_id,role FROM users WHERE lower(email)=lower(?) AND status!='deleted'").bind(em).first();
  if(u){const pending=await env.DB.prepare("SELECT id FROM password_reset_requests WHERE user_id=? AND status='pending'").bind(u.id).first();if(!pending)await env.DB.prepare("INSERT INTO password_reset_requests(id,company_id,user_id,email,target_role,requested_ip) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),u.company_id,u.id,em,u.role,ip(req)).run();await audit(env,u,"PASSWORD_RESET_REQUEST","user",u.id,ip(req))}
  return json({ok:true,message:"Si ce compte existe, la demande a été enregistrée."});
}
async function changePassword(req,env){
  const a=await auth(req,env,null,true);if(a.error)return a.error;const b=await body(req),cr=await env.DB.prepare("SELECT * FROM user_credentials WHERE user_id=?").bind(a.s.u.id).first();if(!cr)return json({error:"Compte d'authentification invalide"},400);const h=await hashPassword(String(b.current_password||""),cr.password_salt,Number(cr.password_iterations||ITER));if(!await safeEq(h,cr.password_hash))return json({error:"Mot de passe actuel incorrect"},400);await setCredential(env,a.s.u.id,b.new_password);await env.DB.prepare("UPDATE users SET password_version=password_version+1,must_change_password=0,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(a.s.u.id).run();await audit(env,a.s.u,"CHANGE_PASSWORD","user",a.s.u.id,ip(req));return json({ok:true})}
async function health(req,env){
  let schema=false,superadmin=false,credential=false;
  try{
    if(env.DB){
      const r=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").first();
      schema=!!r;
      if(schema){
        const u=await env.DB.prepare("SELECT id FROM users WHERE role='superadmin' AND status!='deleted' LIMIT 1").first();
        superadmin=!!u;
        if(u){
          const c=await env.DB.prepare("SELECT user_id FROM user_credentials WHERE user_id=?").bind(u.id).first();
          credential=!!c;
        }
      }
    }
  }catch{}
  return json({ok:!!env.DB&&!!env.GLOBAL_BT_KV,app_version:"11.0.0",d1_bound:!!env.DB,kv_bound:!!env.GLOBAL_BT_KV,superadmin_email_configured:!!env.SUPERADMIN_EMAIL,superadmin_password_configured:!!env.SUPERADMIN_INITIAL_PASSWORD,session_pepper_configured:!!env.SESSION_PEPPER,schema_ready:schema,superadmin_ready:superadmin,superadmin_credential_ready:credential})
}

async function route(req,env){
  const p=new URL(req.url).pathname;
  if(p==="/api/health")return health(req,env);
  if(p==="/api/bootstrap")return bootstrap(req,env);
  if(p==="/api/login")return login(req,env);
  if(p==="/api/register")return register(req,env);
  if(p==="/api/session")return session(req,env);
  if(p==="/api/logout")return logout(req,env);
  if(p==="/api/load")return load(req,env);
  if(p==="/api/save")return save(req,env);
  if(p==="/api/password-reset/request")return resetRequest(req,env);
  if(p==="/api/change-password")return changePassword(req,env);
  return json({error:"Route API introuvable"},404);
}
export default{async fetch(request,env,ctx){try{const u=new URL(request.url);if(u.pathname.startsWith("/api/"))return await route(request,env);return env.ASSETS.fetch(request)}catch(e){console.error(JSON.stringify({event:"worker_error",message:e?.message||String(e)}));return json({error:"Erreur serveur"},500)}}};
