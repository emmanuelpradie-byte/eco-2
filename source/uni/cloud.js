
// ══ ESPACE EN LIGNE (Supabase) ════════════════════════════════
// • Espace perso : recettes, catalogue, fournisseurs, catégories et bons de la
//   personne, retrouvés sur tous ses appareils (personne d'autre ne les voit).
// • Recettes partagées : visibles par tous, modifiables seulement par l'auteur.
// • Documents joints : envoyés avec la recette, lisibles par tous si elle est partagée.
// Les données restent sur l'appareil : l'appli marche hors connexion et envoie
// les modifications au retour du réseau.
var CLOUD={me:null,inv:null,pendingN:0,cfg:null,sess:null,st:null,shared:{},applying:false,busy:false,again:false,status:'off',msg:'',lastOk:0,pendingInvite:null,timer:null,pushT:null,ui:{}};
var CL_KEYS={v4_ing:['ing'],v4_rec:['rec'],v4_suppliers:['sup'],v4_ord:['ord'],v4_ingcats:['cfg'],v4_reccats:['cfg'],v4_ingsubs:['cfg'],v4_recsubs:['cfg'],v4_shdocs:['cfg']};
var CL_CFG_KEYS=['v4_ingcats','v4_reccats','v4_ingsubs','v4_recsubs','v4_shdocs'];
var CL_KINDS=['ing','rec','sup','ord','cfg'];

function clLoad(k,d){ try{ return JSON.parse(LS.getItem(k)||'null')||d; }catch(e){ return d; } }
function clSave(k,v){ CLOUD.applying=true; try{ if(v==null) LS.removeItem(k); else LS.setItem(k,JSON.stringify(v)); } finally { CLOUD.applying=false; } }
function clSaveState(){ clSave('v4_cloud_state',CLOUD.st); }
function clFreshState(){ return {shadow:{},queue:{},since:{user:null,shared:null},v:0,pub:{},attUp:{},attDel:{},ready:false}; }
function clHash(s){ var h=5381,i=s.length; while(i) h=(h*33)^s.charCodeAt(--i); return (h>>>0).toString(36)+'.'+s.length; }
function clActive(){ return !!(CLOUD.cfg&&CLOUD.sess); }
function clLive(){ return clActive()&&CLOUD.st&&CLOUD.st.ready; }
function clUid(){ return CLOUD.sess&&CLOUD.sess.user.id; }
function clSharedId(rid){ return String(clUid()).slice(0,8)+'_'+rid; }
function clMyName(){ var p=loadProfile(); return p.name||(CLOUD.sess&&CLOUD.sess.user.email||'').split('@')[0]||'—'; }

// ── Données locales par type ──
function clLocal(kind){
  var out={};
  if(kind==='cfg'){ CL_CFG_KEYS.forEach(function(k){ var v=LS.getItem(k); if(v!=null){ try{ out[k]=JSON.parse(v); }catch(e){} } }); return out; }
  (clArr(kind)||[]).forEach(function(x){ if(x&&x.id!=null) out[x.id]=x; });
  return out;
}
function clArr(kind){ return kind==='ing'?ingredients:kind==='rec'?recipes:kind==='sup'?suppliers:kind==='ord'?orders:null; }
function clSetArr(kind,a){ if(kind==='ing') ingredients=a; else if(kind==='rec') recipes=a; else if(kind==='sup') suppliers=a; else if(kind==='ord') orders=a; }
function clStoreKind(kind){
  CLOUD.applying=true;
  try{
    if(kind==='ing') DB.save('v4_ing',ingredients); else if(kind==='rec') DB.save('v4_rec',recipes);
    else if(kind==='sup') DB.save('v4_suppliers',suppliers); else if(kind==='ord') DB.save('v4_ord',orders);
  } finally { CLOUD.applying=false; }
}

// ── Détection des modifications locales ──
var _clDirty={};
function clOnSet(k){
  if(CLOUD.applying||!clLive()) return;
  var kinds=CL_KEYS[k]; if(!kinds) return;
  kinds.forEach(function(x){ _clDirty[x]=1; });
  clearTimeout(CLOUD.diffT); CLOUD.diffT=setTimeout(clDiffDirty,250);
}
// modifications pas encore examinées (délai de 250 ms) : à prendre en compte avant toute synchro
function clFlushDirty(){ if(Object.keys(_clDirty).length){ clearTimeout(CLOUD.diffT); clDiffDirty(); } }
function clDiffDirty(){
  var kinds=Object.keys(_clDirty); _clDirty={}; if(!kinds.length||!clLive()) return;
  var dels=[], sh=CLOUD.st.shadow, q=CLOUD.st.queue;
  kinds.forEach(function(kind){
    var loc=clLocal(kind);
    Object.keys(loc).forEach(function(id){
      var key=kind+':'+id, h=clHash(JSON.stringify(loc[id]));
      if(sh[key]!==h) q[key]={kind:kind,id:id,v:++CLOUD.st.v};
    });
    Object.keys(sh).forEach(function(key){
      if(key.indexOf(kind+':')!==0) return;
      if(!(key.slice(kind.length+1) in loc)) dels.push(key);
    });
  });
  // garde-fou : grosse suppression d'un coup (ex. restauration d'une vieille sauvegarde)
  var big=dels.length>=15||CL_KINDS.some(function(kd){
    if(kd==='cfg') return false;
    var d=dels.filter(function(k){ return k.indexOf(kd+':')===0; }).length; if(d<5) return false;
    var tot=Object.keys(sh).filter(function(k){ return k.indexOf(kd+':')===0; }).length;
    return d>=tot*0.5; });
  if(big&&!confirm(dels.length+' éléments vont être supprimés de ton espace en ligne (sur tous tes appareils). Continuer ?')){
    dels=[]; CLOUD.st.since.user=null;   // on recharge la version en ligne
  }
  dels.forEach(function(key){ var i=key.indexOf(':'); q[key]={kind:key.slice(0,i),id:key.slice(i+1),del:1,v:++CLOUD.st.v}; });
  clSaveState(); clUI();
  clearTimeout(CLOUD.pushT); CLOUD.pushT=setTimeout(clSync,1200);
}
function clQueueAttUp(id){ if(!clLive()) return; CLOUD.st.attUp[id]=1; delete CLOUD.st.attDel[id]; clSaveState(); clearTimeout(CLOUD.pushT); CLOUD.pushT=setTimeout(clSync,1200); }
function clQueueAttDel(id){ if(!clLive()) return; CLOUD.st.attDel[id]=1; delete CLOUD.st.attUp[id]; clSaveState(); }

