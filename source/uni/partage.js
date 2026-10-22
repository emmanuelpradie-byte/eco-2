// ══ ESPACE PARTAGE (page dédiée, dossiers) ════════════════════════
// Un dossier partagé = un nom (« Stage traiteur ») porté par chaque élément
// partagé : recettes (r.shareFolder), bons d'économat (o.shareFolder) et
// documents PDF / images (liste « v4_shdocs »). Chaque élément reste
// modifiable par son seul auteur. Un dossier peut avoir un mot de passe :
// le serveur cache alors son contenu à ceux qui ne l'ont pas saisi.
var PART={tab:'others',q:'',open:null,acct:null};
var PT_NAMES={rec:['recette','recettes'],bon:['bon','bons'],pdf:['PDF','PDF'],img:['image','images'],doc:['document','documents']};

function partConnectHTML(){
  return '<div class="empty shr-empty"><span class="empty-i">'+ic('users')+'</span><div class="empty-t">Partage</div>'+
    '<div class="empty-s">Connecte-toi à ton espace en ligne pour voir les recettes, bons et documents partagés par les autres, et partager les tiens. Chacun garde son espace perso.</div>'+
    '<button class="btn btn-gold btn-sm" style="margin-top:12px" onclick="goPage(\'backup\');setTimeout(function(){var c=document.getElementById(\'cl-card\');if(c)c.scrollIntoView({block:\'start\'});},60)">'+ic('user')+' Se connecter</button></div>';
}
function shType(x){ var t=x&&x.data&&x.data.type; return t==='bon'||t==='doc'?t:'rec'; }
function partCountLabel(c){
  var p=[]; ['rec','bon','pdf','img','doc'].forEach(function(k){ var n=c[k]||0; if(n) p.push(n+' '+PT_NAMES[k][n>1?1:0]); });
  return p.join(' · ')||'vide';
}
function partCountRows(rows){ var c={}; rows.forEach(function(x){ var t=partSecType(x); c[t]=(c[t]||0)+1; }); return c; }
function partFolderKey(x){ return x.owner+'|'+((x.data&&x.data.folder)||''); }

// ── mes documents partagés (PDF / images) ──
function shDocs(){ try{ var a=JSON.parse(LS.getItem('v4_shdocs')||'[]'); return Array.isArray(a)?a:[]; }catch(e){ return []; } }
function shDocsSave(a){ LS.setItem('v4_shdocs',JSON.stringify(a)); }
function shOrderSnap(o){
  var items=(o.items||[]).map(function(it){
    var g=ingredients.find(function(x){ return x.id===it.ingId; })||{}, q;
    try{ q=bonQtyLabel(Object.assign({},it,{ing:g})); }catch(e){ q=fQtyNice(it.qty); }
    return {n:g.name||it.name||'?',cat:g.cat||'',u:g.unit||'kg',price:g.price||0,buyPrice:g.buyPrice!=null?g.buyPrice:null,unitWeight:g.unitWeight||null,
      allergens:g.allergens||[],allergensSet:!!g.allergensSet,qty:it.qty,q:q,cost:it.cost||0};
  });
  return {type:'bon',name:o.name||'Bon',date:o.date||'',status:o.status||'draft',notes:o.notes||'',recipes:(o.recipesUsed||[]).slice(0,30),
    items:items,cost:items.reduce(function(s,i){ return s+(i.cost||0); },0),folder:(o.shared&&o.shareFolder)||''};
}
function shDocSnap(d){ return {type:'doc',name:d.name,attachments:[{id:d.att.id,name:d.att.name,mime:d.att.mime,size:d.att.size}],size:d.att.size,mime:d.att.mime,folder:d.folder||''}; }
// éléments publiés en plus des recettes (lu par la synchro)
function shareExtraItems(){
  var out=[];
  orders.forEach(function(o){ if(o.shared) out.push({id:o.id,snap:function(){ return shOrderSnap(o); }}); });
  shDocs().forEach(function(d){ if(d.att) out.push({id:d.id,snap:function(){ return shDocSnap(d); }}); });
  return out;
}
// l'administrateur a retiré un de mes bons / documents
function shareExtraGone(sid){
  var o=orders.find(function(x){ return clSharedId(x.id)===sid; });
  if(o&&o.shared){ delete o.shared; delete o.shareFolder; o.updatedAt=now(); return o.name; }
  var ds=shDocs(), i=ds.findIndex(function(d){ return clSharedId(d.id)===sid; });
  if(i>=0){ var nm=ds[i].name; ds.splice(i,1); shDocsSave(ds); return nm; }
  return null;
}

// ── mots de passe des dossiers ──
function partMyLocked(f){ return (CLOUD.myLocks||[]).indexOf(f)>=0; }
function partLocksOf(owner){ return (CLOUD.locks||[]).filter(function(l){ return l.owner===owner; }); }
function partLockFor(owner,f){ return (CLOUD.locks||[]).find(function(l){ return l.owner===owner&&l.folder===f; }); }
function clLocksTick(){
  if(!clLive()||!CLOUD.me||CLOUD.me.legacy||CLOUD.me.status!=='active') return Promise.resolve();
  return Promise.all([clFetch('/rest/v1/rpc/locked_shares',{method:'POST',body:{}}),clFetch('/rest/v1/rpc/my_share_locks',{method:'POST',body:{}})]).then(function(r){
    CLOUD.locks=r[0]||[]; CLOUD.myLocks=r[1]||[];
    var sig=JSON.stringify(CLOUD.locks.map(function(l){ return [l.owner,l.folder,!!l.unlocked]; }).sort());
    if(sig!==CLOUD.lockSig){ CLOUD.lockSig=sig; return clSharedRefresh(); }
  },function(){ CLOUD.locks=[]; CLOUD.myLocks=[]; });
}
// relit tous les partages visibles (après un mot de passe saisi, ajouté ou retiré)
function clSharedRefresh(){
  return clPullTable('shared_recipes','id,owner,owner_name,data,deleted,updated_at','deleted=eq.false',null).then(function(rows){
    var m={}; rows.forEach(function(r){ m[r.id]=r; });
    CLOUD.shared=m; clSave('v4_shared_cache',m);
    var mx=clMaxTs(rows,null); if(mx&&(!CLOUD.st.since.shared||mx>CLOUD.st.since.shared)) CLOUD.st.since.shared=mx;
    clSaveState(); clAfterRemote(0,1);
  });
}
(function(){ var _p=clPull; clPull=function(){ return _p.apply(this,arguments).then(function(r){ return clLocksTick().then(function(){ return r; },function(){ return r; }); }); }; })();

function partMyFolders(){
  var m={};
  function f(n){ return m[n]||(m[n]={name:n,recs:[],bons:[],docs:[]}); }
  recipes.forEach(function(r){ if(r.shared&&r.shareFolder) f(r.shareFolder).recs.push(r); });
  orders.forEach(function(o){ if(o.shared&&o.shareFolder) f(o.shareFolder).bons.push(o); });
  shDocs().forEach(function(d){ if(d.folder) f(d.folder).docs.push(d); });
  return Object.keys(m).sort(function(a,b){ return a.localeCompare(b,'fr'); }).map(function(k){ return m[k]; });
}
function partMineCount(){ return recipes.filter(function(r){ return r.shared; }).length+orders.filter(function(o){ return o.shared; }).length+shDocs().length; }
function partMatch(txt){ var q=normTxt(PART.q); return !q||normTxt(txt).indexOf(q)>=0; }

