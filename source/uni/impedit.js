// ══ IMPORT → ÉDITEUR DE RECETTE ═══════════════════════════════
// Après l'analyse d'un document, chaque recette détectée s'ouvre dans le même
// éditeur que « Nouvelle recette » ; on l'enregistre recette par recette.
// Les ingrédients et sous-recettes absents du catalogue sont créés en
// « brouillon » (_imp) : visibles dans l'éditeur, jamais écrits sur disque,
// et seulement conservés à l'enregistrement s'ils servent encore.
var IMPQ={active:false,cur:null,hold:false,saveBtn:null};

function impStrip(arr){ for(var i=arr.length-1;i>=0;i--) if(arr[i]._imp) arr.splice(i,1); }
function impHidden(fn){
  var ti=ingredients.filter(function(x){ return x._imp; }), tr=recipes.filter(function(x){ return x._imp; });
  if(!ti.length&&!tr.length) return fn();
  impStrip(ingredients); impStrip(recipes);
  try{ return fn(); } finally { ti.forEach(function(x){ ingredients.push(x); }); tr.forEach(function(x){ recipes.push(x); }); }
}
(function(){
  var _p=persist; persist=function(){ return impHidden(function(){ return _p(); }); };
  if(typeof collectData==='function'){ var _c=collectData; collectData=function(){ return impHidden(function(){ return _c(); }); }; }
})();

function impSrcNote(d){ return 'Importée depuis '+((d.src&&d.src.fileName)||'un document'); }
function impNotes(d){
  var own=(d.subs||[]).filter(function(s){ return s.create; }).map(function(s){ return s.name; });
  var steps=(d.process||[]).filter(function(p){ return !p.section||own.indexOf(p.section)<0; });
  return impSrcNote(d)+(steps.length?'\n\nProcédé :\n'+steps.map(function(p){ return '• '+p.text; }).join('\n'):'');
}
function impSubNotes(d,name){
  var steps=(d.process||[]).filter(function(p){ return p.section===name&&!/^pr[ée]paration\b/i.test(p.text); });
  return impSrcNote(d)+(steps.length?'\n\nPréparation :\n'+steps.map(function(p){ return '• '+p.text; }).join('\n'):'');
}

