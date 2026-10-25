// ══ FLUIDITÉ ET FINITIONS ═════════════════════════════════════

// ── 1. Nouvelle version disponible ──
// Chaque version de l'appli porte un numéro (window.ECO_BUILD). De temps en
// temps, on relit la page sur le site : si le numéro a changé, un bandeau
// propose de recharger.
var UPD={last:0,shown:false};
function updCheck(force){
  if(UPD.shown||!/^https?:$/.test(location.protocol)||!window.ECO_BUILD) return;
  if(!force&&Date.now()-UPD.last<5*60000) return;
  UPD.last=Date.now();
  fetch(location.pathname+'?v='+Date.now(),{cache:'no-store'}).then(function(r){ return r.ok?r.text():''; }).then(function(t){
    var m=/window\.ECO_BUILD="([^"]+)"/.exec(t||'');
    if(m&&m[1]!==window.ECO_BUILD) updBanner();
  }).catch(function(){});
}
function updBanner(){
  if(UPD.shown) return; UPD.shown=true;
  var b=document.createElement('div'); b.id='upd-bar'; b.className='upd-bar'; b.setAttribute('role','status');
  b.innerHTML='<span class="upd-ic">'+ic('sparkle')+'</span><span class="upd-t"><b>Nouvelle version disponible</b><small>Recharge pour en profiter (rien n’est perdu).</small></span>'+
    '<button class="btn btn-gold btn-sm" onclick="updReload()">'+ic('refresh')+' Recharger</button><button class="upd-x" onclick="updHide()" aria-label="Plus tard" title="Plus tard">'+ic('x')+'</button>';
  document.body.appendChild(b); requestAnimationFrame(function(){ b.classList.add('show'); });
}
function updHide(){ var b=document.getElementById('upd-bar'); if(b){ b.classList.remove('show'); setTimeout(function(){ b.remove(); },300); } }
function updReload(){
  try{ if(typeof persist==='function') persist(); }catch(e){}
  var go=function(){ location.reload(); };
  if(navigator.serviceWorker&&navigator.serviceWorker.getRegistration){
    navigator.serviceWorker.getRegistration().then(function(r){ return r&&r.update(); }).then(go,go);
  } else go();
}
setTimeout(function(){ updCheck(true); },20000);
setInterval(function(){ if(document.visibilityState!=='hidden') updCheck(); },15*60000);
document.addEventListener('visibilitychange',function(){ if(document.visibilityState==='visible') updCheck(); });

// ── 2. Calculs gardés en mémoire pendant qu'on parcourt les recettes ──
// (composition aplatie des recettes : poids, coût, allergènes, filtres).
// Oubliés dès qu'une donnée change ou qu'on change de page.
var MEMO={fl:{}};
function memoClear(){ MEMO.fl={}; }
(function(){
  var _fl=flatten;
  flatten=function(id,mult,vis){
    if(mult!=null||vis!=null||typeof CUR==='undefined'||CUR!=='recettes'||String(id).indexOf('__')===0) return _fl.apply(this,arguments);
    var c=MEMO.fl[id]; if(!c) c=MEMO.fl[id]=_fl(id);
    return c.map(function(o){ return {ingId:o.ingId,qty:o.qty,from:o.from}; });
  };
  var _p=persist; persist=function(){ memoClear(); return _p.apply(this,arguments); };
  if(typeof clAfterRemote==='function'){ var _r=clAfterRemote; clAfterRemote=function(){ memoClear(); return _r.apply(this,arguments); }; }
})();

// ── 3. Retour au bon endroit + transitions ──
var SCROLLS={};
(function(){
  var _g=goPage;
  goPage=function(p){
    var from=typeof CUR!=='undefined'?CUR:'', sc=document.getElementById('scroll');
    if(sc&&from) SCROLLS[from]=sc.scrollTop;
    memoClear();
    var r=_g.apply(this,arguments);
    var back=(from==='rec-edit'&&p==='recettes')||(from==='edit'&&p==='bons')||(from==='partage'&&p==='partage');
    if(sc&&back&&SCROLLS[p]){
      var want=SCROLLS[p], n=0;
      (function restore(){
        sc.scrollTop=want;
        if(sc.scrollTop<want-4&&n++<20&&cnPaintMore(document.getElementById('rec-grid'))) return requestAnimationFrame(restore);
      })();
    }
    return r;
  };
})();

