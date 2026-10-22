// ══ CARNET DE RECETTES ════════════════════════════════════════
// Liste : recherche, lettres A→Z, filtres en menus déroulants, tri.
var RF={letter:'',alg:[],tags:[],ing:[],date:'',sort:'az'}, RF_OPEN='', RF_IQ='';
(function(){ try{ var s=LS.getItem('v4_recsort'); if(s) RF.sort=s; }catch(e){} })();
var RF_SORTS=[['az','Nom : A → Z'],['za','Nom : Z → A'],['new','Plus récentes'],['old','Plus anciennes'],['cheap','Coût croissant'],['dear','Coût décroissant']];
var RF_DATES=[['','Toutes les dates'],['7','Modifiées cette semaine'],['30','Modifiées ce mois-ci'],['365','Modifiées cette année']];

function recLetter(r){ var c=normTxt(r.name||'').replace(/^[^a-z0-9]+/,'').charAt(0).toUpperCase(); return /[A-Z]/.test(c)?c:'#'; }
function recDate(r){ return r.updatedAt||r.createdAt||''; }
function recCostOf(r){ try{ return recCost(r.id)||0; }catch(e){ return 0; } }
function recAlgKeys(r){ try{ return allergensOfFlat(flatten(r.id)).keys; }catch(e){ return []; } }
function recIngIds(r){ var o={}; try{ flatten(r.id).forEach(function(f){ o[f.ingId]=1; }); }catch(e){} return o; }
function allRecTags(){
  var n={}; recipes.forEach(function(r){ (r.tags||[]).forEach(function(t){ n[t]=(n[t]||0)+1; }); });
  return Object.keys(n).sort(function(a,b){ return a.localeCompare(b,'fr'); }).map(function(t){ return {t:t,n:n[t]}; });
}
function recFiltered(withLetter){
  var q=normTxt((document.getElementById('rec-srch')||{}).value||'').trim();
  var list=activeSub?recipes.filter(function(r){return r.sub===activeSub;}):(activeCat?recipes.filter(function(r){return r.cat===activeCat;}):recipes.slice());
  if(q) list=list.filter(function(r){ return normTxt(r.name).indexOf(q)>=0||normTxt(r.cat).indexOf(q)>=0||(r.tags||[]).some(function(t){ return normTxt(t).indexOf(q)>=0; }); });
  if(RF.tags.length) list=list.filter(function(r){ return (r.tags||[]).some(function(t){ return RF.tags.indexOf(t)>=0; }); });
  if(RF.alg.length) list=list.filter(function(r){ var k=recAlgKeys(r); return !RF.alg.some(function(a){ return k.indexOf(a)>=0; }); });
  if(RF.ing.length) list=list.filter(function(r){ var s=recIngIds(r); return RF.ing.every(function(id){ return s[id]; }); });
  if(RF.date){ var lim=Date.now()-Number(RF.date)*864e5; list=list.filter(function(r){ var d=Date.parse(recDate(r)); return d&&d>=lim; }); }
  if(withLetter&&RF.letter) list=list.filter(function(r){ return recLetter(r)===RF.letter; });
  var s=RF.sort, cmpN=function(a,b){ return String(a.name).localeCompare(String(b.name),'fr',{sensitivity:'base'}); };
  if(s==='za') list.sort(function(a,b){ return cmpN(b,a); });
  else if(s==='new') list.sort(function(a,b){ return recDate(b).localeCompare(recDate(a)); });
  else if(s==='old') list.sort(function(a,b){ return recDate(a).localeCompare(recDate(b)); });
  else if(s==='cheap'||s==='dear'){ var c={}; list.forEach(function(r){ c[r.id]=recCostOf(r); }); list.sort(function(a,b){ return s==='cheap'?c[a.id]-c[b.id]:c[b.id]-c[a.id]; }); }
  else list.sort(cmpN);
  return list;
}
function rfActiveCount(){ return (activeCat||activeSub?1:0)+RF.alg.length+RF.tags.length+RF.ing.length+(RF.date?1:0)+(RF.letter?1:0)+(((document.getElementById('rec-srch')||{}).value||'').trim()?1:0); }