// ingrédient du catalogue, ou brouillon créé à la volée (jamais deux fois le même)
function impIngFor(l){
  if(l.matchId&&ingredients.some(function(i){ return i.id===l.matchId; })) return {id:l.matchId,isNew:false};
  var dup=ingredients.find(function(i){ return rslug(i.name)===rslug(l.name); });
  if(dup) return {id:dup.id,isNew:!!dup._imp};
  var f=unitFactor(l.newUnit,{unit:l.newUnit,unitWeight:l.newUnitWeight});
  var ing={id:uid(),name:l.name,cat:l.newCat||'Autre',unit:l.newUnit||'kg',unitWeight:l.newUnitWeight||null,
    buyPrice:l.newPrice||0,price:l.newPrice?rnd(l.newPrice/f):0,
    priceHistory:l.newPrice?[{ts:now(),price:rnd(l.newPrice/f),src:'import recette'}]:[],_imp:true};
  ingredients.push(ing); return {id:ing.id,isNew:true};
}
function impItem(l){
  if(l.useRecipeId) return {id:uid(),type:'recipe',refId:l.useRecipeId,qty:l.qty||1,unit:'x',imp:{isRec:true,conf:100,score:1,orig:l.originalName||'',lid:l.id}};
  var r=impIngFor(l);
  return {id:uid(),type:'ingredient',refId:r.id,qty:l.qty,unit:l.unit,
    imp:{isNew:r.isNew,conf:l.confidence,score:l.matchScore||0,orig:l.originalName||'',lid:l.id}};
}
// « Rafraîchi 2800 g » dans la liste principale = utilisation de la sous-recette
// « Rafraîchi » pour ce poids (pas un ingrédient, pas de double comptage).
function impRefLines(d){
  (d.subs||[]).forEach(function(s){
    if(!s.create) return;
    var key=rslug(s.name); if(!key) return;
    var mine=d.lines.filter(function(l){ return l.sel&&l.subName===s.name; });
    var subKg=0; mine.forEach(function(l){ subKg+=toKg(l.qty,l.unit,{unit:l.unit}); });
    var refs=d.lines.filter(function(l){ if(!l.sel||l.subName||l.useRecipeId) return false; var k=rslug(l.name); return k===key||k.indexOf(key+' ')===0; });
    if(!refs.length) return;
    var refKg=0; refs.forEach(function(l){ refKg+=toKg(l.qty,l.unit,{unit:l.unit}); l.sel=false; l.refOf=s.name; });
    var add=subKg>0&&refKg>0?refKg/subKg:0;
    s.mult=Math.round(((s.mult!=null?s.mult:0)+add)*1e4)/1e4||1;
  });
}
function impPretty(t){
  t=String(t||'').replace(/\s+/g,' ').trim();
  if(t&&t===t.toUpperCase()&&/[A-ZÀ-Ý]/.test(t)){ t=t.toLowerCase(); t=t.charAt(0).toUpperCase()+t.slice(1); }
  return t;
}
function impSubName(d,s){
  var p=impPretty(d.name), n=impPretty(s);
  if(!n) return p;
  return p&&rslug(n).indexOf(rslug(p))<0?n+' – '+p:n;
}
function impBookTag(){
  if(!draftQueue||draftQueue.length<2||!draft||!draft.src||!draft.src.fileName) return '';
  return String(draft.src.fileName).replace(/\.[a-z0-9]{2,5}$/i,'').replace(/[_]+/g,' ').replace(/\s*[-–]\s*p\.?\s*\d.*$/i,'').trim();
}
function impBuildItems(d){
  impRefLines(d);
  var sel=d.lines.filter(function(l){ return l.sel; }), items=[];
  sel.filter(function(l){ return !l.subName; }).forEach(function(l){ items.push(impItem(l)); });
  (d.subs||[]).forEach(function(s){
    var mine=sel.filter(function(l){ return l.subName===s.name; });
    if(s.create&&mine.length){
      var tg=impBookTag();
      var sr={id:uid(),name:impSubName(d,s.name),cat:d.cat,image:'⊛',notes:impSubNotes(d,s.name),items:mine.map(impItem),tags:tg?[tg]:undefined,
        createdAt:now(),updatedAt:now(),_imp:true,
        source:{fileName:d.src.fileName,thumb:d.src.thumb,importedAt:d.src.ts}};
      recipes.push(sr);
      items.push({id:uid(),type:'recipe',refId:sr.id,qty:(s.mult!=null?s.mult:1),unit:'x',imp:{isSub:true}});
    } else mine.forEach(function(l){ items.push(impItem(l)); });
  });
  return items;
}

function impSnap(d){
  if(!d||!IMPQ.active) return;
  var g=function(id){ var e=document.getElementById(id); return e?e.value:''; };
  d.edited=JSON.parse(JSON.stringify({name:g('r-name'),cat:g('r-cat'),sub:g('r-sub'),img:g('r-img'),notes:g('r-notes'),
    items:recItems,tmpIng:ingredients.filter(function(x){ return x._imp; }),tmpRec:recipes.filter(function(x){ return x._imp; })}));
}
function impRestore(d){
  var e=d.edited;
  e.tmpIng.forEach(function(x){ if(!ingredients.some(function(i){ return i.id===x.id; })) ingredients.push(x); });
  e.tmpRec.forEach(function(x){ if(!recipes.some(function(i){ return i.id===x.id; })) recipes.push(x); });
  return e;
}

function impOpen(){
  var d=draft;
  if(IMPQ.active&&IMPQ.cur&&IMPQ.cur!==d) impSnap(IMPQ.cur);
  impStrip(ingredients); impStrip(recipes);
  openNewRec();
  ['p-rec-valid','p-rec-import'].forEach(function(id){ var e=document.getElementById(id); if(e) e.style.display='none'; });
  IMPQ.active=true; IMPQ.cur=d;
  var f=d.edited?impRestore(d):{name:d.name||'',cat:d.cat,sub:'',img:d.emoji||'📖',notes:impNotes(d),items:impBuildItems(d)};
  document.getElementById('r-name').value=f.name;
  fillCatSelect('r-cat','rec',f.cat);
  fillSubSelect('r-sub','rec',f.cat,f.sub||'');
  document.getElementById('r-img').value=f.img;
  document.getElementById('r-notes').value=f.notes;
  recItems=f.items;
  var tg=impBookTag();
  if(tg&&typeof REC_ED!=='undefined'&&!(REC_ED.tags||[]).length){ REC_ED.tags=[tg]; if(typeof renderReTags==='function') renderReTags(); }
  renderRItems(); calcRecTots();
  impBar(); persistDraft();
  var sc=document.getElementById('scroll'); if(sc) sc.scrollTop=0;
}