function renderPartage(){
  var w=document.getElementById('part-wrap'); if(!w) return;
  if(typeof clActive!=='function'||!clActive()){ w.innerHTML=partConnectHTML(); return; }
  var others=sharedList().filter(function(x){ return !shrIsMine(x); }).length+(CLOUD.locks||[]).filter(function(l){ return !l.unlocked; }).reduce(function(s,l){ return s+(l.n||0); },0);
  var h='<div class="seg part-seg"><button class="'+(PART.tab==='others'?'on':'')+'" onclick="PART.tab=\'others\';PART.open=null;PART.acct=null;renderPartage()">'+ic('users')+' Des autres · '+others+'</button>'+
    '<button class="'+(PART.tab==='mine'?'on':'')+'" onclick="PART.tab=\'mine\';PART.open=null;renderPartage()">'+ic('upload')+' Les miens · '+partMineCount()+'</button></div>'+
    '<div class="srch">'+ic('search')+'<input class="sinp" id="part-q" placeholder="Rechercher…" value="'+esc(PART.q)+'" oninput="PART.q=this.value;partBody()"></div>'+
    '<div id="part-body"></div>';
  w.innerHTML=h; partBody();
}
function partBody(){
  var b=document.getElementById('part-body'); if(!b) return;
  b.innerHTML=PART.tab==='mine'?partMineHTML():partOthersHTML();
}
function partCopiedBon(x){ return orders.some(function(o){ return o.fromShared&&o.fromShared.id===x.id; }); }
function partTile(x){
  var d=x.data, t=shType(x);
  if(t==='bon'){
    var n=(d.items||[]).length;
    return '<div class="rt sh-bon" onclick="openSharedBon(\''+escJS(x.id)+'\')"><div class="rt-ph" style="--ch:35"><span class="rt-em rt-ic">'+ic('bon')+'</span>'+
      (partCopiedBon(x)?'<span class="rt-badge">'+ic('check')+' Copié</span>':'')+'</div>'+
      '<div class="rt-b"><div class="rt-n">'+esc(d.name)+'</div><div class="rt-m">'+n+' article'+(n>1?'s':'')+' · '+fEur(d.cost||0)+'</div><div class="rt-c">'+ic('bon')+' Bon d’économat'+(d.date?' · '+fDate(d.date):'')+'</div></div></div>';
  }
  if(t==='doc'){
    var a=(d.attachments||[])[0]||{}, pdf=attIsPdf(a);
    return '<div class="rt sh-doc" onclick="openSharedDoc(\''+escJS(x.id)+'\')"><div class="rt-ph" style="--ch:8"><span class="rt-em rt-ic">'+ic(pdf?'pdf':'image')+'</span></div>'+
      '<div class="rt-b"><div class="rt-n">'+esc(d.name)+'</div><div class="rt-m">'+(pdf?'PDF':'Image')+' · '+attSize(a.size||d.size)+'</div><div class="rt-c">'+ic('file')+' Document</div></div></div>';
  }
  var img=d.image&&d.image.length>4;
  var ph=img?'<img src="'+esc(d.image)+'" alt="" loading="lazy">':'<span class="rt-em">'+(d.image||ic('book'))+'</span>';
  var copied=recipes.some(function(r){ return r.fromShared&&r.fromShared.id===x.id; });
  return '<div class="rt" onclick="openShared(\''+escJS(x.id)+'\')"><div class="rt-ph'+(img?' img':'')+'" style="--ch:'+catHue(d.cat||'')+'">'+ph+
    (copied?'<span class="rt-badge">'+ic('check')+' Copiée</span>':'')+'</div>'+
    '<div class="rt-b"><div class="rt-n">'+esc(d.name)+'</div><div class="rt-m">'+fKg(d.weight||0)+' · '+fEur(d.cost||0)+(d.time?' · '+ic('clock')+' '+fDur(d.time):'')+'</div><div class="rt-c">'+catDot(d.cat||'')+esc(d.cat||'')+'</div></div></div>';
}
// contenu d'un dossier rangé en sections séparées : Recettes · Bons · PDF · Images
var PSEC=[['rec','book','Recettes'],['bon','bon','Bons d’économat'],['pdf','pdf','PDF'],['img','image','Images']];
function partSecType(x){ var t=shType(x); if(t!=='doc') return t; var a=(x.data.attachments||[])[0]||{}; return attIsPdf(a.mime?a:x.data.mime)?'pdf':'img'; }
function partSecsHTML(rows){
  var g={rec:[],bon:[],pdf:[],img:[]};
  rows.forEach(function(x){ g[partSecType(x)].push(x); });
  g.rec.sort(function(a,b){ return String(a.data.cat||'').localeCompare(String(b.data.cat||''),'fr')||String(a.data.name).localeCompare(String(b.data.name),'fr'); });
  return PSEC.filter(function(t){ return g[t[0]].length; }).map(function(t){
    var n=g[t[0]].length;
    return '<div class="psec psec-'+t[0]+'"><div class="psec-h"><span class="psec-i">'+ic(t[1])+'</span><b>'+t[2]+'</b><em>'+n+'</em></div><div class="rgrid tiles">'+g[t[0]].map(partTile).join('')+'</div></div>';
  }).join('');
}
// lock : '' | 'locked' (mot de passe à saisir) | 'open' (protégé, déjà déverrouillé ou à moi)
function partFolderCard(name,sub,label,onclick,acts,lock){
  return '<div class="pf'+(acts?' mine':'')+(lock==='locked'?' locked':'')+'"'+(onclick?' onclick="'+onclick+'"':'')+'><span class="pf-ic">'+ic('folder')+(lock?'<i class="pf-lk">'+ic(lock==='locked'?'lock':'unlock')+'</i>':'')+'</span>'+
    '<div class="pf-b"><div class="pf-n">'+esc(name)+'</div><div class="pf-s">'+label+(sub?' · '+sub:'')+'</div></div>'+(acts||ic(lock==='locked'?'lock':'arrow-right'))+'</div>';
}
function partOwnerName(x){ return x.owner_name||'Compte sans nom'; }
function partOthersHTML(){
  var all=sharedList().filter(function(x){ return !shrIsMine(x); });
  var hidden=(CLOUD.locks||[]).filter(function(l){ return !l.unlocked&&l.n>0; });
  if(!all.length&&!hidden.length) return '<div class="empty"><div class="empty-s">Personne n’a encore rien partagé.</div></div>';
  var mkBack=function(label,click){ return '<button class="btn btn-ghost btn-sm" onclick="'+click+'">'+ic('back')+' '+esc(label)+'</button>'; };
  // 3 · un dossier ouvert (à l'intérieur d'un compte)
  if(PART.open){
    var rows=all.filter(function(x){ return partFolderKey(x)===PART.open; });
    if(!rows.length){ PART.open=null; return partOthersHTML(); }
    PART.acct=rows[0].owner;
    var f=rows[0].data.folder, owner=partOwnerName(rows[0]);
    var todo=rows.filter(function(x){ var t=shType(x); return t==='rec'?!recipes.some(function(r){ return r.fromShared&&r.fromShared.id===x.id; }):(t==='bon'&&!partCopiedBon(x)); }).length;
    var copyable=rows.filter(function(x){ return shType(x)!=='doc'; }).length;
    var qa=partMatch(owner+' '+f), lk=partLockFor(rows[0].owner,f);
    return mkBack(owner,'PART.open=null;partBody()')+
      '<div class="pf-head"><span class="pf-ic">'+ic('folder')+(lk?'<i class="pf-lk">'+ic('unlock')+'</i>':'')+'</span><div class="pf-b"><div class="pf-n big">'+esc(f)+'</div><div class="pf-s">Dossier de '+esc(owner)+' · '+partCountLabel(partCountRows(rows))+(lk?' · protégé par mot de passe':'')+'</div></div>'+
      (copyable?'<button class="btn btn-gold btn-sm" id="pf-copyall" onclick="partCopyFolder(\''+escJS(PART.open)+'\')"'+(todo?'':' disabled')+'>'+ic('copy')+' '+(todo?(todo===copyable?'Copier tout le dossier':'Copier les '+todo+' manquants'):'Déjà copié')+'</button>':'')+'</div>'+
      partSecsHTML(rows.filter(function(x){ return qa||partMatch(x.data.name); }));
  }
  // 2 · un compte ouvert : ses dossiers et ses éléments seuls
  if(PART.acct){
    var mine=all.filter(function(x){ return x.owner===PART.acct; }), lks=partLocksOf(PART.acct).filter(function(l){ return !l.unlocked&&l.n>0; });
    if(!mine.length&&!lks.length){ PART.acct=null; return partOthersHTML(); }
    var name=mine.length?partOwnerName(mine[0]):(lks[0].owner_name||'Compte sans nom'), qa2=partMatch(name), groups={}, loose=[];
    mine.forEach(function(x){ if(x.data.folder){ var k=partFolderKey(x); (groups[k]=groups[k]||[]).push(x); } else loose.push(x); });
    var cards=Object.keys(groups).filter(function(k){ var g=groups[k]; return qa2||partMatch(g[0].data.folder)||g.some(function(x){ return partMatch(x.data.name); }); }).map(function(k){
      var g=groups[k], fo=g[0].data.folder;
      return {n:fo,h:partFolderCard(fo,g.slice(0,3).map(function(x){ return esc(x.data.name); }).join(', ')+(g.length>3?'…':''),partCountLabel(partCountRows(g)),'PART.open=\''+escJS(k)+'\';partBody()','',partLockFor(PART.acct,fo)?'open':'')};
    }).concat(lks.filter(function(l){ return qa2||partMatch(l.folder); }).map(function(l){
      return {n:l.folder,h:partFolderCard(l.folder,'mot de passe requis',l.n+' élément'+(l.n>1?'s':''),'partUnlock(\''+escJS(l.owner)+'\',\''+escJS(l.folder)+'\')','','locked')};
    })).sort(function(a,b){ return a.n.localeCompare(b.n,'fr'); });
    var lo=loose.filter(function(x){ return qa2||partMatch(x.data.name+' '+(x.data.cat||'')); });
    var nf=Object.keys(groups).length+lks.length;
    var hh=mkBack('Tous les comptes','PART.acct=null;PART.open=null;partBody()')+
      '<div class="pf-head"><span class="pf-ic">'+ic('folder')+'</span><div class="pf-b"><div class="pf-n big">'+esc(name)+'</div><div class="pf-s">'+partCountLabel(partCountRows(mine))+(nf?' · '+nf+' dossier'+(nf>1?'s':''):'')+'</div></div></div>';
    if(cards.length) hh+='<div class="sh"><div class="sh-t">Dossiers</div></div><div class="pf-list">'+cards.map(function(c){ return c.h; }).join('')+'</div>';
    if(lo.length) hh+='<div class="sh"><div class="sh-t">'+(cards.length?'Autres partages':'Partages')+'</div></div>'+partSecsHTML(lo);
    return hh+((cards.length||lo.length)?'':'<div class="empty"><div class="empty-s">Aucun résultat</div></div>');
  }
  // 1 · un dossier par compte qui partage
  var by={};
  function acct(id,nm){ return by[id]||(by[id]={id:id,name:nm||'Compte sans nom',rows:[],folders:{},locked:0}); }
  all.forEach(function(x){ var a=acct(x.owner,partOwnerName(x)); a.rows.push(x); if(x.data.folder) a.folders[x.data.folder]=1; });
  hidden.forEach(function(l){ var a=acct(l.owner,l.owner_name); a.folders[l.folder]=1; a.locked+=l.n||0; });
  var list=Object.keys(by).map(function(k){ return by[k]; }).filter(function(a){
    return partMatch(a.name)||a.rows.some(function(x){ return partMatch(x.data.name+' '+(x.data.folder||'')+' '+(x.data.cat||'')); })||Object.keys(a.folders).some(partMatch); })
    .sort(function(a,b){ return a.name.localeCompare(b.name,'fr'); });
  if(!list.length) return '<div class="empty"><div class="empty-s">Aucun résultat</div></div>';
  return '<div class="sh"><div class="sh-t">Comptes · '+list.length+'</div></div><div class="pf-list">'+list.map(function(a){
    var nf=Object.keys(a.folders).length, c=partCountRows(a.rows), lab=partCountLabel(c);
    if(a.locked) lab=(a.rows.length?lab+' · ':'')+a.locked+' protégé'+(a.locked>1?'s':'');
    return partFolderCard(a.name,nf?nf+' dossier'+(nf>1?'s':''):'',lab,'PART.acct=\''+escJS(a.id)+'\';partBody()'); }).join('')+'</div>';
}
function partMineHTML(){
  var folders=partMyFolders().filter(function(f){ return partMatch(f.name)||f.recs.some(function(r){ return partMatch(r.name); })||f.bons.some(function(o){ return partMatch(o.name); })||f.docs.some(function(d){ return partMatch(d.name); }); });
  var looseR=recipes.filter(function(r){ return r.shared&&!r.shareFolder&&partMatch(r.name); });
  var looseB=orders.filter(function(o){ return o.shared&&!o.shareFolder&&partMatch(o.name); });
  var looseD=shDocs().filter(function(d){ return !d.folder&&partMatch(d.name); });
  var h='<div class="part-acts"><button class="btn btn-gold btn-sm" onclick="partNewFolder()">'+ic('plus')+' Nouveau dossier partagé</button>'+
    '<button class="btn btn-ghost btn-sm" onclick="partShareCat()">'+ic('folder')+' Partager une catégorie</button>'+
    '<button class="btn btn-ghost btn-sm" onclick="partQuick(\'bon\')">'+ic('bon')+' Partager un bon</button>'+
    '<button class="btn btn-ghost btn-sm" onclick="partAddDocs(\'\')">'+ic('pdf')+' Partager un PDF</button></div>'+
    '<input type="file" id="part-doc-file" accept="application/pdf,image/*" multiple style="display:none" onchange="partDocFiles(this)">'+
    '<div class="shr-info">'+ic('info')+'<span>Les autres voient tes dossiers et peuvent copier tes recettes et tes bons dans leur espace. Toi seul peux les modifier : ils se mettent à jour quand tu enregistres. Un dossier peut avoir un <b>mot de passe</b> ('+ic('lock')+').</span></div>';
  if(folders.length) h+='<div class="sh"><div class="sh-t">Mes dossiers</div></div><div class="pf-list">'+folders.map(function(f){
    var lk=partMyLocked(f.name);
    var acts='<div class="pf-acts" onclick="event.stopPropagation()">'+
      '<button class="btn btn-ghost btn-sm" onclick="partPick(\''+escJS(f.name)+'\')">'+ic('plus')+' Ajouter</button>'+
      '<button class="icbtn'+(lk?' on':'')+'" title="'+(lk?'Mot de passe (protégé)':'Mettre un mot de passe')+'" onclick="partLockUI(\''+escJS(f.name)+'\')">'+ic(lk?'lock':'unlock')+'</button>'+
      '<button class="icbtn" title="Renommer" onclick="partRename(\''+escJS(f.name)+'\')">'+ic('edit')+'</button>'+
      '<button class="icbtn" title="Ne plus partager le dossier" onclick="partStopFolder(\''+escJS(f.name)+'\')">'+ic('x')+'</button></div>';
    var names=f.recs.map(function(r){ return r.name; }).concat(f.bons.map(function(o){ return o.name; }),f.docs.map(function(d){ return d.name; }));
    return partFolderCard(f.name,esc(names.slice(0,3).join(', '))+(names.length>3?'…':''),partCountLabel({rec:f.recs.length,bon:f.bons.length,pdf:f.docs.filter(function(d){ return attIsPdf(d.att); }).length,img:f.docs.filter(function(d){ return !attIsPdf(d.att); }).length})+(lk?' · protégé':''),'partPick(\''+escJS(f.name)+'\')',acts,lk?'open':'');
  }).join('')+'</div>';
  if(looseR.length) h+='<div class="psec"><div class="psec-h"><span class="psec-i">'+ic('book')+'</span><b>Recettes partagées seules</b><em>'+looseR.length+'</em></div><div class="rgrid tiles">'+looseR.map(function(r){
    return '<div class="rt" onclick="openEditRec(\''+r.id+'\')"><div class="rt-ph" style="--ch:'+catHue(r.cat||'')+'">'+recThumb(r)+'</div><div class="rt-b"><div class="rt-n">'+esc(r.name)+'</div><div class="rt-c">'+esc(r.cat||'')+'</div></div></div>'; }).join('')+'</div></div>';
  var looseP=looseD.filter(function(d){ return attIsPdf(d.att); }), looseI=looseD.filter(function(d){ return !attIsPdf(d.att); });
  function mySec(icn,t,n,inner){ return '<div class="psec"><div class="psec-h"><span class="psec-i">'+ic(icn)+'</span><b>'+t+'</b><em>'+n+'</em></div>'+inner+'</div>'; }
  if(looseB.length) h+=mySec('bon','Bons d’économat partagés seuls',looseB.length,'<div class="att-list">'+looseB.map(function(o){ return partMineRow(ic('bon'),o.name,(o.items||[]).length+' article'+((o.items||[]).length>1?'s':'')+' · '+fEur(orderCost(o)),'openEditBon(\''+o.id+'\')','partUnshareBon(\''+o.id+'\')'); }).join('')+'</div>');
  [[looseP,'pdf','PDF partagés seuls'],[looseI,'image','Images partagées seules']].forEach(function(z){
    if(z[0].length) h+=mySec(z[1],z[2],z[0].length,'<div class="att-list">'+z[0].map(function(d){ return partMineRow(ic(z[1]),d.name,(z[1]==='pdf'?'PDF':'Image')+' · '+attSize(d.att.size),'partOpenMyDoc(\''+d.id+'\')','partUnshareDoc(\''+d.id+'\')'); }).join('')+'</div>');
  });
  if(!folders.length&&!looseR.length&&!looseB.length&&!looseD.length) h+='<div class="empty"><div class="empty-s">'+(PART.q?'Aucun résultat':'Tu ne partages rien pour l’instant. Crée un dossier (ex. « Stage traiteur ») et ajoutes-y des recettes, des bons ou des PDF.')+'</div></div>';
  return h;
}
function partMineRow(icon,name,sub,open,del){
  return '<div class="att-r"><span class="att-th" onclick="'+open+'">'+icon+'</span><div class="att-n" onclick="'+open+'"><b>'+esc(name)+'</b><small>'+sub+'</small></div>'+
    '<button class="idel" onclick="'+del+'" title="Ne plus partager">'+ic('x')+'</button></div>';
}

