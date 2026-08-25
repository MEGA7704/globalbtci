const enc=new TextEncoder();
const ITER=210000, NEW_CRED_ITER=100000, SESSION_TTL=28800, RATE_TTL=900, MAX_FAIL=5;

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

async function kvCredentialKey(userId){
  return `cred:v1:${userId}`;
}
async function makeMemberCredential(password){
  const p=String(password||"");
  if(p.length<12)throw new Error("PASSWORD_TOO_SHORT");
  try{
    const salt=b64(bytes(16));
    const hash=await hashPassword(p,salt,NEW_CRED_ITER);
    if(!hash||typeof hash!=="string")throw new Error("EMPTY_PASSWORD_HASH");
    return {
      password_hash:hash,
      password_salt:salt,
      password_iterations:NEW_CRED_ITER,
      updated_at:now()
    };
  }catch(e){
    console.error(JSON.stringify({
      event:"credential_prepare_error",
      name:e?.name||"",
      message:e?.message||String(e)
    }));
    throw new Error("PASSWORD_HASH_FAILED");
  }
}
async function putMemberCredentialKV(env,userId,credential){
  await env.GLOBAL_BT_KV.put(await kvCredentialKey(userId),JSON.stringify(credential));
}
async function setMemberCredentialKV(env,userId,password){
  await putMemberCredentialKV(env,userId,await makeMemberCredential(password));
}
async function getMemberCredentialKV(env,userId){
  const key=await kvCredentialKey(userId);
  let cr=await env.GLOBAL_BT_KV.get(key,"json");
  if(cr)return cr;

  try{
    let old=null;
    try{old=await env.DB.prepare("SELECT * FROM member_credentials_v3 WHERE user_id=?").bind(userId).first()}catch{}
    if(!old){try{old=await env.DB.prepare("SELECT * FROM auth_credentials_v2 WHERE user_id=?").bind(userId).first()}catch{}}
    if(!old){try{old=await env.DB.prepare("SELECT * FROM user_credentials WHERE user_id=?").bind(userId).first()}catch{}}
    if(old&&old.password_hash&&old.password_salt){
      cr={
        password_hash:old.password_hash,
        password_salt:old.password_salt,
        password_iterations:Number(old.password_iterations||ITER),
        updated_at:now()
      };
      await env.GLOBAL_BT_KV.put(key,JSON.stringify(cr));
      return cr;
    }
  }catch(e){
    console.error(JSON.stringify({event:"credential_kv_migration_warning",message:e?.message||String(e)}));
  }
  return null;
}
async function deleteMemberCredentialKV(env,userId){
  await env.GLOBAL_BT_KV.delete(await kvCredentialKey(userId));
}
async function sha(s){return hex(new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(s))))}
function cookie(req,name){for(const p of (req.headers.get("cookie")||"").split(";")){const [k,...r]=p.trim().split("=");if(k===name)return r.join("=")}return null}
const setCookie=t=>`gbt_session=${t}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL}`;
const clearCookie=()=>`gbt_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
async function body(req){try{return await req.json()}catch{return {}}}

async function tableInfo(env,t){const r=await env.DB.prepare(`PRAGMA table_info(${t})`).all();return r.results||[]}
async function columns(env,t){return new Set((await tableInfo(env,t)).map(x=>x.name))}
async function ensureColumn(env,t,n,def){
  const c=await columns(env,t);
  if(c.has(n))return;
  try{await env.DB.prepare(`ALTER TABLE ${t} ADD COLUMN ${n} ${def}`).run()}
  catch(e){
    console.error(JSON.stringify({event:"ensure_column_error",table:t,column:n,message:e?.message||String(e)}));
    throw e;
  }
}
async function ensureSchema(env){
  const sql=[
`CREATE TABLE IF NOT EXISTS companies(id TEXT PRIMARY KEY,name TEXT NOT NULL,code TEXT,phone TEXT,email TEXT,city TEXT,address TEXT,plan TEXT NOT NULL DEFAULT 'free',plan_started_at TEXT NOT NULL,plan_expires_at TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'active',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,company_id TEXT,email TEXT NOT NULL COLLATE NOCASE UNIQUE,full_name TEXT NOT NULL,phone TEXT,role TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'active',password_version INTEGER NOT NULL DEFAULT 1,must_change_password INTEGER NOT NULL DEFAULT 0,created_by TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
`CREATE TABLE IF NOT EXISTS user_credentials(user_id TEXT PRIMARY KEY,password_hash TEXT NOT NULL,password_salt TEXT NOT NULL,password_iterations INTEGER NOT NULL DEFAULT 210000,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
`CREATE TABLE IF NOT EXISTS auth_credentials_v2(user_id TEXT PRIMARY KEY,password_hash TEXT NOT NULL,password_salt TEXT NOT NULL,password_iterations INTEGER NOT NULL DEFAULT 210000,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
`CREATE TABLE IF NOT EXISTS member_credentials_v3(user_id TEXT PRIMARY KEY,password_hash TEXT NOT NULL,password_salt TEXT NOT NULL,password_iterations INTEGER NOT NULL DEFAULT 210000,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,  
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

  // Compatibilité avec les anciennes versions de la table companies.
  await ensureColumn(env,"companies","code","TEXT");
  await ensureColumn(env,"companies","phone","TEXT");
  await ensureColumn(env,"companies","email","TEXT");
  await ensureColumn(env,"companies","city","TEXT");
  await ensureColumn(env,"companies","address","TEXT");
  await ensureColumn(env,"companies","updated_at","TEXT");

  // Réparation complète des anciens schémas métier.
  await ensureColumn(env,"projects","project_type","TEXT");
  await ensureColumn(env,"projects","location","TEXT");
  await ensureColumn(env,"projects","owner_name","TEXT");
  await ensureColumn(env,"projects","manager_name","TEXT");
  await ensureColumn(env,"projects","budget","INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(env,"projects","start_date","TEXT");
  await ensureColumn(env,"projects","end_date","TEXT");
  await ensureColumn(env,"projects","status","TEXT NOT NULL DEFAULT 'in_progress'");
  await ensureColumn(env,"projects","description","TEXT");
  await ensureColumn(env,"projects","created_by","TEXT");
  await ensureColumn(env,"projects","created_at","TEXT");
  await ensureColumn(env,"projects","updated_at","TEXT");

  await ensureColumn(env,"trades","phase","TEXT");
  await ensureColumn(env,"trades","description","TEXT");
  await ensureColumn(env,"trades","created_at","TEXT");

  await ensureColumn(env,"suppliers","phone","TEXT");
  await ensureColumn(env,"suppliers","email","TEXT");
  await ensureColumn(env,"suppliers","city","TEXT");
  await ensureColumn(env,"suppliers","address","TEXT");
  await ensureColumn(env,"suppliers","specialty","TEXT");
  await ensureColumn(env,"suppliers","notes","TEXT");
  await ensureColumn(env,"suppliers","created_by","TEXT");
  await ensureColumn(env,"suppliers","created_at","TEXT");
  await ensureColumn(env,"suppliers","updated_at","TEXT");

  await ensureColumn(env,"expenses","trade_id","TEXT");
  await ensureColumn(env,"expenses","supplier_id","TEXT");
  await ensureColumn(env,"expenses","expense_date","TEXT");
  await ensureColumn(env,"expenses","description","TEXT");
  await ensureColumn(env,"expenses","quantity","REAL NOT NULL DEFAULT 0");
  await ensureColumn(env,"expenses","unit","TEXT");
  await ensureColumn(env,"expenses","unit_price","INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(env,"expenses","total_price","INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(env,"expenses","reference","TEXT");
  await ensureColumn(env,"expenses","notes","TEXT");
  await ensureColumn(env,"expenses","created_by","TEXT");
  await ensureColumn(env,"expenses","created_at","TEXT");
  await ensureColumn(env,"expenses","updated_at","TEXT");

  await ensureColumn(env,"labor_expenses","trade_id","TEXT");
  await ensureColumn(env,"labor_expenses","expense_date","TEXT");
  await ensureColumn(env,"labor_expenses","worker_name","TEXT");
  await ensureColumn(env,"labor_expenses","description","TEXT");
  await ensureColumn(env,"labor_expenses","amount","INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(env,"labor_expenses","payment_method","TEXT");
  await ensureColumn(env,"labor_expenses","reference","TEXT");
  await ensureColumn(env,"labor_expenses","notes","TEXT");
  await ensureColumn(env,"labor_expenses","created_by","TEXT");
  await ensureColumn(env,"labor_expenses","created_at","TEXT");
  await ensureColumn(env,"labor_expenses","updated_at","TEXT");

  await ensureColumn(env,"password_reset_requests","company_id","TEXT");
  await ensureColumn(env,"password_reset_requests","user_id","TEXT");
  await ensureColumn(env,"password_reset_requests","email","TEXT");
  await ensureColumn(env,"password_reset_requests","target_role","TEXT");
  await ensureColumn(env,"password_reset_requests","status","TEXT NOT NULL DEFAULT 'pending'");
  await ensureColumn(env,"password_reset_requests","requested_ip","TEXT");
  await ensureColumn(env,"password_reset_requests","handled_by","TEXT");
  await ensureColumn(env,"password_reset_requests","created_at","TEXT");
  await ensureColumn(env,"password_reset_requests","handled_at","TEXT");

  await ensureColumn(env,"audit_logs","company_id","TEXT");
  await ensureColumn(env,"audit_logs","actor_user_id","TEXT");
  await ensureColumn(env,"audit_logs","action","TEXT");
  await ensureColumn(env,"audit_logs","target_type","TEXT");
  await ensureColumn(env,"audit_logs","target_id","TEXT");
  await ensureColumn(env,"audit_logs","ip","TEXT");
  await ensureColumn(env,"audit_logs","metadata_json","TEXT");
  await ensureColumn(env,"audit_logs","created_at","TEXT");

}
const SCHEMA_READY_KEY="schema:global-bt:v19";
async function markSchemaReady(env){await env.GLOBAL_BT_KV.put(SCHEMA_READY_KEY,"1")}
async function requireSchemaReady(env){
  if((await env.GLOBAL_BT_KV.get(SCHEMA_READY_KEY))==="1")return true;
  const r=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('companies','users','projects','expenses')").all();
  const names=new Set((r.results||[]).map(x=>x.name));
  const ok=["companies","users","projects","expenses"].every(x=>names.has(x));
  if(ok)await markSchemaReady(env);
  return ok;
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

async function insertLaborCompatible(env,row){
  const info=await tableInfo(env,"labor_expenses");
  const names=[],vals=[],qs=[],supplied=new Set();
  const has=n=>info.some(x=>x.name===n);
  const add=(n,v)=>{if(has(n)){names.push(n);vals.push(v);qs.push("?");supplied.add(n)}};

  add("id",row.id);
  add("company_id",row.company_id);
  add("project_id",row.project_id);
  add("trade_id",row.trade_id||null);
  add("expense_date",row.expense_date);
  add("worker_name",row.worker_name||"");
  add("description",row.description||"Main-d'œuvre");
  add("work_description",row.description||"Main-d'œuvre");
  add("amount",row.amount||0);
  add("payment_method",row.payment_method||"");
  add("reference",row.reference||"");
  add("payment_reference",row.reference||"");
  add("notes",row.notes||"");
  add("created_by",row.created_by);
  add("created_at",now());
  add("updated_at",now());

  const bad=info.filter(x =>
    Number(x.notnull)===1 &&
    x.dflt_value==null &&
    Number(x.pk)!==1 &&
    !supplied.has(x.name)
  );
  if(bad.length)throw new Error("LABOR_REQUIRED_COLUMNS:"+bad.map(x=>x.name).join(","));

  await env.DB.prepare(`INSERT INTO labor_expenses(${names.join(",")}) VALUES(${qs.join(",")})`).bind(...vals).run();
}

async function insertCompanyProfile(env,c){
  const info=await tableInfo(env,"companies"),names=[],vals=[],qs=[],supplied=new Set();
  const has=n=>info.some(x=>x.name===n);
  const add=(n,v)=>{if(has(n)){names.push(n);vals.push(v);qs.push("?");supplied.add(n)}};

  add("id",c.id);
  add("name",c.name);
  add("code",c.code||null);
  add("phone",c.phone||"");
  add("email",c.email||null);
  add("city",c.city||"");
  add("address",c.address||"");
  add("plan",c.plan||"free");
  add("plan_started_at",c.plan_started_at);
  add("plan_expires_at",c.plan_expires_at);
  add("status",c.status||"active");
  add("created_at",now());
  add("updated_at",now());

  const bad=info.filter(x =>
    Number(x.notnull)===1 &&
    x.dflt_value==null &&
    Number(x.pk)!==1 &&
    !supplied.has(x.name)
  );
  if(bad.length)throw new Error("UNSUPPORTED_COMPANY_COLUMNS:"+bad.map(x=>x.name).join(","));

  await env.DB.prepare(`INSERT INTO companies(${names.join(",")}) VALUES(${qs.join(",")})`).bind(...vals).run();
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
async function setCredentialV2(env,userId,password){
  if(String(password).length<12)throw new Error("PASSWORD_TOO_SHORT");
  const salt=b64(bytes(16));
  const hash=await hashPassword(String(password),salt);
  await env.DB.prepare(`INSERT INTO auth_credentials_v2(user_id,password_hash,password_salt,password_iterations,updated_at)
    VALUES(?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      password_hash=excluded.password_hash,
      password_salt=excluded.password_salt,
      password_iterations=excluded.password_iterations,
      updated_at=CURRENT_TIMESTAMP`)
    .bind(userId,hash,salt,ITER).run();
}
async function setInitialSuperadminCredential(env,userId,password){
  // Le mot de passe initial vient exclusivement d'un secret Cloudflare.
  // Il peut être plus court que la règle des membres, mais doit rester raisonnable.
  if(String(password).length<8)throw new Error("SUPERADMIN_INITIAL_PASSWORD_TOO_SHORT");
  const salt=b64(bytes(16));
  const hash=await hashPassword(String(password),salt);
  await env.DB.prepare(`INSERT INTO auth_credentials_v2(user_id,password_hash,password_salt,password_iterations,updated_at)
    VALUES(?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      password_hash=excluded.password_hash,
      password_salt=excluded.password_salt,
      password_iterations=excluded.password_iterations,
      updated_at=CURRENT_TIMESTAMP`)
    .bind(userId,hash,salt,ITER).run();
}
async function getCredentialV2(env,userId){
  let cr=await env.DB.prepare("SELECT * FROM auth_credentials_v2 WHERE user_id=?").bind(userId).first();
  if(cr)return cr;

  // Compatibilité : recopier un ancien credential valide vers V2 si disponible.
  try{
    const old=await env.DB.prepare("SELECT * FROM user_credentials WHERE user_id=?").bind(userId).first();
    if(old&&old.password_hash&&old.password_salt){
      await env.DB.prepare(`INSERT INTO auth_credentials_v2(user_id,password_hash,password_salt,password_iterations,updated_at)
        VALUES(?,?,?,?,CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO NOTHING`)
        .bind(userId,old.password_hash,old.password_salt,Number(old.password_iterations||ITER)).run();
      cr=await env.DB.prepare("SELECT * FROM auth_credentials_v2 WHERE user_id=?").bind(userId).first();
    }
  }catch(e){
    console.error(JSON.stringify({event:"legacy_credential_copy_warning",message:e?.message||String(e)}));
  }
  return cr||null;
}
async function setMemberCredentialV3(env,userId,password){
  if(String(password).length<12)throw new Error("PASSWORD_TOO_SHORT");
  const salt=b64(bytes(16));
  const hash=await hashPassword(String(password),salt);
  await env.DB.prepare(`INSERT INTO member_credentials_v3(user_id,password_hash,password_salt,password_iterations,updated_at)
    VALUES(?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      password_hash=excluded.password_hash,
      password_salt=excluded.password_salt,
      password_iterations=excluded.password_iterations,
      updated_at=CURRENT_TIMESTAMP`)
    .bind(userId,hash,salt,ITER).run();
}
async function getMemberCredentialV3(env,userId){
  let cr=await env.DB.prepare("SELECT * FROM member_credentials_v3 WHERE user_id=?").bind(userId).first();
  if(cr)return cr;

  // Migration non bloquante depuis V2 puis ancienne table.
  try{
    const v2=await env.DB.prepare("SELECT * FROM auth_credentials_v2 WHERE user_id=?").bind(userId).first();
    if(v2&&v2.password_hash&&v2.password_salt){
      await env.DB.prepare(`INSERT INTO member_credentials_v3(user_id,password_hash,password_salt,password_iterations,updated_at)
        VALUES(?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO NOTHING`)
        .bind(userId,v2.password_hash,v2.password_salt,Number(v2.password_iterations||ITER)).run();
    }
  }catch(e){
    console.error(JSON.stringify({event:"v2_to_v3_warning",message:e?.message||String(e)}));
  }

  cr=await env.DB.prepare("SELECT * FROM member_credentials_v3 WHERE user_id=?").bind(userId).first();
  if(cr)return cr;

  try{
    const old=await env.DB.prepare("SELECT * FROM user_credentials WHERE user_id=?").bind(userId).first();
    if(old&&old.password_hash&&old.password_salt){
      await env.DB.prepare(`INSERT INTO member_credentials_v3(user_id,password_hash,password_salt,password_iterations,updated_at)
        VALUES(?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO NOTHING`)
        .bind(userId,old.password_hash,old.password_salt,Number(old.password_iterations||ITER)).run();
    }
  }catch(e){
    console.error(JSON.stringify({event:"legacy_to_v3_warning",message:e?.message||String(e)}));
  }
  return await env.DB.prepare("SELECT * FROM member_credentials_v3 WHERE user_id=?").bind(userId).first();
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
    await markSchemaReady(env);
    const em=email(env.SUPERADMIN_EMAIL);

    stage="lookup";
    let su=await env.DB.prepare("SELECT * FROM users WHERE role='superadmin' AND status!='deleted' LIMIT 1").first();

    if(!su){
      su=await env.DB.prepare("SELECT * FROM users WHERE lower(email)=lower(?) LIMIT 1").bind(em).first();
      if(su){
        stage="repair_profile";
        await env.DB.prepare("UPDATE users SET company_id=NULL,email=?,full_name='Super Administrateur',role='superadmin',status='active',must_change_password=0,updated_at=CURRENT_TIMESTAMP WHERE id=?")
          .bind(em,su.id).run();
      }else{
        stage="insert_profile";
        const id=crypto.randomUUID();
        await insertUserProfile(env,{id,company_id:null,email:em,full_name:"Super Administrateur",role:"superadmin",created_by:null,must_change_password:false});
        su=await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(id).first();
      }
    }

    stage="finalize";
    await clearFail(env,ip(req),em);
    await audit(env,{id:su.id,company_id:null},"SUPERADMIN_READY","user",su.id,ip(req),{auth:"cloudflare_secret"});
    try{await migrateLegacyCredentials(env)}catch(e){console.error(JSON.stringify({event:"legacy_credentials_warning",message:e?.message||String(e)}))}
    return json({ok:true,superadmin_ready:true,superadmin_auth:"cloudflare_secret",app_version:"26.0.0"});
  }catch(e){
    const msg=String(e?.message||"");
    console.error(JSON.stringify({event:"bootstrap_error",stage,message:msg,stack:e?.stack||""}));
    return json({error:"Initialisation Super Admin impossible",stage,code:msg.slice(0,120)||"BOOTSTRAP_ERROR",app_version:"26.0.0"},500);
  }
}
async function login(req,env){
  if(req.method!=="POST")return json({error:"Méthode interdite"},405);
  const b=await body(req),em=email(b.email),pw=String(b.password||""),addr=ip(req);

  if(await limited(env,addr,em))return json({error:"Trop de tentatives. Réessayez dans 15 minutes."},429);

  const u=await env.DB.prepare("SELECT * FROM users WHERE lower(email)=lower(?) LIMIT 1").bind(em).first();
  if(!u||u.status!=="active"){
    await fail(env,addr,em);
    return json({error:"Identifiants incorrects"},401);
  }

  // Super Admin : mot de passe vérifié uniquement contre le secret Cloudflare.
  // Aucun hash/sel Super Admin n'est requis dans D1.
  if(u.role==="superadmin"){
    const configuredEmail=email(env.SUPERADMIN_EMAIL||"");
    if(em!==configuredEmail || !env.SUPERADMIN_INITIAL_PASSWORD){
      await fail(env,addr,em);
      return json({error:"Identifiants incorrects"},401);
    }
    if(!await safeEq(pw,String(env.SUPERADMIN_INITIAL_PASSWORD))){
      await fail(env,addr,em);
      await audit(env,u,"LOGIN_FAILED","user",u.id,addr,{role:"superadmin"});
      return json({error:"Identifiants incorrects"},401);
    }

    await clearFail(env,addr,em);
    const s=await makeSession(env,u);
    await audit(env,u,"LOGIN","user",u.id,addr,{auth:"cloudflare_secret"});
    return json({
      authenticated:true,
      csrf:s.csrf,
      user:{id:u.id,email:u.email,full_name:u.full_name,phone:u.phone,role:u.role,must_change_password:0},
      company:null,
      businessPaymentUrl:env.BUSINESS_PAYMENT_URL
    },200,{"set-cookie":setCookie(s.t)});
  }

  // Administrateurs et Agents : credentials stockés dans D1, hors données générales.
  const cr=await getMemberCredentialKV(env,u.id);
  if(!cr){
    await fail(env,addr,em);
    return json({error:"Identifiants incorrects"},401);
  }
  const h=await hashPassword(pw,cr.password_salt,Number(cr.password_iterations||ITER));
  if(!await safeEq(h,cr.password_hash)){
    await fail(env,addr,em);
    await audit(env,u,"LOGIN_FAILED","user",u.id,addr);
    return json({error:"Identifiants incorrects"},401);
  }

  let c=null;
  if(u.company_id){
    c=await env.DB.prepare("SELECT id,name,city,plan,plan_started_at,plan_expires_at,status FROM companies WHERE id=?").bind(u.company_id).first();
    if(!c||c.status!=="active")return json({error:"Entreprise désactivée"},403);
    if(Date.parse(c.plan_expires_at)<=Date.now())return json({error:"Abonnement expiré"},403);
  }

  await clearFail(env,addr,em);
  const s=await makeSession(env,u);
  await audit(env,u,"LOGIN","user",u.id,addr);
  return json({
    authenticated:true,
    csrf:s.csrf,
    user:{id:u.id,email:u.email,full_name:u.full_name,phone:u.phone,role:u.role,must_change_password:u.must_change_password},
    company:c,
    businessPaymentUrl:env.BUSINESS_PAYMENT_URL
  },200,{"set-cookie":setCookie(s.t)});
}

async function register(req,env){
  if(req.method!=="POST")return json({error:"Méthode interdite"},405);

  let stage="start";
  let cid=null,uid=null;
  try{
    stage="schema";
    if(!await requireSchemaReady(env))return json({error:"Base non initialisée",stage,code:"SCHEMA_NOT_READY"},503);

    stage="input";
    const b=await body(req);
    const em=email(b.email);
    const pw=String(b.password||"");
    const companyName=text(b.company_name,180);
    const fullName=text(b.full_name,160);

    if(!companyName||!fullName||!em){
      return json({error:"Entreprise, nom et e-mail obligatoires"},400);
    }
    if(pw.length<12){
      return json({error:"Mot de passe : 12 caractères minimum"},400);
    }

    stage="duplicate_check";
    if(await env.DB.prepare("SELECT id FROM users WHERE lower(email)=lower(?)").bind(em).first()){
      return json({error:"Cette adresse e-mail existe déjà"},409);
    }

    cid=crypto.randomUUID();
    uid=crypto.randomUUID();
    const startDate=now();
    const endDate=plusDays(21);

    stage="credential_prepare";
    const preparedCredential=await makeMemberCredential(pw);

    stage="company_insert";
    await insertCompanyProfile(env,{
      id:cid,
      name:companyName,
      city:text(b.city,120),
      plan:"free",
      plan_started_at:startDate,
      plan_expires_at:endDate,
      status:"active"
    });

    stage="user_insert";
    await insertUserProfile(env,{
      id:uid,
      company_id:cid,
      email:em,
      full_name:fullName,
      phone:text(b.phone,50),
      role:"admin",
      created_by:uid,
      must_change_password:false
    });

    stage="credential_store";
    await putMemberCredentialKV(env,uid,preparedCredential);

    stage="session";
    const u=await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(uid).first();
    if(!u)throw new Error("USER_NOT_FOUND_AFTER_INSERT");
    const s=await makeSession(env,u);

    stage="audit";
    await audit(env,u,"SELF_REGISTER","company",cid,ip(req),{plan:"free"});

    return json({
      authenticated:true,
      csrf:s.csrf,
      user:{id:uid,email:em,full_name:u.full_name,phone:u.phone,role:"admin",must_change_password:0},
      company:{
        id:cid,
        name:companyName,
        city:text(b.city,120),
        plan:"free",
        plan_started_at:startDate,
        plan_expires_at:endDate,
        status:"active"
      },
      businessPaymentUrl:env.BUSINESS_PAYMENT_URL
    },201,{"set-cookie":setCookie(s.t)});
  }catch(e){
    const msg=String(e?.message||"");
    console.error(JSON.stringify({event:"register_error",stage,message:msg,stack:e?.stack||""}));

    // Nettoyage des créations partielles. Ne jamais laisser une entreprise orpheline.
    try{
      if(uid){
        await deleteMemberCredentialKV(env,uid);
        await env.DB.prepare("DELETE FROM users WHERE id=?").bind(uid).run();
      }
      if(cid){
        await env.DB.prepare("DELETE FROM companies WHERE id=?").bind(cid).run();
      }
    }catch(cleanErr){
      console.error(JSON.stringify({event:"register_cleanup_error",message:cleanErr?.message||String(cleanErr)}));
    }

    let code="REGISTER_ERROR";
    if(msg.includes("PASSWORD_HASH_FAILED"))code="PASSWORD_HASH_FAILED";
    else if(msg.includes("PASSWORD_TOO_SHORT"))code="PASSWORD_TOO_SHORT";
    else if(msg.includes("UNSUPPORTED_COMPANY_COLUMNS"))code=msg;
    else if(msg.includes("UNSUPPORTED_USER_COLUMNS"))code=msg;
    else if(msg.includes("no such column"))code="MISSING_COLUMN";
    else if(msg.includes("NOT NULL constraint"))code="NOT_NULL_CONSTRAINT";
    else if(msg.includes("UNIQUE constraint"))code="UNIQUE_CONSTRAINT";
    else if(msg.includes("CHECK constraint"))code="CHECK_CONSTRAINT";
    else if(msg.includes("FOREIGN KEY constraint"))code="FOREIGN_KEY_CONSTRAINT";

    return json({
      error:"Inscription Administrateur impossible",
      stage,
      code
    },500);
  }
}

async function session(req,env){const a=await auth(req,env);if(a.error)return a.error;return json({authenticated:true,csrf:a.s.s.csrf,user:a.s.u,company:a.s.c,businessPaymentUrl:env.BUSINESS_PAYMENT_URL})}
async function logout(req,env){const a=await auth(req,env,null,true);if(!a.error){await env.GLOBAL_BT_KV.delete(a.s.key);await audit(env,a.s.u,"LOGOUT","user",a.s.u.id,ip(req))}return json({ok:true},200,{"set-cookie":clearCookie()})}

async function load(req,env){
  const a=await auth(req,env);if(a.error)return a.error;const s=a.s;
  if(!await requireSchemaReady(env))return json({error:"Base non initialisée",code:"SCHEMA_NOT_READY"},503);
  if(s.u.role==="superadmin"){
    const [companies,users,resets,logs]=await Promise.all([
      env.DB.prepare("SELECT id,name,city,plan,plan_started_at,plan_expires_at,status,created_at FROM companies WHERE status!='deleted' ORDER BY created_at DESC").all(),
      env.DB.prepare(`SELECT u.id,u.company_id,u.email,u.full_name,u.phone,u.role,u.status,u.created_at,c.name company_name
        FROM users u LEFT JOIN companies c ON c.id=u.company_id
        WHERE u.status!='deleted' ORDER BY u.created_at DESC`).all(),
      env.DB.prepare("SELECT r.*,u.full_name,c.name company_name FROM password_reset_requests r LEFT JOIN users u ON u.id=r.user_id LEFT JOIN companies c ON c.id=r.company_id WHERE r.target_role='admin' ORDER BY r.created_at DESC LIMIT 300").all(),
      env.DB.prepare("SELECT a.*,u.full_name actor_name,c.name company_name FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_user_id LEFT JOIN companies c ON c.id=a.company_id ORDER BY a.created_at DESC LIMIT 400").all()
    ]);
    const outUsers=[];
    for(const u of users.results||[]){
      let ready=u.role==="superadmin";
      if(!ready) ready=!!(await getMemberCredentialKV(env,u.id));
      outUsers.push({...u,credential_ready:ready?1:0});
    }
    return json({mode:"superadmin",companies:companies.results,users:outUsers,resets:resets.results,logs:logs.results});
  }
  const c=s.u.company_id;
  const [projects,trades,suppliers,expenses,labor,users,resets]=await Promise.all([
    env.DB.prepare("SELECT * FROM projects WHERE company_id=? ORDER BY created_at DESC").bind(c).all(),
    env.DB.prepare("SELECT * FROM trades WHERE company_id=? ORDER BY name").bind(c).all(),
    env.DB.prepare("SELECT * FROM suppliers WHERE company_id=? ORDER BY name").bind(c).all(),
    env.DB.prepare("SELECT e.*,p.name project_name,t.name trade_name,sp.name supplier_name FROM expenses e JOIN projects p ON p.id=e.project_id LEFT JOIN trades t ON t.id=e.trade_id LEFT JOIN suppliers sp ON sp.id=e.supplier_id WHERE e.company_id=? ORDER BY e.expense_date DESC,e.created_at DESC").bind(c).all(),
    env.DB.prepare("SELECT l.*,p.name project_name,t.name trade_name FROM labor_expenses l JOIN projects p ON p.id=l.project_id LEFT JOIN trades t ON t.id=l.trade_id WHERE l.company_id=? ORDER BY l.expense_date DESC,l.created_at DESC").bind(c).all(),
    s.u.role==="admin"?env.DB.prepare(`SELECT u.id,u.email,u.full_name,u.phone,u.role,u.status,u.created_at
      FROM users u WHERE u.company_id=? AND u.status!='deleted' ORDER BY u.created_at DESC`).bind(c).all():Promise.resolve({results:[]}),
    s.u.role==="admin"?env.DB.prepare("SELECT r.*,u.full_name FROM password_reset_requests r LEFT JOIN users u ON u.id=r.user_id WHERE r.company_id=? AND r.target_role='agent' ORDER BY r.created_at DESC LIMIT 200").bind(c).all():Promise.resolve({results:[]})
  ]);
  const outUsers=[];
  for(const u of users.results||[]){
    outUsers.push({...u,credential_ready:(await getMemberCredentialKV(env,u.id))?1:0});
  }
  return json({mode:"company",projects:projects.results,trades:trades.results,suppliers:suppliers.results,expenses:expenses.results,labor:labor.results,users:outUsers,resets:resets.results});
}

async function save(req,env){
  const a=await auth(req,env,null,true);if(a.error)return a.error;
  const s=a.s,b=await body(req),entity=b.entity,action=b.action||"create",r=b.record||{};
  try{
    if(!await requireSchemaReady(env))return json({error:"Base non initialisée",code:"SCHEMA_NOT_READY"},503);
    if(s.u.role==="superadmin")return await saveSuper(req,env,s,entity,action,r);
    return await saveCompany(req,env,s,entity,action,r);
  }catch(e){
    const msg=String(e?.message||"");
    console.error(JSON.stringify({event:"save_error",entity,action,message:msg,stack:e?.stack||""}));
    let code="SAVE_ERROR";
    if(msg.includes("LABOR_REQUIRED_COLUMNS:"))code=msg;
    else if(msg.includes("no such column"))code="MISSING_COLUMN";
    else if(msg.includes("NOT NULL constraint"))code="NOT_NULL_CONSTRAINT";
    else if(msg.includes("UNIQUE constraint") && entity==="trade")code="TRADE_ALREADY_EXISTS";
    else if(msg.includes("UNIQUE constraint"))code="UNIQUE_CONSTRAINT";
    else if(msg.includes("CHECK constraint"))code="CHECK_CONSTRAINT";
    else if(msg.includes("FOREIGN KEY constraint"))code="FOREIGN_KEY_CONSTRAINT";
    return json({error:"Opération impossible",entity,action,code},500);
  }
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
    if(action==="create"){
      const projectId=text(r.project_id,100);
      const tradeName=text(r.name,120);
      if(!projectId||!tradeName)return json({error:"Projet et nom du métier obligatoires"},400);

      const p=await env.DB.prepare("SELECT id FROM projects WHERE id=? AND company_id=?").bind(projectId,c).first();
      if(!p)return json({error:"Projet invalide"},400);

      const existing=await env.DB.prepare(
        "SELECT id FROM trades WHERE company_id=? AND project_id=? AND lower(trim(name))=lower(trim(?)) LIMIT 1"
      ).bind(c,projectId,tradeName).first();

      if(existing){
        return json({
          error:"Ce métier existe déjà pour ce projet",
          code:"TRADE_ALREADY_EXISTS",
          existing_id:existing.id
        },409);
      }

      const id=crypto.randomUUID();
      await env.DB.prepare(
        "INSERT INTO trades(id,company_id,project_id,name,description,phase) VALUES(?,?,?,?,?,?)"
      ).bind(id,c,projectId,tradeName,text(r.description,500),text(r.phase,80)||null).run();

      await audit(env,actor,"CREATE_TRADE","trade",id,ip(req),{project_id:projectId,name:tradeName});
      return json({ok:true,id})
    }
    if(action==="update"){
      const existing=await env.DB.prepare("SELECT id FROM trades WHERE id=? AND company_id=?").bind(r.id,c).first();if(!existing)return json({error:"Métier introuvable"},404);
      const projectId=text(r.project_id,100),tradeName=text(r.name,120);
      const duplicate=await env.DB.prepare("SELECT id FROM trades WHERE company_id=? AND project_id=? AND lower(trim(name))=lower(trim(?)) AND id<>? LIMIT 1").bind(c,projectId,tradeName,r.id).first();if(duplicate)return json({error:"Ce métier existe déjà pour ce projet",code:"TRADE_ALREADY_EXISTS"},409);
      await env.DB.prepare("UPDATE trades SET project_id=?,name=?,description=?,phase=? WHERE id=? AND company_id=?").bind(projectId,tradeName,text(r.description,500),text(r.phase,80)||null,r.id,c).run();
      await audit(env,actor,"UPDATE_TRADE","trade",r.id,ip(req),{project_id:projectId,name:tradeName,phase:text(r.phase,80)});return json({ok:true})
    }
    if(action==="delete"&&actor.role==="admin"){
      await env.DB.prepare("DELETE FROM trades WHERE id=? AND company_id=?").bind(r.id,c).run();
      await audit(env,actor,"DELETE_TRADE","trade",r.id,ip(req));
      return json({ok:true})
    }
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
    if(action==="create"){
      const p=await env.DB.prepare("SELECT id FROM projects WHERE id=? AND company_id=?").bind(r.project_id,c).first();
      if(!p)return json({error:"Projet invalide"},400);
      const id=crypto.randomUUID();
      await insertLaborCompatible(env,{
        id,
        company_id:c,
        project_id:r.project_id,
        trade_id:r.trade_id||null,
        expense_date:today(r.expense_date),
        worker_name:text(r.worker_name,160),
        description:text(r.description,500),
        amount:money(r.amount),
        payment_method:text(r.payment_method,80),
        reference:text(r.reference,120),
        notes:text(r.notes,800),
        created_by:actor.id
      });
      await audit(env,actor,"CREATE_LABOR","labor",id,ip(req),{amount:money(r.amount)});
      return json({ok:true,id})
    }
    if(action==="delete"&&actor.role==="admin"){await env.DB.prepare("DELETE FROM labor_expenses WHERE id=? AND company_id=?").bind(r.id,c).run();return json({ok:true})}
  }
  if(entity==="user"&&actor.role==="admin"){
    if(action==="create"){const em=email(r.email);if(!em||String(r.password||"").length<12)return json({error:"E-mail et mot de passe 12 caractères minimum"},400);if(await env.DB.prepare("SELECT id FROM users WHERE lower(email)=lower(?)").bind(em).first())return json({error:"E-mail déjà utilisé"},409);const id=crypto.randomUUID();await insertUserProfile(env,{id,company_id:c,email:em,full_name:text(r.full_name,160),phone:text(r.phone,50),role:"agent",created_by:actor.id,must_change_password:true});await setMemberCredentialKV(env,id,r.password);await audit(env,actor,"CREATE_AGENT","user",id,ip(req));return json({ok:true,id})}
    const u=await env.DB.prepare("SELECT * FROM users WHERE id=? AND company_id=? AND role='agent'").bind(r.id,c).first();if(!u)return json({error:"Agent introuvable"},404);
    if(["activate","disable","delete"].includes(action)){const st={activate:"active",disable:"disabled",delete:"deleted"}[action];await env.DB.prepare("UPDATE users SET status=?,password_version=password_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(st,u.id).run();if(action==="delete")await deleteMemberCredentialKV(env,u.id);await audit(env,actor,"AGENT_"+action.toUpperCase(),"user",u.id,ip(req));return json({ok:true})}
    if(action==="reset_password"){await setMemberCredentialKV(env,u.id,r.new_password);await env.DB.prepare("UPDATE users SET password_version=password_version+1,must_change_password=1,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(u.id).run();if(r.reset_request_id)await env.DB.prepare("UPDATE password_reset_requests SET status='resolved',handled_by=?,handled_at=CURRENT_TIMESTAMP WHERE id=? AND company_id=?").bind(actor.id,r.reset_request_id,c).run();await audit(env,actor,"RESET_AGENT_PASSWORD","user",u.id,ip(req));return json({ok:true})}
  }
  return json({error:"Action non autorisée"},403);
}
async function saveSuper(req,env,s,entity,action,r){
  const actor=s.u;
  if(entity==="company"){
    if(action==="create"){const plan=r.plan==="business"?"business":"free",start=now(),end=plusDays(plan==="business"?365:21),cid=crypto.randomUUID(),uid=crypto.randomUUID(),em=email(r.admin_email);if(!text(r.name,180)||!em||String(r.admin_password||"").length<12)return json({error:"Entreprise, administrateur et mot de passe requis"},400);if(await env.DB.prepare("SELECT id FROM users WHERE lower(email)=lower(?)").bind(em).first())return json({error:"E-mail déjà utilisé"},409);await insertCompanyProfile(env,{id:cid,name:text(r.name,180),city:text(r.city,120),plan,plan_started_at:start,plan_expires_at:end,status:"active"});await insertUserProfile(env,{id:uid,company_id:cid,email:em,full_name:text(r.admin_name,160),phone:text(r.admin_phone,50),role:"admin",created_by:actor.id,must_change_password:true});await setMemberCredentialKV(env,uid,r.admin_password);await audit(env,actor,"CREATE_COMPANY","company",cid,ip(req),{plan});return json({ok:true,id:cid})}
    const c=await env.DB.prepare("SELECT * FROM companies WHERE id=?").bind(r.id).first();if(!c)return json({error:"Entreprise introuvable"},404);
    if(action==="set_plan"){const plan=r.plan==="business"?"business":"free",start=now(),end=plusDays(plan==="business"?365:21);await env.DB.prepare("UPDATE companies SET plan=?,plan_started_at=?,plan_expires_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(plan,start,end,c.id).run();await audit(env,actor,"SET_PLAN","company",c.id,ip(req),{plan});return json({ok:true})}
    if(["activate","disable","delete"].includes(action)){const st={activate:"active",disable:"disabled",delete:"deleted"}[action];await env.DB.prepare("UPDATE companies SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(st,c.id).run();if(st!=="active")await env.DB.prepare("UPDATE users SET status='disabled',password_version=password_version+1 WHERE company_id=? AND status='active'").bind(c.id).run();await audit(env,actor,"COMPANY_"+action.toUpperCase(),"company",c.id,ip(req));return json({ok:true})}
  }
  if(entity==="user"){
    const u=await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(r.id).first();if(!u||u.role==="superadmin")return json({error:"Compte protégé ou introuvable"},400);
    if(["activate","disable","delete"].includes(action)){const st={activate:"active",disable:"disabled",delete:"deleted"}[action];await env.DB.prepare("UPDATE users SET status=?,password_version=password_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(st,u.id).run();if(action==="delete")await deleteMemberCredentialKV(env,u.id);await audit(env,actor,"MEMBER_"+action.toUpperCase(),"user",u.id,ip(req));return json({ok:true})}
    if(action==="reset_password"){await setMemberCredentialKV(env,u.id,r.new_password);await env.DB.prepare("UPDATE users SET password_version=password_version+1,must_change_password=1,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(u.id).run();if(r.reset_request_id)await env.DB.prepare("UPDATE password_reset_requests SET status='resolved',handled_by=?,handled_at=CURRENT_TIMESTAMP WHERE id=?").bind(actor.id,r.reset_request_id).run();await audit(env,actor,"RESET_MEMBER_PASSWORD","user",u.id,ip(req));return json({ok:true})}
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
  const a=await auth(req,env,null,true);if(a.error)return a.error;
  if(a.s.u.role==="superadmin"){
    return json({error:"Le mot de passe Super Admin se modifie uniquement dans le secret Cloudflare SUPERADMIN_INITIAL_PASSWORD."},403);
  }
  const b=await body(req),cr=await getMemberCredentialKV(env,a.s.u.id);
  if(!cr)return json({error:"Compte d'authentification invalide"},400);
  const h=await hashPassword(String(b.current_password||""),cr.password_salt,Number(cr.password_iterations||ITER));
  if(!await safeEq(h,cr.password_hash))return json({error:"Mot de passe actuel incorrect"},400);
  await setMemberCredentialKV(env,a.s.u.id,b.new_password);
  await env.DB.prepare("UPDATE users SET password_version=password_version+1,must_change_password=0,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(a.s.u.id).run();
  await audit(env,a.s.u,"CHANGE_PASSWORD","user",a.s.u.id,ip(req));
  return json({ok:true});
}
async function cryptoHealth(req,env){
  const started=Date.now();
  try{
    const test=await makeMemberCredential("GlobalBT-Test-2026!");
    return json({
      ok:true,
      app_version:"26.0.0",
      algorithm:"PBKDF2-SHA-256",
      iterations:test.password_iterations,
      elapsed_ms:Date.now()-started
    });
  }catch(e){
    return json({
      ok:false,
      app_version:"26.0.0",
      code:e?.message||"PASSWORD_HASH_FAILED",
      elapsed_ms:Date.now()-started
    },500);
  }
}


async function refreshCsrf(req,env){
  const s=await getSession(req,env);
  if(!s)return json({error:"Session invalide"},401);
  const next=hex(bytes(24));
  s.s.csrf=next;
  await env.GLOBAL_BT_KV.put(s.key,JSON.stringify(s.s),{expirationTtl:SESSION_TTL});
  return json({ok:true,csrf:next});
}

async function health(req,env){
  let schema=false,superadmin=false,companySchema=false;
  try{
    if(env.DB){
      const r=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").first();
      schema=!!r;
      const cr=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='companies'").first();
      companySchema=!!cr;
      if(schema){
        const u=await env.DB.prepare("SELECT id FROM users WHERE role='superadmin' AND status!='deleted' LIMIT 1").first();
        superadmin=!!u;
      }
    }
  }catch{}
  const secretReady=!!env.SUPERADMIN_EMAIL&&!!env.SUPERADMIN_INITIAL_PASSWORD;
  return json({
    ok:!!env.DB&&!!env.GLOBAL_BT_KV,
    app_version:"26.0.0",
    d1_bound:!!env.DB,
    kv_bound:!!env.GLOBAL_BT_KV,
    superadmin_email_configured:!!env.SUPERADMIN_EMAIL,
    superadmin_password_configured:!!env.SUPERADMIN_INITIAL_PASSWORD,
    session_pepper_configured:!!env.SESSION_PEPPER,
    schema_ready:schema,company_schema_ready:companySchema,
    superadmin_ready:superadmin,
    superadmin_credential_ready:superadmin&&secretReady,
    superadmin_auth:"cloudflare_secret",
    member_auth_store:"GLOBAL_BT_KV / cred:v1:<user_id>",schema_repair_version:"21"
  });
}

async function route(req,env){
  const p=new URL(req.url).pathname;
  if(p==="/api/health")return health(req,env);
  if(p==="/api/crypto-health")return cryptoHealth(req,env);
  if(p==="/api/bootstrap")return bootstrap(req,env);
  if(p==="/api/login")return login(req,env);
  if(p==="/api/register")return register(req,env);
  if(p==="/api/session")return session(req,env);
  if(p==="/api/csrf")return refreshCsrf(req,env);
  if(p==="/api/logout")return logout(req,env);
  if(p==="/api/load")return load(req,env);
  if(p==="/api/save")return save(req,env);
  if(p==="/api/password-reset/request")return resetRequest(req,env);
  if(p==="/api/change-password")return changePassword(req,env);
  return json({error:"Route API introuvable"},404);
}
export default{async fetch(request,env,ctx){try{const u=new URL(request.url);if(u.pathname.startsWith("/api/"))return await route(request,env);return env.ASSETS.fetch(request)}catch(e){console.error(JSON.stringify({event:"worker_error",message:e?.message||String(e)}));return json({error:"Erreur serveur"},500)}}};