function renderRec(){
  var base=recFiltered(false), list=recFiltered(true);
  // lettres
  var has={}; base.forEach(function(r){ has[recLetter(r)]=1; });
  var az=document.getElementById('rec-az');
  if(az) az.innerHTML='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(function(l){
      return '<button class="cn-l'+(RF.letter===l?' on':'')+(has[l]?'':' off')+'"'+(has[l]||RF.letter===l?'':' disabled')+' onclick="cnLetter(\''+l+'\')">'+l+'</button>'; }).join('')+
    (has['#']?'<button class="cn-l'+(RF.letter==='#'?' on':'')+'" onclick="cnLetter(\'#\')" title="Autres">#</button>':'')+
    '<button class="cn-l cn-l0'+(RF.letter?'':' on')+'" onclick="cnLetter(\'\')" title="Toutes les lettres">'+ic('refresh')+'</button>';
  var rc=document.getElementById('rec-count');
  if(rc) rc.innerHTML='Mes recettes <b>('+(list.length===recipes.length?list.length:list.length+' / '+recipes.length)+')</b>';
  renderRecFilters(); renderRecActive();
  var tog=document.getElementById('rv-tog'), view=recView(), nxt=RV_NEXT[view];
  if(tog){ tog.innerHTML=ic(nxt==='list'?'list':'grid')+(nxt==='big'?'<i class="cn-plus">+</i>':''); tog.title='Afficher : '+RV_LBL[nxt]; }
  var grid=document.getElementById('rec-grid'), emp=document.getElementById('rec-empty');
  if(!list.length){
    grid.innerHTML=''; emp.style.display='';
    var none=!recipes.length;
    document.getElementById('rec-empty-t').textContent=none?'Aucune recette pour l’instant.':'Aucun résultat trouvé.';
    var eb=document.getElementById('rec-empty-b');
    eb.innerHTML=none?ic('plus-circle')+' Créer une recette':'Effacer les filtres';
    eb.onclick=none?function(){ openNewRec(); }:cnReset;
    eb.style.display=(none||rfActiveCount())?'':'none';
    return;
  }
  emp.style.display='none';
  grid.classList.toggle('tiles',view!=='list'); grid.classList.toggle('big',view==='big');
  cnPaint(grid,list,view==='list'?recRow:recTile);
}
// vues : vignettes → grandes vignettes → liste
var RV_NEXT={grid:'big',big:'list',list:'grid'}, RV_LBL={grid:'vignettes',big:'grandes vignettes',list:'liste détaillée'};
function recView(){ var v=LS.getItem('v4_recview'); return v==='list'||v==='big'?v:'grid'; }
function cnCycleView(){ setRecView(RV_NEXT[recView()]); }
// grandes listes : affichage par paquets, la suite arrive en faisant défiler
var CN_CHUNK=40, _cnObs=null;
function cnPaint(grid,list,fn){
  grid._rest=list.slice(CN_CHUNK); grid._fn=fn;
  grid.innerHTML=list.slice(0,CN_CHUNK).map(fn).join('');
  cnSentinel(grid);
}
function cnPaintMore(grid){
  if(!grid||!grid._rest||!grid._rest.length) return false;
  var s=grid.querySelector('.cn-more'); if(s) s.remove();
  var part=grid._rest.splice(0,CN_CHUNK);
  grid.insertAdjacentHTML('beforeend',part.map(grid._fn).join(''));
  cnSentinel(grid); return true;
}
function cnSentinel(grid){
  if(!grid._rest||!grid._rest.length) return;
  grid.insertAdjacentHTML('beforeend','<div class="cn-more"><div class="inv-spin"></div></div>');
  var s=grid.querySelector('.cn-more');
  if('IntersectionObserver' in window){
    if(_cnObs) _cnObs.disconnect();
    _cnObs=new IntersectionObserver(function(es){ if(es.some(function(e){ return e.isIntersecting; })) cnPaintMore(grid); },{root:document.getElementById('scroll'),rootMargin:'600px'});
    _cnObs.observe(s);
  } else { while(cnPaintMore(grid)){} }
}
// recherche : on attend la fin de la frappe (120 ms) avant de recalculer
var _cnSearchT=null;
function cnSearchIn(){ clearTimeout(_cnSearchT); _cnSearchT=setTimeout(renderRec,120); }