// ── gestion de mes dossiers ──
function partChanged(msg){
  persist(); if(typeof clActive==='function'&&clActive()) clSync();
  renderPartage(); if(msg) toast(msg,'ok');
}
function partNewFolder(){
  askText('Nouveau dossier partagé','Ex : Stage traiteur',function(nm){
    nm=(nm||'').trim(); if(!nm) return;
    partPick(nm,true);
  });
}
function partShareCat(){
  var cats=[]; recipes.forEach(function(r){ if(r.cat&&cats.indexOf(r.cat)<0) cats.push(r.cat); });
  cats.sort(function(a,b){ return a.localeCompare(b,'fr'); });
  if(!cats.length){ toast('Aucune recette à partager','err'); return; }
  var b=document.getElementById('pk-body');
  document.getElementById('pk-title').textContent='Partager une catégorie';
  b.innerHTML='<div class="pk-hint">Toutes les recettes de la catégorie choisie sont partagées dans un dossier du même nom. Tu pourras ensuite en retirer ou en ajouter.</div>'+
    '<div class="pf-list">'+cats.map(function(c){ var n=recipes.filter(function(r){ return r.cat===c; }).length;
      return partFolderCard(c,'',n+' recette'+(n>1?'s':''),'partShareCatGo(\''+escJS(c)+'\')'); }).join('')+'</div>';
  document.getElementById('pk-foot').innerHTML='<button class="btn btn-ghost btn-full" onclick="closeMod(\'m-pick\')">Annuler</button>';
  openMod('m-pick');
}
function partShareCatGo(c){
  var n=0; recipes.forEach(function(r){ if(r.cat===c){ r.shared=true; r.shareFolder=c; r.updatedAt=now(); n++; } });
  closeMod('m-pick'); PART.tab='mine'; partChanged('Dossier « '+c+' » partagé · '+n+' recette'+(n>1?'s':''));
}
// choix du contenu d'un dossier : 4 onglets bien séparés (Recettes · Bons · PDF · Images)
var PICK={folder:'',sel:{},q:'',isNew:false,newDocs:[],tab:'rec',closed:{}};
var PK_TABS=[['rec','book','Recettes'],['bon','bon','Bons'],['pdf','pdf','PDF'],['img','image','Images']];
function partPick(folder,isNew){
  PICK={folder:folder,sel:{},q:'',isNew:!!isNew,newDocs:[],tab:'rec',closed:{}};
  recipes.forEach(function(r){ if(r.shared&&r.shareFolder===folder) PICK.sel[r.id]=1; });
  orders.forEach(function(o){ if(o.shared&&o.shareFolder===folder) PICK.sel['o:'+o.id]=1; });
  shDocs().forEach(function(d){ if(d.folder===folder) PICK.sel['d:'+d.id]=1; });
  document.getElementById('pk-title').textContent='Dossier « '+folder+' »';
  document.getElementById('pk-body').innerHTML='<div class="pk-hint">Choisis ce qui va dans ce dossier. Chaque type a son onglet ; ils seront rangés séparément mais visibles dans le même dossier.</div>'+
    '<div class="pk-tabs" id="pk-tabs"></div>'+
    '<div class="srch">'+ic('search')+'<input class="sinp" placeholder="Rechercher…" oninput="PICK.q=this.value;partPickList()"></div><div id="pk-list"></div>';
  partPickList(); openMod('m-pick');
}
function pkDocs(){ return shDocs().filter(function(d){ return d.folder===PICK.folder; }).concat(PICK.newDocs); }
function pkLists(){
  return {
    rec:recipes.slice(),
    bon:orders.slice(),
    pdf:pkDocs().filter(function(d){ return attIsPdf(d.att); }),
    img:pkDocs().filter(function(d){ return !attIsPdf(d.att); })
  };
}
function pkKey(k,x){ return k==='rec'?x.id:(k==='bon'?'o:'+x.id:'d:'+x.id); }
function pkTabsHTML(){
  var L=pkLists();
  return PK_TABS.map(function(t){
    var k=t[0], n=L[k].filter(function(x){ return PICK.sel[pkKey(k,x)]; }).length;
    return '<button class="'+(PICK.tab===k?'on':'')+'" onclick="PICK.tab=\''+k+'\';partPickList()">'+ic(t[1])+'<span>'+t[2]+'</span>'+(n?'<em>'+n+'</em>':'')+'</button>';
  }).join('');
}
function pkRow(key,thumb,name,sub){
  var on=!!PICK.sel[key];
  return '<label class="pk-it'+(on?' on':'')+'"><input type="checkbox"'+(on?' checked':'')+' onchange="pkTog(this,\''+escJS(key)+'\')">'+
    '<span class="pk-th">'+thumb+'</span><span class="pk-tx"><b>'+esc(name)+'</b>'+(sub?'<small>'+sub+'</small>':'')+'</span><span class="pk-ck">'+ic('check')+'</span></label>';
}
function pkTog(el,key){
  PICK.sel[key]=el.checked?1:0;
  var p=el.parentNode; if(p) p.classList.toggle('on',el.checked);
  partPickCount(); var t=document.getElementById('pk-tabs'); if(t) t.innerHTML=pkTabsHTML();
  pkGrpCount();
}
function pkGrpCount(){
  document.querySelectorAll('#pk-list .pk-grp').forEach(function(g){
    var rows=g.querySelectorAll('.pk-it'), on=g.querySelectorAll('.pk-it.on'), c=g.querySelector('.pk-gc');
    if(c) c.textContent=on.length+'/'+rows.length;
    var b=g.querySelector('.pk-all'); if(b){ var all=on.length===rows.length; b.textContent=all?'Tout décocher':'Tout cocher'; b.setAttribute('data-v',all?0:1); }
  });
}
function pkFold(c){ PICK.closed[c]=!PICK.closed[c]; partPickList(); }
function partPickList(){
  var box=document.getElementById('pk-list'); if(!box) return;
  var tb=document.getElementById('pk-tabs'); if(tb) tb.innerHTML=pkTabsHTML();
  var q=normTxt(PICK.q), tab=PICK.tab||'rec', h='';
  if(tab==='rec'){
    var by={};
    recipes.filter(function(r){ return !q||normTxt(r.name+' '+r.cat).indexOf(q)>=0; }).forEach(function(r){ var c=r.cat||'Sans catégorie'; (by[c]=by[c]||[]).push(r); });
    var cats=Object.keys(by).sort(function(a,b){ return a.localeCompare(b,'fr'); });
    h=cats.length?cats.map(function(c){
      var rs=by[c].sort(function(a,b){ return a.name.localeCompare(b.name,'fr'); }), on=rs.filter(function(r){ return PICK.sel[r.id]; }).length, all=on===rs.length, shut=PICK.closed[c]&&!q;
      return '<div class="pk-grp'+(shut?' shut':'')+'"><div class="pk-gh"><button class="pk-gt" onclick="pkFold(\''+escJS(c)+'\')">'+ic('chev-down')+catDot(c)+'<b>'+esc(c)+'</b><span class="pk-gc">'+on+'/'+rs.length+'</span></button>'+
        '<button class="pk-all" data-v="'+(all?0:1)+'" onclick="partPickCat(\''+escJS(c)+'\',+this.getAttribute(\'data-v\'))">'+(all?'Tout décocher':'Tout cocher')+'</button></div>'+
        (shut?'':'<div class="pk-gb">'+rs.map(function(r){
          var other=r.shared&&r.shareFolder&&r.shareFolder!==PICK.folder?' · dans « '+esc(r.shareFolder)+' »':'', w=0, co=0;
          try{ w=recWeight(r.id); co=recCostOf(r); }catch(e){}
          return pkRow(r.id,'<i class="pk-ph" style="--ch:'+catHue(r.cat||'')+'">'+recThumb(r)+'</i>',r.name,fKg(w)+' · '+fEur(co)+other);
        }).join('')+'</div>')+'</div>';
    }).join(''):'<div class="pk-none">Aucune recette</div>';
  } else if(tab==='bon'){
    var bons=orders.filter(function(o){ return !q||normTxt(o.name).indexOf(q)>=0; }).sort(function(a,b){ return String(b.date||'').localeCompare(String(a.date||'')); });
    h=bons.length?'<div class="pk-gb flat">'+bons.map(function(o){
      var other=o.shared&&o.shareFolder&&o.shareFolder!==PICK.folder?' · dans « '+esc(o.shareFolder)+' »':'';
      return pkRow('o:'+o.id,'<i class="pk-ic">'+ic('bon')+'</i>',o.name,fDate(o.date)+' · '+(o.items||[]).length+' article'+((o.items||[]).length>1?'s':'')+' · '+fEur(orderCost(o))+other);
    }).join('')+'</div>':'<div class="pk-none">Aucun bon d’économat</div>';
  } else {
    var isPdf=tab==='pdf', ds=pkDocs().filter(function(d){ return attIsPdf(d.att)===isPdf&&(!q||normTxt(d.name).indexOf(q)>=0); });
    h=(ds.length?'<div class="pk-gb flat">'+ds.map(function(d){
      return pkRow('d:'+d.id,'<i class="pk-ic'+(isPdf?' pdf':'')+'">'+ic(isPdf?'pdf':'image')+'</i>',d.name,(isPdf?'PDF':'Image')+' · '+attSize(d.att.size)+(d.isNew?' · nouveau':''));
    }).join('')+'</div>':'<div class="pk-none">'+(isPdf?'Aucun PDF':'Aucune image')+' dans ce dossier</div>')+
      '<button class="btn btn-ghost btn-sm pk-add" onclick="document.getElementById(\'pk-doc-file\').click()">'+ic('plus')+' Ajouter '+(isPdf?'un PDF':'une image')+'</button>'+
      '<input type="file" id="pk-doc-file" accept="'+(isPdf?'application/pdf':'image/*')+'" multiple style="display:none" onchange="partPickDocs(this)">';
  }
  box.innerHTML=h;
  partPickCount();
}
function partPickCat(c,v){
  recipes.forEach(function(r){ if((r.cat||'Sans catégorie')===c&&(!PICK.q||normTxt(r.name+' '+r.cat).indexOf(normTxt(PICK.q))>=0)) PICK.sel[r.id]=v; });
  partPickList();
}
function partPickCount(){
  var n=Object.keys(PICK.sel).filter(function(k){ return PICK.sel[k]; }).length;
  document.getElementById('pk-foot').innerHTML='<button class="btn btn-ghost" onclick="closeMod(\'m-pick\')">Annuler</button>'+
    '<button class="btn btn-gold btn-full" onclick="partPickSave()">'+ic('check')+' '+(n?'Partager '+n+' élément'+(n>1?'s':''):(PICK.isNew?'Choisis au moins un élément':'Vider le dossier'))+'</button>';
}
// lit des fichiers choisis (PDF / images) → documents prêts à partager
function partReadDocs(files){
  var out=[], chain=Promise.resolve();
  files.forEach(function(f){
    chain=chain.then(function(){
      var isImg=/^image\//.test(f.type), isPdf=f.type==='application/pdf'||/\.pdf$/i.test(f.name);
      if(!isImg&&!isPdf){ toast(f.name+' : seuls les PDF et les images sont acceptés','err'); return; }
      if(isPdf&&f.size>ATT_MAX){ toast(f.name+' : trop gros (15 Mo maximum)','err'); return; }
      return attReadFile(f).then(function(d){ return isImg?attShrinkImage(d,2200,0.86):d; }).then(function(d){
        var aid='a'+uid()+uid(), mime=isPdf?'application/pdf':(d.slice(5,d.indexOf(';'))||f.type);
        var size=Math.round((d.length-d.indexOf(',')-1)*3/4);
        if(size>ATT_MAX){ toast(f.name+' : trop gros (15 Mo maximum)','err'); return; }
        out.push({id:'d'+uid(),name:(f.name||'document').replace(/\.(pdf|jpe?g|png|webp|heic)$/i,''),att:{id:aid,name:f.name||('document.'+(isPdf?'pdf':'jpg')),mime:mime,size:size},data:d,createdAt:now()});
      });
    }).catch(function(e){ toast(f.name+' : '+e.message,'err'); });
  });
  return chain.then(function(){ return out; });
}
function partPickDocs(input){
  var files=Array.prototype.slice.call(input.files||[]); input.value=''; if(!files.length) return;
  partReadDocs(files).then(function(ds){ ds.forEach(function(d){ d.isNew=true; d.folder=PICK.folder; PICK.newDocs.push(d); PICK.sel['d:'+d.id]=1; }); partPickList(); });
}
function partDocStore(d){ attPut(d.att.id,d.data); var c={id:d.id,name:d.name,att:d.att,folder:d.folder||'',createdAt:d.createdAt||now()}; return c; }
function partPickSave(){
  var n=0;
  if(PICK.isNew&&!Object.keys(PICK.sel).some(function(k){ return PICK.sel[k]; })){ toast('Choisis au moins un élément','err'); return; }
  recipes.forEach(function(r){
    var want=!!PICK.sel[r.id], inF=r.shared&&r.shareFolder===PICK.folder;
    if(want&&!inF){ r.shared=true; r.shareFolder=PICK.folder; r.updatedAt=now(); }
    else if(!want&&inF){ delete r.shared; delete r.shareFolder; r.updatedAt=now(); }
    if(want) n++;
  });
  orders.forEach(function(o){
    var want=!!PICK.sel['o:'+o.id], inF=o.shared&&o.shareFolder===PICK.folder;
    if(want&&!inF){ o.shared=true; o.shareFolder=PICK.folder; o.updatedAt=now(); }
    else if(!want&&inF){ delete o.shared; delete o.shareFolder; o.updatedAt=now(); }
    if(want) n++;
  });
  var ds=shDocs().filter(function(d){ return d.folder!==PICK.folder||PICK.sel['d:'+d.id]; });
  PICK.newDocs.forEach(function(d){ if(PICK.sel['d:'+d.id]) ds.push(partDocStore(d)); });
  n+=ds.filter(function(d){ return d.folder===PICK.folder; }).length;
  shDocsSave(ds);
  ds.forEach(function(d){ if(typeof clQueueAttUp==='function'&&attLocal(d.att.id)) clQueueAttUp(d.att.id); });
  closeMod('m-pick'); PART.tab='mine';
  if(!n&&partMyLocked(PICK.folder)) clRpc('set_share_lock',{p_folder:PICK.folder,p_pw:''}).catch(function(){});
  partChanged(n?'Dossier « '+PICK.folder+' » : '+n+' élément'+(n>1?'s':'')+' partagé'+(n>1?'s':''):'Dossier « '+PICK.folder+' » retiré du partage');
}
// partage rapide : un bon, ou des documents, avec choix du dossier
function partFolderSelect(id){
  var fs=partMyFolders().map(function(f){ return f.name; });
  return '<div class="field"><div class="fl">Dossier</div><select class="fi" id="'+id+'" onchange="if(this.value===\'__new__\'){var s=this;askText(\'Nouveau dossier partagé\',\'Ex : Stage traiteur\',function(nm){nm=(nm||\'\').trim();if(!nm){s.value=\'\';return;}var o=document.createElement(\'option\');o.textContent=nm;o.value=nm;s.insertBefore(o,s.lastChild);s.value=nm;});}">'+
    '<option value="">— Aucun (partagé seul) —</option>'+fs.map(function(f){ return '<option>'+esc(f)+'</option>'; }).join('')+'<option value="__new__">+ Nouveau dossier…</option></select></div>';
}
function partQuick(kind){
  if(kind==='bon'){
    if(!orders.length){ toast('Aucun bon d’économat à partager','err'); return; }
    PICK={folder:'',sel:{},q:'',isNew:false,newDocs:[]};
    document.getElementById('pk-title').textContent='Partager des bons d’économat';
    var bons=orders.slice().sort(function(a,b){ return String(b.date||'').localeCompare(String(a.date||'')); });
    document.getElementById('pk-body').innerHTML='<div class="pk-hint">Les autres pourront voir ces bons (articles, quantités, coûts) et les copier dans leurs propres bons. Toi seul peux les modifier.</div>'+
      partFolderSelect('pk-fold')+bons.map(function(o){
        return '<label class="pk-r"><input type="checkbox"'+(o.shared?' checked disabled':'')+' onchange="PICK.sel[\''+o.id+'\']=this.checked?1:0"><span>'+esc(o.name)+'<small>'+fDate(o.date)+' · '+(o.items||[]).length+' article'+((o.items||[]).length>1?'s':'')+' · '+fEur(orderCost(o))+(o.shared?' · déjà partagé':'')+'</small></span></label>';
      }).join('');
    document.getElementById('pk-foot').innerHTML='<button class="btn btn-ghost" onclick="closeMod(\'m-pick\')">Annuler</button><button class="btn btn-gold btn-full" onclick="partQuickBonSave()">'+ic('check')+' Partager</button>';
    openMod('m-pick');
  }
}
function partQuickBonSave(){
  var f=(document.getElementById('pk-fold')||{}).value||''; if(f==='__new__') f='';
  var ids=Object.keys(PICK.sel).filter(function(k){ return PICK.sel[k]; });
  if(!ids.length){ toast('Coche au moins un bon','err'); return; }
  ids.forEach(function(id){ var o=orders.find(function(x){ return x.id===id; }); if(o){ o.shared=true; if(f) o.shareFolder=f; else delete o.shareFolder; o.updatedAt=now(); } });
  closeMod('m-pick'); PART.tab='mine'; partChanged(ids.length+' bon'+(ids.length>1?'s':'')+' partagé'+(ids.length>1?'s':'')+(f?' dans « '+f+' »':''));
}
var PDOC={list:[]};
function partAddDocs(){ var i=document.getElementById('part-doc-file'); if(i) i.click(); }
function partDocFiles(input){
  var files=Array.prototype.slice.call(input.files||[]); input.value=''; if(!files.length) return;
  partReadDocs(files).then(function(ds){
    if(!ds.length) return; PDOC.list=ds;
    document.getElementById('pk-title').textContent='Partager '+(ds.length>1?ds.length+' documents':'un document');
    document.getElementById('pk-body').innerHTML='<div class="pk-hint">Les autres pourront ouvrir et télécharger '+(ds.length>1?'ces documents':'ce document')+'.</div>'+partFolderSelect('pk-fold')+
      '<div class="att-list">'+ds.map(function(d){ return '<div class="att-r"><span class="att-th'+(attIsPdf(d.att)?' pdf':'')+'">'+ic(attIsPdf(d.att)?'pdf':'image')+'</span><div class="att-n"><b>'+esc(d.name)+'</b><small>'+(attIsPdf(d.att)?'PDF':'Image')+' · '+attSize(d.att.size)+'</small></div></div>'; }).join('')+'</div>';
    document.getElementById('pk-foot').innerHTML='<button class="btn btn-ghost" onclick="closeMod(\'m-pick\')">Annuler</button><button class="btn btn-gold btn-full" onclick="partDocSave()">'+ic('check')+' Partager</button>';
    openMod('m-pick');
  });
}
function partDocSave(){
  var f=(document.getElementById('pk-fold')||{}).value||''; if(f==='__new__') f='';
  var ds=shDocs(); PDOC.list.forEach(function(d){ d.folder=f; ds.push(partDocStore(d)); if(typeof clQueueAttUp==='function') clQueueAttUp(d.att.id); });
  shDocsSave(ds); var n=PDOC.list.length; PDOC.list=[];
  closeMod('m-pick'); PART.tab='mine'; partChanged(n+' document'+(n>1?'s':'')+' partagé'+(n>1?'s':'')+(f?' dans « '+f+' »':''));
}
function partOpenMyDoc(id){ var d=shDocs().find(function(x){ return x.id===id; }); if(d) attOpen(d.att); }
function partUnshareDoc(id){
  var ds=shDocs(), d=ds.find(function(x){ return x.id===id; }); if(!d) return;
  if(!confirm('Ne plus partager « '+d.name+' » ?')) return;
  shDocsSave(ds.filter(function(x){ return x.id!==id; })); partChanged('Document retiré du partage');
}
function partUnshareBon(id){
  var o=orders.find(function(x){ return x.id===id; }); if(!o) return;
  delete o.shared; delete o.shareFolder; o.updatedAt=now(); partChanged('Bon retiré du partage');
}
function partRename(f){
  askText('Renommer le dossier',f,function(nm){
    nm=(nm||'').trim(); if(!nm||nm===f) return;
    recipes.forEach(function(r){ if(r.shared&&r.shareFolder===f){ r.shareFolder=nm; r.updatedAt=now(); } });
    orders.forEach(function(o){ if(o.shared&&o.shareFolder===f){ o.shareFolder=nm; o.updatedAt=now(); } });
    var ds=shDocs(); ds.forEach(function(d){ if(d.folder===f) d.folder=nm; }); shDocsSave(ds);
    if(partMyLocked(f)) clRpc('rename_share_lock',{p_old:f,p_new:nm}).then(function(){ CLOUD.myLocks=(CLOUD.myLocks||[]).map(function(x){ return x===f?nm:x; }); renderPartage(); },function(e){ toast(e.message,'err'); });
    partChanged('Dossier renommé');
  });
}
function partStopFolder(f){
  if(!confirm('Ne plus partager le dossier « '+f+' » ? Tes recettes et tes bons restent dans ton espace ; les copies déjà faites par les autres restent chez eux.')) return;
  recipes.forEach(function(r){ if(r.shared&&r.shareFolder===f){ delete r.shared; delete r.shareFolder; r.updatedAt=now(); } });
  orders.forEach(function(o){ if(o.shared&&o.shareFolder===f){ delete o.shared; delete o.shareFolder; o.updatedAt=now(); } });
  shDocsSave(shDocs().filter(function(d){ return d.folder!==f; }));
  if(partMyLocked(f)) clRpc('set_share_lock',{p_folder:f,p_pw:''}).then(function(){ CLOUD.myLocks=(CLOUD.myLocks||[]).filter(function(x){ return x!==f; }); },function(){});
  partChanged('Dossier retiré du partage');
}

