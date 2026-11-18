// ══ LIVRE DE RECETTES (administrateurs) ═══════════════════════
// Même éditeur que les bons d’économat : panneau « Ajouter » à gauche, liste
// au centre, récapitulatif et export à droite, onglet « Aperçu ». Chaque
// recette du livre peut être adaptée (ingrédients, quantités, procédé mis en
// forme) sans toucher à la recette d’origine. PDF : couverture, sommaire
// cliquable (par catégorie, numéros de page), puis une fiche par recette.
var BK_KEY='v4_book';
if(window.ALLP&&ALLP.indexOf('livre')<0) ALLP.push('livre');
function bkAdm(){ try{ return typeof permOk==='function'&&permOk('book'); }catch(e){ return false; } }
// Plusieurs livres, comme les bons : liste → éditeur
var BKS_KEY='v4_books';
function bkAll(){
  var l=null; try{ l=JSON.parse(LS.getItem(BKS_KEY)||'null'); }catch(e){}
  if(!Array.isArray(l)){
    l=[]; var old=null; try{ old=JSON.parse(LS.getItem(BK_KEY)||'null'); }catch(e){}
    if(old&&Array.isArray(old.items)&&old.items.length){ old.id=old.id||uid(); old.createdAt=old.createdAt||now(); old.updatedAt=old.updatedAt||now(); l.push(old); }
    try{ LS.setItem(BKS_KEY,JSON.stringify(l)); }catch(e){}
  }
  return l.filter(function(b){ return b&&b.id; });
}
function bkPutAll(l){ try{ LS.setItem(BKS_KEY,JSON.stringify(l)); }catch(e){} }
function bkNorm(b){
  b=b||{}; b.title=b.title||''; b.sub=b.sub||''; b.items=Array.isArray(b.items)?b.items:[];
  b.items=b.items.filter(function(x){ return x&&!!bkR(x.id); });
  return b;
}
function bkR(id){ return recipes.find(function(r){ return r.id===id; })||(typeof archRec==='function'?archRec(id):null); }
function bkGone(id){ return !recipes.some(function(r){ return r.id===id; }); }
function bkGet(){
  var l=bkAll(), b=BK.cur&&l.find(function(x){ return x.id===BK.cur; });
  return bkNorm(b?b:{id:null});
}
function bkSave(b){
  if(!b||!b.id) return; var l=bkAll(), i=l.findIndex(function(x){ return x.id===b.id; });
  b.updatedAt=now(); if(i>=0) l[i]=b; else l.unshift(b); bkPutAll(l);
}
function bkNew(title,open){
  var b={id:uid(),title:title||'',sub:'',items:[],autoSubs:true,createdAt:now(),updatedAt:now()};
  var l=bkAll(); l.unshift(b); bkPutAll(l);
  if(open!==false) bkOpen(b.id);
  return b;
}
function bkOpen(id){
  BK.cur=id; BK.tab='items';
  if(CUR!=='livre'){ BK.keep=1; goPage('livre'); BK.keep=0; return; }
  document.documentElement.classList.add('re-full'); bkTop(); renderLivre();
}
function bkClose(){ BK.cur=null; document.documentElement.classList.remove('re-full'); bkTop(); renderLivre(); }
function bkDup(id){
  var l=bkAll(), b=l.find(function(x){ return x.id===id; }); if(!b) return;
  var c=JSON.parse(JSON.stringify(b)); c.id=uid(); c.title=(b.title||'Livre sans titre')+' (copie)'; c.createdAt=c.updatedAt=now();
  l.unshift(c); bkPutAll(l); renderLivre(); toast('Livre dupliqué','ok');
}
function bkDel(id){
  var l=bkAll(), b=l.find(function(x){ return x.id===id; }); if(!b) return;
  if(!confirm('Supprimer le livre « '+(b.title||'Livre sans titre')+' » ? Les recettes restent dans ton carnet.')) return;
  bkPutAll(l.filter(function(x){ return x.id!==id; })); if(BK.cur===id) BK.cur=null; renderLivre(); bkNav(); toast('Livre supprimé','ok');
}
// barre du haut + bouton + flottant (comme la page des bons)
function bkTop(){
  if(CUR!=='livre') return;
  var bc=document.getElementById('tb-bc'); if(bc) bc.textContent='Livres';
  var act=document.getElementById('tb-act'); if(act) act.innerHTML=BK.cur?'':'<button class="tbtn gold" onclick="bkNew()">'+ic('plus')+' Nouveau</button>';
  var f=document.getElementById('ux-fab'); if(f){ f.style.display=BK.cur?'none':''; if(!BK.cur){ f.title='Nouveau livre'; f.setAttribute('aria-label','Nouveau livre'); f.onclick=function(){ bkNew(); }; } }
}
var BKL={q:''};
function bkCard(b){
  var n=b.items.length, cats={}, nov=0;
  b.items.forEach(function(x){ cats[bkCatOf(bkR(x.id))]=1; if(x.ov) nov++; });
  var nc=Object.keys(cats).length, d=b.updatedAt||b.createdAt;
  return '<div class="bc" onclick="bkOpen(\''+b.id+'\')"><div class="bc-img"><div class="bc-ico">'+ic('list')+'</div><div style="flex:1;min-width:0"><div class="bc-name">'+esc(b.title||'Livre sans titre')+'</div>'+
    '<div class="bc-meta" style="margin-bottom:0">'+ic('calendar')+' '+(d?fDate(String(d).slice(0,10)):'—')+' · '+n+' recette'+(n>1?'s':'')+(nc?' · '+ic('folder')+' '+nc:'')+'</div></div></div>'+
    '<div class="bc-body"><div class="bc-row"><span class="badge '+(n?'bd-ok':'bd-d')+'">'+(n?(nov?nov+' adaptée'+(nov>1?'s':''):(b.sub?esc(b.sub.slice(0,22)):'Prêt')):'Vide')+'</span>'+
    '<div class="bc-btns" onclick="event.stopPropagation()"><button class="btn btn-ghost btn-xs" onclick="bkOpen(\''+b.id+'\')" title="Modifier" aria-label="Modifier">'+ic('edit')+'</button><button class="btn btn-ghost btn-xs" onclick="bkDup(\''+b.id+'\')" title="Dupliquer" aria-label="Dupliquer">'+ic('copy')+'</button><button class="btn btn-red btn-xs" onclick="bkDel(\''+b.id+'\')" title="Supprimer" aria-label="Supprimer">'+ic('trash')+'</button></div>'+
    '<span class="bc-cost">'+(n?'≈ '+bkPagesEst(b)+' p.':'—')+'</span></div></div></div>';
}
function renderLivres(){
  var w=document.getElementById('bk-wrap'); if(!w) return;
  var l=bkAll().map(bkNorm).sort(function(a,b){ return String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')); });
  var q=normTxt(BKL.q||''), list=l.filter(function(b){ return !q||normTxt((b.title||'Livre sans titre')+' '+(b.sub||'')).indexOf(q)>=0; });
  var nr=l.reduce(function(s,b){ return s+b.items.length; },0), nov=l.reduce(function(s,b){ return s+b.items.filter(function(x){ return x.ov; }).length; },0), np=l.reduce(function(s,b){ return s+bkPagesEst(b); },0);
  var inp=document.getElementById('bkl-q'), focus=inp&&document.activeElement===inp;
  w.innerHTML='<div class="sbar"><div class="sb2"><span class="sb2-v">'+l.length+'</span><div class="sb2-l">Livres</div></div><div class="sb2"><span class="sb2-v" style="color:var(--i3)">'+nr+'</span><div class="sb2-l">Recettes</div></div><div class="sb2"><span class="sb2-v" style="color:var(--gr)">'+nov+'</span><div class="sb2-l">Adaptées</div></div><div class="sb2"><span class="sb2-v" style="font-size:16px">≈ '+np+'</span><div class="sb2-l">Pages</div></div></div>'+
    '<div class="srch">'+ic('search')+'<input class="sinp" id="bkl-q" placeholder="Rechercher un livre…" value="'+esc(BKL.q)+'" oninput="BKL.q=this.value;renderLivres()"></div>'+
    (list.length?'<div class="bgrid">'+list.map(bkCard).join('')+'</div>':
      '<div class="empty"><span class="empty-i">'+ic('list')+'</span><div class="empty-t">'+(l.length?'Aucun livre trouvé':'Aucun livre')+'</div><div class="empty-s">'+(l.length?'Essaie un autre mot.':'Crée ton premier livre de recettes')+'</div>'+(l.length?'':'<button class="btn btn-gold btn-sm empty-b" onclick="bkNew()">'+ic('plus')+' Créer un livre</button>')+'</div>');
  if(focus){ var i=document.getElementById('bkl-q'); if(i){ i.focus(); try{ i.setSelectionRange(i.value.length,i.value.length); }catch(e){} } }
}
var BK={tab:'items',cur:null,keep:0};
function bkIsSub(r){ return !!r&&(r.image==='⊛'||!!(window.BK_AUTO&&BK_AUTO[r.id])); }
var BK_SUB='Sous-recettes';
function bkCatOf(r){ return bkIsSub(r)?BK_SUB:((r&&r.cat)||'Sans catégorie'); }
function bkCmpCat(a,c){ return (a===BK_SUB)-(c===BK_SUB)||a.localeCompare(c,'fr'); }
// ordre du livre : catégories (A→Z), puis recettes (A→Z)
function bkSorted(b){ return bkSortList(b.items); }
function bkSortList(list){
  return list.map(function(x){ return {x:x,r:bkR(x.id)}; }).filter(function(o){ return o.r; })
    .sort(function(a,c){ return bkCmpCat(bkCatOf(a.r),bkCatOf(c.r))||a.r.name.localeCompare(c.r.name,'fr'); })
    .map(function(o){ var y={id:o.x.id,m:o.x.m>0?o.x.m:1}; if(o.x.ov) y.ov=o.x.ov; return y; });
}
function bkHas(b,id){ return b.items.some(function(x){ return x.id===id; }); }
function bkItem(b,id){ return b.items.find(function(x){ return x.id===id; }); }
// ajoute des recettes : dans un nouveau livre (titre donné) ou dans le livre ouvert
window.bkAdd=function(ids,opt){
  opt=opt||{};
  if(opt.title||!BK.cur){ var l=bkAll(); if(!opt.title&&l.length) BK.cur=l.slice().sort(function(a,b){ return String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')); })[0].id; else BK.cur=bkNew(opt.title||'',false).id; }
  var b=bkGet(); (ids||[]).forEach(function(x){ var id=x.id||x, m=x.m||1; if(!bkHas(b,id)) b.items.push({id:id,m:m}); });
  bkSave(b); bkNav();
};
function bkToggle(id){ var b=bkGet(); if(bkHas(b,id)) b.items=b.items.filter(function(x){ return x.id!==id; }); else b.items.push({id:id,m:1}); bkSave(b); renderLivre(true); }
function bkMult(id,v){ var b=bkGet(), e=bkItem(b,id); if(!e) return; var n=parseFloat(String(v).replace(',','.')); e.m=n>0?n:1; bkSave(b); bkSide(); }
function bkField(k,v){ var b=bkGet(); b[k]=v; bkSave(b); if(k==='title'){ var m=document.getElementById('bk-meta'); if(m) m.innerHTML=bkMetaHTML(b); } }
function bkClear(){ if(!confirm('Vider le livre ? Les recettes restent dans ton carnet.')) return; var b=bkGet(); b.items=[]; bkSave(b); renderLivre(true); }
function bkAutoSubs(v){ var b=bkGet(); b.autoSubs=!!v; bkSave(b); bkSide(); }

// recettes du livre avec leurs adaptations (ingrédients / procédé propres au livre)
function bkVirtual(b){
  var ov={}; b.items.forEach(function(x){ if(x.ov) ov[x.id]=x.ov; });
  var base=typeof archRecsFor==='function'?recipes.concat(archRecsFor()):recipes;
  return base.map(function(r){ var o=ov[r.id]; if(!o) return r; var v=Object.assign({},r,{items:o.items.map(function(i){ return Object.assign({},i); })}); if(o.notesHtml!=null){ v.notesHtml=o.notesHtml; v.notes=o.notes||''; } return v; });
}
function bkWith(b,fn){ var orig=recipes; if(typeof memoClear==='function') memoClear(); recipes=bkVirtual(b); try{ return typeof withArchIng==='function'?withArchIng(fn):fn(); } finally{ recipes=orig; if(typeof memoClear==='function') memoClear(); } }

// ── éditeur (même disposition que l’éditeur de bon) ──
function bkMetaHTML(b){
  var n=b.items.length, cats={}; b.items.forEach(function(x){ cats[bkCatOf(bkR(x.id))]=1; });
  var nc=Object.keys(cats).length, nov=b.items.filter(function(x){ return x.ov; }).length;
  return '<span>'+ic('book')+' '+n+' recette'+(n>1?'s':'')+'</span><span>'+ic('folder')+' '+nc+' catégorie'+(nc>1?'s':'')+'</span>'+(nov?'<span>'+ic('edit')+' '+nov+' adaptée'+(nov>1?'s':'')+'</span>':'');
}
function bkPagesEst(b){ var n=b.items.length; return n?1+Math.ceil((n+Object.keys(b.items.reduce(function(o,x){ o[bkCatOf(bkR(x.id))]=1; return o; },{})).length)/34)+n:0; }
function renderLivre(keep){
  var w=document.getElementById('bk-wrap'); if(!w) return;
  if(!BK.cur||!bkAll().some(function(x){ return x.id===BK.cur; })){ BK.cur=null; document.documentElement.classList.remove('re-full'); w.className='bk-list'; renderLivres(); return; }
  w.className='';
  var b=bkGet(), sc=document.getElementById('bk-mid'), top=keep&&sc?sc.scrollTop:0;
  var fold={}; try{ fold=JSON.parse(LS.getItem('v4_bkfold')||'{}'); }catch(e){}
  w.innerHTML=
    '<div class="re-top">'+
      '<button class="re-x" onclick="bkClose()" title="Retour à mes livres" aria-label="Retour à mes livres">'+ic('x')+'</button>'+
      '<div class="re-tabs" role="tablist"><button id="bk-t-items" class="'+(BK.tab==='items'?'on':'')+'" onclick="bkTab(\'items\')">Recettes</button><button id="bk-t-prev" class="'+(BK.tab==='prev'?'on':'')+'" onclick="bkTab(\'prev\')">Aperçu</button></div>'+
      '<div class="re-top-r">'+
        '<button class="re-ib dsk" onclick="bookBuild()" title="PDF du livre" aria-label="PDF du livre">'+ic('pdf')+'</button>'+
        '<button class="btn btn-gold btn-full re-save" onclick="bookBuild()">'+ic('download')+' Créer le livre</button>'+
      '</div></div>'+
    '<div class="re-body'+(fold.l?' l-off':'')+(fold.r?' r-off':'')+'" id="bkx-body">'+
      '<aside class="re-side re-l" id="bk-l">'+
        '<details class="re-sec" open><summary>Informations '+ic('chev-down')+'</summary><div class="re-box">'+
          '<div class="re-lb">Sous-titre</div><input class="fi" id="bk-sub" value="'+esc(b.sub)+'" placeholder="Ex. Recueil de l’atelier — 2026" oninput="bkField(\'sub\',this.value)">'+
        '</div></details>'+
        '<details class="re-sec" open><summary>Sous-recettes '+ic('chev-down')+'</summary>'+
          '<label class="bk-ck bk-auto"><input type="checkbox" id="bk-auto"'+(b.autoSubs!==false?' checked':'')+' onchange="bkAutoSubs(this.checked)"> Ajouter automatiquement les sous-recettes utilisées, sur leurs propres pages</label></details>'+
        '<details class="re-sec" open><summary>Ajouter '+ic('chev-down')+'</summary><div class="re-adds">'+
          '<button class="re-add pri" onclick="bkStartPick()"><span>Recette</span>'+ic('plus-circle')+'</button>'+
        '</div></details>'+
      '</aside>'+
      '<button class="re-fold l" onclick="bkFold(\'l\')" title="Masquer le panneau" aria-label="Masquer le panneau de gauche">'+ic('chev-left')+'</button>'+
      '<main class="re-mid" id="bk-mid">'+
        '<div class="re-head"><div class="re-thumb be-ic">'+ic('book')+'</div>'+
          '<input class="re-title" type="text" id="bk-title" placeholder="TITRE DU LIVRE" autocomplete="off" value="'+esc(b.title)+'" oninput="bkField(\'title\',this.value)">'+
          '<div class="re-meta" id="bk-meta">'+bkMetaHTML(b)+'</div></div>'+
        '<div id="bk-pane-items"'+(BK.tab==='items'?'':' style="display:none"')+'>'+bkListHTML(b)+'</div>'+
        '<div id="bk-pane-prev"'+(BK.tab==='prev'?'':' style="display:none"')+'></div>'+
      '</main>'+
      '<button class="re-fold r" onclick="bkFold(\'r\')" title="Masquer le panneau" aria-label="Masquer le panneau de droite">'+ic('chev-right')+'</button>'+
      '<aside class="re-side re-r" id="bk-r"><div id="bk-side"></div></aside>'+
    '</div>'+
    '<div class="re-dock">'+
      '<button onclick="bkStartPick()" title="Ajouter une recette" aria-label="Ajouter une recette">'+ic('plus-circle')+'</button>'+
      '<span class="re-dock-s"></span>'+
      '<button onclick="bkTab(BK.tab===\'prev\'?\'items\':\'prev\')" title="Aperçu du livre" aria-label="Aperçu du livre">'+ic('eye')+'</button>'+
      '<button onclick="bookBuild()" title="Créer le PDF" aria-label="Créer le PDF">'+ic('pdf')+'</button>'+
    '</div>';
  bkSide();
  if(BK.tab==='prev') bkPrev();
  var m=document.getElementById('bk-mid'); if(m) m.scrollTop=top;
}
function bkFold(side){
  var b=document.getElementById('bkx-body'); if(!b) return; b.classList.toggle(side+'-off');
  try{ LS.setItem('v4_bkfold',JSON.stringify({l:b.classList.contains('l-off'),r:b.classList.contains('r-off')})); }catch(e){}
}
function bkTab(t){
  BK.tab=t;
  ['items','prev'].forEach(function(k){ var p=document.getElementById('bk-pane-'+k), tb=document.getElementById('bk-t-'+k); if(p) p.style.display=k===t?'':'none'; if(tb) tb.classList.toggle('on',k===t); });
  if(t==='prev') bkPrev();
}
function bkListHTML(b){
  var sorted=bkSorted(b), cats={}, order=[];
  sorted.forEach(function(it){ var r=bkR(it.id), c=bkCatOf(r); if(!cats[c]){ cats[c]=[]; order.push(c); } cats[c].push({r:r,it:it}); });
  var body=order.map(function(c){
    return '<div class="bk-cat">'+catDot(c)+esc(c)+' <small>'+cats[c].length+'</small></div>'+cats[c].map(function(o){
      var r=o.r, op=!!BK.open[r.id];
      return '<div class="bk-sel'+(op?' open':'')+'" data-id="'+r.id+'"><div class="bk-th">'+(typeof recThumb==='function'?recThumb(r):'')+'</div>'+
        '<button type="button" class="bk-nm" onclick="bkInl(\''+r.id+'\')" title="Modifier les ingrédients dans le livre" aria-expanded="'+op+'"><b>'+esc(r.name)+(bkGone(r.id)?' <span class="bk-gone" title="Supprimée de ton carnet : elle reste dans ce livre">'+ic('info')+' supprimée du carnet</span>':'')+'</b><small>'+bkRowSmall(b,o.it,r)+'</small></button>'+
        '<button type="button" class="bk-x bk-chev" aria-label="Ingrédients de '+esc(r.name)+'" title="Ingrédients" onclick="bkInl(\''+r.id+'\')">'+ic(op?'chev-up':'chev-down')+'</button>'+
        '<label class="bk-m" title="Multiplicateur de la recette">×<input type="text" inputmode="decimal" value="'+esc(String(o.it.m).replace('.',','))+'" aria-label="Multiplicateur de '+esc(r.name)+'" onchange="bkMult(\''+r.id+'\',this.value);renderLivre(true)"></label>'+
        '<button type="button" class="bk-x bk-ed" aria-label="Adapter '+esc(r.name)+'" title="Modifier les ingrédients et le procédé pour le livre" onclick="bkEdit(\''+r.id+'\')">'+ic('edit')+'</button>'+
        '<button type="button" class="bk-x" aria-label="Retirer '+esc(r.name)+'" title="Retirer du livre" onclick="bkToggle(\''+r.id+'\')">'+ic('x')+'</button></div>'+
        (op?'<div class="bk-inl" id="bki-'+r.id+'">'+bkiHTML(b,r.id)+'</div>':'');
    }).join('');
  }).join('');
  var n=sorted.length;
  return '<section class="re-card"><div class="re-card-t">Recettes du livre'+(n?'<span class="re-card-a"><button class="btn btn-beige btn-sm" onclick="bkStartPick()">'+ic('plus')+' Recette</button></span>':'')+'</div>'+
    (n?'<div class="ustrip">'+ic('info')+' Touche une recette pour modifier ses ingrédients directement ici. Seul le livre change : ta recette du catalogue reste la même. Le crayon permet aussi d’adapter le procédé.</div>'+body+
      '<div class="tots"><div class="ti"><span class="tv">'+n+'</span><div class="tl">Recettes</div></div><div class="ti"><span class="tv">'+order.length+'</span><div class="tl">Catégories</div></div><div class="ti big"><span class="tv">≈ '+bkPagesEst(b)+'</span><div class="tl">Pages</div></div></div>'
      :'<div class="re-empty"><button class="re-big pri" onclick="bkStartPick()">'+ic('plus-circle')+' Ajouter une recette</button></div>'+
       '<div class="re-empty-t">Même recherche, mêmes filtres et mêmes vignettes que pour le partage de recettes.</div>')+
  '</section>';
}
// ── ingrédients modifiés directement dans la liste du livre ──
function bkRowSmall(b,it,r){
  var w=0; try{ w=bkWith(b,function(){ return recWeight(r.id)*(it.m||1); }); }catch(e){}
  return (w>0?fQtyNice(w):'—')+(it.ov?' · <span class="bk-ovb" title="Ingrédients ou procédé adaptés pour le livre">'+ic('edit')+' adaptée</span>':'');
}
BK.open={};
function bkInl(id){ BK.open[id]=!BK.open[id]; renderLivre(true); if(BK.open[id]){ var p=document.getElementById('bki-'+id); if(p&&p.scrollIntoView) try{ p.scrollIntoView({block:'nearest'}); }catch(e){} } }
function bkiItems(id){ var b=bkGet(), it=bkItem(b,id), r=bkR(id); if(!it||!r) return []; return ((it.ov&&it.ov.items)||r.items||[]).map(function(x){ return Object.assign({},x); }); }
function bkiPut(id,items,paint){
  var b=bkGet(), it=bkItem(b,id), r=bkR(id); if(!it||!r) return;
  var key=function(l){ return JSON.stringify((l||[]).map(function(x){ return [x.type,x.refId,+x.qty||0,x.unit]; })); };
  var clean=items.map(function(x){ var y={type:x.type,refId:x.refId,qty:+x.qty||0,unit:x.unit}; return y; });
  var notes=it.ov&&it.ov.notesHtml!=null;
  if(key(clean)===key(r.items)&&!notes) delete it.ov;
  else { var ov=Object.assign({},it.ov||{}); ov.items=clean; it.ov=ov; }
  bkSave(b);
  var row=document.querySelector('.bk-sel[data-id="'+id+'"] .bk-nm small'); if(row) row.innerHTML=bkRowSmall(b,it,r);
  var m=document.getElementById('bk-meta'); if(m) m.innerHTML=bkMetaHTML(b);
  if(paint){ var p=document.getElementById('bki-'+id); if(p) p.innerHTML=bkiHTML(b,id); }
  else bkiTot(id);
  try{ if(BK.tab==='prev') bkPrev(); bkSide(); }catch(e){}
}
function bkIng(id){ return ingredients.find(function(x){ return x.id===id; })||(typeof archIng==='function'?archIng(id):null); }
function bkiTotHTML(id){
  var b=bkGet(), it=bkItem(b,id), w=0, c=0;
  try{ bkWith(b,function(){ w=recWeight(id); c=recCost(id); }); }catch(e){}
  return '<span>Poids <b>'+fQtyNice(w)+'</b></span><span>Coût matière <b>'+fEur(c)+'</b></span>'+(it&&it.m&&it.m!==1?'<span>× '+String(it.m).replace('.',',')+'</span>':'');
}
function bkiTot(id){ var t=document.getElementById('bki-tot-'+id); if(t) t.innerHTML=bkiTotHTML(id); }
function bkiHTML(b,id){
  var it=bkItem(b,id), items=bkiItems(id), J='\''+id+'\'';
  var rows=items.map(function(x,i){
    if(x.type==='ingredient'){
      var g=bkIng(x.refId), gone=!ingredients.some(function(y){ return y.id===x.refId; });
      return '<div class="ir"><div class="ir-sw"><div class="ir-n">'+esc(g?g.name:'?')+'</div><div class="ir-c">'+(gone?'Supprimé du catalogue':'Ingrédient')+' · <button type="button" class="lnk bk-chg" onclick="bkiSwap('+J+','+i+')" title="Remplacer par un autre ingrédient ou une sous-recette">'+ic('refresh')+' Changer</button></div></div>'+
        '<input class="iq" type="text" inputmode="decimal" value="'+(Number(x.qty)>0?String(x.qty).replace('.',','):'')+'" placeholder="Q.S." aria-label="Quantité de '+esc(g?g.name:'')+'" onchange="bkiQty('+J+','+i+',this.value)">'+
        '<select class="iu bke-u" aria-label="Unité" onchange="bkiUnit('+J+','+i+',this.value)">'+bkeUnits(g,x.unit).map(function(u){ return '<option'+(u===x.unit?' selected':'')+'>'+esc(u)+'</option>'; }).join('')+'</select>'+
        '<button type="button" class="idel" onclick="bkiDel('+J+','+i+')" aria-label="Retirer">'+ic('x')+'</button></div>';
    }
    var sr=bkR(x.refId), sb=0; try{ sb=bkWith(b,function(){ return recWeight(x.refId); }); }catch(e){}
    var kg=sb*(Number(x.qty)||0);
    return '<div class="ir" style="border-left:2px solid var(--bl)"><div class="ir-sw"><div class="ir-n" style="color:var(--bl)">⊛ '+esc(sr?sr.name:'?')+'</div><div class="ir-c">Sous-recette · ×'+fQ(Math.round((Number(x.qty)||0)*100)/100)+' · <button type="button" class="lnk bk-chg" onclick="bkiSwap('+J+','+i+')" title="Remplacer par un autre ingrédient ou une sous-recette">'+ic('refresh')+' Changer</button></div></div>'+
      '<input class="iq" type="text" inputmode="decimal" value="'+(kg>0?String(Math.round(kg*1000)/1000).replace('.',','):'')+'" placeholder="Q.S." aria-label="Poids de '+esc(sr?sr.name:'')+' en kg" onchange="bkiSubKg('+J+','+i+',this.value)">'+
      '<div class="iu">kg</div><button type="button" class="idel" onclick="bkiDel('+J+','+i+')" aria-label="Retirer">'+ic('x')+'</button></div>';
  }).join('');
  return '<div class="ilist">'+(rows?'<div class="ihd"><span>Composant</span><span style="text-align:right">Qté</span><span>Unt</span><span></span></div>'+rows:'<div class="re-empty-t">Aucun ingrédient : ajoute-en avec la recherche ci-dessous.</div>')+'</div>'+
    '<div class="bke-add"><label class="cn-srch bp-srch"><input id="bki-q-'+id+'" type="search" placeholder="Ajouter un ingrédient ou une sous-recette…" oninput="bkiSug('+J+',this.value)" autocomplete="off">'+ic('search')+'</label><div id="bki-sug-'+id+'" class="bke-sug"></div></div>'+
    '<div class="bk-inl-f"><div class="bke-tot" id="bki-tot-'+id+'">'+bkiTotHTML(id)+'</div><div class="bk-inl-a">'+
      (it&&it.ov?'<button type="button" class="btn btn-ghost btn-sm" onclick="bkiReset('+J+')">'+ic('refresh')+' Recette d’origine</button>':'')+
      '<button type="button" class="btn btn-ghost btn-sm" onclick="bkEdit('+J+')">'+ic('edit')+' Procédé</button></div></div>';
}
function bkiQty(id,i,v){ var l=bkiItems(id); if(!l[i]) return; l[i].qty=Math.max(0,parseFloat(String(v).replace(',','.'))||0); bkiPut(id,l); }
function bkiUnit(id,i,u){ var l=bkiItems(id); if(!l[i]) return; l[i].unit=u; bkiPut(id,l); }
function bkiSubKg(id,i,v){ var l=bkiItems(id); if(!l[i]) return; var b=bkGet(), w=0; try{ w=bkWith(b,function(){ return recWeight(l[i].refId); }); }catch(e){} var kg=parseFloat(String(v).replace(',','.'))||0; l[i].qty=w>0?Math.round(kg/w*1e6)/1e6:kg; bkiPut(id,l,true); }
function bkiDel(id,i){ var l=bkiItems(id); var x=l.splice(i,1)[0]; if(!x) return; bkiPut(id,l,true); }
function bkiSug(id,v){
  var el=document.getElementById('bki-sug-'+id); if(!el) return; var q=normTxt(v||'').trim();
  if(!q){ el.innerHTML=''; return; }
  var w=q.split(/\s+/), ok=function(t){ t=normTxt(t); return w.every(function(x){ return t.indexOf(x)>=0; }); };
  var ings=ingredients.filter(function(g){ return ok(g.name+' '+(g.cat||'')); }).slice(0,8);
  var recs=recipes.filter(function(r){ return r.id!==id&&ok(r.name); }).slice(0,5);
  el.innerHTML=ings.map(function(g){ return '<button type="button" onclick="bkiAdd(\''+id+'\',\'ingredient\',\''+g.id+'\')">'+ic('box')+'<span>'+esc(g.name)+'</span><small>Ingrédient</small></button>'; }).join('')+
    recs.map(function(r){ return '<button type="button" onclick="bkiAdd(\''+id+'\',\'recipe\',\''+r.id+'\')">'+ic('sub')+'<span>'+esc(r.name)+'</span><small>Sous-recette</small></button>'; }).join('')||'<div class="pk-none">Rien trouvé</div>';
}
function bkiAdd(id,type,ref){
  var l=bkiItems(id);
  if(type==='ingredient'){ var g=ingredients.find(function(x){ return x.id===ref; }), u=String((g&&g.unit)||'kg'); l.push({type:'ingredient',refId:ref,qty:0,unit:/^(l|ml|cl)$/i.test(u)?'ml':(isCountable(u)?u:'g')}); }
  else l.push({type:'recipe',refId:ref,qty:1,unit:'x'});
  bkiPut(id,l,true);
  var ins=document.querySelectorAll('#bki-'+id+' .iq'); if(ins.length) try{ ins[ins.length-1].focus(); }catch(e){}
}
// ── remplacer un ingrédient (même fenêtre « Changer » que l’éditeur de recette) ──
function bkSwapApply(bookRecId,x,val){
  if(!val||!x) return false;
  var p=String(val).split(':'), kind=p[0], ref=p.slice(1).join(':');
  if(kind==='ing'){
    var g=ingredients.find(function(z){ return z.id===ref; }); if(!g) return false;
    var u=String(g.unit||'kg'), units=bkeUnits(g,null);
    if(x.type!=='ingredient'){ x.qty=0; x.unit=/^(l|ml|cl)$/i.test(u)?'ml':(isCountable(u)?u:'g'); }
    else if(units.indexOf(x.unit)<0) x.unit=units[0]||x.unit;
    x.type='ingredient'; x.refId=ref; return g.name;
  }
  if(kind==='rec'){
    if(ref===bookRecId){ toast('Une recette ne peut pas se contenir elle-même','err'); return false; }
    var r=recipes.find(function(z){ return z.id===ref; }); if(!r) return false;
    if(x.type!=='recipe'){ x.qty=1; x.unit='x'; }
    x.type='recipe'; x.refId=ref; return r.name;
  }
  return false;
}
function bkSwapOpen(bookRecId,x,done){
  var g=x.type==='ingredient'?bkIng(x.refId):bkR(x.refId);
  var prev=typeof editRecId!=='undefined'?editRecId:null;
  try{ editRecId=bookRecId; }catch(e){}
  swapOpen({cur:{type:x.type,id:x.refId},name:g?g.name:'',allowNew:false,onPick:function(val){
    try{ editRecId=prev; }catch(e){}
    var nm=bkSwapApply(bookRecId,x,val); if(nm){ done(); toast('Remplacé par « '+nm+' » dans le livre','ok'); }
  }});
  var sw=document.getElementById('m-swap'); if(sw) document.body.appendChild(sw); // devant la fenêtre « Adapter »
  var _c=swapClose; swapClose=function(){ try{ editRecId=prev; }catch(e){} swapClose=_c; return _c.apply(this,arguments); };
}
function bkiSwap(id,i){ var l=bkiItems(id), x=l[i]; if(!x) return; bkSwapOpen(id,x,function(){ bkiPut(id,l,true); }); }
function bkeSwap(i){ var x=BKE&&BKE.items[i]; if(!x) return; bkSwapOpen(BKE.id,x,function(){ bkeRender(); }); }
function bkiReset(id){ var b=bkGet(), it=bkItem(b,id); if(!it) return; delete it.ov; bkSave(b); renderLivre(true); toast('Recette d’origine reprise','ok'); }
function bkSide(){
  var el=document.getElementById('bk-side'); if(!el) return;
  var b=bkGet(), cats={}, order=[];
  bkSorted(b).forEach(function(it){ var c=bkCatOf(bkR(it.id)); if(!cats[c]){ cats[c]=0; order.push(c); } cats[c]++; });
  var subs=0; if(b.autoSubs!==false&&b.items.length){ try{ subs=bkWith(b,function(){ var x=bkExpand(b,bkSorted(b)).length-b.items.length; BK_AUTO={}; return x; }); }catch(e){} }
  el.innerHTML='<details class="re-sec" open><summary>Récapitulatif '+ic('chev-down')+'</summary><div class="be-rc">'+
    (order.length?order.map(function(c){ return '<div class="be-rr"><span class="be-rn">'+catDot(c)+esc(c)+'</span><b>'+cats[c]+'</b></div>'; }).join('')+
      (subs>0?'<div class="be-rr"><span class="be-rn">'+ic('sub')+'Sous-recettes ajoutées <small>sur leurs propres pages</small></span><b>'+subs+'</b></div>':'')+
      '<div class="be-rr tt"><span>Total</span><b>'+(b.items.length+Math.max(0,subs))+' fiche'+((b.items.length+subs)>1?'s':'')+'</b></div>'
      :'<div class="re-hint">Aucune recette pour l’instant.</div>')+'</div></details>'+
    '<details class="re-sec" open><summary>Exporter '+ic('chev-down')+'</summary><div class="be-acts">'+
      '<button class="re-add" onclick="bookBuild()"><span>PDF du livre</span>'+ic('pdf')+'</button>'+
      '<button class="re-add" onclick="bkTab(\'prev\')"><span>Aperçu</span>'+ic('eye')+'</button>'+
      (b.items.length?'<button class="re-add" onclick="bkClear()"><span>Vider le livre</span>'+ic('trash')+'</button>':'')+
    '</div></details>';
}
// aperçu : couverture, sommaire, puis les fiches telles qu’elles seront imprimées
function bkPrev(){
  var el=document.getElementById('bk-pane-prev'); if(!el) return;
  var b=bkGet(), items=bkSorted(b);
  if(!items.length){ el.innerHTML='<div class="re-card"><div class="re-empty-t">Ajoute des recettes pour voir l’aperçu du livre.</div></div>'; return; }
  var html='';
  try{ html=bkWith(b,function(){
    var all=bkExpand(b,items), toc='', last=null;
    all.forEach(function(it){ var r=bkR(it.id), c=bkCatOf(r); if(c!==last){ toc+='<div class="bkv-c">'+esc(c)+'</div>'; last=c; } toc+='<div class="bkv-l"><span>'+esc(r.name)+'</span><i></i></div>'; });
    var max=24, fiches=all.slice(0,max).map(function(it){ var r=bkR(it.id); return '<div class="bkv-p">'+ficheHTML(ficheData(r,it.m,true))+'</div>'; }).join('');
    BK_AUTO={};
    return '<div class="bkv-p bkv-cover"><div class="bkv-rule"></div><h1>'+esc(b.title||'Livre de recettes')+'</h1>'+(b.sub?'<p>'+esc(b.sub)+'</p>':'')+'<div class="bkv-rule"></div><small>'+all.length+' fiche'+(all.length>1?'s':'')+'</small></div>'+
      '<div class="bkv-p bkv-toc"><h2>Sommaire</h2>'+toc+'</div>'+fiches+(all.length>max?'<div class="re-empty-t">… et '+(all.length-max)+' autres fiches dans le PDF.</div>':'');
  }); }catch(e){ if(window.console) console.error(e); html='<div class="re-empty-t">Aperçu indisponible.</div>'; }
  el.innerHTML='<div class="bkv">'+html+'</div>';
}

// ── ajouter une recette : page Recettes en mode choix (comme le partage) ──
function bkModals(){
  if(document.getElementById('m-bkedit')) return;
  var d=document.createElement('div');
  d.innerHTML='<div class="ov" id="m-bkedit"><div class="modal wide bke-modal"><div class="m-grip"></div><div class="m-hdr"><h3 id="bke-title">Adapter pour le livre</h3><button class="m-x" onclick="closeMod(\'m-bkedit\')">'+ic('x')+'</button></div>'+
    '<div class="m-body" id="bke-body"></div><div class="m-foot" id="bke-foot"></div></div></div>';
  while(d.firstChild) document.body.appendChild(d.firstChild);
}
function bkAddOpen(){ bkStartPick(); }

// ── adapter une recette pour le livre (comme la modification de recette) ──
var BKE=null;
function bkEdit(id){
  var b=bkGet(), it=bkItem(b,id), r=bkR(id); if(!it||!r) return;
  bkModals();
  BKE={id:id,m:it.m||1,items:(it.ov?it.ov.items:r.items).map(function(x){ return Object.assign({},x); }),html:it.ov&&it.ov.notesHtml!=null?it.ov.notesHtml:rteHtmlOf(r),q:'',had:!!it.ov};
  document.getElementById('bke-title').textContent='Adapter « '+r.name+' » pour le livre';
  document.getElementById('bke-body').innerHTML=
    '<div class="ustrip">'+ic('info')+' Ces changements ne servent que dans le livre : ta recette d’origine ne bouge pas.</div>'+
    '<div class="re-card bke-card"><div class="re-card-t">Composition <span class="re-card-a"><label class="bk-m bke-mult" title="Multiplicateur">×<input type="text" inputmode="decimal" id="bke-m" value="'+esc(String(BKE.m).replace('.',','))+'" aria-label="Multiplicateur"></label></span></div>'+
      '<div id="bke-items"></div>'+
      '<div class="bke-add"><label class="cn-srch bp-srch">'+'<input id="bke-q" type="search" placeholder="Ajouter un ingrédient ou une sous-recette…" oninput="BKE.q=this.value;bkeSug()" autocomplete="off">'+ic('search')+'</label><div id="bke-sug" class="bke-sug"></div></div>'+
      '<div class="bke-tot" id="bke-tot"></div></div>'+
    '<div class="re-card"><div class="re-card-t">Procédé / méthode</div><textarea class="fi re-notes" id="bke-notes" placeholder="Pétrissage, pointage, façonnage, cuisson…"></textarea></div>';
  document.getElementById('bke-foot').innerHTML=(BKE.had?'<button class="btn btn-ghost" onclick="bkeReset()">'+ic('refresh')+' Reprendre la recette d’origine</button>':'')+
    '<button class="btn btn-ghost" onclick="closeMod(\'m-bkedit\')">Annuler</button><button class="btn btn-gold" onclick="bkeSave()">'+ic('check')+' Enregistrer pour le livre</button>';
  rteMount('bke-notes',{label:'Procédé dans le livre'}); rteSet('bke-notes-rte',BKE.html);
  bkeRender(); openMod('m-bkedit');
}
function bkeUnits(ing,cur){
  var u=String((ing&&ing.unit)||'kg'), list=[];
  function add(x){ if(x&&list.indexOf(x)<0) list.push(x); }
  add(cur);
  if(/^(l|ml|cl)$/i.test(u)){ ['ml','cl','L','g','kg'].forEach(add); }
  else if(isCountable(u)){ add(u); if(ing&&ing.unitWeight>0){ add('g'); add('kg'); } }
  else ['g','kg'].forEach(add);
  return list;
}
function bkeRender(){
  var el=document.getElementById('bke-items'); if(!el) return;
  if(!BKE.items.length){ el.innerHTML='<div class="re-empty-t">Aucun ingrédient : ajoute-en avec la recherche ci-dessous.</div>'; bkeTot(); return; }
  el.innerHTML='<div class="ilist"><div class="ihd"><span>Composant</span><span style="text-align:right">Qté</span><span>Unt</span><span></span></div>'+BKE.items.map(function(it,i){
    if(it.type==='ingredient'){
      var g=bkIng(it.refId);
      return '<div class="ir"><div class="ir-sw"><div class="ir-n">'+esc(g?g.name:'?')+'</div><div class="ir-c">Ingrédient · <button type="button" class="lnk bk-chg" onclick="bkeSwap('+i+')" title="Remplacer par un autre ingrédient ou une sous-recette">'+ic('refresh')+' Changer</button></div></div>'+
        '<input class="iq" type="text" inputmode="decimal" value="'+(Number(it.qty)>0?String(it.qty).replace('.',','):'')+'" placeholder="Q.S." aria-label="Quantité de '+esc(g?g.name:'')+'" onchange="bkeQty('+i+',this.value)">'+
        '<select class="iu bke-u" aria-label="Unité" onchange="bkeUnit('+i+',this.value)">'+bkeUnits(g,it.unit).map(function(u){ return '<option'+(u===it.unit?' selected':'')+'>'+esc(u)+'</option>'; }).join('')+'</select>'+
        '<button class="idel" onclick="bkeDel('+i+')" aria-label="Retirer">✕</button></div>';
    }
    var s=bkR(it.refId), sb=s?recWeight(s.id):0, kg=sb*(Number(it.qty)||0);
    return '<div class="ir" style="border-left:2px solid var(--bl)"><div class="ir-sw"><div class="ir-n" style="color:var(--bl)">⊛ '+esc(s?s.name:'?')+'</div><div class="ir-c">Sous-recette · ×'+fQ(Math.round((Number(it.qty)||0)*100)/100)+' · <button type="button" class="lnk bk-chg" onclick="bkeSwap('+i+')" title="Remplacer par un autre ingrédient ou une sous-recette">'+ic('refresh')+' Changer</button></div></div>'+
      '<input class="iq" type="text" inputmode="decimal" value="'+(kg>0?String(Math.round(kg*1000)/1000).replace('.',','):'')+'" placeholder="Q.S." aria-label="Poids de '+esc(s?s.name:'')+' en kg" onchange="bkeSubKg('+i+',this.value)">'+
      '<div class="iu">kg</div><button class="idel" onclick="bkeDel('+i+')" aria-label="Retirer">✕</button></div>';
  }).join('')+'</div>';
  bkeTot();
}
function bkeTot(){
  var t=document.getElementById('bke-tot'); if(!t) return;
  var tmp={id:BKE.id,name:'',items:BKE.items}, w=0, c=0, orig=recipes;
  recipes=orig.map(function(r){ return r.id===BKE.id?Object.assign({},r,{items:BKE.items}):r; });
  try{ w=recWeight(BKE.id); c=recCost(BKE.id); }catch(e){} finally{ recipes=orig; }
  t.innerHTML='<span>Poids <b>'+fQtyNice(w)+'</b></span><span>Coût matière <b>'+fEur(c)+'</b></span>';
}
function bkeQty(i,v){ var it=BKE.items[i]; if(!it) return; it.qty=Math.max(0,parseFloat(String(v).replace(',','.'))||0); bkeTot(); }
function bkeUnit(i,u){ var it=BKE.items[i]; if(it){ it.unit=u; bkeTot(); } }
function bkeSubKg(i,v){ var it=BKE.items[i]; if(!it) return; var b=recWeight(it.refId), kg=parseFloat(String(v).replace(',','.'))||0; it.qty=b>0?Math.round(kg/b*1e6)/1e6:kg; bkeRender(); }
function bkeDel(i){ BKE.items.splice(i,1); bkeRender(); }
function bkeSug(){
  var el=document.getElementById('bke-sug'); if(!el) return; var q=normTxt(BKE.q||'');
  if(!q){ el.innerHTML=''; return; }
  var ings=ingredients.filter(function(g){ return normTxt(g.name).indexOf(q)>=0; }).slice(0,8);
  var recs=recipes.filter(function(r){ return r.id!==BKE.id&&normTxt(r.name).indexOf(q)>=0; }).slice(0,5);
  el.innerHTML=ings.map(function(g){ return '<button type="button" onclick="bkeAdd(\'ingredient\',\''+g.id+'\')">'+ic('box')+'<span>'+esc(g.name)+'</span><small>Ingrédient</small></button>'; }).join('')+
    recs.map(function(r){ return '<button type="button" onclick="bkeAdd(\'recipe\',\''+r.id+'\')">'+ic('sub')+'<span>'+esc(r.name)+'</span><small>Sous-recette</small></button>'; }).join('')||'<div class="pk-none">Rien trouvé</div>';
}
function bkeAdd(type,id){
  if(type==='ingredient'){ var g=ingredients.find(function(x){ return x.id===id; }), u=String((g&&g.unit)||'kg'); BKE.items.push({type:'ingredient',refId:id,qty:0,unit:/^(l|ml|cl)$/i.test(u)?'ml':(isCountable(u)?u:'g')}); }
  else BKE.items.push({type:'recipe',refId:id,qty:1,unit:'x'});
  BKE.q=''; var q=document.getElementById('bke-q'); if(q) q.value=''; bkeSug(); bkeRender();
  var ins=document.querySelectorAll('#bke-items .iq'); if(ins.length) ins[ins.length-1].focus();
}
function bkeSave(){
  var b=bkGet(), it=bkItem(b,BKE.id), r=bkR(BKE.id); if(!it||!r) return;
  var m=parseFloat(String((document.getElementById('bke-m')||{}).value||'1').replace(',','.')); it.m=m>0?m:1;
  var html=rteGet('bke-notes-rte'), same=JSON.stringify(BKE.items.map(function(x){ return [x.type,x.refId,+x.qty||0,x.unit]; }))===JSON.stringify(r.items.map(function(x){ return [x.type,x.refId,+x.qty||0,x.unit]; }))&&rteToText(html)===rteToText(rteHtmlOf(r))&&html===rteHtmlOf(r);
  if(same) delete it.ov; else it.ov={items:BKE.items.map(function(x){ return {type:x.type,refId:x.refId,qty:+x.qty||0,unit:x.unit}; }),notesHtml:html,notes:rteToText(html)};
  bkSave(b); closeMod('m-bkedit'); renderLivre(true);
  toast(same?'Recette identique à l’originale':'Recette adaptée pour le livre','ok');
}
function bkeReset(){
  var b=bkGet(), it=bkItem(b,BKE.id); if(!it) return; delete it.ov; bkSave(b); closeMod('m-bkedit'); renderLivre(true); toast('Recette d’origine reprise','ok');
}

// ── choisir des recettes dans la page Recettes (même recherche, filtres, vignettes) ──
// Sert au livre, au partage et aux bons : BKP.kind = 'book' | 'share' | 'bon'.
var BKP={on:false,kind:'book'};
function bkpBonRecs(){ return (typeof curBon!=='undefined'&&curBon&&curBon.recs)||[]; }
function bkpHas(id){ if(BKP.kind==='share') return !!(window.PICK&&PICK.sel&&PICK.sel[id]); if(BKP.kind==='bon') return bkpBonRecs().some(function(x){ return x.id===id; }); return bkHas(bkGet(),id); }
function bkpSet(id,on){
  if(BKP.kind==='share'){ PICK.sel[id]=on?1:0; return; }
  var b=bkGet(), has=bkHas(b,id); if(on&&!has) b.items.push({id:id,m:1}); if(!on&&has) b.items=b.items.filter(function(x){ return x.id!==id; }); bkSave(b);
}
function bkpCount(){ if(BKP.kind==='share') return recipes.filter(function(r){ return PICK.sel[r.id]; }).length; if(BKP.kind==='bon') return bkpBonRecs().length; return bkGet().items.length; }
function bkpLabel(n){ if(BKP.kind==='bon') return n?n+' recette'+(n>1?'s':'')+' dans le bon':'Touche une recette pour l’ajouter au bon'; return n+' recette'+(n>1?'s':'')+(BKP.kind==='share'?' à partager'+(PICK.folder?' dans « '+PICK.folder+' »':''):' dans le livre'); }
// bon : on choisit la recette dans la page Recettes, puis le poids et les ingrédients dans la fenêtre habituelle
function beStartPick(){ if(typeof curBon==='undefined'||!curBon) return; BKP.on=true; BKP.kind='bon'; var m=document.getElementById('m-rec'); if(m&&m.classList.contains('show')) closeMod('m-rec'); goPage('recettes'); }
function bkStartPick(){ BKP.on=true; BKP.kind='book'; var m=document.getElementById('m-bkrec'); if(m) closeMod('m-bkrec'); goPage('recettes'); }
function bkPickDone(){
  var k=BKP.kind; BKP.on=false; document.body.classList.remove('bk-pick'); bkPickBar();
  if(k==='share'){ goPage('partage'); if(typeof partPickBack==='function') partPickBack(); return; }
  if(k==='bon'){ try{ renderRec(); }catch(e){} goPage('edit'); try{ renderItems(); }catch(e){} return; }
  try{ renderRec(); }catch(e){} BK.keep=1; goPage('livre'); BK.keep=0;
}
function bkPick(id){
  if(BKP.kind==='bon'){ openMod('m-rec'); pickRec(id); var mo=document.getElementById('rec-more'); if(mo) mo.style.display='none'; return; }
  bkpSet(id,!bkpHas(id)); bkPickSync(id);
}
function bkPickSync(id){
  document.querySelectorAll('[data-bk]').forEach(function(e){ if(!id||e.getAttribute('data-bk')===id) e.classList.toggle('bk-s',bkpHas(e.getAttribute('data-bk'))); });
  var n=document.getElementById('bkp-n'); if(n) n.textContent=bkpLabel(bkpCount());
  var all=document.getElementById('bkp-all'); if(all) all.style.display=BKP.kind==='bon'?'none':''; if(all&&BKP.kind!=='bon'){ var l=recFiltered(true); var allOn=l.length&&l.every(function(r){ return bkpHas(r.id); }); all.textContent=allOn?'Tout désélectionner ('+l.length+')':'Tout sélectionner ('+l.length+')'; }
}
function bkPickAll(){
  var l=recFiltered(true), allOn=l.length&&l.every(function(r){ return bkpHas(r.id); });
  l.forEach(function(r){ bkpSet(r.id,!allOn); });
  bkPickSync();
}
function bkPickBar(){
  var bar=document.getElementById('bkp-bar');
  if(!BKP.on){ if(bar) bar.remove(); document.body.classList.remove('bk-pick'); return; }
  document.body.classList.add('bk-pick');
  if(!bar){
    bar=document.createElement('div'); bar.id='bkp-bar'; bar.className='bkp-bar';
    bar.innerHTML='<div class="bkp-t">'+ic(BKP.kind==='share'?'users':(BKP.kind==='bon'?'bon':'book'))+'<span id="bkp-n"></span></div><button type="button" class="btn btn-ghost btn-sm" id="bkp-all" onclick="bkPickAll()"></button><button type="button" class="btn btn-gold btn-sm" onclick="bkPickDone()">'+ic('check')+' Terminer</button>';
    document.body.appendChild(bar);
  }
  bkPickSync();
}
// vignettes et lignes de la page Recettes : en mode choix, toucher = cocher
['recTile','recRow'].forEach(function(fn){
  var orig=window[fn]; if(typeof orig!=='function') return;
  window[fn]=function(r){
    var h=orig.apply(this,arguments); if(!BKP.on) return h;
    h=h.replace(/openEditRec\('/g,"bkPick('").replace(/quickAddRec\('/g,"bkPick('");
    h=h.replace(/^<div class="(rt|rc)"/,function(m,c){ return '<div class="'+c+(bkpHas(r.id)?' bk-s':'')+'" data-bk="'+r.id+'" onclick="bkPick(\''+r.id+'\')"'; });
    return h.replace('>','><span class="bk-ckm" aria-hidden="true">'+ic('check')+'</span>');
  };
});
(function(){
  var _r=renderRec;
  renderRec=function(){ var r=_r.apply(this,arguments); try{ bkPickBar(); }catch(e){} return r; };
})();
// bon : après chaque ajout on reste dans la page Recettes (coche mise à jour)
(function(){
  var _c=confirmRec;
  confirmRec=function(){ var r=_c.apply(this,arguments); if(BKP.on&&BKP.kind==='bon'){ try{ bkPickSync(); }catch(e){} } return r; };
  var _u=unpickRec;
  unpickRec=function(){ if(BKP.on&&BKP.kind==='bon'){ closeMod('m-rec'); return; } return _u.apply(this,arguments); };
})();

// ── PDF ──
// ajoute (sur leurs propres pages) les sous-recettes utilisées par les recettes choisies
var BK_AUTO={};
function bkExpand(b,items){
  BK_AUTO={};
  if(b.autoSubs===false) return items;
  var have={}, out=items.slice();
  items.forEach(function(x){ have[x.id]=1; });
  function walk(id,d){
    var r=recipes.find(function(y){ return y.id===id; }); if(!r||d>5) return;
    (r.items||[]).forEach(function(it){
      if(it.type==='ingredient') return;
      if(!have[it.refId]&&recipes.some(function(y){ return y.id===it.refId; })){ have[it.refId]=1; BK_AUTO[it.refId]=1; out.push({id:it.refId,m:1}); }
      walk(it.refId,d+1);
    });
  }
  items.forEach(function(x){ walk(x.id,0); });
  return bkSortList(out);
}
window.bookBuild=function(){
  var b=bkGet(), items=bkSorted(b);
  if(!items.length){ toast('Choisis au moins une recette','err'); return; }
  toast('Création du livre…','info');
  // recettes adaptées pour le livre : ingrédients et procédé propres au livre
  withJsPDF(function(){ try{ bkWith(b,function(){ bkPdf(b,bkExpand(b,items)); }); }catch(e){ if(window.console) console.error(e); toast('Impossible de créer le livre','err'); } BK_AUTO={}; });
};
function bkPdf(b,items){
  // BK_AUTO est déjà rempli par bkExpand (catégorie « Sous-recettes »)
  var doc=new window.jspdf.jsPDF({orientation:'portrait',unit:'pt',format:'a4'}), F=bonPdfFonts(doc);
  var PW=595.28, PH=841.89, BAND=539, L=42, R=505, BOTTOM=786, P=bonPal(), INK=P.ink, BEIGE=P.beige, GREY=[110,110,110], GREEN=[30,150,85];
  function rgb(fn,c){ doc[fn](c[0],c[1],c[2]); }
  function chrome(label,num){
    rgb('setFillColor',BEIGE); doc.rect(BAND,0,PW-BAND,PH,'F');
    if(BON_CREST) try{ doc.addImage(BON_CREST,'PNG',BAND+(PW-BAND-44)/2,18,44,44*219/260,'bonCrest','FAST'); }catch(e){}
    if(BON_CMARK) try{ doc.addImage(BON_CMARK,'PNG',BAND+(PW-BAND-36)/2,63,36,36,'bonCmark','FAST'); }catch(e){}
    if(label){ doc.setFont(F,'bold'); doc.setFontSize(24); rgb('setTextColor',INK); var w=doc.getTextWidth(label); doc.text(label,BAND+(PW-BAND)/2+8,PH/2+w/2,{angle:90}); }
    if(num){ doc.setFont(F,'normal'); doc.setFontSize(9); rgb('setTextColor',GREY); doc.text(String(num),R,PH-30,{align:'right'}); }
  }
  var title=(b.title||'').trim()||'Livre de recettes', sub=(b.sub||'').trim();
  // ① couverture
  chrome('',0);
  var cx=(L+R)/2, y=PH/2-90;
  rgb('setDrawColor',INK); doc.setLineWidth(2); doc.line(L+40,y,R-40,y); y+=58;
  doc.setFont(F,'bold'); doc.setFontSize(32); rgb('setTextColor',INK);
  doc.splitTextToSize(title,R-L-60).forEach(function(t){ doc.text(t,cx,y,{align:'center'}); y+=42; });
  if(sub){ y-=4; doc.setFont(F,'normal'); doc.setFontSize(13); rgb('setTextColor',GREY); doc.splitTextToSize(sub,R-L-80).forEach(function(t){ doc.text(t,cx,y,{align:'center'}); y+=19; }); }
  y+=14; doc.setLineWidth(2); rgb('setDrawColor',INK); doc.line(L+40,y,R-40,y);
  var who=''; try{ who=(loadProfile().name||'').trim(); }catch(e){}
  doc.setFont(F,'normal'); doc.setFontSize(10); rgb('setTextColor',GREY);
  doc.text(items.length+' recette'+(items.length>1?'s':'')+(who?' · '+who:'')+' · '+fDate(new Date().toISOString().slice(0,10)),cx,PH-70,{align:'center'});
  // ② sommaire : on réserve les pages, on les remplit une fois les numéros connus
  var recs=items.map(function(it){ return {it:it,r:bkR(it.id)}; });
  var lines=[], lastCat=null;
  recs.forEach(function(o){ var c=bkCatOf(o.r); if(c!==lastCat){ lines.push({cat:c}); lastCat=c; } lines.push({rec:o}); });
  var TOP=118, perPage=[], yy=TOP, pg=[];
  lines.forEach(function(l){
    var h=l.cat?30:19; if(yy+h>BOTTOM){ perPage.push(pg); pg=[]; yy=TOP; } pg.push(l); yy+=h;
  });
  perPage.push(pg);
  var tocFirst=doc.getNumberOfPages()+1;
  perPage.forEach(function(){ doc.addPage(); });
  // ③ fiches
  var pageOf={};
  fichePagesDraw(doc,F,items,function(rec,pn){ pageOf[rec.id]=pn; },true);
  // ④ remplissage du sommaire
  perPage.forEach(function(pgl,i){
    var pn=tocFirst+i; doc.setPage(pn); chrome('SOMMAIRE',pn);
    var y=60; doc.setFont(F,'bold'); doc.setFontSize(22); rgb('setTextColor',INK); doc.text(i?'Sommaire (suite)':'Sommaire',cx,y,{align:'center'});
    y=TOP-18; rgb('setDrawColor',INK); doc.setLineWidth(1.6); doc.line(L,y,R,y); y=TOP;
    pgl.forEach(function(l){
      if(l.cat){ y+=14; doc.setFont(F,'bold'); doc.setFontSize(10.5); rgb('setTextColor',GREEN); doc.text(l.cat.toUpperCase(),L,y); y+=16; return; }
      var r=l.rec.r, p=String(pageOf[r.id]||''), name=r.name;
      doc.setFont(F,'normal'); doc.setFontSize(10.5); rgb('setTextColor',INK);
      var maxW=R-L-70; while(name.length>3&&doc.getTextWidth(name)>maxW) name=name.slice(0,-2);
      if(name!==r.name) name=name.replace(/\s+$/,'')+'…';
      doc.text(name,L+10,y); var nw=doc.getTextWidth(name);
      doc.setFont(F,'bold'); doc.text(p,R,y,{align:'right'});
      try{ doc.setLineDashPattern([1,2.2],0); rgb('setDrawColor',[160,160,160]); doc.setLineWidth(.6); doc.line(L+10+nw+6,y-1.5,R-doc.getTextWidth(p)-6,y-1.5); doc.setLineDashPattern([],0); }catch(e){}
      try{ doc.link(L,y-11,R-L,15,{pageNumber:pageOf[r.id]}); }catch(e){}
      y+=19;
    });
  });
  doc.save((title.replace(/[^a-z0-9]/gi,'_')||'livre')+'.pdf');
  toast('Livre créé : '+items.length+' recette'+(items.length>1?'s':''),'ok');
}

// ── navigation (administrateurs) ──
function bkNav(){
  var on=bkAdm();
  ['nav-livre','bk-m-btn','bn-livre'].forEach(function(id){ var e=document.getElementById(id); if(e) e.style.display=on?'':'none'; });
  var n=document.getElementById('bk-hd-n'); if(n){ var c=bkAll().length; n.textContent=c?String(c):''; n.style.display=c?'flex':'none'; }
}
(function(){
  var _g=goPage;
  goPage=function(p){
    if(p==='livre'&&!bkAdm()){ toast('Livres : demande l’accès à un administrateur','err'); p='home'; }
    if(p==='livre'&&CUR!=='livre'&&!BK.keep) BK.cur=null;
    var home=BKP.kind==='share'?'partage':(BKP.kind==='bon'?'edit':'livre');
    if(BKP.on&&p!=='recettes'&&p!==home){ BKP.on=false; bkPickBar(); try{ renderRec(); }catch(e){} }
    if(BKP.on&&p===home){ BKP.on=false; bkPickBar(); }
    var r=_g.apply(this,arguments);
    if(p==='livre'&&BK.cur) document.documentElement.classList.add('re-full');
    ['nav-livre','bn-livre'].forEach(function(id){ var e=document.getElementById(id); if(e) e.classList.toggle('on',p==='livre'); });
    var pg=document.getElementById('p-livre'); if(pg) pg.style.display=p==='livre'?'block':'none';
    if(p==='livre'){
      renderLivre(); bkTop();
    }
    if(p==='recettes'&&BKP.on){ try{ renderRec(); }catch(e){} }
    bkNav();
    return r;
  };
  setInterval(bkNav,2500);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bkNav); else bkNav();
})();
