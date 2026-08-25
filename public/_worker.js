const enc = new TextEncoder();
const ITERATIONS = 210000;
const SESSION_TTL = 8 * 60 * 60;
const RATE_TTL = 15 * 60;
const MAX_ATTEMPTS = 5;

function response(data,status=200,headers={}) {
  return new Response(JSON.stringify(data), {status,headers:{
    "content-type":"application/json; charset=utf-8",
    "cache-control":"no-store",
    "x-content-type-options":"nosniff",
    ...headers
  }});
}
function clientIp(req){return req.headers.get("CF-Connecting-IP") || "0.0.0.0"}
function normEmail(v){return String(v||"").trim().toLowerCase()}
function cleanText(v,max=500){return String(v??"").trim().slice(0,max)}
function asMoney(v){const n=Math.round(Number(v||0));return Number.isFinite(n)&&n>=0?n:0}
function asQty(v){const n=Number(v||0);return Number.isFinite(n)&&n>=0?n:0}
function isoDate(v){const s=String(v||"");return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:new Date().toISOString().slice(0,10)}
function nowIso(){return new Date().toISOString()}
function addDays(days){const d=new Date();d.setUTCDate(d.getUTCDate()+days);return d.toISOString()}
function toB64(bytes){return btoa(String.fromCharCode(...bytes))}
function fromB64(s){return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
function randomToken(n=32){const a=new Uint8Array(n);crypto.getRandomValues(a);return toB64(a).replaceAll("+","-").replaceAll("/","_").replaceAll("=","")}
async function digestText(v){const h=await crypto.subtle.digest("SHA-256",enc.encode(v));return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,"0")).join("")}
async function sessionKey(env,token){return "sess:"+await digestText(`${token}:${env.SESSION_PEPPER||""}`)}
async function passwordHash(password,salt,iterations=ITERATIONS){
  const key=await crypto.subtle.importKey("raw",enc.encode(password),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:fromB64(salt),iterations},key,256);
  return toB64(new Uint8Array(bits));
}
async function safeEqual(a,b){
  const x=new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(String(a))));
  const y=new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(String(b))));
  let diff=x.length^y.length;for(let i=0;i<Math.min(x.length,y.length);i++)diff|=x[i]^y[i];return diff===0;
}
function readCookie(req,name){
  for(const p of (req.headers.get("cookie")||"").split(";")){
    const [k,...rest]=p.trim().split("=");if(k===name)return rest.join("=");
  } return null;
}
function setSessionCookie(t){return `gbt_session=${t}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL}`}
function clearSessionCookie(){return "gbt_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"}
async function parseJson(req){try{return await req.json()}catch{return {}}}
async function audit(env,actor,action,targetType=null,targetId=null,ip=null,meta={}){
  await env.DB.prepare(`INSERT INTO audit_logs(id,company_id,actor_user_id,action,target_type,target_id,ip,metadata_json)
    VALUES(?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),actor?.company_id||null,actor?.id||null,action,targetType,targetId,ip,JSON.stringify(meta)).run();
}
async function rateState(env,key){return await env.GLOBAL_BT_KV.get(key,"json")}
async function isLimited(env,ip,email){
  for(const key of [`rl:ip:${ip}`,`rl:acct:${normEmail(email)}`]){
    const v=await rateState(env,key); if(v?.blockedUntil>Date.now()) return true;
  } return false;
}
async function addFailure(env,ip,email){
  for(const key of [`rl:ip:${ip}`,`rl:acct:${normEmail(email)}`]){
    const v=(await rateState(env,key))||{count:0};v.count=(v.count||0)+1;
    if(v.count>=MAX_ATTEMPTS)v.blockedUntil=Date.now()+RATE_TTL*1000;
    await env.GLOBAL_BT_KV.put(key,JSON.stringify(v),{expirationTtl:RATE_TTL});
  }
}
async function clearFailures(env,ip,email){
  await Promise.all([env.GLOBAL_BT_KV.delete(`rl:ip:${ip}`),env.GLOBAL_BT_KV.delete(`rl:acct:${normEmail(email)}`)]);
}
async function createSession(env,user){
  const token=randomToken(32),csrf=randomToken(24),key=await sessionKey(env,token);
  await env.GLOBAL_BT_KV.put(key,JSON.stringify({userId:user.id,passwordVersion:user.password_version,csrf,createdAt:Date.now()}),{expirationTtl:SESSION_TTL});
  return {token,csrf};
}
async function getSession(req,env){
  const token=readCookie(req,"gbt_session");if(!token)return null;
  const key=await sessionKey(env,token),data=await env.GLOBAL_BT_KV.get(key,"json");if(!data)return null;
  const user=await env.DB.prepare(`SELECT id,company_id,email,full_name,phone,role,status,password_version,must_change_password
    FROM users WHERE id=?`).bind(data.userId).first();
  if(!user||user.status!=="active"||Number(user.password_version)!==Number(data.passwordVersion)){await env.GLOBAL_BT_KV.delete(key);return null}
  let company=null;
  if(user.company_id){
    company=await env.DB.prepare(`SELECT id,name,code,phone,email,address,city,status,plan,plan_started_at,plan_expires_at FROM companies WHERE id=?`).bind(user.company_id).first();
    if(!company||company.status!=="active")return null;
  }
  return {token,key,data,user,company};
}
function csrfOk(req,s){return !!s?.data?.csrf && req.headers.get("X-CSRF-Token")===s.data.csrf}
function requireRole(s,roles){return s&&roles.includes(s.user.role)}
function planValid(s){return !s.company || (s.company.status==="active" && Date.parse(s.company.plan_expires_at)>Date.now())}
async function needAuth(req,env,roles=null,write=false){
  const s=await getSession(req,env);
  if(!s)return {error:response({error:"Session invalide ou expirée"},401)};
  if(!planValid(s)&&s.user.role!=="superadmin")return {error:response({error:"Abonnement expiré. Contactez le Super Admin."},403)};
  if(roles&&!requireRole(s,roles))return {error:response({error:"Rôle non autorisé"},403)};
  if(write&&!csrfOk(req,s))return {error:response({error:"Jeton CSRF invalide"},403)};
  return {s};
}
async function ownedProject(env,id,cid){return await env.DB.prepare("SELECT id FROM projects WHERE id=? AND company_id=?").bind(id,cid).first()}
async function ownedTrade(env,id,cid){if(!id)return null;return await env.DB.prepare("SELECT id FROM trades WHERE id=? AND company_id=?").bind(id,cid).first()}
async function ownedSupplier(env,id,cid){if(!id)return null;return await env.DB.prepare("SELECT id FROM suppliers WHERE id=? AND company_id=?").bind(id,cid).first()}
async function userById(env,id){return await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(id).first()}
async function setPassword(env,actor,target,newPassword,req){
  const password=String(newPassword||"");
  if(password.length<12)return response({error:"Le mot de passe doit contenir au moins 12 caractères."},400);
  const salt=randomToken(16),hash=await passwordHash(password,salt),next=Number(target.password_version||1)+1;
  await env.DB.prepare(`UPDATE users SET password_hash=?,password_salt=?,password_iterations=?,password_version=?,must_change_password=1,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .bind(hash,salt,ITERATIONS,next,target.id).run();
  await audit(env,actor,"PASSWORD_RESET","user",target.id,clientIp(req),{target_role:target.role});
  return response({ok:true});
}


async function ensureSchema(env){
  const statements = [
    `CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE,
      phone TEXT,
      email TEXT,
      address TEXT,
      city TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled','deleted')),
      plan TEXT NOT NULL DEFAULT 'free' CHECK(plan IN ('free','business')),
      plan_started_at TEXT NOT NULL,
      plan_expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      company_id TEXT,
      email TEXT NOT NULL COLLATE NOCASE UNIQUE,
      full_name TEXT NOT NULL,
      phone TEXT,
      role TEXT NOT NULL CHECK(role IN ('superadmin','admin','agent')),
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      password_iterations INTEGER NOT NULL DEFAULT 210000,
      password_version INTEGER NOT NULL DEFAULT 1,
      must_change_password INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled','deleted')),
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      name TEXT NOT NULL,
      project_type TEXT,
      location TEXT,
      owner_name TEXT,
      manager_name TEXT,
      budget INTEGER NOT NULL DEFAULT 0,
      start_date TEXT,
      end_date TEXT,
      status TEXT NOT NULL DEFAULT 'in_progress',
      description TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS trades (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(company_id,project_id,name)
    )`,
    `CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      city TEXT,
      specialty TEXT,
      notes TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      trade_id TEXT,
      supplier_id TEXT,
      expense_date TEXT NOT NULL,
      description TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 0,
      unit TEXT,
      unit_price INTEGER NOT NULL DEFAULT 0,
      total_price INTEGER NOT NULL DEFAULT 0,
      invoice_reference TEXT,
      notes TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS labor_expenses (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      trade_id TEXT,
      expense_date TEXT NOT NULL,
      worker_name TEXT,
      work_description TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      payment_method TEXT,
      payment_reference TEXT,
      notes TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS password_reset_requests (
      id TEXT PRIMARY KEY,
      company_id TEXT,
      user_id TEXT,
      email TEXT NOT NULL,
      requested_by_ip TEXT,
      target_role TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      handled_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      handled_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      company_id TEXT,
      actor_user_id TEXT,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      ip TEXT,
      metadata_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id)`,
    `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
    `CREATE INDEX IF NOT EXISTS idx_projects_company ON projects(company_id)`,
    `CREATE INDEX IF NOT EXISTS idx_trades_company_project ON trades(company_id,project_id)`,
    `CREATE INDEX IF NOT EXISTS idx_suppliers_company ON suppliers(company_id)`,
    `CREATE INDEX IF NOT EXISTS idx_expenses_company_date ON expenses(company_id,expense_date)`,
    `CREATE INDEX IF NOT EXISTS idx_labor_company_date ON labor_expenses(company_id,expense_date)`,
    `CREATE INDEX IF NOT EXISTS idx_reset_status ON password_reset_requests(status,created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_company_created ON audit_logs(company_id,created_at)`
  ];
  for(const sql of statements){
    await env.DB.prepare(sql).run();
  }
}
async function health(req,env){
  const result = {
    ok:true,
    d1_bound:!!env.DB,
    kv_bound:!!env.GLOBAL_BT_KV,
    superadmin_email_configured:!!env.SUPERADMIN_EMAIL,
    superadmin_password_configured:!!env.SUPERADMIN_INITIAL_PASSWORD,
    session_pepper_configured:!!env.SESSION_PEPPER,
    schema_ready:false
  };
  try{
    if(env.DB){
      const row=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").first();
      result.schema_ready=!!row;
    }
  }catch(e){
    result.ok=false;
    result.database_error="D1 inaccessible";
  }
  return response(result,result.ok?200:503);
}

async function bootstrap(req,env){
  if(req.method!=="POST")return response({error:"Méthode interdite"},405);
  if(!env.DB)return response({error:"Binding D1 DB manquant dans Cloudflare Pages"},503);
  if(!env.GLOBAL_BT_KV)return response({error:"Binding KV GLOBAL_BT_KV manquant dans Cloudflare Pages"},503);
  if(!env.SUPERADMIN_EMAIL)return response({error:"Secret SUPERADMIN_EMAIL manquant"},503);
  if(!env.SUPERADMIN_INITIAL_PASSWORD)return response({error:"Secret SUPERADMIN_INITIAL_PASSWORD manquant"},503);
  if(!env.SESSION_PEPPER)return response({error:"Secret SESSION_PEPPER manquant"},503);

  try{
    await ensureSchema(env);

    const configuredEmail=normEmail(env.SUPERADMIN_EMAIL);
    const current=await env.DB.prepare(
      "SELECT * FROM users WHERE role='superadmin' AND status!='deleted' LIMIT 1"
    ).first();

    // Ne jamais écraser un Super Admin existant à chaque démarrage.
    if(current){
      return response({ok:true,alreadyInitialized:true});
    }

    // Si l'adresse configurée existe déjà sous un autre rôle, la réparer
    // au lieu de provoquer une erreur UNIQUE(email).
    const sameEmail=await env.DB.prepare(
      "SELECT * FROM users WHERE email=? LIMIT 1"
    ).bind(configuredEmail).first();

    const salt=randomToken(16);
    const hash=await passwordHash(env.SUPERADMIN_INITIAL_PASSWORD,salt);

    if(sameEmail){
      const nextVersion=Number(sameEmail.password_version||1)+1;
      await env.DB.prepare(`UPDATE users
        SET company_id=NULL,
            full_name='Super Administrateur',
            role='superadmin',
            password_hash=?,
            password_salt=?,
            password_iterations=?,
            password_version=?,
            must_change_password=0,
            status='active',
            updated_at=CURRENT_TIMESTAMP
        WHERE id=? AND email=?`)
        .bind(hash,salt,ITERATIONS,nextVersion,sameEmail.id,configuredEmail).run();

      await audit(env,{id:sameEmail.id,company_id:null},"SUPERADMIN_REPAIRED","user",sameEmail.id,clientIp(req),{email:configuredEmail});
      return response({ok:true,repaired:true});
    }

    const id=crypto.randomUUID();
    await env.DB.prepare(`INSERT INTO users(
      id,company_id,email,full_name,role,password_hash,password_salt,
      password_iterations,password_version,must_change_password,status
    ) VALUES(?,NULL,?,'Super Administrateur','superadmin',?,?,?,1,0,'active')`)
      .bind(id,configuredEmail,hash,salt,ITERATIONS).run();

    await audit(env,{id,company_id:null},"SUPERADMIN_BOOTSTRAP","user",id,clientIp(req),{email:configuredEmail});
    return response({ok:true,created:true});
  }catch(e){
    console.error(JSON.stringify({
      event:"superadmin_bootstrap_error",
      message:e?.message||String(e),
      stack:e?.stack||""
    }));
    return response({
      error:"Initialisation Super Admin impossible",
      detail:"Le schéma D1 est disponible mais le compte Super Admin n'a pas pu être créé ou réparé."
    },500);
  }
}
async function register(req,env){
  if(req.method!=="POST")return response({error:"Méthode interdite"},405);
  if(!env.DB)return response({error:"Binding D1 DB manquant"},503);
  if(!env.GLOBAL_BT_KV)return response({error:"Binding KV GLOBAL_BT_KV manquant"},503);

  try{ await ensureSchema(env); }
  catch(e){
    console.error(JSON.stringify({event:"register_schema_error",message:e?.message||String(e)}));
    return response({error:"Base de données indisponible"},503);
  }

  const b=await parseJson(req);
  const companyName=cleanText(b.company_name,180);
  const city=cleanText(b.city,120);
  const fullName=cleanText(b.full_name,160);
  const phone=cleanText(b.phone,50);
  const em=normEmail(b.email);
  const password=String(b.password||"");
  const addr=clientIp(req);

  if(!companyName||!fullName||!em)return response({error:"Entreprise, nom et e-mail sont obligatoires"},400);
  if(password.length<12)return response({error:"Le mot de passe doit contenir au moins 12 caractères"},400);
  if(await isLimited(env,addr,em))return response({error:"Trop de tentatives. Réessayez dans 15 minutes."},429);

  const exists=await env.DB.prepare("SELECT id FROM users WHERE email=? LIMIT 1").bind(em).first();
  if(exists){
    await addFailure(env,addr,em);
    return response({error:"Un compte utilise déjà cette adresse e-mail"},409);
  }

  const companyId=crypto.randomUUID();
  const userId=crypto.randomUUID();
  const start=nowIso();
  const end=addDays(21);
  const salt=randomToken(16);
  const hash=await passwordHash(password,salt);

  try{
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO companies(id,name,city,status,plan,plan_started_at,plan_expires_at)
        VALUES(?,?,?,'active','free',?,?)`).bind(companyId,companyName,city,start,end),
      env.DB.prepare(`INSERT INTO users(id,company_id,email,full_name,phone,role,password_hash,password_salt,password_iterations,password_version,must_change_password,status,created_by)
        VALUES(?,?,?,?,?,'admin',?,?,?,1,0,'active',?)`).bind(userId,companyId,em,fullName,phone,hash,salt,ITERATIONS,userId)
    ]);
  }catch(e){
    console.error(JSON.stringify({event:"register_error",message:e?.message||String(e)}));
    return response({error:"Impossible de créer le compte"},500);
  }

  await clearFailures(env,addr,em);
  const user={id:userId,company_id:companyId,email:em,full_name:fullName,phone,role:"admin",password_version:1};
  await audit(env,user,"SELF_REGISTER","company",companyId,addr,{plan:"free",expires_at:end});

  const s=await createSession(env,user);
  return response({
    authenticated:true,
    csrf:s.csrf,
    user:{id:userId,email:em,full_name:fullName,phone,role:"admin",must_change_password:0},
    company:{id:companyId,name:companyName,plan:"free",plan_started_at:start,plan_expires_at:end,status:"active"},
    businessPaymentUrl:env.BUSINESS_PAYMENT_URL
  },201,{"set-cookie":setSessionCookie(s.token)});
}