// ── mot de passe d'un de mes dossiers ──
function partLockUI(f){
  var lk=partMyLocked(f);
  document.getElementById('pk-title').textContent='Mot de passe · « '+f+' »';
  document.getElementById('pk-body').innerHTML='<div class="pk-hint">'+(lk?ic('lock')+' Ce dossier est <b>protégé</b> : les autres comptes doivent saisir le mot de passe (une seule fois) pour voir son contenu. Tu peux le changer : ceux qui l’avaient devront saisir le nouveau.':'Avec un mot de passe, le contenu de ce dossier n’est visible que par les comptes qui le saisissent (une seule fois). Donne-le aux personnes concernées, par exemple tes stagiaires.')+'</div>'+
    '<div class="field"><div class="fl">'+(lk?'Nouveau mot de passe':'Mot de passe')+' (4 caractères minimum)</div><div class="lk-pw"><input class="fi" id="lk-pw" type="password" autocomplete="new-password" onkeydown="if(event.key===\'Enter\')partLockSave()"><button type="button" class="icbtn" onclick="var i=document.getElementById(\'lk-pw\');i.type=i.type===\'password\'?\'text\':\'password\'" title="Afficher">'+ic('eye')+'</button></div></div>'+
    '<div class="cl-err" id="lk-err"></div>';
  document.getElementById('pk-foot').innerHTML='<button class="btn btn-ghost" onclick="closeMod(\'m-pick\')">Annuler</button>'+
    (lk?'<button class="btn btn-ghost" onclick="partLockSave(true)">'+ic('unlock')+' Retirer le mot de passe</button>':'')+
    '<button class="btn btn-gold" onclick="partLockSave()">'+ic('lock')+' '+(lk?'Changer':'Protéger le dossier')+'</button>';
  PICK.folder=f; openMod('m-pick');
  setTimeout(function(){ var i=document.getElementById('lk-pw'); if(i) i.focus(); },80);
}
function partLockSave(remove){
  var f=PICK.folder, pw=remove?'':(document.getElementById('lk-pw').value||'');
  var er=document.getElementById('lk-err');
  if(!remove&&pw.length<4){ er.textContent='Mot de passe trop court (4 caractères minimum)'; return; }
  if(remove&&!confirm('Retirer le mot de passe ? Le dossier sera visible par tous les comptes.')) return;
  clRpc('set_share_lock',{p_folder:f,p_pw:pw}).then(function(){
    var l=(CLOUD.myLocks||[]).filter(function(x){ return x!==f; }); if(!remove) l.push(f); CLOUD.myLocks=l;
    closeMod('m-pick'); renderPartage(); toast(remove?'Mot de passe retiré':'Dossier « '+f+' » protégé par mot de passe','ok');
  },function(e){ er.textContent=e.message||String(e); });
}
// ── saisir le mot de passe d'un dossier d'un autre compte ──
var PUNL={owner:'',folder:''};
function partUnlock(owner,f){
  PUNL={owner:owner,folder:f};
  var l=partLockFor(owner,f)||{};
  document.getElementById('pk-title').textContent='Dossier protégé';
  document.getElementById('pk-body').innerHTML='<div class="pk-hint">'+ic('lock')+' « <b>'+esc(f)+'</b> » de '+esc(l.owner_name||'—')+' est protégé par un mot de passe. Demande-le à son auteur ; tu ne le saisis qu’une fois.</div>'+
    '<div class="field"><div class="fl">Mot de passe du dossier</div><div class="lk-pw"><input class="fi" id="unl-pw" type="password" autocomplete="off" onkeydown="if(event.key===\'Enter\')partUnlockGo()"><button type="button" class="icbtn" onclick="var i=document.getElementById(\'unl-pw\');i.type=i.type===\'password\'?\'text\':\'password\'" title="Afficher">'+ic('eye')+'</button></div></div>'+
    '<div class="cl-err" id="unl-err"></div>';
  document.getElementById('pk-foot').innerHTML='<button class="btn btn-ghost" onclick="closeMod(\'m-pick\')">Annuler</button><button class="btn btn-gold btn-full" id="unl-go" onclick="partUnlockGo()">'+ic('unlock')+' Ouvrir le dossier</button>';
  openMod('m-pick'); setTimeout(function(){ var i=document.getElementById('unl-pw'); if(i) i.focus(); },80);
}
function partUnlockGo(){
  var pw=document.getElementById('unl-pw').value||'', er=document.getElementById('unl-err'), b=document.getElementById('unl-go');
  if(!pw){ er.textContent='Entre le mot de passe'; return; }
  if(b) b.disabled=true; er.textContent='';
  clRpc('unlock_share',{p_owner:PUNL.owner,p_folder:PUNL.folder,p_pw:pw}).then(function(ok){
    if(b) b.disabled=false;
    if(!ok){ er.textContent='Mot de passe incorrect'; return; }
    CLOUD.lockSig=null;
    return clLocksTick().then(function(){
      closeMod('m-pick'); PART.tab='others'; PART.acct=PUNL.owner; PART.open=PUNL.owner+'|'+PUNL.folder; renderPartage(); toast('Dossier ouvert','ok');
    });
  },function(e){ if(b) b.disabled=false; er.textContent=e.message||String(e); });
}