// ── filtres ──
function rfPill(key,label,on,pop){
  return '<div class="cn-f'+(RF_OPEN===key?' open':'')+'"><button class="cn-fb'+(on?' on':'')+'" onclick="cnOpen(event,\''+key+'\')">'+label+ic('chev-down')+'</button>'+
    (RF_OPEN===key?'<div class="cn-pop" onclick="event.stopPropagation()">'+pop+'</div>':'')+'</div>';
}
function rfOpt(on,label,click,multi,count){
  return '<button class="cn-o'+(on?' on':'')+'" onclick="'+click+'"><span class="cn-ck'+(multi?' sq':'')+'">'+(on?ic('check'):'')+'</span><span class="cn-ot">'+label+'</span>'+(count!=null?'<span class="cn-on">'+count+'</span>':'')+'</button>';
}
function renderRecFilters(){
  var box=document.getElementById('rec-filters'); if(!box) return;
  var op=document.querySelector('.cn-pop'), keep=op?{k:op.getAttribute('data-k'),a:op.scrollTop,b:(op.querySelector('.cn-ol')||{}).scrollTop||0}:null;
  var sl=box.scrollLeft; cnSheetRm();
  // catégories (et leurs dossiers)
  var catOrder=loadCats('rec'), cnt={};
  recipes.forEach(function(r){ cnt[r.cat]=(cnt[r.cat]||0)+1; });
  var cats=Object.keys(cnt).sort(function(a,b){ var ia=catOrder.indexOf(a), ib=catOrder.indexOf(b); if(ia<0) ia=999; if(ib<0) ib=999; return ia-ib||String(a).localeCompare(String(b),'fr'); });
  var subsUsed={}; recipes.forEach(function(r){ if(r.sub){ var s=subById('rec',r.sub); if(s){ (subsUsed[r.cat]=subsUsed[r.cat]||{})[s.id]={s:s,n:((subsUsed[r.cat]||{})[s.id]||{n:0}).n+1}; } } });
  var catPop=rfOpt(!activeCat&&!activeSub,'Toutes les catégories','cnCat(\'\')',false,recipes.length)+cats.map(function(c){
    var subs=subsUsed[c]?Object.keys(subsUsed[c]).map(function(k){ return subsUsed[c][k]; }).sort(function(a,b){ return a.s.name.localeCompare(b.s.name,'fr'); }):[];
    return rfOpt(activeCat===c,catDot(c)+esc(c||'Sans catégorie'),'cnCat(\''+escJS(c)+'\')',false,cnt[c])+
      subs.map(function(x){ return '<div class="cn-sub">'+rfOpt(activeSub===x.s.id,ic('folder')+' '+esc(x.s.name),'cnSub(\''+x.s.id+'\')',false,x.n)+'</div>'; }).join('');
  }).join('');
  var catLbl=activeSub?(subLabel('rec',activeSub)||'Dossier'):(activeCat||'Catégories');
  // allergènes : « sans … »
  var algPop='<div class="cn-ph">Masquer les recettes contenant :</div>'+ALLERGENS.map(function(a){ return rfOpt(RF.alg.indexOf(a.k)>=0,esc(a.n),'cnTog(\'alg\',\''+a.k+'\')',true); }).join('');
  var algLbl=RF.alg.length===1?'Sans '+algLabel(RF.alg[0]).toLowerCase():(RF.alg.length?'Allergènes · '+RF.alg.length:'Allergènes');
  // tags
  var tags=allRecTags();
  var tagPop=tags.length?tags.map(function(t){ return rfOpt(RF.tags.indexOf(t.t)>=0,esc(t.t),'cnTog(\'tags\',\''+escJS(t.t)+'\')',true,t.n); }).join(''):'<div class="cn-ph">Aucun tag pour l’instant. Ajoute-en depuis une recette (panneau de droite).</div>';
  var tagLbl=RF.tags.length===1?RF.tags[0]:(RF.tags.length?'Tags · '+RF.tags.length:'Tags');
  // ingrédients utilisés
  var used={}; recipes.forEach(function(r){ var s=recIngIds(r); Object.keys(s).forEach(function(id){ used[id]=(used[id]||0)+1; }); });
  var ings=ingredients.filter(function(i){ return used[i.id]; }).sort(function(a,b){ return a.name.localeCompare(b.name,'fr'); });
  var ingPop='<label class="cn-psrch">'+ic('search')+'<input type="search" placeholder="Chercher un ingrédient…" value="'+esc(RF_IQ)+'" oninput="cnIngSearch(this.value)" autocomplete="off"></label><div class="cn-ph">Recettes qui contiennent :</div><div class="cn-ol" id="cn-ing-ol">'+
    (ings.length?ings.map(function(i){ return '<div class="cn-oi" data-n="'+esc(normTxt(i.name))+'">'+rfOpt(RF.ing.indexOf(i.id)>=0,esc(i.name),'cnTog(\'ing\',\''+i.id+'\')',true,used[i.id])+'</div>'; }).join(''):'<div class="cn-ph">Aucun ingrédient utilisé.</div>')+'</div>';
  var ingLbl=RF.ing.length===1?((ingredients.find(function(i){ return i.id===RF.ing[0]; })||{}).name||'Ingrédient'):(RF.ing.length?'Ingrédients · '+RF.ing.length:'Ingrédients');
  var datePop=RF_DATES.map(function(d){ return rfOpt(RF.date===d[0],d[1],'cnSet(\'date\',\''+d[0]+'\')'); }).join('');
  var dateLbl=RF.date?RF_DATES.filter(function(d){ return d[0]===RF.date; })[0][1].replace('Modifiées ',''):'Dates';
  var sortPop=RF_SORTS.map(function(d){ return rfOpt(RF.sort===d[0],d[1],'cnSet(\'sort\',\''+d[0]+'\')'); }).join('');
  var sortLbl=RF_SORTS.filter(function(d){ return d[0]===RF.sort; })[0]; sortLbl=sortLbl?sortLbl[1]:'Trier';
  box.innerHTML=
    rfPill('cat',esc(catLbl),!!(activeCat||activeSub),catPop)+
    rfPill('alg',esc(algLbl),RF.alg.length>0,algPop)+
    rfPill('tags',esc(tagLbl),RF.tags.length>0,tagPop)+
    rfPill('ing',esc(ingLbl),RF.ing.length>0,ingPop)+
    rfPill('date',esc(dateLbl),!!RF.date,datePop)+
    rfPill('sort',esc(sortLbl),false,sortPop);
  box.scrollLeft=sl;
  var pop=box.querySelector('.cn-pop');
  if(pop){
    pop.setAttribute('data-k',RF_OPEN);
    if(cnMobile()){
      // téléphone : vraie feuille du bas, hors de la rangée qui défile, avec fond et bouton OK
      var sh=document.createElement('div'); sh.id='cn-sheet'; sh.className='cn-sheet';
      sh.innerHTML='<div class="cn-sheet-bd" onclick="cnClose()"></div>';
      var hd=document.createElement('div'); hd.className='cn-sh';
      hd.innerHTML='<b>'+esc(RF_TITLES[RF_OPEN]||'')+'</b><button type="button" class="cn-sh-ok" onclick="cnClose()">OK</button>';
      pop.insertBefore(hd,pop.firstChild);
      sh.appendChild(pop); document.body.appendChild(sh);
      document.documentElement.classList.add('cn-lock');
    }
    if(getComputedStyle(pop).position!=='fixed'){
      var r=pop.getBoundingClientRect(), vw=document.documentElement.clientWidth;
      if(r.right>vw-8) pop.style.left=Math.max(vw-8-r.right,8-r.left)+'px';
    }
    if(RF_IQ) cnIngSearch(RF_IQ);
    if(keep&&keep.k===RF_OPEN){ pop.scrollTop=keep.a; var ol=pop.querySelector('.cn-ol'); if(ol) ol.scrollTop=keep.b; }
    else { var si=pop.querySelector('input'); if(si&&!('ontouchstart' in window)) si.focus(); }
  }
}
function renderRecActive(){
  var box=document.getElementById('rec-active'); if(!box) return;
  var ch=[];
  if(activeSub) ch.push(['cnCat(\'\')',ic('folder')+' '+esc(subLabel('rec',activeSub)||'Dossier')]);
  else if(activeCat) ch.push(['cnCat(\'\')',esc(activeCat)]);
  if(RF.letter) ch.push(['cnLetter(\'\')','Lettre '+RF.letter]);
  RF.alg.forEach(function(k){ ch.push(['cnTog(\'alg\',\''+k+'\')','Sans '+esc(algLabel(k).toLowerCase())]); });
  RF.tags.forEach(function(t){ ch.push(['cnTog(\'tags\',\''+escJS(t)+'\')',ic('tag')+' '+esc(t)]); });
  RF.ing.forEach(function(id){ var i=ingredients.find(function(x){ return x.id===id; }); ch.push(['cnTog(\'ing\',\''+id+'\')','Avec '+esc(i?i.name:'?')]); });
  if(RF.date) ch.push(['cnSet(\'date\',\'\')',esc(RF_DATES.filter(function(d){ return d[0]===RF.date; })[0][1])]);
  box.style.display=ch.length?'':'none';
  box.innerHTML=ch.map(function(c){ return '<button class="cn-ac" onclick="'+c[0]+'">'+c[1]+ic('x')+'</button>'; }).join('')+(ch.length>1?'<button class="cn-acx" onclick="cnReset()">Tout effacer</button>':'');
}
function cnOpen(e,k){ if(e) e.stopPropagation(); RF_OPEN=RF_OPEN===k?'':k; RF_IQ=''; renderRecFilters(); }
function cnClose(){ if(!RF_OPEN){ cnSheetRm(); return; } RF_OPEN=''; renderRecFilters(); }
var RF_TITLES={cat:'Catégories',alg:'Allergènes',tags:'Tags',ing:'Ingrédients',date:'Dates',sort:'Trier'};
function cnMobile(){ return window.matchMedia&&window.matchMedia('(max-width:820px)').matches; }
function cnSheetRm(){ var s=document.getElementById('cn-sheet'); if(s) s.remove(); document.documentElement.classList.remove('cn-lock'); }
document.addEventListener('click',function(e){ if(RF_OPEN&&!(e.target.closest&&e.target.closest('.cn-f'))) cnClose(); });
document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&RF_OPEN) cnClose(); });
function cnLetter(l){ RF.letter=(RF.letter===l?'':l); renderRec(); }
function cnCat(c){ RF_OPEN=''; activeSub=''; activeCat=c; renderRec(); }
function cnSub(s){ RF_OPEN=''; activeCat=''; activeSub=(activeSub===s?'':s); renderRec(); }
function cnTog(k,v){ var a=RF[k], i=a.indexOf(v); if(i>=0) a.splice(i,1); else a.push(v); RF.letter=''; renderRec(); }
function cnSet(k,v){ RF[k]=v; RF_OPEN=''; if(k==='sort'){ try{ LS.setItem('v4_recsort',v); }catch(e){} } renderRec(); }
function cnIngSearch(v){ RF_IQ=v; var q=normTxt(v).trim(); document.querySelectorAll('#cn-ing-ol .cn-oi').forEach(function(d){ d.style.display=!q||d.getAttribute('data-n').indexOf(q)>=0?'':'none'; }); }
function cnClearSearch(){ var i=document.getElementById('rec-srch'); if(i){ i.value=''; i.focus(); } renderRec(); }
function cnReset(){ RF.letter=''; RF.alg=[]; RF.tags=[]; RF.ing=[]; RF.date=''; RF_OPEN=''; activeCat=''; activeSub=''; var i=document.getElementById('rec-srch'); if(i) i.value=''; renderRec(); }
function filterCat(c){ cnCat(c); }
function filterSub(s){ cnSub(s); }