// ── 4. Squelettes pendant les chargements ──
function skelTiles(n){ var h=''; for(var i=0;i<n;i++) h+='<div class="sk-tile"><div class="sk sk-ph"></div><div class="sk sk-l1"></div><div class="sk sk-l2"></div></div>'; return '<div class="rgrid tiles sk-grid">'+h+'</div>'; }
function skelRows(n){ var h=''; for(var i=0;i<n;i++) h+='<div class="sk-row"><div class="sk sk-av"></div><div style="flex:1"><div class="sk sk-l1"></div><div class="sk sk-l2"></div></div></div>'; return '<div class="sk-rows">'+h+'</div>'; }
(function(){
  var _pb=partBody;
  partBody=function(){
    var b=document.getElementById('part-body');
    var first=typeof CLOUD!=='undefined'&&CLOUD.st&&!(CLOUD.st.since&&CLOUD.st.since.shared)&&!sharedList().length&&CLOUD.status!=='offline'&&CLOUD.status!=='error';
    if(b&&PART.tab==='others'&&first&&clActive()){ b.innerHTML='<div class="sk sk-h"></div>'+skelTiles(6); return; }
    return _pb.apply(this,arguments);
  };
  var _ra=renderAdmin;
  renderAdmin=function(){
    var r=_ra.apply(this,arguments), w=document.getElementById('adm-wrap');
    if(w&&w.querySelector('.inv-spin')&&ADM.users==null) w.innerHTML='<div class="sk sk-card"></div><div class="sk sk-card"></div>'+skelRows(4);
    return r;
  };
})();