async function login(req,env){
  if(req.method!=="POST")return response({error:"Méthode interdite"},405);
  const b=await parseJson(req),email=normEmail(b.email),password=String(b.password||""),ip=clientIp(req);
  if(await isLimited(env,ip,email))return response({error:"Trop de tentatives. Réessayez dans 15 minutes."},429);
  const user=await env.DB.prepare("SELECT * FROM users WHERE email=? LIMIT 1").bind(email).first();
  if(!user||user.status!=="active"){await addFailure(env,ip,email);return response({error:"Identifiants incorrects"},401)}
  const candidate=await passwordHash(password,user.password_salt,user.password_iterations);
  if(!await safeEqual(candidate,user.password_hash)){await addFailure(env,ip,email);await audit(env,user,"LOGIN_FAILED","user",user.id,ip);return response({error:"Identifiants incorrects"},401)}
  let company=null;
  if(user.company_id){
    company=await env.DB.prepare("SELECT * FROM companies WHERE id=?").bind(user.company_id).first();
    if(!company||company.status!=="active")return response({error:"Compte entreprise désactivé"},403);
    if(Date.parse(company.plan_expires_at)<=Date.now())return response({error:"Votre abonnement a expiré. Contactez le Super Admin."},403);
  }
  await clearFailures(env,ip,email);
  const s=await createSession(env,user);await audit(env,user,"LOGIN","user",user.id,ip);
  return response({
    authenticated:true,csrf:s.csrf,
    user:{id:user.id,email:user.email,full_name:user.full_name,phone:user.phone,role:user.role,must_change_password:user.must_change_password},
    company:company&&{id:company.id,name:company.name,plan:company.plan,plan_started_at:company.plan_started_at,plan_expires_at:company.plan_expires_at,status:company.status},
    businessPaymentUrl:env.BUSINESS_PAYMENT_URL
  },200,{"set-cookie":setSessionCookie(s.token)});
}
async function session(req,env){
  const a=await needAuth(req,env);if(a.error)return a.error;const {s}=a;
  return response({authenticated:true,csrf:s.data.csrf,user:s.user,company:s.company,businessPaymentUrl:env.BUSINESS_PAYMENT_URL});
}
async function logout(req,env){
  const a=await needAuth(req,env,null,true);
  if(a.error)return response({ok:true},200,{"set-cookie":clearSessionCookie()});
  await env.GLOBAL_BT_KV.delete(a.s.key);await audit(env,a.s.user,"LOGOUT","user",a.s.user.id,clientIp(req));
  return response({ok:true},200,{"set-cookie":clearSessionCookie()});
}
async function changeOwnPassword(req,env){
  const a=await needAuth(req,env,null,true);if(a.error)return a.error;const b=await parseJson(req);
  const full=await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(a.s.user.id).first();
  const oldCandidate=await passwordHash(String(b.current_password||""),full.password_salt,full.password_iterations);
  if(!await safeEqual(oldCandidate,full.password_hash))return response({error:"Mot de passe actuel incorrect"},400);
  const r=await setPassword(env,a.s.user,full,b.new_password,req);
  if(r.status===200) await env.DB.prepare("UPDATE users SET must_change_password=0 WHERE id=?").bind(full.id).run();
  return r;
}