// ══ ÉDITEUR DE RECETTE ════════════════════════════════════════
var RE_TAB='rec', REH={st:[],i:-1,mute:false};
function fDur(min){ min=Math.round(Number(min)||0); if(!min) return ''; if(min<60) return min+' min'; var h=Math.floor(min/60), m=min%60; return h+' h'+(m?' '+(m<10?'0':'')+m:''); }
function reVal(id){ var e=document.getElementById(id); return e?e.value:''; }
function reTmp(items,fn){ var tmp={id:'__re__',name:'',cat:'',image:'',notes:'',items:items}, orig=recipes; recipes=orig.concat([tmp]); try{ return fn('__re__'); } finally { recipes=orig; } }
function reWeight(){ return reTmp(recItems,recWeight)||0; }
function reCostAll(){ return reTmp(recItems,recCost)||0; }

// ouverture : on charge les champs propres au nouvel éditeur
function reLoad(){
  var r=editRecId&&recipes.find(function(x){ return x.id===editRecId; });
  REC_ED.tags=(r&&r.tags||[]).slice(); REC_ED.time=(r&&r.time)||0; REC_ED.pcs=(r&&r.pcs)||0; REC_ED.coef=(r&&r.coef)||0;
  var t=REC_ED.time, u=t&&t%60===0?60:1;
  document.getElementById('re-time').value=t?t/u:''; document.getElementById('re-time-u').value=String(u);
  document.getElementById('re-pcs').value=REC_ED.pcs||'';
  document.getElementById('re-mult').value='1'; document.getElementById('re-target').value='';
  var emp=document.getElementById('r-items-empty'); if(emp&&!recItems.length) emp.style.display='block';
  reTab('rec'); renderReTags(); reThumb(); reMeta(); rePcsHint();
  var sc=document.getElementById('scroll'); if(sc) sc.scrollTop=0;
  ['re-l','re-mid','re-r'].forEach(function(id){ var e=document.getElementById(id); if(e) e.scrollTop=0; });
  setTimeout(reHistReset,0);
}
function recEdApply(rec){
  var t=REC_ED.tags||[]; if(t.length) rec.tags=t.slice(); else delete rec.tags;
  if(REC_ED.time>0) rec.time=REC_ED.time; else delete rec.time;
  if(REC_ED.pcs>0) rec.pcs=REC_ED.pcs; else delete rec.pcs;
  if(REC_ED.coef>0) rec.coef=REC_ED.coef; else delete rec.coef;
  if(CUR==='recettes') renderRec();   // la liste a été dessinée avant ces champs
}
(function(){
  var _n=openNewRec; openNewRec=function(){ var r=_n.apply(this,arguments); reLoad(); return r; };
  var _e=openEditRec; openEditRec=function(){ var r=_e.apply(this,arguments); if(CUR==='rec-edit') reLoad(); return r; };
  var _c=calcRecTots; calcRecTots=function(){ var r=_c.apply(this,arguments); rePcsHint(); reHistPush(); if(RE_TAB==='prix') renderRePrix(); return r; };
  var _r=renderRItems; renderRItems=function(){ var r=_r.apply(this,arguments); reHistPush(); reThumb(); reMeta(); return r; };
  var _p=showRecImgPrev; showRecImgPrev=function(){ var r=_p.apply(this,arguments); reThumb(); return r; };
  var _g=goPage; goPage=function(p){
    var r=_g.apply(this,arguments);
    document.documentElement.classList.toggle('re-full',CUR==='rec-edit'||CUR==='edit');
    if(CUR!=='recettes'){ RF_OPEN=''; cnSheetRm(); }
    return r;
  };
  var nm=document.getElementById('r-name'), no=document.getElementById('r-notes'), tm=null;
  function later(){ clearTimeout(tm); tm=setTimeout(reHistPush,500); }
  if(nm) nm.addEventListener('input',function(){ later(); reMeta(); });
  if(no) no.addEventListener('input',later);
  try{ var f=JSON.parse(LS.getItem('v4_refold')||'{}'); var b=document.getElementById('re-body'); if(b){ b.classList.toggle('l-off',!!f.l); b.classList.toggle('r-off',!!f.r); } }catch(e){}
})();