// ── journal des copies (visible par l'administrateur) ──
function partLogQ(){ try{ var a=JSON.parse(LS.getItem('v4_copylog')||'[]'); return Array.isArray(a)?a:[]; }catch(e){ return []; } }
function partLogCopy(id,act){
  if(!id) return; var q=partLogQ(); q.push({id:id,a:act||'copy'}); LS.setItem('v4_copylog',JSON.stringify(q.slice(-200))); partLogFlush();
}
var PLOG_BUSY=false;
function partLogFlush(){
  if(PLOG_BUSY||typeof clLive!=='function'||!clLive()||!clUid()) return Promise.resolve();
  var q=partLogQ(); if(!q.length) return Promise.resolve();
  PLOG_BUSY=true;
  return q.reduce(function(p,e){ return p.then(function(){
    return clRpc('log_share_copy',{p_item:e.id,p_action:e.a}).then(function(){ return 1; },function(err){ return err&&(err.status===404||err.status===400)?1:0; })
      .then(function(done){ if(done){ var l=partLogQ(), i=l.findIndex(function(z){ return z.id===e.id&&z.a===e.a; }); if(i>=0){ l.splice(i,1); LS.setItem('v4_copylog',JSON.stringify(l)); } } });
  }); },Promise.resolve()).then(function(){ PLOG_BUSY=false; },function(){ PLOG_BUSY=false; });
}
(function(){ var _p=clPull; clPull=function(){ return _p.apply(this,arguments).then(function(r){ partLogFlush(); return r; }); }; })();