// ── Réseau ──
function clFetch(path,opt){
  opt=opt||{}; var c=CLOUD.cfg, h={'apikey':c.key,'Content-Type':'application/json'};
  if(opt.auth!==false&&CLOUD.sess) h['Authorization']='Bearer '+CLOUD.sess.access_token;
  Object.keys(opt.headers||{}).forEach(function(k){ h[k]=opt.headers[k]; });
  var ctl=typeof AbortController!=='undefined'?new AbortController():null, to=ctl?setTimeout(function(){ ctl.abort(); },opt.timeout||30000):null;
  return fetch(c.url.replace(/\/+$/,'')+path,{method:opt.method||'GET',headers:h,body:opt.body!=null?JSON.stringify(opt.body):undefined,signal:ctl?ctl.signal:undefined})
    .then(function(r){
      if(to) clearTimeout(to);
      return r.text().then(function(t){ var j=null; try{ j=t?JSON.parse(t):null; }catch(e){}
        if(!r.ok){ var e=new Error(clErrMsg(j,r.status)); e.status=r.status; e.body=j; throw e; }
        return j; });
    },function(err){ if(to) clearTimeout(to); var e=new Error('Pas de connexion au serveur'); e.net=true; throw e; });
}
function clErrMsg(j,status){
  var m=j&&(j.error_description||j.msg||j.message||j.error)||('Erreur '+status);
  var T=[[/invalid login credentials/i,'Email ou mot de passe incorrect'],[/already (been )?registered|already exists/i,'Un compte existe déjà avec cet email : connecte-toi'],
    [/email not confirmed/i,'Confirme ton adresse (lien reçu par email), puis connecte-toi'],[/password should be at least/i,'Mot de passe trop court (6 caractères minimum)'],
    [/unable to validate email|invalid email/i,'Adresse email invalide'],[/invalid api key|no api key/i,'Clé du serveur incorrecte'],[/jwt expired/i,'Session expirée'],
    [/rate limit|too many/i,'Trop de tentatives, réessaie dans quelques minutes'],[/row-level security|permission denied/i,'Action non autorisée'],
    [/payload too large|request entity too large/i,'Document trop gros pour le serveur'],
    [/should be different from the old password/i,'Le nouveau mot de passe doit être différent de l’ancien'],[/weak and easy to guess|known to be weak/i,'Mot de passe trop facile à deviner : choisis-en un autre'],
    [/reauthentication|recently logged in/i,'Pour ta sécurité, reconnecte-toi puis réessaie']];
  for(var i=0;i<T.length;i++) if(T[i][0].test(m)) return T[i][1];
  return m;
}
function clAuthed(fn){
  var s=CLOUD.sess; if(!s) return Promise.reject(new Error('Non connecté'));
  var p=(s.expires_at&&s.expires_at*1000-Date.now()<90000)?clRefresh():Promise.resolve();
  return p.then(fn).catch(function(e){ if(e.status===401){ return clRefresh().then(fn); } throw e; });
}
function clRefresh(){
  var s=CLOUD.sess; if(!s||!s.refresh_token) return Promise.reject(new Error('Session expirée'));
  return clFetch('/auth/v1/token?grant_type=refresh_token',{method:'POST',auth:false,body:{refresh_token:s.refresh_token}})
    .then(clSetSession,function(e){ if(e.status===400||e.status===401){ clSignedOut('Session expirée : reconnecte-toi'); } throw e; });
}
function clSetSession(j){
  if(!j||!j.access_token) return null;
  var old=CLOUD.sess;
  CLOUD.sess={access_token:j.access_token,refresh_token:j.refresh_token,expires_at:j.expires_at||Math.floor(Date.now()/1000)+(j.expires_in||3600),
    user:{id:(j.user||{}).id||(old&&old.user.id),email:(j.user||{}).email||(old&&old.user.email)}};
  clSave('v4_cloud_sess',CLOUD.sess); return CLOUD.sess;
}
function clFetchAtt(id){
  return clAuthed(function(){ return clFetch('/rest/v1/attachments?id=eq.'+encodeURIComponent(id)+'&select=id,name,mime,data'); }).then(function(r){ return r&&r[0]; });
}

// ── Statut du compte (validation par l'administrateur) ──
function clMe(){
  return clFetch('/rest/v1/rpc/me',{method:'POST',body:{}}).then(function(j){
    var was=CLOUD.me; CLOUD.me=j||{status:'active'}; clSave('v4_cloud_me',CLOUD.me);
    if(typeof admNav==='function') admNav();
    return CLOUD.me;
  },function(e){
    // serveur installé avant l'administration : tout le monde est actif
    if(e.status===404||(e.body&&/PGRST202|42883/.test(String(e.body.code||'')))){ CLOUD.me={status:'active',admin:false,legacy:true}; return CLOUD.me; }
    throw e;
  });
}
function clIsAdmin(){ return !!(CLOUD.sess&&CLOUD.me&&CLOUD.me.admin&&CLOUD.me.status==='active'); }
function clRpc(fn,args){ return clAuthed(function(){ return clFetch('/rest/v1/rpc/'+fn,{method:'POST',body:args||{}}); }); }
function clNameSync(){
  var st=CLOUD.st, n=clMyName(); if(!CLOUD.me||CLOUD.me.legacy||st.nameSent===n) return Promise.resolve();
  return clFetch('/rest/v1/rpc/set_my_name',{method:'POST',body:{p_name:n}}).then(function(){ st.nameSent=n; clSaveState(); },function(){});
}
function clAdminTick(){
  if(!clIsAdmin()) return Promise.resolve();
  var inv=CLOUD.inv, soon=!inv||!inv.expires_at||Date.parse(inv.expires_at)-Date.now()<7*864e5;
  var p1=soon?clFetch('/rest/v1/rpc/admin_invite',{method:'POST',body:{}}).then(function(j){ if(j&&j.code){ CLOUD.inv=j; clSave('v4_cloud_inv',j); } },function(){}):Promise.resolve();
  var p2=clFetch('/rest/v1/profiles?select=id&status=eq.pending').then(function(r){
    var n=(r||[]).length, was=CLOUD.pendingN; CLOUD.pendingN=n;
    if(n>was&&was!=null&&CLOUD.adminSeen) toast(n+' inscription'+(n>1?'s':'')+' à valider (Administration)','info');
    CLOUD.adminSeen=true; if(typeof admNav==='function') admNav();
  },function(){});
  return Promise.all([p1,p2]);
}
var _clWaitT=null;
function clWaitApproval(){
  clearTimeout(_clWaitT);
  _clWaitT=setTimeout(function(){
    if(!CLOUD.sess||!CLOUD.ui||!CLOUD.ui.wait) return;
    clAuthed(clMe).then(function(me){
      if(me.status==='active'){ CLOUD.ui={}; clRedraw(); toast('Ton compte est validé','ok'); clAfterLogin().catch(function(e){ console.warn(e); }); }
      else { if(CLOUD.ui.wait!==me.status){ CLOUD.ui.wait=me.status; clRedraw(); } clWaitApproval(); }
    },function(){ clWaitApproval(); });
  },20000);
}