// onglets
function reTab(t){
  RE_TAB=t;
  document.getElementById('re-t-rec').classList.toggle('on',t==='rec');
  document.getElementById('re-t-prix').classList.toggle('on',t==='prix');
  document.getElementById('re-pane-rec').style.display=t==='rec'?'':'none';
  document.getElementById('re-pane-prix').style.display=t==='prix'?'':'none';
  if(t==='prix') renderRePrix();
}
function reFold(side,bodyId){
  var b=document.getElementById(bodyId||'re-body'); if(!b) return;
  b.classList.toggle(side+'-off');
  var k=bodyId==='be-body'?'v4_befold':'v4_refold';
  try{ LS.setItem(k,JSON.stringify({l:b.classList.contains('l-off'),r:b.classList.contains('r-off')})); }catch(e){}
}
(function(){ try{ var f=JSON.parse(LS.getItem('v4_befold')||'{}'), b=document.getElementById('be-body'); if(b){ b.classList.toggle('l-off',!!f.l); b.classList.toggle('r-off',!!f.r); } }catch(e){} })();

// en-tête : vignette + ligne d'infos
function reThumb(){
  var t=document.getElementById('re-thumb'); if(!t) return;
  var em=reVal('r-img').trim();
  if(curRecImg){ t.innerHTML='<img src="'+esc(curRecImg)+'" alt="">'; t.className='re-thumb img cover'; t.title='Changer la photo'; }
  else if(em){ t.textContent=em; t.className='re-thumb em'; }
  else { t.innerHTML=ic('camera'); t.className='re-thumb'; }
}
function reMeta(){
  var m=document.getElementById('re-meta'); if(!m) return;
  var cat=reVal('r-cat'), sub=reVal('r-sub'), parts=[];
  if(cat&&cat!=='__new__') parts.push(catDot(cat)+esc(cat)+(sub?' · '+esc(subLabel('rec',sub)||''):''));
  if(REC_ED&&REC_ED.pcs) parts.push(ic('cube')+' '+REC_ED.pcs+' pièce'+(REC_ED.pcs>1?'s':''));
  if(REC_ED&&REC_ED.time) parts.push(ic('clock')+' '+fDur(REC_ED.time));
  m.innerHTML=parts.map(function(p){ return '<span>'+p+'</span>'; }).join('');
}

