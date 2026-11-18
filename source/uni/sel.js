// ══ SÉLECTION PAR APPUI LONG (comme sur iPhone) ═══════════════
// Recettes et catalogue : un appui long (ou clic droit) sur une recette / un
// ingrédient passe en mode sélection. On touche ensuite les autres pour les
// cocher, puis on agit sur tout : ajouter à un bon, ajouter à un livre
// (recettes, administrateurs), envoyer par message, supprimer.
var SEL={on:false,kind:null,ids:{},just:false};
function selTiles(kind){
  var q=kind==='ing'?'#p-catalogue .catcard':'#p-recettes .rt, #p-recettes .rc';
  return Array.prototype.slice.call(document.querySelectorAll(q));
}
function selTileOf(t){
  if(!t||!t.closest) return null;
  return t.closest('#p-recettes .rt, #p-recettes .rc, #p-catalogue .catcard');
}
function selKindOf(tile){ return tile&&tile.closest('#p-catalogue')?'ing':'rec'; }
function selIdOf(tile){
  if(!tile) return null; if(tile.dataset.sid) return tile.dataset.sid;
  var m=tile.outerHTML.match(tile.classList.contains('catcard')?/openEditIng\('([^']+)'/:/openEditRec\('([^']+)'/);
  if(m){ tile.dataset.sid=m[1]; return m[1]; }
  return null;
}
function selIds(){ return Object.keys(SEL.ids).filter(function(k){ return SEL.ids[k]; }); }
function selStart(kind,id){
  if(window.BKP&&BKP.on) return;
  SEL.on=true; SEL.kind=kind; SEL.ids={}; if(id) SEL.ids[id]=1;
  try{ if(navigator.vibrate) navigator.vibrate(12); }catch(e){}
  selPaint();
}
function selEnd(){ SEL.on=false; SEL.ids={}; SEL.kind=null; selPaint(); }
function selToggle(id){ if(!id) return; SEL.ids[id]=SEL.ids[id]?0:1; selPaint(); }
function selAll(){
  var t=selTiles(SEL.kind), ids=t.map(selIdOf).filter(Boolean), all=ids.length&&ids.every(function(i){ return SEL.ids[i]; });
  ids.forEach(function(i){ SEL.ids[i]=all?0:1; }); selPaint();
}
function selPaint(){
  document.body.classList.toggle('sel-mode',SEL.on);
  ['rec','ing'].forEach(function(k){ selTiles(k).forEach(function(t){ var id=selIdOf(t); t.classList.toggle('sel-on',SEL.on&&SEL.kind===k&&!!SEL.ids[id]); t.classList.toggle('sel-can',SEL.on&&SEL.kind===k); }); });
  var bar=document.getElementById('sel-bar');
  if(!SEL.on){ if(bar) bar.remove(); return; }
  if(!bar){ bar=document.createElement('div'); bar.id='sel-bar'; bar.className='sel-bar'; bar.setAttribute('role','toolbar'); document.body.appendChild(bar); }
  var n=selIds().length, rec=SEL.kind==='rec', vis=selTiles(SEL.kind).map(selIdOf).filter(Boolean), all=vis.length&&vis.every(function(i){ return SEL.ids[i]; });
  var adm=typeof permOk==='function'&&permOk('book'), chat=typeof chReady==='function'&&chReady();
  function A(fn,icn,lb,cls){ return '<button type="button" class="sel-a'+(cls?' '+cls:'')+'" onclick="'+fn+'"'+(n?'':' disabled')+'>'+ic(icn)+'<span>'+lb+'</span></button>'; }
  bar.innerHTML='<div class="sel-top"><button type="button" class="sel-x" onclick="selEnd()" aria-label="Quitter la sélection">'+ic('x')+'</button>'+
    '<b>'+(n?n+' '+(rec?'recette':'ingrédient')+(n>1?'s':'')+' sélectionné'+(rec?'e':'')+(n>1?'s':''):'Touche pour sélectionner')+'</b>'+
    '<button type="button" class="sel-all" onclick="selAll()">'+(all?'Tout désélectionner':'Tout sélectionner')+'</button></div>'+
    '<div class="sel-acts">'+A('selToBon()','bon','Ajouter à un bon')+(rec&&adm?A('selToBook()','list','Ajouter à un livre'):'')+(chat?A('selToMsg()','chat','Envoyer par message'):'')+A('selDel()','trash','Supprimer','del')+'</div>';
}

// ── gestes : appui long, toucher en mode sélection, clic droit ──
(function(){
  var T=null, sx=0, sy=0, tile=null;
  function clear(){ if(T){ clearTimeout(T); T=null; } tile=null; }
  document.addEventListener('pointerdown',function(e){
    if(e.button>0) return; var t=selTileOf(e.target); if(!t||(window.BKP&&BKP.on)) return;
    if(e.target.closest('button,input,select,textarea,a,.rt-tools,.cat-btns')) return;
    clear(); tile=t; sx=e.clientX; sy=e.clientY;
    T=setTimeout(function(){
      T=null; var id=selIdOf(tile), k=selKindOf(tile); if(!id) return;
      SEL.just=true;
      if(SEL.on&&SEL.kind===k) selToggle(id); else selStart(k,id);
    },480);
  },{passive:true});
  document.addEventListener('pointermove',function(e){ if(T&&(Math.abs(e.clientX-sx)>10||Math.abs(e.clientY-sy)>10)) clear(); },{passive:true});
  ['pointerup','pointercancel','scroll'].forEach(function(ev){ document.addEventListener(ev,function(){ if(T) clear(); },{passive:true,capture:true}); });
  document.addEventListener('click',function(e){
    var t=selTileOf(e.target);
    if(SEL.just){ SEL.just=false; if(t){ e.preventDefault(); e.stopPropagation(); return; } }
    if(!SEL.on||!t||selKindOf(t)!==SEL.kind) return;
    e.preventDefault(); e.stopPropagation(); selToggle(selIdOf(t));
  },true);
  document.addEventListener('contextmenu',function(e){
    var t=selTileOf(e.target); if(!t||(window.BKP&&BKP.on)) return;
    e.preventDefault(); var id=selIdOf(t), k=selKindOf(t); if(!id) return;
    if(T) clear(); if(SEL.just) return;
    if(SEL.on&&SEL.kind===k) selToggle(id); else selStart(k,id);
  });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&SEL.on) selEnd(); });
  // re-peindre après chaque affichage ; quitter la sélection en changeant de page
  ['renderRec','renderCat'].forEach(function(fn){ var o=window[fn]; if(typeof o!=='function') return; window[fn]=function(){ var r=o.apply(this,arguments); try{ if(SEL.on) selPaint(); }catch(e){} return r; }; });
  var _g=goPage; goPage=function(p){ if(SEL.on) selEnd(); return _g.apply(this,arguments); };
})();