// ── Synchronisation ──
// Compte rétabli par l'administrateur après suppression : son espace en ligne est
// vide. On oublie ce qui était « déjà envoyé » pour tout renvoyer depuis l'appareil
// (recettes partagées comprises).
function clResetAfterRestore(){
  var st=CLOUD.st; delete st.lost;
  st.shadow={}; st.queue={}; st.pub={}; st.since={user:null,shared:null}; st.nameSent=null;
  recipes.forEach(function(r){ (r.attachments||[]).forEach(function(a){ if(attLocal(a.id)) st.attUp[a.id]=1; }); });
  CL_KINDS.forEach(function(k){ _clDirty[k]=1; });
  clSaveState(); clDiffDirty();
}
function clSync(){
  if(!clLive()) return Promise.resolve();
  clFlushDirty();
  if(CLOUD.busy){ CLOUD.again=true; return CLOUD.busyP; }
  if(typeof navigator!=='undefined'&&navigator.onLine===false){ CLOUD.status='offline'; clUI(); return Promise.resolve(); }
  CLOUD.busy=true; CLOUD.status='sync'; clUI();
  CLOUD.busyP=clAuthed(function(){ return clMe().then(function(me){
      if(me.status==='deleted'&&!CLOUD.st.lost){ CLOUD.st.lost=1; clSaveState(); }   // l'espace en ligne a été effacé
      if(me.status!=='active') return 'stop';
      if(CLOUD.st.lost) clResetAfterRestore();                                         // compte rétabli : on renvoie tout
      // lecture avant publication : un partage retiré par l'administrateur n'est pas republié
      return clPush().then(clPushAtt).then(clPull).then(clPublish).then(clNameSync).then(clAdminTick);
    }); })
    .then(function(r){ if(r==='stop'){ CLOUD.status=CLOUD.me.status; CLOUD.msg=''; return; } CLOUD.status='ok'; CLOUD.msg=''; CLOUD.lastOk=Date.now(); })
    .catch(function(e){ console.warn('Synchro :',e); CLOUD.status=e.net?'offline':'error'; CLOUD.msg=e.message||String(e); })
    .then(function(){ CLOUD.busy=false; clUI(); if(CLOUD.again){ CLOUD.again=false; return clSync(); } });
  return CLOUD.busyP;
}
function clBatches(items){ var out=[],cur=[],sz=0; items.forEach(function(it){ if(cur.length&&(sz+it.size>1500000||cur.length>=200)){ out.push(cur); cur=[]; sz=0; } cur.push(it); sz+=it.size; }); if(cur.length) out.push(cur); return out; }
function clUpsert(table,conflict,rows){
  return clFetch('/rest/v1/'+table+'?on_conflict='+conflict,{method:'POST',headers:{'Prefer':'resolution=merge-duplicates,return=minimal'},body:rows});
}
function clPush(){
  var q=CLOUD.st.queue, keys=Object.keys(q); if(!keys.length) return Promise.resolve();
  var uid=clUid(), locs={}, items=[];
  keys.forEach(function(key){
    var e=q[key]; if(!locs[e.kind]) locs[e.kind]=clLocal(e.kind);
    var d=e.del?undefined:locs[e.kind][e.id]; if(!e.del&&d===undefined) e.del=1;
    var json=e.del?null:JSON.stringify(d);
    items.push({key:key,v:e.v,h:json?clHash(json):null,row:{user_id:uid,kind:e.kind,id:e.id,data:e.del?null:d,deleted:!!e.del},size:json?json.length:60});
  });
  return clBatches(items).reduce(function(p,b){
    return p.then(function(){
      return clUpsert('user_docs','user_id,kind,id',b.map(function(it){ return it.row; })).then(function(){
        b.forEach(function(it){
          if(it.row.deleted) delete CLOUD.st.shadow[it.key]; else CLOUD.st.shadow[it.key]=it.h;
          if(q[it.key]&&q[it.key].v===it.v) delete q[it.key];
        });
        clSaveState();
      });
    });
  },Promise.resolve());
}
function clPushAtt(){
  var st=CLOUD.st, up=Object.keys(st.attUp), del=Object.keys(st.attDel);
  var metas={}; recipes.forEach(function(r){ (r.attachments||[]).forEach(function(a){ metas[a.id]=a; }); });
  if(typeof shDocs==='function') shDocs().forEach(function(d){ if(d.att) metas[d.att.id]=d.att; });
  var p=Promise.resolve();
  up.forEach(function(id){
    p=p.then(function(){
      var d=attLocal(id), m=metas[id];
      if(!d||!m){ delete st.attUp[id]; clSaveState(); return; }
      return clUpsert('attachments','id',[{id:id,owner:clUid(),name:m.name,mime:m.mime,size:m.size,data:d}]).then(function(){ delete st.attUp[id]; clSaveState(); },
        function(e){ if(e.net) throw e; console.warn('Document non envoyé',id,e); if(e.status===413||/trop gros/.test(e.message)){ delete st.attUp[id]; clSaveState(); toast('« '+m.name+' » : '+e.message,'err'); } else throw e; });
    });
  });
  del.forEach(function(id){
    p=p.then(function(){ return clFetch('/rest/v1/attachments?id=eq.'+encodeURIComponent(id),{method:'DELETE',headers:{'Prefer':'return=minimal'}}).then(function(){ delete st.attDel[id]; clSaveState(); }); });
  });
  return p;
}
// Recettes partagées : on publie un instantané autonome (ingrédients, sous-recettes,
// prix, allergènes, documents) dès qu'il change ; on retire celles qui ne sont plus partagées.
// Garde anti-copie ancienne : un partage n'est retiré que si l'élément a été
// décoché sur cet appareil APRÈS la dernière publication (sa date de modification
// est plus récente). Sans ça, un appareil avec une vieille copie effaçait les
// partages faits depuis un autre appareil.
function clTs(v){ if(!v) return 0; var t=Date.parse(String(v).replace(' ','T').replace(/(\.\d{3})\d+/,'$1').replace(/\+00(:00)?$/,'Z')); return isNaN(t)?0:t; }
function clMayUnpublish(sid){
  var v=CLOUD.st.pub[sid]; if(v==='force-delete') return true;
  var it=recipes.find(function(x){ return clSharedId(x.id)===sid; })||orders.find(function(x){ return clSharedId(x.id)===sid; });
  var row=CLOUD.shared[sid];
  if(!it) return v!=='remote';
  if(!row||row.deleted) return true;
  return clTs(it.updatedAt)>=clTs(row.updated_at);
}
function clPublish(){
  var st=CLOUD.st, rows=[], want={};
  var items=[]; recipes.forEach(function(r){ if(r.shared) items.push({id:r.id,snap:function(){ return shareSnapshot(r); }}); });
  if(typeof shareExtraItems==='function') items=items.concat(shareExtraItems());
  items.forEach(function(it){
    var sid=clSharedId(it.id), snap; want[sid]=1;
    try{ snap=it.snap(); }catch(e){ console.warn(e); return; }
    var h=clHash(JSON.stringify(snap)+'|'+clMyName());
    if(st.pub[sid]!==h) rows.push({sid:sid,h:h,row:{id:sid,owner:clUid(),owner_name:clMyName(),data:snap,deleted:false}});
  });
  Object.keys(st.pub).forEach(function(sid){ if(!want[sid]&&clMayUnpublish(sid)) rows.push({sid:sid,h:null,row:{id:sid,owner:clUid(),owner_name:clMyName(),data:null,deleted:true}}); });
  if(!rows.length) return Promise.resolve();
  return rows.reduce(function(p,it){
    return p.then(function(){ return clUpsert('shared_recipes','id',[it.row]).then(function(){ if(it.h) st.pub[it.sid]=it.h; else delete st.pub[it.sid]; clSaveState(); }); });
  },Promise.resolve());
}
function clPullTable(table,select,filter,since){
  var rows=[];
  function page(after){
    var s=after||since, qs='/rest/v1/'+table+'?select='+select+(filter?'&'+filter:'')+(s?'&updated_at=gt.'+encodeURIComponent(s):'')+'&order=updated_at.asc&limit=500';
    return clFetch(qs).then(function(r){ r=r||[]; rows=rows.concat(r); if(r.length===500) return page(r[r.length-1].updated_at); return rows; });
  }
  return page(null);
}
function clIsoMinus(iso,ms){ if(!iso) return null; var t=Date.parse(String(iso).replace(' ','T').replace(/(\.\d{3})\d+/,'$1')); return isNaN(t)?null:new Date(t-ms).toISOString(); }
function clMaxTs(rows,prev){ return rows.reduce(function(m,r){ return (!m||r.updated_at>m)?r.updated_at:m; },prev); }
function clPull(opts){
  opts=opts||{}; var st=CLOUD.st, full=!st.since.user;
  return Promise.all([
    clPullTable('user_docs','kind,id,data,deleted,updated_at','user_id=eq.'+clUid(),clIsoMinus(st.since.user,3000)),
    clPullTable('shared_recipes','id,owner,owner_name,data,deleted,updated_at','',clIsoMinus(st.since.shared,3000))
  ]).then(function(res){
    var n=clApply(res[0],(full&&opts.replace!==false)?CL_KINDS:null);
    st.since.user=clMaxTs(res[0],st.since.user)||st.since.user||'1970-01-01T00:00:00Z';
    var ns=0; res[1].forEach(function(r){ var o=CLOUD.shared[r.id]; if(!o||o.updated_at!==r.updated_at){ CLOUD.shared[r.id]=r; ns++; } });
    st.since.shared=clMaxTs(res[1],st.since.shared)||st.since.shared||'1970-01-01T00:00:00Z';
    // une de mes recettes retirée du partage par l'administrateur
    var gone=[];
    res[1].forEach(function(r){
      // seul un retrait par l'administrateur (marqué by:admin) décoche la recette ; un retrait fait
      // depuis un autre de mes appareils arrive déjà par la recette elle-même
      if(r.owner!==clUid()||!r.deleted||!st.pub[r.id]||st.pub[r.id]==='force-delete'||!(r.data&&r.data.by==='admin')) return;
      var rec=recipes.find(function(x){ return clSharedId(x.id)===r.id; });
      if(rec&&rec.shared){ delete rec.shared; delete rec.shareFolder; rec.updatedAt=now(); gone.push(rec.name); }
      else if(typeof shareExtraGone==='function'){ var nm=shareExtraGone(r.id); if(nm) gone.push(nm); }
    });
    if(gone.length){ persist(); toast((gone.length>1?gone.length+' partages retirés':'« '+gone[0]+' » retiré')+' du partage par l’administrateur','info'); }
    // une recette partagée par moi depuis un autre appareil : on garde la trace pour pouvoir la retirer
    res[1].forEach(function(r){ if(r.owner===clUid()&&!r.deleted&&!(r.id in st.pub)) st.pub[r.id]='remote'; if(r.owner===clUid()&&r.deleted) delete st.pub[r.id]; });
    if(ns) clSave('v4_shared_cache',CLOUD.shared);
    clSaveState();
    if(n||ns) clAfterRemote(n,ns);
  });
}
// Applique les lignes reçues. Si fullKinds est donné, les éléments locaux absents
// du serveur (et non en attente d'envoi) sont retirés : la version en ligne fait foi.
function clApply(rows,fullKinds){
  clFlushDirty();
  var st=CLOUD.st, changed={}, n=0, seen={};
  rows.forEach(function(r){
    var key=r.kind+':'+r.id; seen[key]=1;
    if(st.queue[key]) return;                     // modification locale en attente : elle gagne
    var json=r.deleted?null:JSON.stringify(r.data);
    if(r.kind==='cfg'){
      if(r.deleted){ delete st.shadow[key]; return; }
      if(LS.getItem(r.id)!==json){ CLOUD.applying=true; try{ LS.setItem(r.id,json); }finally{ CLOUD.applying=false; } n++; }
      st.shadow[key]=clHash(json); return;
    }
    var arr=clArr(r.kind); if(!arr) return;
    var idx=-1; for(var i=0;i<arr.length;i++){ if(arr[i]&&String(arr[i].id)===String(r.id)){ idx=i; break; } }
    if(r.deleted){ if(idx>=0){ arr.splice(idx,1); changed[r.kind]=1; n++; } delete st.shadow[key]; return; }
    if(idx>=0){ if(JSON.stringify(arr[idx])!==json){ arr[idx]=r.data; changed[r.kind]=1; n++; } }
    else { arr.push(r.data); changed[r.kind]=1; n++; }
    st.shadow[key]=clHash(json);
  });
  (fullKinds||[]).forEach(function(kind){
    if(kind==='cfg') return;
    var arr=clArr(kind); if(!arr) return;
    var keep=arr.filter(function(x){ var key=kind+':'+x.id; return seen[key]||st.queue[key]; });
    if(keep.length!==arr.length){ n+=arr.length-keep.length; clSetArr(kind,keep); changed[kind]=1; }
    Object.keys(st.shadow).forEach(function(key){ if(key.indexOf(kind+':')===0&&!seen[key]) delete st.shadow[key]; });
  });
  Object.keys(changed).forEach(clStoreKind);
  return n;
}
function clAfterRemote(n,ns){
  try{
    updBadges(); if(typeof updSharedCount==='function') updSharedCount();
    if(CUR==='home') renderHome();
    else if(CUR==='partage') renderPartage();
    else if(CUR==='recettes'){ if(n) renderRec(); }
    else if(n&&CUR==='catalogue') renderCat(); else if(n&&CUR==='fournisseurs') renderSuppliers(); else if(n&&CUR==='bons') renderBons();
  }catch(e){ console.warn(e); }
}