// rendement
function reRound(q){ q=Number(q)||0; return q>=100?Math.round(q*10)/10:Math.round(q*1000)/1000; }
function reScale(f,label){
  if(!recItems.length){ toast('Ajoute d’abord des éléments','err'); return; }
  if(!(f>0)||!isFinite(f)){ toast('Valeur incorrecte','err'); return; }
  recItems.forEach(function(it){ it.qty=reRound(it.qty*f); });
  if(REC_ED.pcs) { REC_ED.pcs=Math.max(1,Math.round(REC_ED.pcs*f)); document.getElementById('re-pcs').value=REC_ED.pcs; reMeta(); }
  renderRItems(); toast(label,'ok');
}
function reMultiply(){ var m=parseFloat(String(reVal('re-mult')).replace(',','.')); if(m===1) return; reScale(m,'Quantités multipliées par '+fNum(m,2)); document.getElementById('re-mult').value='1'; }
function reScaleTo(){
  var t=parseFloat(String(reVal('re-target')).replace(',','.')), w=reWeight();
  if(!(w>0)){ toast('Poids de la recette inconnu','err'); return; }
  reScale(t/w,'Recette ajustée à '+fKg(t)); document.getElementById('re-target').value='';
}
function reSetPcs(v){ var n=Math.round(Number(v)||0); REC_ED.pcs=n>0?n:0; rePcsHint(); reMeta(); if(RE_TAB==='prix') renderRePrix(); }
function rePcsHint(){ var h=document.getElementById('re-pcs-w'); if(!h) return; var w=reWeight(); h.textContent=(REC_ED&&REC_ED.pcs&&w>0)?fQtyNice(w/REC_ED.pcs)+' / pièce':''; }
function reSetTime(){ var v=parseFloat(String(reVal('re-time')).replace(',','.'))||0, u=Number(reVal('re-time-u'))||1; REC_ED.time=v>0?Math.round(v*u):0; reMeta(); }