// ── bons et documents des autres ──
function openSharedDoc(id){ var x=(CLOUD.shared||{})[id]; var a=x&&x.data&&(x.data.attachments||[])[0]; if(a){ if(!shrIsMine(x)) partLogCopy(x.id,'open'); attOpen(a); } }
function openSharedBon(id){
  var x=(CLOUD.shared||{})[id]; if(!x||!x.data) return; SHR_CUR=x; var d=x.data, mine=shrIsMine(x);
  var copy=orders.find(function(o){ return o.fromShared&&o.fromShared.id===x.id; });
  document.getElementById('shr-title').textContent=d.name;
  var rows=(d.items||[]).slice().sort(function(a,b){ return String(a.cat).localeCompare(String(b.cat),'fr')||String(a.n).localeCompare(String(b.n),'fr'); });
  document.getElementById('shr-body').innerHTML=
    '<div class="shr-by">'+ic('user')+' Partagé par <b>'+esc(x.owner_name||'—')+(mine?' (toi)':'')+'</b> · mis à jour le '+new Date(x.updated_at).toLocaleDateString('fr-FR')+'</div>'+
    '<div class="rc-stats" style="margin:10px 0"><div class="rs"><span class="rs-v">'+rows.length+'</span><div class="rs-l">Articles</div></div><div class="rs"><span class="rs-v">'+fEur(d.cost||0)+'</span><div class="rs-l">Total (prix de l’auteur)</div></div><div class="rs"><span class="rs-v" style="font-size:13px">'+(d.date?fDate(d.date):'—')+'</span><div class="rs-l">'+(d.status==='validated'?'Validé':'Brouillon')+'</div></div></div>'+
    ((d.recipes||[]).length?'<div class="shr-h">Recettes</div><div class="shr-notes">'+esc(d.recipes.join(', '))+'</div>':'')+
    '<div class="shr-h">Articles</div><div class="shr-items">'+rows.map(function(it){ return '<div class="shr-i"><span>'+catDot(it.cat||'')+esc(it.n)+'</span><b>'+esc(it.q||'')+'<small class="shr-c">'+fEur(it.cost||0)+'</small></b></div>'; }).join('')+'</div>'+
    (d.notes?'<div class="shr-h">Notes</div><div class="shr-notes">'+esc(d.notes)+'</div>':'')+
    (copy&&!mine?'<div class="shr-info" style="margin-top:12px">'+ic('check-circle')+'<span>Tu as déjà une copie de ce bon : « '+esc(copy.name)+' ».</span></div>':'');
  var loc=mine&&orders.find(function(o){ return clSharedId(o.id)===x.id; });
  document.getElementById('shr-foot').innerHTML=mine
    ?(loc?'<button class="btn btn-ghost" onclick="closeMod(\'m-shr\');partUnshareBon(\''+loc.id+'\')">Ne plus partager</button><button class="btn btn-gold" onclick="closeMod(\'m-shr\');openEditBon(\''+loc.id+'\')">'+ic('edit')+' Ouvrir mon bon</button>':'<button class="btn btn-ghost" onclick="closeMod(\'m-shr\')">Fermer</button>')
    :'<button class="btn btn-ghost" onclick="closeMod(\'m-shr\')">Fermer</button><button class="btn btn-gold" id="shr-copy" onclick="shrCopyBonUI()">'+ic('copy')+' '+(copy?'Copier à nouveau':'Copier dans mes bons')+'</button>';
  openMod('m-shr');
}
// copie d'un bon partagé : les ingrédients absents du catalogue y sont ajoutés
function shrCopyBon(x){
  var d=x.data, created=0, o=mkOrder();
  o.name=d.name||o.name; o.notes=d.notes||''; o.recipesUsed=(d.recipes||[]).slice();
  o.items=(d.items||[]).map(function(it){
    var n=normTxt(it.n), g=ingredients.find(function(i){ return normTxt(i.name)===n; });
    if(!g){ g={id:uid(),name:it.n,cat:it.cat||'Autre',unit:it.u||'kg',price:it.price||0,buyPrice:it.buyPrice!=null?it.buyPrice:(it.price||0),unitWeight:it.unitWeight||null,
      allergens:(it.allergens||[]).slice(),allergensSet:!!it.allergensSet,priceHistory:[]}; ingredients.push(g); created++; }
    return {id:uid(),ingId:g.id,qty:it.qty,cost:rnd((it.qty||0)*(g.price||0)),uses:[{n:'Copie du bon de '+(x.owner_name||'—'),q:it.qty}]};
  });
  o.fromShared={id:x.id,by:x.owner_name||''};
  o.history=[{ts:now(),desc:'Copié depuis le partage de '+(x.owner_name||'—')}];
  orders.unshift(o);
  return {bon:o,ing:created};
}
function shrCopyBonUI(){
  var x=SHR_CUR; if(!x) return; var b=document.getElementById('shr-copy'); if(b) b.disabled=true;
  var r=shrCopyBon(x); partLogCopy(x.id); persist(); updBadges(); closeMod('m-shr');
  toast('« '+r.bon.name+' » copié dans tes bons'+(r.ing?' · '+r.ing+' ingrédient'+(r.ing>1?'s':'')+' ajouté'+(r.ing>1?'s':'')+' au catalogue':''),'ok');
  if(CUR==='partage') partBody();
}