async function load(req,env){
  const a=await needAuth(req,env);if(a.error)return a.error;const {s}=a;
  if(s.user.role==="superadmin"){
    const [companies,users,pending]=await Promise.all([
      env.DB.prepare("SELECT COUNT(*) n FROM companies WHERE status!='deleted'").first(),
      env.DB.prepare("SELECT COUNT(*) n FROM users WHERE status!='deleted'").first(),
      env.DB.prepare("SELECT COUNT(*) n FROM password_reset_requests WHERE status='pending'").first()
    ]);
    return response({mode:"superadmin",summary:{companies:companies.n,users:users.n,pendingResets:pending.n}});
  }
  const c=s.user.company_id;
  const [projects,trades,suppliers,expenses,labor,users,sm,sl,budget,month]=await Promise.all([
    env.DB.prepare("SELECT * FROM projects WHERE company_id=? ORDER BY created_at DESC").bind(c).all(),
    env.DB.prepare("SELECT * FROM trades WHERE company_id=? ORDER BY name").bind(c).all(),
    env.DB.prepare("SELECT * FROM suppliers WHERE company_id=? ORDER BY name").bind(c).all(),
    env.DB.prepare(`SELECT e.*,p.name project_name,t.name trade_name,s.name supplier_name
      FROM expenses e JOIN projects p ON p.id=e.project_id LEFT JOIN trades t ON t.id=e.trade_id LEFT JOIN suppliers s ON s.id=e.supplier_id
      WHERE e.company_id=? ORDER BY e.expense_date DESC,e.created_at DESC LIMIT 1500`).bind(c).all(),
    env.DB.prepare(`SELECT l.*,p.name project_name,t.name trade_name FROM labor_expenses l JOIN projects p ON p.id=l.project_id LEFT JOIN trades t ON t.id=l.trade_id
      WHERE l.company_id=? ORDER BY l.expense_date DESC,l.created_at DESC LIMIT 1500`).bind(c).all(),
    s.user.role==="admin"?env.DB.prepare("SELECT id,email,full_name,phone,role,status,created_at FROM users WHERE company_id=? AND status!='deleted' ORDER BY created_at DESC").bind(c).all():Promise.resolve({results:[]}),
    env.DB.prepare("SELECT COALESCE(SUM(total_price),0) v FROM expenses WHERE company_id=?").bind(c).first(),
    env.DB.prepare("SELECT COALESCE(SUM(amount),0) v FROM labor_expenses WHERE company_id=?").bind(c).first(),
    env.DB.prepare("SELECT COALESCE(SUM(budget),0) v FROM projects WHERE company_id=?").bind(c).first(),
    env.DB.prepare(`SELECT COALESCE((SELECT SUM(total_price) FROM expenses WHERE company_id=? AND substr(expense_date,1,7)=substr(date('now'),1,7)),0)+
      COALESCE((SELECT SUM(amount) FROM labor_expenses WHERE company_id=? AND substr(expense_date,1,7)=substr(date('now'),1,7)),0) v`).bind(c,c).first()
  ]);
  return response({
    mode:"company",
    summary:{projects:projects.results.length,materials:sm.v,labor:sl.v,budget:budget.v,month:month.v},
    projects:projects.results,trades:trades.results,suppliers:suppliers.results,expenses:expenses.results,labor:labor.results,users:users.results
  });
}