// ── Connexion ──
function clAppUrl(){ return /^https?:$/.test(location.protocol)?location.origin+location.pathname:''; }
function clRedirectQS(){ var u=clAppUrl(); return u?'?redirect_to='+encodeURIComponent(u):''; }
function clSignIn(email,pw){ return clFetch('/auth/v1/token?grant_type=password',{method:'POST',auth:false,body:{email:email,password:pw}}).then(clSetSession); }
function clSignUp(email,pw,name){
  return clFetch('/auth/v1/signup'+clRedirectQS(),{method:'POST',auth:false,body:{email:email,password:pw,data:{display_name:name||'',invite:(CLOUD.pendingInvite&&CLOUD.pendingInvite.c)||''}}})
    .then(function(j){ if(j&&j.access_token) return clSetSession(j); var e=new Error('Compte créé. Ouvre le lien reçu par email pour le confirmer, puis connecte-toi.'); e.confirm=true; throw e; });
}
function clSignedOut(msg){
  CLOUD.sess=null; CLOUD.st=clFreshState(); CLOUD.shared={}; CLOUD.me=null; CLOUD.inv=null; CLOUD.pendingN=0;
  clSave('v4_cloud_sess',null); clSave('v4_shared_cache',null); clSave('v4_cloud_me',null); clSave('v4_cloud_inv',null); clSaveState();
  CLOUD.status='off'; if(msg) toast(msg,'info'); clUI(); if(typeof updSharedCount==='function') updSharedCount();
}
function clHasLocalData(){
  if(!(recipes.length+ingredients.length+orders.length+suppliers.length)) return false;
  var p=LS.getItem('v4_pristine');   // catalogue d'exemple jamais modifié : ce ne sont pas des données personnelles
  return !(p&&!orders.length&&!suppliers.length&&clHash(JSON.stringify([ingredients,recipes]))===p);
}