// ── copie (une recette ou un dossier entier) ──
function shrCopyRow(x,cat){
  var created={ing:0};
  function ingFor(it){
    var n=normTxt(it.n), g=ingredients.find(function(i){ return normTxt(i.name)===n; });
    if(g) return g.id;
    g={id:uid(),name:it.n,cat:it.cat||'Autre',unit:it.u||'kg',price:it.price||0,buyPrice:it.buyPrice!=null?it.buyPrice:(it.price||0),unitWeight:it.unitWeight||null,
       allergens:(it.allergens||[]).slice(),allergensSet:!!it.allergensSet,priceHistory:[]};
    ingredients.push(g); created.ing++; return g.id;
  }
  function recFrom(s,top){
    var items=(s.items||[]).map(function(it){
      if(it.t==='i') return {id:uid(),type:'ingredient',refId:ingFor(it),qty:it.qty,unit:it.unit};
      var nm=normTxt(it.sub&&it.sub.name), ex=recipes.find(function(r){ return normTxt(r.name)===nm; });
      var sid=ex?ex.id:recFrom(it.sub,false).id;
      return {id:uid(),type:'recipe',refId:sid,qty:it.qty,unit:it.unit||'x'};
    });
    var r={id:uid(),name:s.name,cat:(top&&cat)||s.cat||'',image:s.image||'📖',notes:s.notes||'',items:items,createdAt:now(),updatedAt:now()};
    if(top&&s.tags&&s.tags.length) r.tags=s.tags.slice(); if(top&&s.time) r.time=s.time; if(top&&s.pcs) r.pcs=s.pcs;
    if(top) r.fromShared={id:x.id,by:x.owner_name||''};
    recipes.unshift(r); return r;
  }
  var atts=(x.data.attachments||[]);
  return Promise.all(atts.map(function(a){
    return attGet(a.id).then(function(d){ var id='a'+uid()+uid(); attPut(id,d); return {id:id,name:a.name,mime:a.mime,size:a.size}; },function(){ return null; });
  })).then(function(newAtt){
    var r=recFrom(x.data,true); newAtt=newAtt.filter(Boolean); if(newAtt.length) r.attachments=newAtt;
    if(typeof clQueueAttUp==='function') newAtt.forEach(function(a){ clQueueAttUp(a.id); });
    return {rec:r,ing:created.ing};
  });
}
function shrCopy(){
  var x=SHR_CUR; if(!x) return; var btn=document.getElementById('shr-copy'); if(btn) btn.disabled=true;
  shrCopyRow(x).then(function(o){
    partLogCopy(x.id); persist(); updBadges(); closeMod('m-shr');
    toast('« '+o.rec.name+' » copiée dans tes recettes'+(o.ing?' · '+o.ing+' ingrédient'+(o.ing>1?'s':'')+' ajouté'+(o.ing>1?'s':'')+' au catalogue':''),'ok');
    if(CUR==='partage') partBody();
  });
}
function partCopyFolder(key){
  var rows=sharedList().filter(function(x){ return !shrIsMine(x)&&partFolderKey(x)===key; });
  var todo=rows.filter(function(x){ var t=shType(x); return t==='rec'?!recipes.some(function(r){ return r.fromShared&&r.fromShared.id===x.id; }):(t==='bon'&&!partCopiedBon(x)); });
  if(!todo.length) return;
  var folder=rows[0].data.folder, btn=document.getElementById('pf-copyall'); if(btn) btn.disabled=true;
  var hasRec=todo.some(function(x){ return shType(x)==='rec'; });
  var cat=hasRec?(addCatIfNew('rec',folder)||folder):folder, ing=0, nr=0, nb=0;
  todo.reduce(function(p,x){ return p.then(function(){
    if(shType(x)==='bon'){ var r=shrCopyBon(x); ing+=r.ing; nb++; partLogCopy(x.id); return; }
    return shrCopyRow(x,cat).then(function(o){ ing+=o.ing; nr++; partLogCopy(x.id); });
  }); },Promise.resolve()).then(function(){
    persist(); updBadges(); partBody();
    var parts=[]; if(nr) parts.push(nr+' recette'+(nr>1?'s':'')+' copiée'+(nr>1?'s':'')+' dans la catégorie « '+cat+' »'); if(nb) parts.push(nb+' bon'+(nb>1?'s':'')+' copié'+(nb>1?'s':''));
    toast(parts.join(' · ')+(ing?' · '+ing+' ingrédient'+(ing>1?'s':'')+' ajouté'+(ing>1?'s':''):''),'ok');
  });
}