// ── 5. Feuilleter le carnet ──
var FLIP={list:[],i:0,busy:false};
function flipOpen(id){
  var list=typeof recFiltered==='function'?recFiltered(true):recipes.slice();
  if(!list.length){ toast('Aucune recette à feuilleter','info'); return; }
  FLIP.list=list.map(function(r){ return r.id; });
  FLIP.i=Math.max(0,id?FLIP.list.indexOf(id):0);
  var o=document.getElementById('flip');
  if(!o){
    o=document.createElement('div'); o.id='flip'; o.className='flip'; o.setAttribute('role','dialog'); o.setAttribute('aria-label','Carnet de recettes');
    o.innerHTML='<div class="flip-top"><span class="flip-n" id="flip-n"></span><div class="flip-acts">'+
        '<button class="flip-b" onclick="flipFiche()" title="Fiche technique">'+ic('file')+'<span>Fiche</span></button>'+
        '<button class="flip-b" onclick="flipEdit()" title="Modifier">'+ic('edit')+'<span>Modifier</span></button>'+
        '<button class="flip-b x" onclick="flipClose()" title="Fermer (Échap)" aria-label="Fermer">'+ic('x')+'</button></div></div>'+
      '<button class="flip-nav prev" onclick="flipGo(-1)" aria-label="Recette précédente">'+ic('chev-left')+'</button>'+
      '<div class="flip-stage" id="flip-stage"></div>'+
      '<button class="flip-nav next" onclick="flipGo(1)" aria-label="Recette suivante">'+ic('chev-right')+'</button>'+
      '<div class="flip-dots" id="flip-dots"></div>';
    document.body.appendChild(o);
    var sx=0, sy=0;
    o.addEventListener('touchstart',function(e){ var t=e.touches[0]; sx=t.clientX; sy=t.clientY; },{passive:true});
    o.addEventListener('touchend',function(e){ var t=e.changedTouches[0], dx=t.clientX-sx, dy=t.clientY-sy; if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.4) flipGo(dx<0?1:-1); },{passive:true});
  }
  flipRender(0); o.classList.add('show'); document.documentElement.classList.add('flip-on');
}
function flipClose(){ var o=document.getElementById('flip'); if(o) o.classList.remove('show'); document.documentElement.classList.remove('flip-on'); }
function flipCur(){ return recipes.find(function(r){ return r.id===FLIP.list[FLIP.i]; }); }
function flipEdit(){ var r=flipCur(); flipClose(); if(r) openEditRec(r.id); }
function flipFiche(){ var r=flipCur(); if(r) ficheFromCard(r.id); }
function flipGo(d){
  var n=FLIP.list.length; if(n<2||FLIP.busy) return;
  FLIP.i=(FLIP.i+d+n)%n; flipRender(d);
}
function flipQ(q){ var t=fNum(q,3); if(t.indexOf(',')>=0) t=t.replace(/0+$/,'').replace(/,$/,''); return t; }
function flipPage(r){
  var flat=flatten(r.id), w=flat.reduce(function(s,i){ return s+i.qty; },0);
  var cost=flat.reduce(function(s,i){ var g=ingredients.find(function(x){ return x.id===i.ingId; }); return s+(g?g.price*i.qty:0); },0);
  var a=allergensOfFlat(flat);
  var ph=recHasPhoto(r)?'<img src="'+esc(r.image)+'" alt="">':'<span class="flip-em">'+(recEmoji(r)||ic('book'))+'</span>';
  var items=(r.items||[]).map(function(it){
    if(it.type==='ingredient'){ var g=ingredients.find(function(x){ return x.id===it.refId; }); return '<li><span>'+catDot(g&&g.cat||'')+esc(g?g.name:'?')+'</span><b>'+(Number(it.qty)>0?esc(flipQ(it.qty))+' '+esc(it.unit||''):'Q.S.')+'</b></li>'; }
    var s=recipes.find(function(x){ return x.id===it.refId; });
    return '<li class="sub"><span>'+ic('sub')+' '+esc(s?s.name:'?')+'</span><b>× '+esc(fNum(it.qty,2))+'</b></li>';
  }).join('');
  var chips=[fKg(w),fEur(cost)+' TTC'];
  if(r.pcs) chips.push(r.pcs+' pièce'+(r.pcs>1?'s':''));
  if(r.time) chips.push(fDur(r.time));
  return '<article class="flip-page">'+
    '<div class="flip-l"><div class="flip-ph'+(recHasPhoto(r)?' img':'')+'" style="--ch:'+catHue(r.cat||'')+'">'+ph+'</div>'+
      '<div class="flip-cat">'+catDot(r.cat||'')+esc(r.cat||'')+'</div><h2 class="flip-t">'+esc(r.name)+'</h2>'+
      '<div class="flip-chips">'+chips.map(function(c){ return '<span>'+esc(c)+'</span>'; }).join('')+'</div>'+
      ((r.tags||[]).length?'<div class="flip-tags">'+r.tags.map(function(t){ return '<span>'+ic('tag')+esc(t)+'</span>'; }).join('')+'</div>':'')+
      (a.keys.length?'<div class="flip-alg">'+algChips(a.keys,'sm')+'</div>':'')+
    '</div>'+
    '<div class="flip-r"><div class="flip-h">Composition</div><ul class="flip-items">'+(items||'<li><span>—</span></li>')+'</ul>'+
      (r.notes?'<div class="flip-h">Procédé</div><div class="flip-notes">'+esc(r.notes)+'</div>':'')+
    '</div></article>';
}
function flipRender(d){
  var st=document.getElementById('flip-stage'), r=flipCur(); if(!st||!r) return;
  document.getElementById('flip-n').textContent=(FLIP.i+1)+' / '+FLIP.list.length;
  var n=FLIP.list.length, dots=document.getElementById('flip-dots');
  dots.innerHTML=n>1&&n<=30?FLIP.list.map(function(id,i){ return '<i class="'+(i===FLIP.i?'on':'')+'" onclick="flipGo('+(i-FLIP.i)+')"></i>'; }).join(''):'';
  var old=st.firstChild;
  if(!d||!old){ st.innerHTML=flipPage(r); return; }
  FLIP.busy=true;
  st.insertAdjacentHTML('beforeend',flipPage(r));
  var nw=st.lastChild;
  nw.classList.add(d>0?'in-r':'in-l'); old.classList.add(d>0?'out-l':'out-r');
  setTimeout(function(){ if(old.parentNode) old.remove(); nw.classList.remove('in-r','in-l'); FLIP.busy=false; },380);
}
document.addEventListener('keydown',function(e){
  var o=document.getElementById('flip'); if(!o||!o.classList.contains('show')||document.querySelector('.ov.show')) return;
  if(e.key==='ArrowRight'){ e.preventDefault(); flipGo(1); }
  else if(e.key==='ArrowLeft'){ e.preventDefault(); flipGo(-1); }
  else if(e.key==='Escape'){ e.preventDefault(); flipClose(); }
});
(function(){ var _g=goPage; goPage=function(){ flipClose(); return _g.apply(this,arguments); }; })();