// tags
function renderReTags(){
  var box=document.getElementById('re-tags'); if(!box) return;
  var mine=REC_ED.tags||[], sug=allRecTags().map(function(x){ return x.t; }).filter(function(t){ return mine.indexOf(t)<0; }).slice(0,8);
  box.innerHTML=mine.map(function(t,i){ return '<span class="re-tag">'+esc(t)+'<button onclick="reTagDel('+i+')" title="Retirer" aria-label="Retirer">'+ic('x')+'</button></span>'; }).join('')+
    '<button class="re-tag-add" onclick="reTagAdd()">'+ic('plus-circle')+' Ajouter un tag</button>'+
    (sug.length?'<div class="re-tag-sug">'+sug.map(function(t){ return '<button onclick="reTagPut(\''+escJS(t)+'\')">'+ic('plus')+esc(t)+'</button>'; }).join('')+'</div>':'');
}
function reTagPut(t){ t=String(t||'').trim().replace(/\s+/g,' ').slice(0,40); if(!t) return; var a=REC_ED.tags||(REC_ED.tags=[]); if(!a.some(function(x){ return normTxt(x)===normTxt(t); })) a.push(t); renderReTags(); }
function reTagAdd(){ askText('Nouveau tag','Ex : best-seller, été, sans lactose',function(v){ String(v||'').split(',').forEach(reTagPut); }); }
function reTagDel(i){ (REC_ED.tags||[]).splice(i,1); renderReTags(); }

// annuler / rétablir
function reSnap(){ return JSON.stringify({it:recItems,n:reVal('r-name'),no:reVal('r-notes')}); }
function reHistReset(){ REH.st=[reSnap()]; REH.i=0; reHistBtns(); }
function reHistPush(){
  if(REH.mute||CUR!=='rec-edit'||REH.i<0) return;
  var s=reSnap(); if(REH.st[REH.i]===s) return;
  REH.st=REH.st.slice(0,REH.i+1); REH.st.push(s); if(REH.st.length>80) REH.st.shift(); REH.i=REH.st.length-1; reHistBtns();
}
function reHistBtns(){ var u=document.getElementById('re-undo'), r=document.getElementById('re-redo'); if(u) u.disabled=REH.i<=0; if(r) r.disabled=REH.i>=REH.st.length-1; }
function reHistGo(i){
  if(i<0||i>=REH.st.length) return;
  var o=JSON.parse(REH.st[i]); REH.i=i; REH.mute=true;
  try{ recItems.length=0; o.it.forEach(function(x){ recItems.push(x); }); document.getElementById('r-name').value=o.n; document.getElementById('r-notes').value=o.no; renderRItems(); reMeta(); }
  finally{ REH.mute=false; }
  reHistBtns();
}
function reUndo(){ reHistPush(); reHistGo(REH.i-1); }
function reRedo(){ reHistGo(REH.i+1); }
function reDirty(){ return REH.st.length&&REH.st[0]!==reSnap(); }
function reClose(){
  if(!document.getElementById('imp-bar')&&reDirty()&&!confirm('Quitter sans enregistrer ? Les modifications de la recette seront perdues.')) return;
  goBack();
}
document.addEventListener('keydown',function(e){
  if(CUR!=='rec-edit'||document.querySelector('.ov.show')) return;
  var k=(e.key||'').toLowerCase(), t=e.target, typing=t&&(/^(input|textarea|select)$/i.test(t.tagName)||t.isContentEditable);
  if(!(e.ctrlKey||e.metaKey)) return;
  if(k==='s'){ e.preventDefault(); saveRecipe(); }
  else if(!typing&&k==='z'&&!e.shiftKey){ e.preventDefault(); reUndo(); }
  else if(!typing&&(k==='y'||(k==='z'&&e.shiftKey))){ e.preventDefault(); reRedo(); }
});