// ── éditeur : choix du dossier sous « Partager cette recette » ──
(function(){
  var _x=recEdExtras;
  recEdExtras=function(){
    _x();
    var c=document.getElementById('r-share-card'); if(!c) return;
    var r=editRecId&&recipes.find(function(x){ return x.id===editRecId; });
    if(REC_ED.folder===undefined) REC_ED.folder=(r&&r.shareFolder)||'';
    var box=document.getElementById('r-shfold');
    if(!box){ box=document.createElement('div'); box.id='r-shfold'; box.className='sh-fold'; c.appendChild(box); }
    var fs=partMyFolders().map(function(f){ return f.name; }); if(REC_ED.folder&&fs.indexOf(REC_ED.folder)<0) fs.push(REC_ED.folder);
    box.style.display=REC_ED.shared?'':'none';
    box.innerHTML='<div class="fl">Dossier partagé</div><select class="fi sm" onchange="partEdFolder(this)"><option value="">— Aucun —</option>'+
      fs.map(function(f){ return '<option'+(f===REC_ED.folder?' selected':'')+'>'+esc(f)+'</option>'; }).join('')+'<option value="__new__">+ Nouveau dossier…</option></select>';
  };
  var cb=document.getElementById('r-shared');
  if(cb) cb.addEventListener('change',function(){ var b=document.getElementById('r-shfold'); if(b) b.style.display=this.checked?'':'none'; });
})();
function partEdFolder(sel){
  if(sel.value==='__new__'){
    askText('Nouveau dossier partagé','Ex : Stage traiteur',function(nm){ nm=(nm||'').trim(); if(nm) REC_ED.folder=nm; recEdExtras(); });
    return;
  }
  REC_ED.folder=sel.value;
}
(function(){
  var _o=openNewRec; openNewRec=function(){ _o.apply(this,arguments); REC_ED.folder=''; recEdExtras(); };
  var _e=openEditRec; openEditRec=function(id){ REC_ED={att:[],shared:false,fromShared:null}; _e.apply(this,arguments); };
  var _s=saveRecipe;
  saveRecipe=function(){
    var ids={}; recipes.forEach(function(r){ ids[r.id]=r.updatedAt; });
    var wasId=editRecId, folder=REC_ED.folder||'';
    _s.apply(this,arguments);
    var rec=wasId?recipes.find(function(r){ return r.id===wasId; }):recipes.find(function(r){ return !(r.id in ids); });
    if(!rec) return;
    var want=rec.shared?folder:'';
    if((rec.shareFolder||'')!==want){ if(want) rec.shareFolder=want; else delete rec.shareFolder; persist(); }
  };
})();

// ── navigation : nouvelle page « Partage » ──
(function(){
  var _g=goPage;
  goPage=function(p){
    var r=_g.apply(this,arguments);
    ['nav-partage','bn-partage'].forEach(function(id){ var e=document.getElementById(id); if(e) e.classList.toggle('on',p==='partage'); });
    if(p==='partage'){
      var bc=document.getElementById('tb-bc'); if(bc) bc.textContent='Partage';
      var act=document.getElementById('tb-act');
      if(act) act.innerHTML=(typeof clActive==='function'&&clActive())?'<button class="tbtn gold" onclick="PART.tab=\'mine\';partNewFolder()">'+ic('plus')+' Dossier</button>':'';
      renderPartage(); if(typeof clActive==='function'&&clActive()) clSync();
    }
    return r;
  };
  // l'ancien onglet « Partagées » de la page Recettes mène désormais ici
  setRecTab=function(t){ if(t==='shared'){ PART.tab='others'; goPage('partage'); return; } REC_TAB='mine'; renderRec(); };
})();