async function projectRoute(req,env){
  const a=await needAuth(req,env,["admin","agent"],true);if(a.error)return a.error;const b=await parseJson(req),c=a.s.user.company_id,act=b.action||"create";
  if(act==="create"){
    const id=crypto.randomUUID();
    await env.DB.prepare(`INSERT INTO projects(id,company_id,name,project_type,location,owner_name,manager_name,budget,start_date,end_date,status,description,created_by)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,c,cleanText(b.name,160),cleanText(b.project_type,100),cleanText(b.location,160),cleanText(b.owner_name,160),cleanText(b.manager_name,160),asMoney(b.budget),b.start_date||null,b.end_date||null,b.status||"in_progress",cleanText(b.description,1200),a.s.user.id).run();
    await audit(env,a.s.user,"CREATE_PROJECT","project",id,clientIp(req));return response({ok:true,id});
  }
  const own=await ownedProject(env,b.id,c);if(!own)return response({error:"Projet introuvable"},404);
  if(act==="update"){
    await env.DB.prepare(`UPDATE projects SET name=?,project_type=?,location=?,owner_name=?,manager_name=?,budget=?,start_date=?,end_date=?,status=?,description=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND company_id=?`)
      .bind(cleanText(b.name,160),cleanText(b.project_type,100),cleanText(b.location,160),cleanText(b.owner_name,160),cleanText(b.manager_name,160),asMoney(b.budget),b.start_date||null,b.end_date||null,b.status||"in_progress",cleanText(b.description,1200),b.id,c).run();
    await audit(env,a.s.user,"UPDATE_PROJECT","project",b.id,clientIp(req));return response({ok:true});
  }
  if(act==="delete"&&a.s.user.role==="admin"){
    const counts=await env.DB.prepare(`SELECT (SELECT COUNT(*) FROM expenses WHERE project_id=? AND company_id=?)+(SELECT COUNT(*) FROM labor_expenses WHERE project_id=? AND company_id=?) n`).bind(b.id,c,b.id,c).first();
    if(counts.n>0)return response({error:"Impossible de supprimer un projet contenant des dépenses. Passez-le en Terminé ou Suspendu."},409);
    await env.DB.prepare("DELETE FROM trades WHERE project_id=? AND company_id=?").bind(b.id,c).run();
    await env.DB.prepare("DELETE FROM projects WHERE id=? AND company_id=?").bind(b.id,c).run();
    await audit(env,a.s.user,"DELETE_PROJECT","project",b.id,clientIp(req));return response({ok:true});
  }
  return response({error:"Action interdite"},403);
}
async function tradeRoute(req,env){
  const a=await needAuth(req,env,["admin","agent"],true);if(a.error)return a.error;const b=await parseJson(req),c=a.s.user.company_id;
  if(!await ownedProject(env,b.project_id,c))return response({error:"Projet invalide"},400);
  if(b.action==="delete"){
    if(a.s.user.role!=="admin")return response({error:"Administrateur requis"},403);
    const used=await env.DB.prepare("SELECT (SELECT COUNT(*) FROM expenses WHERE trade_id=?)+(SELECT COUNT(*) FROM labor_expenses WHERE trade_id=?) n").bind(b.id,b.id).first();
    if(used.n>0)return response({error:"Métier déjà utilisé dans des dépenses"},409);
    await env.DB.prepare("DELETE FROM trades WHERE id=? AND company_id=?").bind(b.id,c).run();await audit(env,a.s.user,"DELETE_TRADE","trade",b.id,clientIp(req));return response({ok:true});
  }
  const id=crypto.randomUUID();
  try{await env.DB.prepare("INSERT INTO trades(id,company_id,project_id,name,description) VALUES(?,?,?,?,?)").bind(id,c,b.project_id,cleanText(b.name,120),cleanText(b.description,500)).run()}
  catch{return response({error:"Ce corps de métier existe déjà pour ce projet."},409)}
  await audit(env,a.s.user,"CREATE_TRADE","trade",id,clientIp(req));return response({ok:true,id});
}
async function supplierRoute(req,env){
  const a=await needAuth(req,env,["admin","agent"],true);if(a.error)return a.error;const b=await parseJson(req),c=a.s.user.company_id;
  if(b.action==="delete"){
    if(a.s.user.role!=="admin")return response({error:"Administrateur requis"},403);
    await env.DB.prepare("UPDATE expenses SET supplier_id=NULL WHERE supplier_id=? AND company_id=?").bind(b.id,c).run();
    await env.DB.prepare("DELETE FROM suppliers WHERE id=? AND company_id=?").bind(b.id,c).run();await audit(env,a.s.user,"DELETE_SUPPLIER","supplier",b.id,clientIp(req));return response({ok:true});
  }
  if(b.action==="update"){
    await env.DB.prepare(`UPDATE suppliers SET name=?,phone=?,email=?,address=?,city=?,specialty=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND company_id=?`)
      .bind(cleanText(b.name,160),cleanText(b.phone,50),normEmail(b.email)||null,cleanText(b.address,250),cleanText(b.city,120),cleanText(b.specialty,160),cleanText(b.notes,800),b.id,c).run();
    await audit(env,a.s.user,"UPDATE_SUPPLIER","supplier",b.id,clientIp(req));return response({ok:true});
  }
  const id=crypto.randomUUID();await env.DB.prepare(`INSERT INTO suppliers(id,company_id,name,phone,email,address,city,specialty,notes,created_by) VALUES(?,?,?,?,?,?,?,?,?,?)`)
    .bind(id,c,cleanText(b.name,160),cleanText(b.phone,50),normEmail(b.email)||null,cleanText(b.address,250),cleanText(b.city,120),cleanText(b.specialty,160),cleanText(b.notes,800),a.s.user.id).run();
  await audit(env,a.s.user,"CREATE_SUPPLIER","supplier",id,clientIp(req));return response({ok:true,id});
}
async function expenseRoute(req,env){
  const a=await needAuth(req,env,["admin","agent"],true);if(a.error)return a.error;const b=await parseJson(req),c=a.s.user.company_id;
  if(b.action==="delete"){
    if(a.s.user.role!=="admin")return response({error:"Administrateur requis"},403);
    const own=await env.DB.prepare("SELECT id,total_price FROM expenses WHERE id=? AND company_id=?").bind(b.id,c).first();if(!own)return response({error:"Dépense introuvable"},404);
    await env.DB.prepare("DELETE FROM expenses WHERE id=? AND company_id=?").bind(b.id,c).run();await audit(env,a.s.user,"DELETE_EXPENSE","expense",b.id,clientIp(req),{amount:own.total_price});return response({ok:true});
  }
  if(!await ownedProject(env,b.project_id,c))return response({error:"Projet invalide"},400);
  if(b.trade_id&&!await ownedTrade(env,b.trade_id,c))return response({error:"Métier invalide"},400);
  if(b.supplier_id&&!await ownedSupplier(env,b.supplier_id,c))return response({error:"Fournisseur invalide"},400);
  const qty=asQty(b.quantity),pu=asMoney(b.unit_price),total=Math.round(qty*pu);
  if(!cleanText(b.description,500))return response({error:"Désignation obligatoire"},400);
  if(b.action==="update"){
    await env.DB.prepare(`UPDATE expenses SET project_id=?,trade_id=?,supplier_id=?,expense_date=?,description=?,quantity=?,unit=?,unit_price=?,total_price=?,invoice_reference=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND company_id=?`)
      .bind(b.project_id,b.trade_id||null,b.supplier_id||null,isoDate(b.expense_date),cleanText(b.description,500),qty,cleanText(b.unit,50),pu,total,cleanText(b.invoice_reference,120),cleanText(b.notes,800),b.id,c).run();
    await audit(env,a.s.user,"UPDATE_EXPENSE","expense",b.id,clientIp(req),{total});return response({ok:true});
  }
  const id=crypto.randomUUID();await env.DB.prepare(`INSERT INTO expenses(id,company_id,project_id,trade_id,supplier_id,expense_date,description,quantity,unit,unit_price,total_price,invoice_reference,notes,created_by)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,c,b.project_id,b.trade_id||null,b.supplier_id||null,isoDate(b.expense_date),cleanText(b.description,500),qty,cleanText(b.unit,50),pu,total,cleanText(b.invoice_reference,120),cleanText(b.notes,800),a.s.user.id).run();
  await audit(env,a.s.user,"CREATE_EXPENSE","expense",id,clientIp(req),{total});return response({ok:true,id,total});
}
async function laborRoute(req,env){
  const a=await needAuth(req,env,["admin","agent"],true);if(a.error)return a.error;const b=await parseJson(req),c=a.s.user.company_id;
  if(b.action==="delete"){
    if(a.s.user.role!=="admin")return response({error:"Administrateur requis"},403);
    const own=await env.DB.prepare("SELECT id,amount FROM labor_expenses WHERE id=? AND company_id=?").bind(b.id,c).first();if(!own)return response({error:"Dépense introuvable"},404);
    await env.DB.prepare("DELETE FROM labor_expenses WHERE id=? AND company_id=?").bind(b.id,c).run();await audit(env,a.s.user,"DELETE_LABOR","labor",b.id,clientIp(req),{amount:own.amount});return response({ok:true});
  }
  if(!await ownedProject(env,b.project_id,c))return response({error:"Projet invalide"},400);
  if(b.trade_id&&!await ownedTrade(env,b.trade_id,c))return response({error:"Métier invalide"},400);
  const amount=asMoney(b.amount);if(!cleanText(b.work_description,500))return response({error:"Nature des travaux obligatoire"},400);
  if(b.action==="update"){
    await env.DB.prepare(`UPDATE labor_expenses SET project_id=?,trade_id=?,expense_date=?,worker_name=?,work_description=?,amount=?,payment_method=?,payment_reference=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND company_id=?`)
      .bind(b.project_id,b.trade_id||null,isoDate(b.expense_date),cleanText(b.worker_name,160),cleanText(b.work_description,500),amount,cleanText(b.payment_method,80),cleanText(b.payment_reference,120),cleanText(b.notes,800),b.id,c).run();
    await audit(env,a.s.user,"UPDATE_LABOR","labor",b.id,clientIp(req),{amount});return response({ok:true});
  }
  const id=crypto.randomUUID();await env.DB.prepare(`INSERT INTO labor_expenses(id,company_id,project_id,trade_id,expense_date,worker_name,work_description,amount,payment_method,payment_reference,notes,created_by)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,c,b.project_id,b.trade_id||null,isoDate(b.expense_date),cleanText(b.worker_name,160),cleanText(b.work_description,500),amount,cleanText(b.payment_method,80),cleanText(b.payment_reference,120),cleanText(b.notes,800),a.s.user.id).run();
  await audit(env,a.s.user,"CREATE_LABOR","labor",id,clientIp(req),{amount});return response({ok:true,id});
}

async function companyUsers(req,env){
  const a=await needAuth(req,env,["admin"]);if(a.error)return a.error;
  const r=await env.DB.prepare("SELECT id,email,full_name,phone,role,status,created_at FROM users WHERE company_id=? AND status!='deleted' ORDER BY created_at DESC").bind(a.s.user.company_id).all();
  return response({users:r.results});
}
async function companyUserAction(req,env){
  const a=await needAuth(req,env,["admin"],true);if(a.error)return a.error;const b=await parseJson(req),c=a.s.user.company_id;
  if(b.action==="create"){
    const em=normEmail(b.email);if(!em||String(b.password||"").length<12)return response({error:"E-mail valide et mot de passe d'au moins 12 caractères requis"},400);
    const exists=await env.DB.prepare("SELECT id FROM users WHERE email=?").bind(em).first();if(exists)return response({error:"Cet e-mail existe déjà"},409);
    const salt=randomToken(16),hash=await passwordHash(String(b.password),salt),id=crypto.randomUUID();
    await env.DB.prepare(`INSERT INTO users(id,company_id,email,full_name,phone,role,password_hash,password_salt,password_iterations,password_version,must_change_password,status,created_by)
      VALUES(?,?,?,?,?,'agent',?,?,?,1,1,'active',?)`).bind(id,c,em,cleanText(b.full_name,160),cleanText(b.phone,50),hash,salt,ITERATIONS,a.s.user.id).run();
    await audit(env,a.s.user,"CREATE_AGENT","user",id,clientIp(req));return response({ok:true,id});
  }
  const target=await env.DB.prepare("SELECT * FROM users WHERE id=? AND company_id=? AND role='agent'").bind(b.user_id,c).first();
  if(!target)return response({error:"Agent introuvable"},404);
  if(["activate","disable","delete"].includes(b.action)){
    const st={activate:"active",disable:"disabled",delete:"deleted"}[b.action];
    await env.DB.prepare("UPDATE users SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(st,target.id).run();
    await audit(env,a.s.user,`AGENT_${b.action.toUpperCase()}`,"user",target.id,clientIp(req));return response({ok:true});
  }
  if(b.action==="reset_password")return await setPassword(env,a.s.user,target,b.new_password,req);
  return response({error:"Action invalide"},400);
}
async function resetRequest(req,env){
  if(req.method!=="POST")return response({error:"Méthode interdite"},405);
  const b=await parseJson(req),em=normEmail(b.email),addr=clientIp(req);
  const user=await env.DB.prepare("SELECT id,company_id,role FROM users WHERE email=? AND status!='deleted'").bind(em).first();
  if(user){
    const duplicate=await env.DB.prepare("SELECT id FROM password_reset_requests WHERE user_id=? AND status='pending' LIMIT 1").bind(user.id).first();
    if(!duplicate)await env.DB.prepare(`INSERT INTO password_reset_requests(id,company_id,user_id,email,requested_by_ip,target_role) VALUES(?,?,?,?,?,?)`)
      .bind(crypto.randomUUID(),user.company_id,user.id,em,addr,user.role).run();
    await audit(env,user,"PASSWORD_RESET_REQUEST","user",user.id,addr);
  }
  return response({ok:true,message:"Si ce compte existe, la demande a été enregistrée."});
}
async function adminResetRequests(req,env){
  const a=await needAuth(req,env,["admin"]);if(a.error)return a.error;
  const r=await env.DB.prepare(`SELECT r.*,u.full_name FROM password_reset_requests r LEFT JOIN users u ON u.id=r.user_id
    WHERE r.company_id=? AND r.target_role='agent' ORDER BY r.created_at DESC LIMIT 200`).bind(a.s.user.company_id).all();
  return response({requests:r.results});
}
async function resolveReset(env,actor,id,status){
  await env.DB.prepare("UPDATE password_reset_requests SET status=?,handled_by=?,handled_at=CURRENT_TIMESTAMP WHERE id=?").bind(status,actor.id,id).run();
}

async function importExcel(req,env){
  const a=await needAuth(req,env,["admin"],true);if(a.error)return a.error;const b=await parseJson(req),c=a.s.user.company_id;
  const rows=Array.isArray(b.rows)?b.rows.slice(0,5000):[];if(!rows.length)return response({error:"Aucune ligne à importer"},400);
  let projectId=b.project_id;
  if(!projectId){
    projectId=crypto.randomUUID();
    await env.DB.prepare(`INSERT INTO projects(id,company_id,name,project_type,location,budget,status,description,created_by) VALUES(?,?,?,?,?,0,'in_progress',?,?)`)
      .bind(projectId,c,cleanText(b.project_name||"Construction Bâtiment A",160),"Bâtiment",cleanText(b.location||"Koko 1",160),"Projet importé depuis bt.xlsx",a.s.user.id).run();
  } else if(!await ownedProject(env,projectId,c)) return response({error:"Projet invalide"},400);
  const tradeMap=new Map();
  for(const name of [...new Set(rows.map(r=>cleanText(r.trade,120)).filter(Boolean))]){
    let t=await env.DB.prepare("SELECT id FROM trades WHERE company_id=? AND project_id=? AND name=?").bind(c,projectId,name).first();
    if(!t){const id=crypto.randomUUID();await env.DB.prepare("INSERT INTO trades(id,company_id,project_id,name) VALUES(?,?,?,?)").bind(id,c,projectId,name).run();t={id}}
    tradeMap.set(name,t.id);
  }
  let materials=0,labor=0;
  for(const r of rows){
    const trade=cleanText(r.trade,120),tradeId=tradeMap.get(trade)||null,date=isoDate(r.date);
    const desc=cleanText(r.description,500),qty=asQty(r.quantity),pu=asMoney(r.unit_price),main=asMoney(r.labor);
    if(desc&&(qty>0||pu>0)){
      const total=Math.round(qty*pu),id=crypto.randomUUID();
      await env.DB.prepare(`INSERT INTO expenses(id,company_id,project_id,trade_id,expense_date,description,quantity,unit_price,total_price,notes,created_by)
        VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(id,c,projectId,tradeId,date,desc,qty,pu,total,"Import bt.xlsx",a.s.user.id).run();materials++;
    }
    if(main>0){
      const id=crypto.randomUUID();
      await env.DB.prepare(`INSERT INTO labor_expenses(id,company_id,project_id,trade_id,expense_date,worker_name,work_description,amount,notes,created_by)
        VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(id,c,projectId,tradeId,date,"Main-d'œuvre importée",desc||trade,main,"Import bt.xlsx",a.s.user.id).run();labor++;
    }
  }
  await audit(env,a.s.user,"IMPORT_EXCEL","project",projectId,clientIp(req),{rows:rows.length,materials,labor});
  return response({ok:true,project_id:projectId,materials,labor});
}

async function reports(req,env){
  const a=await needAuth(req,env,["admin","agent"]);if(a.error)return a.error;const c=a.s.user.company_id,u=new URL(req.url);
  const project=u.searchParams.get("project_id")||"",start=u.searchParams.get("start")||"0000-01-01",end=u.searchParams.get("end")||"9999-12-31";
  const px=project?" AND project_id=?":"",params=project?[c,start,end,project]:[c,start,end];
  const mat=await env.DB.prepare(`SELECT project_id,COALESCE(SUM(total_price),0) total FROM expenses WHERE company_id=? AND expense_date BETWEEN ? AND ?${px} GROUP BY project_id`).bind(...params).all();
  const lab=await env.DB.prepare(`SELECT project_id,COALESCE(SUM(amount),0) total FROM labor_expenses WHERE company_id=? AND expense_date BETWEEN ? AND ?${px} GROUP BY project_id`).bind(...params).all();
  const byTrade=await env.DB.prepare(`SELECT COALESCE(t.name,'Sans métier') name,
    COALESCE((SELECT SUM(e.total_price) FROM expenses e WHERE e.company_id=? AND e.trade_id=t.id AND e.expense_date BETWEEN ? AND ?),0) materials,
    COALESCE((SELECT SUM(l.amount) FROM labor_expenses l WHERE l.company_id=? AND l.trade_id=t.id AND l.expense_date BETWEEN ? AND ?),0) labor
    FROM trades t WHERE t.company_id=? ORDER BY name`).bind(c,start,end,c,start,end,c).all();
  const monthly=await env.DB.prepare(`SELECT month,SUM(total) total FROM (
      SELECT substr(expense_date,1,7) month,SUM(total_price) total FROM expenses WHERE company_id=? GROUP BY month
      UNION ALL SELECT substr(expense_date,1,7) month,SUM(amount) total FROM labor_expenses WHERE company_id=? GROUP BY month
    ) GROUP BY month ORDER BY month DESC LIMIT 12`).bind(c,c).all();
  return response({materials:mat.results,labor:lab.results,byTrade:byTrade.results,monthly:monthly.results});
}

async function superDashboard(req,env){
  const a=await needAuth(req,env,["superadmin"]);if(a.error)return a.error;
  const [companies,users,free,business,pending,expired]=await Promise.all([
    env.DB.prepare("SELECT COUNT(*) n FROM companies WHERE status!='deleted'").first(),
    env.DB.prepare("SELECT COUNT(*) n FROM users WHERE status!='deleted'").first(),
    env.DB.prepare("SELECT COUNT(*) n FROM companies WHERE status='active' AND plan='free'").first(),
    env.DB.prepare("SELECT COUNT(*) n FROM companies WHERE status='active' AND plan='business'").first(),
    env.DB.prepare("SELECT COUNT(*) n FROM password_reset_requests WHERE status='pending'").first(),
    env.DB.prepare("SELECT COUNT(*) n FROM companies WHERE status='active' AND datetime(plan_expires_at)<=datetime('now')").first()
  ]);
  return response({summary:{companies:companies.n,users:users.n,free:free.n,business:business.n,pending:pending.n,expired:expired.n}});
}
async function superCompanies(req,env){
  const a=await needAuth(req,env,["superadmin"]);if(a.error)return a.error;
  const r=await env.DB.prepare(`SELECT c.*,
    (SELECT COUNT(*) FROM users u WHERE u.company_id=c.id AND u.status!='deleted') user_count,
    (SELECT COUNT(*) FROM projects p WHERE p.company_id=c.id) project_count
    FROM companies c WHERE c.status!='deleted' ORDER BY c.created_at DESC`).all();return response({companies:r.results});
}
async function superCompanyAction(req,env){
  const a=await needAuth(req,env,["superadmin"],true);if(a.error)return a.error;const b=await parseJson(req);
  if(b.action==="create"){
    const companyId=crypto.randomUUID(),plan=b.plan==="business"?"business":"free",days=plan==="business"?365:21,start=nowIso(),end=addDays(days);
    const adminEmail=normEmail(b.admin_email);if(!adminEmail||String(b.admin_password||"").length<12)return response({error:"E-mail administrateur et mot de passe d'au moins 12 caractères requis"},400);
    if(await env.DB.prepare("SELECT id FROM users WHERE email=?").bind(adminEmail).first())return response({error:"Cet e-mail utilisateur existe déjà"},409);
    await env.DB.prepare(`INSERT INTO companies(id,name,code,phone,email,address,city,status,plan,plan_started_at,plan_expires_at) VALUES(?,?,?,?,?,?,?,'active',?,?,?)`)
      .bind(companyId,cleanText(b.name,180),cleanText(b.code,60)||null,cleanText(b.phone,50),normEmail(b.email)||null,cleanText(b.address,250),cleanText(b.city,120),plan,start,end).run();
    const uid=crypto.randomUUID(),salt=randomToken(16),hash=await passwordHash(String(b.admin_password),salt);
    await env.DB.prepare(`INSERT INTO users(id,company_id,email,full_name,phone,role,password_hash,password_salt,password_iterations,password_version,must_change_password,status,created_by)
      VALUES(?,?,?,?,?,'admin',?,?,?,1,1,'active',?)`).bind(uid,companyId,adminEmail,cleanText(b.admin_name,160),cleanText(b.admin_phone,50),hash,salt,ITERATIONS,a.s.user.id).run();
    await audit(env,a.s.user,"CREATE_COMPANY","company",companyId,clientIp(req),{plan,admin_id:uid});return response({ok:true,company_id:companyId});
  }
  const company=await env.DB.prepare("SELECT * FROM companies WHERE id=?").bind(b.company_id).first();if(!company)return response({error:"Entreprise introuvable"},404);
  if(b.action==="set_plan"){
    const plan=b.plan==="business"?"business":"free",days=plan==="business"?365:21,start=nowIso(),end=addDays(days);
    await env.DB.prepare("UPDATE companies SET plan=?,plan_started_at=?,plan_expires_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(plan,start,end,company.id).run();
    await audit(env,a.s.user,"SET_PLAN","company",company.id,clientIp(req),{plan,end});return response({ok:true});
  }
  if(["activate","disable","delete"].includes(b.action)){
    const st={activate:"active",disable:"disabled",delete:"deleted"}[b.action];
    await env.DB.prepare("UPDATE companies SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(st,company.id).run();
    if(st!=="active")await env.DB.prepare("UPDATE users SET status='disabled',updated_at=CURRENT_TIMESTAMP WHERE company_id=? AND status='active'").bind(company.id).run();
    if(st==="active")await env.DB.prepare("UPDATE users SET status='active',updated_at=CURRENT_TIMESTAMP WHERE company_id=? AND role='admin' AND status='disabled'").bind(company.id).run();
    await audit(env,a.s.user,`COMPANY_${b.action.toUpperCase()}`,"company",company.id,clientIp(req));return response({ok:true});
  }
  return response({error:"Action invalide"},400);
}
async function superUsers(req,env){
  const a=await needAuth(req,env,["superadmin"]);if(a.error)return a.error;
  const r=await env.DB.prepare(`SELECT u.id,u.company_id,u.email,u.full_name,u.phone,u.role,u.status,u.must_change_password,u.created_at,c.name company_name,c.plan,c.plan_expires_at
    FROM users u LEFT JOIN companies c ON c.id=u.company_id WHERE u.status!='deleted' ORDER BY u.created_at DESC`).all();return response({users:r.results});
}
async function superUserAction(req,env){
  const a=await needAuth(req,env,["superadmin"],true);if(a.error)return a.error;const b=await parseJson(req),target=await userById(env,b.user_id);
  if(!target||target.role==="superadmin")return response({error:"Compte cible protégé ou introuvable"},400);
  if(["activate","disable","delete"].includes(b.action)){
    const st={activate:"active",disable:"disabled",delete:"deleted"}[b.action];await env.DB.prepare("UPDATE users SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(st,target.id).run();
    await audit(env,a.s.user,`SUPER_USER_${b.action.toUpperCase()}`,"user",target.id,clientIp(req));return response({ok:true});
  }
  if(b.action==="reset_password"){
    const out=await setPassword(env,a.s.user,target,b.new_password,req);
    if(out.status===200&&b.reset_request_id)await resolveReset(env,a.s.user,b.reset_request_id,"resolved");
    return out;
  }
  return response({error:"Action invalide"},400);
}
async function superResets(req,env){
  const a=await needAuth(req,env,["superadmin"]);if(a.error)return a.error;
  const r=await env.DB.prepare(`SELECT r.*,u.full_name,u.role,c.name company_name FROM password_reset_requests r
    LEFT JOIN users u ON u.id=r.user_id LEFT JOIN companies c ON c.id=r.company_id ORDER BY r.created_at DESC LIMIT 500`).all();return response({requests:r.results});
}
async function superResetAction(req,env){
  const a=await needAuth(req,env,["superadmin"],true);if(a.error)return a.error;const b=await parseJson(req);
  if(b.action==="reject"){await resolveReset(env,a.s.user,b.request_id,"rejected");await audit(env,a.s.user,"REJECT_RESET","password_reset",b.request_id,clientIp(req));return response({ok:true})}
  const rr=await env.DB.prepare("SELECT * FROM password_reset_requests WHERE id=?").bind(b.request_id).first();if(!rr||!rr.user_id)return response({error:"Demande invalide"},404);
  const target=await userById(env,rr.user_id);if(!target||target.role==="superadmin")return response({error:"Cible invalide"},400);
  const out=await setPassword(env,a.s.user,target,b.new_password,req);if(out.status===200)await resolveReset(env,a.s.user,rr.id,"resolved");return out;
}
async function superAudit(req,env){
  const a=await needAuth(req,env,["superadmin"]);if(a.error)return a.error;const u=new URL(req.url),limit=Math.min(1000,Math.max(20,Number(u.searchParams.get("limit")||300)));
  const r=await env.DB.prepare(`SELECT a.*,u.full_name actor_name,c.name company_name FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_user_id LEFT JOIN companies c ON c.id=a.company_id ORDER BY a.created_at DESC LIMIT ?`).bind(limit).all();
  return response({logs:r.results});
}

async function route(req,env){
  const p=new URL(req.url).pathname;
  if(p==="/api/health")return health(req,env);
  if(p==="/api/bootstrap")return bootstrap(req,env);
  if(p==="/api/register")return register(req,env);
  if(p==="/api/login")return login(req,env);
  if(p==="/api/session")return session(req,env);
  if(p==="/api/logout")return logout(req,env);
  if(p==="/api/change-password")return changeOwnPassword(req,env);
  if(p==="/api/load")return load(req,env);
  if(p==="/api/project")return projectRoute(req,env);
  if(p==="/api/trade")return tradeRoute(req,env);
  if(p==="/api/supplier")return supplierRoute(req,env);
  if(p==="/api/expense")return expenseRoute(req,env);
  if(p==="/api/labor")return laborRoute(req,env);
  if(p==="/api/users")return companyUsers(req,env);
  if(p==="/api/user-action")return companyUserAction(req,env);
  if(p==="/api/password-reset/request")return resetRequest(req,env);
  if(p==="/api/admin/reset-requests")return adminResetRequests(req,env);
  if(p==="/api/import-excel")return importExcel(req,env);
  if(p==="/api/reports")return reports(req,env);
  if(p==="/api/super/dashboard")return superDashboard(req,env);
  if(p==="/api/super/companies")return superCompanies(req,env);
  if(p==="/api/super/company-action")return superCompanyAction(req,env);
  if(p==="/api/super/users")return superUsers(req,env);
  if(p==="/api/super/user-action")return superUserAction(req,env);
  if(p==="/api/super/resets")return superResets(req,env);
  if(p==="/api/super/reset-action")return superResetAction(req,env);
  if(p==="/api/super/audit")return superAudit(req,env);
  return response({error:"Route API introuvable"},404);
}
export default {
  async fetch(request,env,ctx){
    try{
      const url=new URL(request.url);
      if(url.pathname.startsWith("/api/"))return await route(request,env);
      return env.ASSETS.fetch(request);
    }catch(err){
      console.error(JSON.stringify({event:"worker_error",message:err?.message||String(err),stack:err?.stack||""}));
      return response({error:"Erreur serveur"},500);
    }
  }
};