function impNextIdx(){
  if(!draftQueue) return -1;
  for(var k=1;k<=draftQueue.length;k++){ var j=(draftQueueIdx+k)%draftQueue.length; if(!draftQueue[j].queueDone) return j; }
  return -1;
}
function impBar(){
  var page=document.getElementById('re-mid')||document.getElementById('p-rec-edit'); if(!page) return;
  var box=document.getElementById('imp-bar');
  if(!box){ box=document.createElement('div'); box.id='imp-bar'; page.insertBefore(box,page.firstChild); }
  var d=draft, q=draftQueue, n=q?q.length:1, i=q?draftQueueIdx:0;
  var nNew=ingredients.filter(function(x){ return x._imp&&recItems.some(function(it){ return it.type==='ingredient'&&it.refId===x.id; }); }).length;
  var nIgn=d.lines.filter(function(l){ return !l.sel&&!l.refOf; }).length;
  var nChk=recItems.filter(function(it){ return it.imp&&!it.imp.isNew&&!it.imp.isSub&&(it.imp.score<0.9||it.imp.conf<70); }).length;
  var msg=[];
  if(nNew) msg.push('<b>'+nNew+'</b> ingrédient'+(nNew>1?'s':'')+' absent'+(nNew>1?'s':'')+' du catalogue '+(nNew>1?'seront ajoutés':'sera ajouté')+' à l’enregistrement (repérés « Nouveau »).');
  if(nChk) msg.push('<b>'+nChk+'</b> ligne'+(nChk>1?'s':'')+' à vérifier.');
  if(nIgn) msg.push(nIgn+' ligne'+(nIgn>1?'s':'')+' peu fiable'+(nIgn>1?'s':'')+' ignorée'+(nIgn>1?'s':'')+' — <a href="#" onclick="RIMP.addIgnored();return false">les ajouter</a>.');
  var done=q?q.filter(function(x){ return x.queueDone; }).length:0;
  box.className='cw imp-bar';
  box.innerHTML=
    '<div class="imp-top">'+(d.src&&d.src.thumb?'<img class="imp-th" src="'+d.src.thumb+'" alt="">':'<span class="imp-th imp-th0">'+ic('clip')+'</span>')+
      '<div class="imp-ti"><b>Import'+(q?' · recette '+(i+1)+' sur '+n:'')+'</b><span>'+esc((d.src&&d.src.fileName)||'')+'</span></div>'+
      '<button class="btn btn-gold btn-sm imp-sv" onclick="saveRecipe()">'+ic('check')+' Enregistrer</button></div>'+
    (q&&n>1?'<div class="imp-chips">'+q.map(function(x,k){
        var cls=x.queueDone?'b-ok2':(k===i?'b-warn':'b-new');
        return '<span class="ri-badge '+cls+'" onclick="RIMP.queueGo('+k+')">'+(x.queueDone?'✓ ':'')+esc(x.name||('Recette '+(k+1)))+'</span>'; }).join('')+
      '<span class="imp-cnt">'+done+' enregistrée'+(done>1?'s':'')+'</span></div>':'')+
    (msg.length?'<div class="imp-msg">'+msg.join(' ')+'</div>':'')+
    (d.aiWarning?'<div class="imp-msg imp-warn">'+esc(d.aiWarning)+'</div>':'')+
    '<div class="imp-acts">'+
      (q&&n>1?'<button class="btn btn-ghost btn-sm"'+(i<=0?' disabled':'')+' onclick="RIMP.queuePrev()">← Précédente</button>'+
              '<button class="btn btn-ghost btn-sm"'+(i>=n-1?' disabled':'')+' onclick="RIMP.queueNext()">Suivante →</button>'+
              '<button class="btn btn-ghost btn-sm" onclick="RIMP.queueSkip()">Passer</button>':'')+
      '<button class="btn btn-ghost btn-sm" onclick="RIMP.pause()">Mettre de côté</button>'+
      '<button class="btn btn-ghost btn-sm" onclick="RIMP.abandon()">Abandonner</button></div>';
  // bouton principal du bas
  var sb=page.querySelector('button.btn-gold.btn-full');
  if(sb){
    if(IMPQ.saveBtn==null) IMPQ.saveBtn=sb.innerHTML;
    sb.innerHTML=ic('check')+(impNextIdx()>=0?' Enregistrer et passer à la suivante':' Enregistrer la recette');
  }
  document.getElementById('tb-title').textContent=q?'Import · '+(i+1)+' / '+n:'Import de recette';
}
function impLine(m){ return m&&m.lid&&draft&&draft.lines.find(function(x){ return x.id===m.lid; }); }
function impDecorate(){
  if(!IMPQ.active) return;
  var rows=document.querySelectorAll('#r-items .ir');
  rows.forEach(function(row,idx){
    var it=recItems[idx], m=it&&it.imp; if(!m) return;
    var c=row.querySelector('.ir-c'); if(!c||c.querySelector('.imp-b')) return;
    var b=null;
    if(m.isSub) b=['b-new','Sous-recette créée'];
    else if(m.isRec) b=['b-ok2','Sous-recette'];
    else if(m.isNew) b=['b-new','Nouveau'];
    else if(m.score<0.9||m.conf<70) b=['b-warn','À vérifier'+(m.orig?' · lu « '+m.orig+' »':'')];
    if(b) c.insertAdjacentHTML('beforeend',' <span class="ri-badge imp-b '+b[0]+'">'+esc(b[1])+'</span>');
    // bouton « changer » : ouvre la recherche (catalogue, sous-recettes, nouvel ingrédient)
    var l=impLine(m); if(!l||m.isSub) return;
    var cur=ingredients.find(function(x){ return x.id===it.refId; });
    var lab;
    if(it.type==='recipe'){ var rr=recipes.find(function(x){ return x.id===it.refId; }); lab=ic('sub')+' '+esc(rr?rr.name:'?'); }
    else if(m.isNew) lab='＋ Nouvel ingrédient';
    else lab=esc(cur?cur.name:'?')+(m.score<1?' — '+Math.round(m.score*100)+' %':'');
    var html='<div class="imp-pick" onclick="event.stopPropagation()">'+
      '<button class="fi sm imp-chg" onclick="RIMP.swap('+idx+')" aria-label="Changer l’ingrédient">'+ic('search')+'<span>'+lab+'</span>'+ic('chev-down')+'</button>'+
      (m.isNew&&cur&&cur._imp?'<input class="fi sm imp-nm" value="'+esc(cur.name)+'" placeholder="Nom du nouvel ingrédient" onchange="RIMP.setName('+idx+',this.value)" aria-label="Nom du nouvel ingrédient">':'')+
    '</div>';
    row.insertAdjacentHTML('beforeend',html);
  });
}
// recettes proposables comme sous-recette (les plus proches du nom lu d'abord)
function impRecOpts(l,it){
  var key=rslug(l.name||''), list=recipes.filter(function(r){ return !r._imp&&r.id!==editRecId; });
  if(!list.length) return '';
  var near=function(r){ var k=rslug(r.name); return key.length>2&&(k.indexOf(key)>=0||key.indexOf(k)>=0); };
  list.sort(function(a,b){ return (near(b)-near(a))||a.name.localeCompare(b.name,'fr'); });
  return '<optgroup label="Utiliser une sous-recette">'+list.map(function(r){
    var w=recWeight(r.id);
    return '<option value="rec:'+r.id+'"'+(it.type==='recipe'&&it.refId===r.id?' selected':'')+'>⊛ '+esc(r.name)+(w>0?' ('+fQtyNice(w)+')':'')+'</option>';
  }).join('')+'</optgroup>';
}
// poids actuel de la ligne (kg), pour garder la même quantité en changeant de choix
function impLineKg(it){
  if(it.type==='recipe') return (recWeight(it.refId)||0)*(Number(it.qty)||0);
  var ing=ingredients.find(function(x){ return x.id===it.refId; });
  return toKg(it.qty,it.unit,ing);
}
function impSwap(idx){
  var it=recItems[idx], m=it&&it.imp, l=impLine(m); if(!l) return;
  swapOpen({cur:m.isNew?{type:'new'}:{type:it.type,id:it.refId},name:l.originalName||l.name,allowNew:true,onPick:function(v){ impSetIng(idx,v); }});
}
function impSetIng(idx,val){
  var it=recItems[idx], m=it&&it.imp, l=impLine(m); if(!l) return;
  if(/^new:/.test(val||'')){ var nm=decodeURIComponent(val.slice(4)); impSetIng(idx,''); if(nm) impSetName(idx,nm); return; }
  if(/^rec:/.test(val||'')){
    var rid=val.slice(4), rec=recipes.find(function(r){ return r.id===rid; }); if(!rec) return;
    var kg=impLineKg(it), base=recWeight(rid), mult=(base>0&&kg>0)?Math.round(kg/base*1e6)/1e6:1;
    if(it.type==='ingredient'){ l.ingQty=it.qty; l.ingUnit=it.unit; }
    l.useRecipeId=rid; l.qty=mult; l.matchId='';
    recItems[idx]={id:it.id,type:'recipe',refId:rid,qty:mult,unit:'x',imp:{isRec:true,conf:100,score:1,orig:m.orig,lid:l.id}};
    renderRItems(); persistDraft(); return;
  }
  if(it.type==='recipe'){
    var kg2=impLineKg(it);
    delete l.useRecipeId;
    if(l.ingQty!=null){ l.qty=l.ingQty; l.unit=l.ingUnit; } else { l.qty=Math.round(kg2*1000)/1000; l.unit='kg'; }
    l.matchId=val?val.replace(/^ing:/,''):'';
    var ni=impItem(l); ni.id=it.id; recItems[idx]=ni; it=ni; m=ni.imp;
    if(!val){ renderRItems(); persistDraft(); return; }
  }
  if(val){
    var ing=ingredients.find(function(x){ return x.id===val.replace(/^ing:/,''); }); if(!ing) return;
    l.matchId=ing.id; l.matchScore=1; it.refId=ing.id; m.isNew=false; m.score=1; m.conf=100;
    if(l.originalName&&cslug(l.originalName)!==cslug(ing.name)) try{ learnCorrection(l.originalName,ing.name); }catch(e){}
  } else {
    l.matchId=''; var r=impIngFor(l); it.refId=r.id; m.isNew=r.isNew; m.score=r.isNew?0:1;
  }
  renderRItems(); persistDraft();
}
function impSetName(idx,v){
  var it=recItems[idx], m=it&&it.imp, l=impLine(m); v=String(v||'').trim(); if(!l||v.length<2) return;
  var ing=ingredients.find(function(x){ return x.id===it.refId&&x._imp; }); if(!ing) return;
  var ex=ingredients.find(function(x){ return !x._imp&&rslug(x.name)===rslug(v); });
  if(ex){ impSetIng(idx,'ing:'+ex.id); toast('« '+ex.name+' » existe déjà : ingrédient du catalogue utilisé','info'); return; }
  if(l.originalName&&cslug(l.originalName)!==cslug(v)) try{ learnCorrection(l.originalName,v); }catch(e){}
  l.name=v; ing.name=v; renderRItems(); persistDraft();
}
(function(){ var _r=renderRItems; renderRItems=function(){ _r.apply(this,arguments); impDecorate(); if(IMPQ.active&&document.getElementById('imp-bar')) impBar(); }; })();