// ── fenêtre de choix (bon, livre, conversation) ──
function selPickOpen(title,html){
  var m=document.getElementById('m-selpick');
  if(!m){ var d=document.createElement('div'); d.innerHTML='<div class="ov" id="m-selpick"><div class="modal"><div class="m-grip"></div><div class="m-hdr"><h3 id="selp-t"></h3><button class="m-x" onclick="closeMod(\'m-selpick\')" aria-label="Fermer">'+ic('x')+'</button></div><div class="m-body" id="selp-b"></div></div></div>'; m=d.firstChild; document.body.appendChild(m); }
  document.getElementById('selp-t').textContent=title; document.getElementById('selp-b').innerHTML=html; openMod('m-selpick');
}
function selOpt(fn,icn,t,s,cls){ return '<button type="button" class="sel-o'+(cls?' '+cls:'')+'" onclick="'+fn+'"><span class="sel-oi">'+icn+'</span><span class="sel-ot"><b>'+t+'</b>'+(s?'<small>'+s+'</small>':'')+'</span>'+ic('chev-right')+'</button>'; }

// ── ajouter à un bon ──
function selToBon(){
  var ids=selIds(); if(!ids.length) return;
  var drafts=orders.filter(function(o){ return o.status!=='validated'; }).sort(function(a,b){ return String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')); }).slice(0,30);
  selPickOpen('Ajouter à un bon',selOpt('selBonGo(null)',ic('plus'),'Nouveau bon','Crée un bon avec '+(SEL.kind==='rec'?'ces recettes':'ces ingrédients'),'pri')+
    (drafts.length?'<div class="sel-sec">Bons en cours</div>'+drafts.map(function(o){ return selOpt('selBonGo(\''+o.id+'\')',ic('bon'),esc(o.name),fDate(o.date)+' · '+o.items.length+' article'+(o.items.length>1?'s':'')); }).join(''):''));
}
function selBonGo(oid){
  var ids=selIds(), o=oid?orders.find(function(x){ return x.id===oid; }):null, isNew=!o;
  if(!o){ o=mkOrder(); orders.unshift(o); }
  if(!o.recipesUsed) o.recipesUsed=[]; if(!o.history) o.history=[];
  if(SEL.kind==='rec'){
    ids.forEach(function(id){ addRecToOrder(id,o,1); });
    o.history.push({ts:now(),desc:ids.length+' recette'+(ids.length>1?'s':'')+' ajoutée'+(ids.length>1?'s':'')});
  } else {
    ids.forEach(function(id){ var g=ingredients.find(function(i){ return i.id===id; }); if(!g||o.items.some(function(x){ return x.ingId===id; })) return; o.items.push({id:uid(),ingId:id,qty:0,cost:0,uses:[{n:'Ajout direct',q:0}]}); });
    o.history.push({ts:now(),desc:ids.length+' ingrédient'+(ids.length>1?'s':'')+' ajouté'+(ids.length>1?'s':'')+' (quantités à saisir)'});
  }
  o.updatedAt=now(); persist(); try{ updBadges(); }catch(e){}
  var n=ids.length, rec=SEL.kind==='rec';
  closeMod('m-selpick'); selEnd();
  toast(n+' '+(rec?'recette':'ingrédient')+(n>1?'s':'')+' ajouté'+(rec?'e':'')+(n>1?'s':'')+' '+(isNew?'dans un nouveau bon':'au bon « '+o.name+' »')+(rec?'':' · saisis les quantités'),'ok');
  openEditBon(o.id);
}

// ── ajouter à un livre (recettes, administrateurs) ──
function selToBook(){
  var ids=selIds(); if(!ids.length||typeof bkAll!=='function') return;
  var l=bkAll().slice().sort(function(a,b){ return String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')); });
  selPickOpen('Ajouter à un livre',selOpt('selBookGo(null)',ic('plus'),'Nouveau livre','Crée un livre avec ces recettes','pri')+
    (l.length?'<div class="sel-sec">Mes livres</div>'+l.map(function(b){ var n=(b.items||[]).length; return selOpt('selBookGo(\''+b.id+'\')',ic('list'),esc(b.title||'Livre sans titre'),n+' recette'+(n>1?'s':'')); }).join(''):''));
}
function selBookGo(bid){
  var ids=selIds(), n=ids.length;
  if(bid) BK.cur=bid; else BK.cur=bkNew('',false).id;
  bkAdd(ids);
  closeMod('m-selpick'); selEnd();
  toast(n+' recette'+(n>1?'s':'')+' ajoutée'+(n>1?'s':'')+' au livre','ok');
  bkOpen(BK.cur);
}

// ── envoyer par message ──
function selAtt(kind,id){
  if(kind==='rec'){
    var r=recipes.find(function(x){ return x.id===id; }); if(!r) return null;
    var d=shareSnapshot(r); if(d&&typeof d.image==='string'&&d.image.length>20000) d.image='📖'; delete d.attachments;
    var a={t:'rec',name:r.name,data:d}; return JSON.stringify(a).length>190000?null:a;
  }
  var g=ingredients.find(function(x){ return x.id===id; }); if(!g) return null;
  return {t:'ing',ing:{name:g.name,cat:g.cat||'',unit:g.unit||'kg',price:g.price||0,buyPrice:g.buyPrice!=null?g.buyPrice:(g.price||0),unitWeight:g.unitWeight||null,allergens:(g.allergens||[]).slice(),allergensSet:!!g.allergensSet}};
}
var SELM={q:''};
function selToMsg(){
  var ids=selIds(); if(!ids.length) return;
  if(ids.length>25){ toast('25 éléments au maximum par envoi','err'); return; }
  selPickOpen('Envoyer à…','<div class="pk-none">Chargement…</div>');
  chLoadBase().then(function(){ SELM.q=''; selMsgList(); }).catch(function(e){ document.getElementById('selp-b').innerHTML='<div class="pk-none">'+esc(chErr(e))+'</div>'; });
}
function selMsgList(keep){
  var b=document.getElementById('selp-b'); if(!b) return; var q=normTxt(SELM.q||''), tmap={};
  CHAT.threads.forEach(function(t){ tmap[t.channel]=t; });
  var users=CHAT.users.map(function(u){ return {u:u,ch:chDm(u.id),t:tmap[chDm(u.id)]}; });
  var talk=users.filter(function(x){ return x.t&&(!q||normTxt(x.u.name).indexOf(q)>=0); }).sort(function(a,c){ return c.t.last_id-a.t.last_id; });
  var others=q?users.filter(function(x){ return !x.t&&normTxt(x.u.name).indexOf(q)>=0; }):[];
  function row(ch,name,gen,sub){ return '<button type="button" class="sel-o" onclick="selMsgGo(\''+ch+'\')">'+chAv(name,'sm',gen)+'<span class="sel-ot"><b>'+esc(name)+'</b>'+(sub?'<small>'+sub+'</small>':'')+'</span>'+ic('send')+'</button>'; }
  b.innerHTML='<label class="ch-ls-q sel-q">'+ic('search')+'<input id="selm-q" type="search" placeholder="Rechercher une personne…" value="'+esc(SELM.q)+'" oninput="SELM.q=this.value;selMsgList(true)" aria-label="Rechercher une personne"></label>'+
    ((!q||normTxt('salon général').indexOf(q)>=0)?row('general','Salon général',true,'Tous les comptes'):'')+
    (talk.length?'<div class="sel-sec">Discussions</div>'+talk.map(function(x){ return row(x.ch,x.u.name,false,''); }).join(''):'')+
    (others.length?'<div class="sel-sec">Nouvelle discussion</div>'+others.map(function(x){ return row(x.ch,x.u.name,false,''); }).join(''):'')+
    (!q&&!talk.length?'<div class="pk-none">Cherche une personne pour lui envoyer.</div>':'');
  if(keep){ var i=document.getElementById('selm-q'); if(i){ i.focus(); try{ i.setSelectionRange(i.value.length,i.value.length); }catch(e){} } }
}
function selMsgGo(ch){
  var ids=selIds(), kind=SEL.kind, sent=0, skip=0;
  document.getElementById('selp-b').innerHTML='<div class="pk-none">Envoi…</div>';
  ids.reduce(function(p,id){ return p.then(function(){
    var a=selAtt(kind,id); if(!a){ skip++; return; }
    return clRpc('chat_send',{p_channel:ch,p_body:'',p_attach:a}).then(function(){ sent++; });
  }); },Promise.resolve()).then(function(){
    closeMod('m-selpick'); selEnd();
    toast(sent+' envoyé'+(sent>1?'s':'')+' à '+chTitle(ch)+(skip?' · '+skip+' trop volumineux':''),'ok');
    goPage('chat'); setTimeout(function(){ try{ chOpen(ch); }catch(e){} },300);
  }).catch(function(e){ toast(chErr(e),'err'); closeMod('m-selpick'); });
}

// ── supprimer (avec « Annuler ») ──
function selDel(){
  var ids=selIds(), n=ids.length, rec=SEL.kind==='rec'; if(!n) return;
  var used=rec?recipes.filter(function(r){ return ids.indexOf(r.id)<0&&r.items.some(function(i){ return i.type==='recipe'&&ids.indexOf(i.refId)>=0; }); }):
    recipes.filter(function(r){ return r.items.some(function(i){ return i.type==='ingredient'&&ids.indexOf(i.refId)>=0; }); });
  var msg='Supprimer '+n+' '+(rec?'recette':'ingrédient')+(n>1?'s':'')+' ?'+(used.length?'\n\nAttention : '+(rec?'utilisée'+(n>1?'s':'')+' comme sous-recette':'utilisé'+(n>1?'s':''))+' dans '+used.length+' recette'+(used.length>1?'s':'')+' ('+used.slice(0,3).map(function(r){ return r.name; }).join(', ')+(used.length>3?'…':'')+').':'');
  if(!confirm(msg)) return;
  var snap=rec?recipes:ingredients;
  if(rec) recipes=recipes.filter(function(r){ return ids.indexOf(r.id)<0; });
  else ingredients=ingredients.filter(function(i){ return ids.indexOf(i.id)<0; });
  selEnd(); refreshAllViews();
  toastUndo(n+' '+(rec?'recette':'ingrédient')+(n>1?'s':'')+' supprimé'+(rec?'e':'')+(n>1?'s':''),function(){ if(rec) recipes=snap; else ingredients=snap; refreshAllViews(); });
}

// ── titres courts dans la barre du haut sur téléphone (évite « Bons d’… ») ──
(function(){
  var SHORT={'Bons d’économat':'Bons','Bons d\'économat':'Bons','Réglages & sauvegarde':'Réglages','Livres de recettes':'Livres','Administration':'Admin','Fournisseurs':'Fournisseurs'};
  var LONG={};
  function mob(){ try{ return typeof layIsMob==='function'?layIsMob():innerWidth<=820; }catch(e){ return innerWidth<=820; } }
  function fix(){
    var bc=document.getElementById('tb-bc'); if(!bc) return;
    var t=bc.textContent;
    if(mob()&&SHORT[t]&&SHORT[t]!==t){ LONG[SHORT[t]]=t; bc.textContent=SHORT[t]; bc.title=t; }
    else if(!mob()&&LONG[t]){ bc.textContent=LONG[t]; }
  }
  var _g=goPage; goPage=function(){ var r=_g.apply(this,arguments); try{ fix(); }catch(e){} return r; };
  window.addEventListener('resize',fix);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',fix); else setTimeout(fix,0);
})();