// onglet Prix
function reLineCost(it){ return reTmp([it],recCost)||0; }
function reLineWeight(it){ return reTmp([it],recWeight)||0; }
function renderRePrix(){
  var box=document.getElementById('re-pane-prix'); if(!box) return;
  if(!recItems.length){ box.innerHTML='<section class="re-card"><div class="re-empty-t">Ajoute des ingrédients pour voir le détail des coûts.</div></section>'; return; }
  var tot=reCostAll(), w=reWeight(), pcs=REC_ED.pcs||0, coef=REC_ED.coef||0;
  var rows=recItems.map(function(it){
    var c=reLineCost(it), lw=reLineWeight(it), nm, pu='';
    if(it.type==='ingredient'){ var g=ingredients.find(function(x){ return x.id===it.refId; }); nm=g?g.name:'?'; if(g) pu=fEur(g.price)+' / '+esc(g.unit||'kg'); }
    else { var r=recipes.find(function(x){ return x.id===it.refId; }); nm=ic('sub')+' '+esc(r?r.name:'?'); pu=fKg(reTmp(r?r.items:[],recWeight))+' · '+fEur(r?recCost(r.id):0); }
    var pc=tot>0?c/tot:0;
    return {nm:it.type==='ingredient'?esc(nm):nm, q:fQtyNice(lw), pu:pu, c:c, pc:pc};
  }).sort(function(a,b){ return b.c-a.c; });
  var sell=coef>0?tot*coef:0;
  box.innerHTML=
    '<div class="re-kpis">'+
      '<div class="re-kpi"><span>Coût matière TTC</span><b>'+fEur(tot)+'</b></div>'+
      '<div class="re-kpi"><span>Coût au kilo</span><b>'+(w>0?fEur(tot/w):'—')+'</b></div>'+
      '<div class="re-kpi"><span>Coût par pièce</span><b>'+(pcs?fEur(tot/pcs):'—')+'</b>'+(pcs?'':'<small>Indique le nombre de pièces à gauche</small>')+'</div>'+
    '</div>'+
    '<section class="re-card"><div class="re-card-t">Détail des coûts</div><div class="re-pt">'+
      '<div class="re-pr hd"><span>Élément</span><span>Quantité</span><span>Prix</span><span>Coût</span></div>'+
      rows.map(function(x){ return '<div class="re-pr"><span class="re-pn">'+x.nm+'<i style="width:'+(x.pc*100).toFixed(1)+'%"></i></span><span>'+x.q+'</span><span class="re-pu">'+x.pu+'</span><span><b>'+fEur(x.c)+'</b><small>'+Math.round(x.pc*100)+' %</small></span></div>'; }).join('')+
      '<div class="re-pr tt"><span>Total</span><span>'+fQtyNice(w)+'</span><span></span><span><b>'+fEur(tot)+'</b></span></div>'+
    '</div></section>'+
    '<section class="re-card"><div class="re-card-t">Prix de vente conseillé</div>'+
      '<div class="re-sell"><div><div class="re-lb">Coefficient</div><input class="fi" type="number" inputmode="decimal" min="0" step="0.1" id="re-coef" value="'+(coef||'')+'" placeholder="Ex : 3,5" oninput="reSetCoef(this.value)"></div>'+
      '<div class="re-sell-r" id="re-sell-r">'+reSellHTML(tot,pcs,coef)+'</div></div>'+
      '<div class="re-hint">Prix TTC = coût matière × coefficient. Le coefficient est enregistré avec la recette.</div></section>';
}
function reSellHTML(tot,pcs,coef){
  if(!(coef>0)) return '<span class="re-hint">Indique un coefficient pour calculer le prix de vente.</span>';
  var s=tot*coef;
  return '<div class="re-kv"><span>Prix de la recette</span><b>'+fEur(s)+'</b></div>'+(pcs?'<div class="re-kv"><span>Prix par pièce</span><b>'+fEur(s/pcs)+'</b></div>':'')+'<div class="re-kv"><span>Marge brute</span><b>'+fEur(s-tot)+'</b></div>';
}
function reSetCoef(v){ var c=parseFloat(String(v).replace(',','.'))||0; REC_ED.coef=c>0?c:0; var b=document.getElementById('re-sell-r'); if(b) b.innerHTML=reSellHTML(reCostAll(),REC_ED.pcs||0,REC_ED.coef); }