function impAddIgnored(){
  if(!IMPQ.active||!draft) return;
  draft.lines.filter(function(l){ return !l.sel; }).forEach(function(l){
    if(!l.useRecipeId&&(!l.name||l.name.length<2)) return;
    l.sel=true; recItems.push(impItem(l));
  });
  renderRItems(); toast('Lignes ajoutées — vérifiez-les','info');
}
function impFinalize(){
  var keepI={}, keepR={};
  (function walk(items){ (items||[]).forEach(function(it){
    if(it.type==='ingredient') keepI[it.refId]=1;
    else if(!keepR[it.refId]){ keepR[it.refId]=1; var r=recipes.find(function(x){ return x.id===it.refId; }); if(r) walk(r.items); }
  }); })(recItems);
  var out={ing:0,sub:0};
  for(var i=ingredients.length-1;i>=0;i--){ var x=ingredients[i]; if(!x._imp) continue; if(keepI[x.id]){ delete x._imp; out.ing++; } else ingredients.splice(i,1); }
  for(var j=recipes.length-1;j>=0;j--){ var y=recipes[j]; if(!y._imp) continue; if(keepR[y.id]){ delete y._imp; out.sub++; } else recipes.splice(j,1); }
  recItems.forEach(function(it){ delete it.imp; });
  return out;
}
function impLeave(){
  if(!IMPQ.active) return;
  impSnap(IMPQ.cur); try{ persistNow(); }catch(e){}
  impStrip(ingredients); impStrip(recipes);
  IMPQ.active=false; IMPQ.cur=null;
  var box=document.getElementById('imp-bar'); if(box) box.remove();
  var sb=document.querySelector('#p-rec-edit button.btn-gold.btn-full');
  if(sb&&IMPQ.saveBtn!=null) sb.innerHTML=IMPQ.saveBtn;
  IMPQ.saveBtn=null;
}
function impPause(){ persistDraft(); impLeave(); goPage('recettes'); toast('Import mis de côté — reprenez-le depuis « Importer une recette »','info'); }
function impAbandon(){
  if(!confirm('Abandonner l’import ? Les recettes pas encore enregistrées seront perdues.')) return;
  draft=null; draftQueue=null; draftQueueIdx=0; persistDraft(); impLeave(); goPage('recettes'); toast('Import abandonné','info');
}