// ── Un espace par compte sur le même appareil ──
// Les données de travail appartiennent au compte connecté (v4_owner). À la
// déconnexion, elles sont mises de côté sous « acct:<id>: » et l'appareil se
// vide ; elles reviennent quand ce compte se reconnecte. Les données sans
// compte (avant toute connexion) sont rangées sous « acct:_appareil: ».
var ACCT_KEYS=['v4_ing','v4_rec','v4_ord','v4_suppliers','v4_ingcats','v4_reccats','v4_ingsubs','v4_recsubs','v4_profile','v4_ridraft','v4_ocrfix','v4_safety','v4_lastbackup','v4_bksnooze','v4_cloud_state','v4_shared_cache','v4_aikey','v4_cloud_me','v4_cloud_inv','v4_shdocs'];
function acctIsData(k){ return ACCT_KEYS.indexOf(k)>=0||k.indexOf('v4_att:')===0; }
function acctOwner(){ return LS.getItem('v4_owner')||''; }
function acctPfx(id){ return 'acct:'+id+':'; }
function acctHas(id){ var p=acctPfx(id); return LS.keys().some(function(k){ return k.indexOf(p)===0; }); }
function acctMarkPristine(){ try{ LS.setItem('v4_pristine',clHash(JSON.stringify([ingredients,recipes]))); }catch(e){} }
function acctMove(from,to){   // '' = données de travail
  CLOUD.applying=true;
  try{
    LS.keys().forEach(function(k){
      var w=from?(k.indexOf(from)===0?k.slice(from.length):null):k;
      if(w==null||!acctIsData(w)) return;
      if(to!=null) LS.setItem(to+w,LS.getItem(k));
      LS.removeItem(k);
    });
  } finally { CLOUD.applying=false; }
}
function acctStash(id){ acctMove('',acctPfx(id)); }
function acctRestore(id){ acctMove('',null); acctMove(acctPfx(id),''); }
function acctReload(){ try{ LS.flush(); }catch(e){} setTimeout(function(){ location.reload(); },350); }
// À la connexion : 'ok' (continuer), 'ask' (données sans compte : demander), 'reload'
function acctEnter(uid){
  var own=acctOwner(); if(own===uid) return 'ok';
  try{ persist(); }catch(e){}
  if(!own){
    if(!acctHas(uid)&&!clHasLocalData()){ LS.setItem('v4_owner',uid); return 'ok'; }
    if(!acctHas(uid)) return 'ask';
    if(clHasLocalData()) acctStash('_appareil'); else acctMove('',null);
  } else acctStash(own);
  if(acctHas(uid)) acctRestore(uid); else acctMove('',null);
  LS.setItem('v4_owner',uid);
  return 'reload';
}
function clClaim(mine){
  var uid=clUid(); if(!uid) return;
  if(mine){
    LS.setItem('v4_owner',uid); CLOUD.st=clFreshState(); clSaveState(); CLOUD.ui={}; clRedraw();
    clAuthed(clMe).then(function(me){
      if(me.status!=='active'){ CLOUD.ui={wait:me.status}; clRedraw(); clUI(); clWaitApproval(); return; }
      return clStart('merge');
    }).catch(function(e){ console.warn(e); });
    return;
  }
  try{ persist(); }catch(e){}
  acctStash('_appareil'); acctMove('',null); LS.setItem('v4_owner',uid);
  toast('Ces recettes sont mises de côté sur l’appareil. Ouverture de ton espace…','info'); acctReload();
}
// Première connexion sur cet appareil
function clAfterLogin(){
  if(acctOwner()!==clUid()){
    var g=acctEnter(clUid());
    if(g==='reload'){ acctReload(); return Promise.resolve(); }
    if(g==='ask'){ CLOUD.ui={claim:true}; clRedraw(); clUI(); return Promise.resolve(); }
  }
  return clAuthed(clMe).then(function(me){
    if(me.status!=='active'){ CLOUD.st=clFreshState(); clSaveState(); CLOUD.ui={wait:me.status}; clRedraw(); clUI(); clWaitApproval(); return; }
    return clAfterLoginGo();
  });
}
function clAfterLoginGo(){
  CLOUD.st=clFreshState(); clSaveState();
  return clAuthed(function(){ return clFetch('/rest/v1/user_docs?select=kind&user_id=eq.'+clUid()+'&deleted=eq.false&limit=1'); }).then(function(r){
    if(!r||!r.length){ return clStart('push'); }                 // espace en ligne vide : on y met les données de l'appareil
    if(!clHasLocalData()) return clStart('replace');
    CLOUD.ui={choice:true}; clRedraw();                           // l'utilisateur choisit
  });
}
function clStart(mode){
  var st=CLOUD.st; st.ready=true; CLOUD.ui={};
  if(mode==='replace'){ try{ pushAutosave('avant la connexion à l’espace en ligne'); }catch(e){} }
  clSaveState(); clRedraw();
  CLOUD.busy=true; CLOUD.status='sync'; clUI();
  // remplacer : la version en ligne remplace l'appareil ; fusionner / envoyer : on garde tout et on envoie ce qui manque
  return clAuthed(function(){ return clPull({replace:mode==='replace'}); }).then(function(){
    CLOUD.busy=false;
    if(mode!=='replace'){ CL_KINDS.forEach(function(k){ _clDirty[k]=1; }); clDiffDirty(); }
    recipes.forEach(function(r){ (r.attachments||[]).forEach(function(a){ if(attLocal(a.id)) st.attUp[a.id]=1; }); });
    clSaveState();
    return clSync();
  },function(e){ CLOUD.busy=false; CLOUD.status=e.net?'offline':'error'; CLOUD.msg=e.message; clUI(); throw e; })
  .then(function(){ if(CUR==='backup') renderBackup(); else clRedraw(); if(typeof recEdExtras==='function'&&CUR==='rec-edit') recEdExtras(); if(CUR==='recettes') setRecTab(REC_TAB);
    toast(mode==='replace'?'Ton espace en ligne est chargé':'Espace en ligne prêt','ok'); });
}