// enregistrement : une recette à la fois, puis la suivante
(function(){
  var _s=saveRecipe;
  saveRecipe=function(){
    if(!IMPQ.active) return _s();
    var name=document.getElementById('r-name').value.trim();
    if(!name){ toast('Nom requis','err'); return; }
    if(!recItems.length){ toast('Ajoutez au moins un ingrédient','err'); return; }
    var d=draft, ids={}; recipes.forEach(function(r){ ids[r.id]=1; });
    var made=impFinalize();
    IMPQ.hold=true;
    try{ _s(); } finally { IMPQ.hold=false; }
    var rec=recipes.find(function(r){ return !ids[r.id]&&r.name===name; })||recipes.find(function(r){ return !ids[r.id]; });
    if(rec){
      rec.source={fileName:d.src.fileName,thumb:d.src.thumb,importedAt:d.src.ts};
      persist();
    }
    d.queueDone=true; delete d.edited;
    var msg='✓ « '+name+' » enregistrée'+(made.ing?' · '+made.ing+' ingrédient'+(made.ing>1?'s':'')+' ajouté'+(made.ing>1?'s':'')+' au catalogue':'')+(made.sub?' · '+made.sub+' sous-recette'+(made.sub>1?'s':''):'');
    IMPQ.cur=null;
    var nx=impNextIdx();
    if(nx>=0){ draftQueueIdx=nx; draft=draftQueue[nx]; persistDraft(); impOpen(); toast(msg,'ok'); return; }
    var total=draftQueue?draftQueue.filter(function(x){ return x.queueDone; }).length:1;
    draft=null; draftQueue=null; draftQueueIdx=0; persistDraft();
    impLeave(); goPage('recettes');
    toast(total>1?'✓ '+total+' recettes importées':msg,'ok');
  };
})();

// navigation : quitter l'éditeur d'import nettoie les brouillons
(function(){
  var _g=goPage;
  goPage=function(p){
    if(IMPQ.hold&&p==='recettes') return;
    if(IMPQ.active&&p!=='rec-edit') impLeave();
    if(p!=='rec-import'&&p!=='rec-valid') ['p-rec-valid','p-rec-import'].forEach(function(id){ var e=document.getElementById(id); if(e) e.style.display='none'; });
    return _g.apply(this,arguments);
  };
})();

// l'écran de vérification est remplacé par l'éditeur
(function(){
  var _rd=renderDraft;
  renderDraft=function(){ if(draft&&draft.multi) return _rd(); impOpen(); };
})();

RIMP.addIgnored=impAddIgnored; RIMP.setIng=impSetIng; RIMP.swap=impSwap; RIMP.setName=impSetName; RIMP.pause=impPause; RIMP.abandon=impAbandon;

// Point d'entrée programmatique : ouvre l'éditeur à partir de recettes déjà analysées.
RIMP.fromParsed=function(list,fileName){
  var res={thumb:null,fileName:fileName||'document',text:''};
  var q=list.map(function(p){ var d=buildDraft(p,res,[]); d.queueDone=false; return d; });
  if(q.length>1){ draftQueue=q; draftQueueIdx=0; draft=q[0]; } else { draftQueue=null; draftQueueIdx=0; draft=q[0]; }
  renderDraft();
};