// ── Lien d'invitation (contient l'adresse du serveur) ──
function clB64e(s){ return btoa(unescape(encodeURIComponent(s))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function clB64d(s){ s=s.replace(/-/g,'+').replace(/_/g,'/'); while(s.length%4) s+='='; return decodeURIComponent(escape(atob(s))); }
function clInviteLink(){
  if(!CLOUD.cfg) return '';
  var base=location.href.split('#')[0].split('?')[0];
  var o={u:CLOUD.cfg.url,k:CLOUD.cfg.key,by:CLOUD.sess?clMyName():''};
  if(clIsAdmin()&&CLOUD.inv&&CLOUD.inv.code) o.c=CLOUD.inv.code;   // lien de l'administrateur : compte validé d'office
  return base+'#rejoindre='+clB64e(JSON.stringify(o));
}
function clParseInvite(txt){
  var m=String(txt||'').trim().match(/rejoindre=([A-Za-z0-9_\-]+)/); if(!m) return null;
  try{ var o=JSON.parse(clB64d(m[1])); if(o&&o.u&&o.k) return o; }catch(e){}
  return null;
}
function clUseInvite(o){
  if(CLOUD.sess&&CLOUD.cfg&&CLOUD.cfg.url===o.u) return;   // déjà connecté à ce serveur
  CLOUD.cfg={url:o.u,key:o.k}; clSave('v4_cloud_cfg',CLOUD.cfg);
  CLOUD.pendingInvite={by:o.by||'',c:o.c||''}; CLOUD.ui={mode:'signup'};
}
function clCheckHash(){
  var o=clParseInvite(location.hash); if(!o) return false;
  clUseInvite(o);
  try{ history.replaceState(null,'',location.href.split('#')[0]); }catch(e){ location.hash=''; }
  setTimeout(function(){ goPage('backup'); var c=document.getElementById('cl-card'); if(c) c.scrollIntoView({block:'start'}); toast(o.by?'Invitation de '+o.by:'Invitation reçue','info'); },300);
  return true;
}

// ── Indicateur ──
function clUI(){
  var b=document.getElementById('tb-cloud'), sb=document.getElementById('sb-cloud');
  var on=clLive(), pend=CLOUD.st?Object.keys(CLOUD.st.queue).length+Object.keys(CLOUD.st.attUp).length:0;
  var cls=!on?'':(CLOUD.status==='blocked'||CLOUD.status==='deleted')?'err':CLOUD.status==='pending'?'off':CLOUD.status==='error'?'err':CLOUD.status==='offline'?'off':(CLOUD.status==='sync'||pend)?'sync':'ok';
  var txt=!on?'':CLOUD.status==='pending'?'En attente de validation':CLOUD.status==='blocked'?'Compte bloqué':CLOUD.status==='deleted'?'Compte supprimé':CLOUD.status==='error'?'Erreur de synchro':CLOUD.status==='offline'?('Hors ligne'+(pend?' · '+pend+' en attente':'')):(CLOUD.status==='sync'?'Synchronisation…':pend?pend+' en attente':'Synchronisé');
  if(b){ b.style.display=on?'':'none'; b.className='tb-cloud '+cls; b.title='Espace en ligne — '+txt; b.innerHTML=ic(CLOUD.status==='offline'?'cloud-off':'cloud')+'<i></i>'; }
  if(sb){ sb.style.display=on?'':'none'; sb.className='sb-cloud '+cls; sb.innerHTML=on?ic(CLOUD.status==='offline'?'cloud-off':'cloud')+'<span><b>'+esc(clMyName())+'</b>'+esc(txt)+'</span><button class="sb-out" onclick="event.stopPropagation();clLogout()" title="Se déconnecter" aria-label="Se déconnecter">'+ic('logout')+'</button>':''; }
  var s=document.getElementById('cl-status'); if(s) s.innerHTML=clStatusLine();
}
function clStatusLine(){
  var pend=CLOUD.st?Object.keys(CLOUD.st.queue).length+Object.keys(CLOUD.st.attUp).length:0;
  if(CLOUD.status==='pending'||CLOUD.status==='blocked'||CLOUD.status==='deleted') return '<span class="cl-st '+(CLOUD.status==='pending'?'off':'err')+'">'+ic('alert')+' '+(CLOUD.status==='pending'?'Compte en attente de validation par l’administrateur':CLOUD.status==='blocked'?'Compte bloqué par l’administrateur':'Compte supprimé par l’administrateur')+'</span>';
  if(CLOUD.status==='error') return '<span class="cl-st err">'+ic('alert')+' '+esc(CLOUD.msg||'Erreur')+'</span>';
  if(CLOUD.status==='offline') return '<span class="cl-st off">'+ic('cloud-off')+' Hors ligne'+(pend?' — '+pend+' modification'+(pend>1?'s':'')+' seront envoyées au retour du réseau':'')+'</span>';
  if(CLOUD.status==='sync') return '<span class="cl-st sync">'+ic('refresh')+' Synchronisation…</span>';
  return '<span class="cl-st ok">'+ic('check-circle')+' Synchronisé'+(CLOUD.lastOk?' à '+new Date(CLOUD.lastOk).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'')+(pend?' — '+pend+' en attente':'')+'</span>';
}

// ── Carte « Espace en ligne » (Réglages) ──
function clCardHTML(){
  var h='<div class="cw" id="cl-card"><div class="cw-t">'+ic('cloud')+' Espace en ligne</div>', ui=CLOUD.ui;
  if(!CLOUD.cfg){
    h+='<div class="cl-p">Retrouve tes recettes, ton catalogue et tes bons sur tous tes appareils, et accède aux <b>recettes partagées</b> : chacun garde son espace perso, et seul l’auteur d’une recette partagée peut la modifier.</div>';
    if(ui.step==='server'){
      h+='<div class="field"><div class="fl">Adresse du projet Supabase</div><input class="fi" id="cl-url" placeholder="https://xxxx.supabase.co" autocapitalize="off" autocorrect="off" spellcheck="false"></div>'+
         '<div class="field"><div class="fl">Clé publique (publishable / anon)</div><input class="fi" id="cl-key" placeholder="sb_publishable_… ou eyJhbGciOi…" autocapitalize="off" autocorrect="off" spellcheck="false"></div>'+
         '<div class="cl-btns"><button class="btn btn-gold btn-sm" onclick="clSaveServer()">'+ic('check')+' Enregistrer</button><button class="btn btn-ghost btn-sm" onclick="clStep(\'\')">Annuler</button></div>'+
         '<div class="cl-hint">La mise en place (une seule fois, 10 minutes) est expliquée dans le fichier PARTAGE.md fourni avec l’appli.</div>';
    } else if(ui.step==='invite'){
      h+='<div class="field"><div class="fl">Lien d’invitation reçu</div><input class="fi" id="cl-inv" placeholder="Colle ici le lien reçu"></div>'+
         '<div class="cl-btns"><button class="btn btn-gold btn-sm" onclick="clPasteInvite()">'+ic('arrow-right')+' Continuer</button><button class="btn btn-ghost btn-sm" onclick="clStep(\'\')">Annuler</button></div>';
    } else {
      h+='<div class="cl-btns"><button class="btn btn-gold btn-sm" onclick="clStep(\'invite\')">'+ic('link')+' J’ai reçu une invitation</button><button class="btn btn-ghost btn-sm" onclick="clStep(\'server\')">'+ic('settings')+' Configurer le serveur (1re fois)</button></div>';
    }
    return h+'</div>';
  }
  if(!CLOUD.sess){
    var pi=CLOUD.pendingInvite;
    h+=(pi?'<div class="cl-inv">'+ic('users')+'<span>'+(pi.by?'<b>'+esc(pi.by)+'</b> t’invite sur Économat Pro. ':'')+'Crée ton compte (ou connecte-toi) : tu auras ton espace perso et accès aux recettes partagées.</span></div>':'<div class="cl-p">Connecte-toi ou crée ton compte.</div>')+
      '<div class="seg cl-seg"><button class="'+(ui.mode!=='login'?'on':'')+'" onclick="clMode(\'signup\')">Créer un compte</button><button class="'+(ui.mode==='login'?'on':'')+'" onclick="clMode(\'login\')">Se connecter</button></div>'+
      (ui.mode!=='login'?'<div class="field"><div class="fl">Prénom (affiché sur tes recettes partagées)</div><input class="fi" id="cl-name" value="'+esc(loadProfile().name||'')+'" placeholder="Ton prénom"></div>':'')+
      '<div class="field"><div class="fl">Email</div><input class="fi" id="cl-email" type="email" autocomplete="email" autocapitalize="off" value="'+esc(ui.email||'')+'"></div>'+
      '<div class="field"><div class="fl">Mot de passe</div><input class="fi" id="cl-pw" type="password" autocomplete="'+(ui.mode==='login'?'current-password':'new-password')+'" placeholder="6 caractères minimum" onkeydown="if(event.key===\'Enter\')clAuthGo()"></div>'+
      '<div class="cl-btns"><button class="btn btn-gold btn-sm" id="cl-go" onclick="clAuthGo()">'+ic('check')+' '+(ui.mode==='login'?'Se connecter':'Créer mon compte')+'</button>'+
      (ui.mode==='login'?'<button class="lnk" onclick="clForgot()">Mot de passe oublié ?</button>':'')+'</div>'+
      '<div class="cl-err" id="cl-err">'+esc(ui.err||'')+'</div>'+
      '<div class="cl-foot"><button class="lnk" onclick="clForgetServer()">Changer de serveur</button></div>';
    return h+'</div>';
  }
  if(!CLOUD.st.ready){
    h+='<div class="cl-who">'+ic('user')+' Connecté : <b>'+esc(CLOUD.sess.user.email||'')+'</b></div>';
    if(ui.wait){
      h+=ui.wait==='pending'
        ?'<div class="cl-p">'+ic('clock')+' <b>Ton compte attend la validation de l’administrateur.</b> Tu peux utiliser l’appli normalement sur cet appareil : tes données seront envoyées dès que ton compte sera validé.</div>'
        :'<div class="cl-p">'+ic('alert')+' <b>'+(ui.wait==='blocked'?'Ton compte a été bloqué':'Ton compte a été supprimé')+' par l’administrateur.</b> L’espace en ligne et les recettes partagées ne sont pas accessibles.</div>';
    } else if(ui.claim){
      var nr=recipes.length;
      h+='<div class="cl-p">Cet appareil contient déjà <b>'+nr+' recette'+(nr>1?'s':'')+'</b> qui ne sont liées à aucun compte. Sont-elles à toi ?</div>'+
        '<div class="cl-choice"><button class="cl-opt" onclick="clClaim(true)"><b>'+ic('check')+' Oui, ce sont les miennes</b><small>Elles sont ajoutées à ton compte (avec ce qu’il contient déjà).</small></button>'+
        '<button class="cl-opt" onclick="clClaim(false)"><b>'+ic('user')+' Non, ouvrir mon espace</b><small>Elles restent de côté sur l’appareil, sans être mises dans ton compte.</small></button></div>';
    } else if(ui.choice){
      h+='<div class="cl-p">Ton espace en ligne contient déjà des données, et cet appareil aussi. Que veux-tu faire ?</div>'+
        '<div class="cl-choice"><button class="cl-opt" onclick="clStart(\'replace\')"><b>'+ic('download')+' Charger mon espace en ligne</b><small>Les données de cet appareil sont remplacées (une copie de sécurité est gardée dans Réglages).</small></button>'+
        '<button class="cl-opt" onclick="clStart(\'merge\')"><b>'+ic('layers')+' Tout fusionner</b><small>Garde les deux : ce qui est sur cet appareil est ajouté à ton espace en ligne.</small></button></div>';
    } else h+='<div class="cl-hint">'+ic('refresh')+' Préparation de ton espace…</div>';
    h+='<div class="cl-err" id="cl-err">'+esc(ui.err||'')+'</div><div class="cl-foot"><span></span><button class="lnk" onclick="clLogout()">'+ic('logout')+' Se déconnecter</button></div>';
    return h+'</div>';
  }
  var myShared=recipes.filter(function(r){ return r.shared; }).length;
  h+='<div class="cl-team"><div class="cl-tn">'+esc(clMyName())+'</div><div class="cl-who">'+esc(CLOUD.sess.user.email||'')+'</div></div>'+
    (typeof mcBox==='function'?mcBox():'')+
    '<div class="cl-sync"><div id="cl-status">'+clStatusLine()+'</div><button class="btn btn-ghost btn-sm" onclick="clSyncNow()">'+ic('refresh')+' Synchroniser</button></div>'+
    '<div class="cl-box"><div class="cl-h">Recettes partagées</div><div class="cl-p" style="margin:0 0 8px">'+(myShared?'Tu partages <b>'+myShared+'</b> recette'+(myShared>1?'s':'')+'.':'Tu ne partages encore aucune recette.')+' Pour partager des dossiers entiers ou une recette, va dans <b>Partage</b>.</div>'+
    '<button class="btn btn-ghost btn-sm" onclick="goPage(\'partage\')">'+ic('users')+' Ouvrir l’espace Partage</button></div>'+
    (clIsAdmin()?'<div class="cl-box"><div class="cl-h">Administration</div><div class="cl-p" style="margin:0 0 8px">Tu es administrateur : tu valides les inscriptions, gères les comptes et les partages.'+(CLOUD.pendingN?' <b>'+CLOUD.pendingN+' inscription'+(CLOUD.pendingN>1?'s':'')+' à valider.</b>':'')+'</div><button class="btn btn-gold btn-sm" onclick="goPage(\'admin\')">'+ic('shield')+' Ouvrir l’administration</button></div>':'')+
    '<div class="cl-box"><div class="cl-h">Inviter quelqu’un</div><div class="cl-row" style="justify-content:space-between"><span class="cl-p" style="margin:0;flex:1;min-width:180px">La personne ouvre le lien, crée son compte, et a son propre espace.'+(clIsAdmin()?' Avec ton lien, son compte est validé d’office (lien valable 30 jours).':(CLOUD.me&&CLOUD.me.approval&&!CLOUD.me.legacy?' Son compte devra être validé par l’administrateur.':''))+'</span><button class="btn btn-gold btn-sm" onclick="clShareInvite()">'+ic('link')+' Envoyer le lien</button></div></div>'+
    '<div class="cl-foot"><span></span><button class="lnk" onclick="clLogout()">'+ic('logout')+' Se déconnecter</button></div>';
  return h+'</div>';
}
function clRedraw(){ var c=document.getElementById('cl-card'), a=document.activeElement; if(c&&!(CLOUD.ui&&CLOUD.ui.acct&&a&&a.tagName==='INPUT'&&a.closest&&a.closest('#mc-box')&&!CLOUD.ui.force)) c.outerHTML=clCardHTML(); if(typeof gateRender==='function') gateRender(); }
function clStep(s){ CLOUD.ui.step=s; CLOUD.ui.err=''; clRedraw(); var f=document.querySelector('#cl-card input'); if(f) f.focus(); }
function clMode(m){ var e=document.getElementById('cl-email'); if(e) CLOUD.ui.email=e.value; CLOUD.ui.mode=m; CLOUD.ui.err=''; clRedraw(); }
function clErr(msg){ CLOUD.ui.err=msg||''; var e=document.getElementById('cl-err'); if(e) e.textContent=CLOUD.ui.err; }
function clBusy(on){ document.querySelectorAll('#cl-card .btn').forEach(function(b){ b.disabled=!!on; }); }
function clNormUrl(u){ u=String(u||'').trim().replace(/\/+$/,'').replace(/\/(rest|auth)\/v1.*$/,''); if(u&&!/^https?:\/\//.test(u)) u='https://'+u; return u; }
function clSaveServer(){
  var url=clNormUrl(document.getElementById('cl-url').value), key=document.getElementById('cl-key').value.trim();
  if(!/^https?:\/\/.+/.test(url)||key.length<20){ toast('Adresse ou clé incomplète','err'); return; }
  CLOUD.cfg={url:url,key:key}; clBusy(true);
  clFetch('/auth/v1/settings',{auth:false}).then(function(){
    clSave('v4_cloud_cfg',CLOUD.cfg); CLOUD.ui={mode:'signup'}; clRedraw(); toast('Serveur enregistré','ok');
  },function(e){ CLOUD.cfg=null; clBusy(false); toast(e.net?'Serveur injoignable : vérifie l’adresse':'Clé refusée : '+e.message,'err'); });
}
function clPasteInvite(){
  var o=clParseInvite(document.getElementById('cl-inv').value);
  if(!o){ toast('Ce n’est pas un lien d’invitation Économat Pro','err'); return; }
  clUseInvite(o); clRedraw();
}
function clForgetServer(){ if(!confirm('Oublier ce serveur ?')) return; CLOUD.cfg=null; CLOUD.pendingInvite=null; clSave('v4_cloud_cfg',null); CLOUD.ui={}; clRedraw(); }
function clPendingName(){
  var n=LS.getItem('v4_pendname'); if(!n) return; LS.removeItem('v4_pendname');
  var pr=loadProfile(); if(!pr.name){ pr.name=n; LS.setItem('v4_profile',JSON.stringify(pr)); }
}
function clAuthGo(){
  var email=(document.getElementById('cl-email').value||'').trim(), pw=document.getElementById('cl-pw').value||'';
  var nmEl=document.getElementById('cl-name'), name=nmEl?nmEl.value.trim():'';
  CLOUD.ui.email=email;
  if(!/^\S+@\S+\.\S+$/.test(email)){ clErr('Adresse email invalide'); return; }
  if(pw.length<6){ clErr('Mot de passe trop court (6 caractères minimum)'); return; }
  clErr(''); clBusy(true);
  clAuthDo(CLOUD.ui.mode==='login'?'login':'signup',email,pw,name)
    .catch(function(e){ clBusy(false); if(e.confirm){ CLOUD.ui.mode='login'; clRedraw(); clErr(e.message); } else { clRedraw(); clErr(e.message); } });
}
// Connexion ou création de compte, puis ouverture de l'espace (partagé par la carte Réglages et l'écran d'accueil)
function clAuthDo(mode,email,pw,name){
  var p=mode==='login'?clSignIn(email,pw):clSignUp(email,pw,name);
  return p.then(function(){
    CLOUD.pendingInvite=null;
    var go=acctEnter(clUid());
    if(name) LS.setItem('v4_pendname',name);
    if(go==='reload'){ CLOUD.ui={reloading:true}; clRedraw(); toast('Ouverture de ton espace…','info'); acctReload(); return; }
    clPendingName();
    if(go==='ask'){ CLOUD.ui={claim:true}; clRedraw(); clUI(); return; }
    CLOUD.ui={}; clRedraw(); clUI();
    return clAfterLogin();
  });
}
function clShareInvite(){
  if(clIsAdmin()&&!(CLOUD.inv&&CLOUD.inv.code)){ clAdminTick().then(function(){ clShareInvite(); }); return; }
  var link=clInviteLink(); if(!link) return;
  if(navigator.share){ navigator.share({title:'Économat Pro',text:clMyName()+' t’invite sur Économat Pro (recettes partagées)',url:link}).catch(function(){}); return; }
  clCopy(link).then(function(){ toast('Lien copié : colle-le dans un message','ok'); },function(){ prompt('Copie ce lien :',link); });
}
function clCopy(s){
  if(navigator.clipboard&&navigator.clipboard.writeText) return navigator.clipboard.writeText(s);
  return new Promise(function(res,rej){ try{ var t=document.createElement('textarea'); t.value=s; document.body.appendChild(t); t.select(); var ok=document.execCommand('copy'); t.remove(); ok?res():rej(); }catch(e){ rej(e); } });
}
function clSyncNow(){ clSync().then(function(){ if(CLOUD.status==='ok') toast('Synchronisé','ok'); else if(CLOUD.msg) toast(CLOUD.msg,'err'); }); }
function clLogout(){
  var pend=CLOUD.st?Object.keys(CLOUD.st.queue).length:0;
  if(!confirm('Se déconnecter ?\n\nTes recettes, ton catalogue et tes bons sont mis de côté : la personne qui utilisera l’appli ensuite ne les verra pas. Tu les retrouves en te reconnectant'+(pend?' (les '+pend+' modification(s) pas encore envoyée(s) partiront à ce moment-là)':'')+'.')) return;
  clLogoutDo();
}
function clLogoutDo(){
  var s=CLOUD.sess, uid=clUid();
  try{ persist(); }catch(e){}
  clSaveState();
  if(uid&&acctOwner()===uid){ acctStash(uid); LS.removeItem('v4_owner'); if(acctHas('_appareil')) acctRestore('_appareil'); }
  clSignedOut(); clRedraw();
  if(s) fetch(CLOUD.cfg.url+'/auth/v1/logout',{method:'POST',headers:{apikey:CLOUD.cfg.key,Authorization:'Bearer '+s.access_token}}).catch(function(){});
  toast('Déconnecté — tes données sont à l’abri','ok'); acctReload();
}
function clForgot(){
  var e=(document.getElementById('cl-email').value||'').trim(); if(!/^\S+@\S+\.\S+$/.test(e)){ clErr('Entre ton email puis clique à nouveau'); return; }
  clFetch('/auth/v1/recover'+clRedirectQS(),{method:'POST',auth:false,body:{email:e}}).then(function(){ clErr(''); toast('Email de réinitialisation envoyé','ok'); },function(er){ clErr(er.message); });
}

// ── Démarrage ──
function cloudInit(){
  CLOUD.cfg=clLoad('v4_cloud_cfg',null);
  if(!CLOUD.cfg&&window.ECO_SERVER&&ECO_SERVER.url&&ECO_SERVER.key){ CLOUD.cfg={url:clNormUrl(ECO_SERVER.url),key:ECO_SERVER.key,builtin:true}; clSave('v4_cloud_cfg',CLOUD.cfg); }   /* gardé : une future version sans serveur intégré le retrouve */ CLOUD.sess=clLoad('v4_cloud_sess',null);
  CLOUD.st=clLoad('v4_cloud_state',null)||clFreshState();
  ['pub','attUp','attDel'].forEach(function(k){ if(!CLOUD.st[k]) CLOUD.st[k]={}; });
  if(!CLOUD.st.since) CLOUD.st.since={user:null,shared:null};
  if(CLOUD.sess&&CLOUD.st.ready===undefined) CLOUD.st.ready=false;
  CLOUD.shared=clLoad('v4_shared_cache',{})||{};
  CLOUD.me=clLoad('v4_cloud_me',null); CLOUD.inv=clLoad('v4_cloud_inv',null);
  // appareil déjà connecté avant les espaces séparés : ses données sont celles de ce compte
  if(CLOUD.sess&&CLOUD.sess.user&&!acctOwner()&&!LS.getItem('v4_acctv')) LS.setItem('v4_owner',CLOUD.sess.user.id);
  LS.setItem('v4_acctv','1');
  if(CLOUD.sess) clPendingName();
  var _set=LS.setItem, _rm=LS.removeItem;
  LS.setItem=function(k,v){ _set.call(LS,k,v); clOnSet(k); };
  LS.removeItem=function(k){ _rm.call(LS,k); clOnSet(k); };
  clCheckHash(); clUI();
  try{ attGc(); }catch(e){}
  if(clLive()){
    CL_KINDS.forEach(function(k){ _clDirty[k]=1; });   // modifs faites hors ligne / avant fermeture
    setTimeout(function(){ clDiffDirty(); clSync(); },600);
  } else if(clActive()&&!CLOUD.st.ready){ setTimeout(function(){ clAfterLogin().catch(function(e){ console.warn(e); }); },800); }
  CLOUD.timer=setInterval(function(){ if(clLive()&&document.visibilityState!=='hidden') clSync(); },25000);
  window.addEventListener('hashchange',function(){ if(clCheckHash()) clRedraw(); });
  window.addEventListener('online',function(){ if(clLive()) clSync(); });
  window.addEventListener('offline',function(){ if(clLive()){ CLOUD.status='offline'; clUI(); } });
  document.addEventListener('visibilitychange',function(){ if(document.visibilityState==='visible'&&clLive()) clSync(); });
  if(typeof updSharedCount==='function') updSharedCount();
}
