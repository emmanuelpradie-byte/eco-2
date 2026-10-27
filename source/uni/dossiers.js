// ══ RECETTES RANGÉES EN DOSSIERS ══════════════════════════════
// Sans recherche ni filtre, le carnet s'ouvre sur les catégories (dossiers),
// puis leurs sous-catégories, puis les recettes. Dès qu'on cherche ou filtre,
// on revient à la liste complète.
function recFoldOn(){ try{ return LS.getItem('v4_recfolders')!=='0'; }catch(e){ return true; } }
function recFoldToggle(){ try{ LS.setItem('v4_recfolders',recFoldOn()?'0':'1'); }catch(e){} renderRec(); }
function recFoldFree(){
  var q=((document.getElementById('rec-srch')||{}).value||'').trim();
  return !q&&!RF.letter&&!RF.alg.length&&!RF.tags.length&&!RF.ing.length&&!RF.date;
}
function recFoldActive(){ return recFoldOn()&&recFoldFree(); }
// catégories dans l'ordre choisi, plus celles utilisées mais absentes de la liste
function catAll(kind){
  var arr=kind==='rec'?recipes:ingredients, list=loadCats(kind).slice();
  arr.forEach(function(x){ var c=x.cat||''; if(list.indexOf(c)<0) list.push(c); });
  return list;
}
function catItems(kind,c){ return (kind==='rec'?recipes:ingredients).filter(function(x){ return (x.cat||'')===c; }); }
function recFoldBox(){
  var b=document.getElementById('rec-folders');
  if(!b){ var g=document.getElementById('rec-grid'); if(!g) return null; b=document.createElement('div'); b.id='rec-folders'; g.parentNode.insertBefore(b,g); }
  return b;
}
function recFoldTile(name,n,sub,click,hue,empty,word){
  word=word||'recette';
  return '<div class="rf-fold'+(empty?' rf-empty':'')+'" style="--ch:'+hue+'" onclick="'+click+'">'+
    '<span class="rf-fi">'+ic('folder')+'</span><span class="rf-ft"><b>'+esc(name)+'</b><small>'+
    (n?n+' '+word+(n>1?'s':''):'Vide')+(sub?' · '+sub+' dossier'+(sub>1?'s':''):'')+'</small></span>'+ic('chev-right')+'</div>';
}
function recFoldCrumb(parts){
  return '<div class="rf-crumb">'+parts.map(function(p,i){
    return (i?'<span class="rf-sep">'+ic('chev-right')+'</span>':'')+(p.click?'<button onclick="'+p.click+'">'+(i?'':ic('folder')+' ')+esc(p.l)+'</button>':'<b>'+esc(p.l)+'</b>');
  }).join('')+'</div>';
}
(function(){
  var _renderRec=renderRec;
  renderRec=function(){
    _renderRec.apply(this,arguments);
    var fb=document.getElementById('rv-fold'); if(fb){ fb.classList.toggle('on',recFoldOn()); fb.title=recFoldOn()?'Dossiers : activés':'Dossiers : désactivés'; }
    var box=recFoldBox(); if(!box) return;
    if(!recFoldActive()){ box.innerHTML=''; box.style.display='none'; return; }
    var grid=document.getElementById('rec-grid'), emp=document.getElementById('rec-empty');
    var view=recView(), fn=view==='list'?recRow:recTile;
    box.style.display='';
    if(!activeCat&&!activeSub){
      grid.innerHTML=''; grid._rest=[];
      if(!recipes.length){ box.innerHTML=''; return; }
      emp.style.display='none';
      box.innerHTML='<div class="rf-grid">'+catAll('rec').map(function(c){
        var n=catItems('rec',c).length, s=subsOf('rec',c).length;
        if(!n&&!s&&c==='') return '';
        return recFoldTile(c||'Sans catégorie',n,s,'cnCat(\''+escJS(c)+'\')',catHue(c),!n);
      }).join('')+'</div>';
      return;
    }
    if(activeSub){
      var sb=subById('rec',activeSub);
      box.innerHTML=recFoldCrumb([{l:'Toutes les catégories',click:'cnCat(\'\')'}].concat(sb?[{l:sb.parent||'Sans catégorie',click:'cnCat(\''+escJS(sb.parent)+'\')'}]:[]).concat([{l:sb?sb.name:'Dossier'}]));
      return;
    }
    var subs=subsOf('rec',activeCat), ids={}; subs.forEach(function(s){ ids[s.id]=1; });
    var list=recFiltered(true).filter(function(r){ return !(r.sub&&ids[r.sub]); });
    box.innerHTML=recFoldCrumb([{l:'Toutes les catégories',click:'cnCat(\'\')'},{l:activeCat||'Sans catégorie'}])+
      (subs.length?'<div class="rf-grid sub">'+subs.map(function(s){ return recFoldTile(s.name,subCount('rec',s.id),0,'cnSub(\''+s.id+'\')',catHue(activeCat),!subCount('rec',s.id)); }).join('')+'</div>':'');
    if(list.length){ emp.style.display='none'; grid.classList.toggle('tiles',view!=='list'); grid.classList.toggle('big',view==='big'); cnPaint(grid,list,fn); }
    else { grid.innerHTML=''; grid._rest=[]; emp.style.display=subs.length?'none':''; if(!subs.length){ document.getElementById('rec-empty-t').textContent='Aucune recette dans cette catégorie.'; var eb=document.getElementById('rec-empty-b'); eb.style.display=''; eb.innerHTML=ic('plus-circle')+' Créer une recette'; eb.onclick=function(){ openNewRec(); }; } }
  };
})();

// ══ PARAMÈTRES DES CATÉGORIES (recettes et catalogue) ═════════
// Ajouter, renommer, ranger, supprimer — avec leurs sous-catégories.
var CATM={del:'',open:{}};
function catMgrRefresh(){
  try{ persist(); }catch(e){}
  renderSubMgr();
  try{ renderRec(); }catch(e){} try{ renderCat(); }catch(e){}
}
function catNameClash(kind,name,except){ var n=name.toLowerCase(); return catAll(kind).filter(function(c){ return c!==except&&String(c).toLowerCase()===n; })[0]; }
function catAddUI(){
  var kind=subMgrKind;
  askText('Nouvelle catégorie',kind==='rec'?'Ex : Entremets, Traiteur…':'Ex : Chocolats, Fruits secs…',function(name){
    name=String(name||'').trim(); if(!name) return;
    if(catNameClash(kind,name)){ toast('« '+name+' » existe déjà','err'); return; }
    var l=loadCats(kind); l.push(name); saveCats(kind,l); CATM.open[kind+'|'+name]=true;
    catMgrRefresh(); toast('Catégorie « '+name+' » ajoutée','ok');
  });
}
function catRenameUI(i){
  var kind=subMgrKind, old=catAll(kind)[i]; if(old==null) return;
  askText('Renommer la catégorie','Nouveau nom',function(name){
    name=String(name||'').trim(); if(!name||name===old) return;
    var tgt=catNameClash(kind,name,old);
    if(tgt&&!confirm('« '+tgt+' » existe déjà.\n\nRegrouper « '+old+' » dedans ?')) return;
    catMerge(kind,old,tgt||name,!tgt);
    catMgrRefresh(); toast(tgt?'Catégories regroupées':'Catégorie renommée','ok');
  });
  var inp=document.getElementById('ask-input'); if(inp){ inp.value=old; try{ inp.select(); }catch(e){} }
}
// old → nouveau nom (rename=true) ou fusion dans une catégorie existante
function catMerge(kind,old,to,rename){
  var l=loadCats(kind), i=l.indexOf(old);
  if(rename){ if(i>=0) l[i]=to; else l.push(to); } else if(i>=0) l.splice(i,1);
  saveCats(kind,l);
  (kind==='rec'?recipes:ingredients).forEach(function(x){ if((x.cat||'')===old){ x.cat=to; x.updatedAt=new Date().toISOString(); } });
  var subs=loadSubs(kind), keep=[];
  subs.forEach(function(s){
    if(s.parent!==old){ keep.push(s); return; }
    var twin=subs.filter(function(t){ return t!==s&&t.parent===to&&t.name.toLowerCase()===s.name.toLowerCase(); })[0];
    if(twin){ (kind==='rec'?recipes:ingredients).forEach(function(x){ if(x.sub===s.id) x.sub=twin.id; }); return; }
    s.parent=to; keep.push(s);
  });
  saveSubs(kind,keep);
  if(kind==='rec'&&typeof activeCat!=='undefined'&&activeCat===old) activeCat=to;
  if(kind==='ing'&&typeof activeIngCat!=='undefined'&&activeIngCat===old) activeIngCat=to;
}
function catMoveUI(i,d){
  var kind=subMgrKind, all=catAll(kind), j=i+d; if(j<0||j>=all.length) return;
  var t=all[i]; all[i]=all[j]; all[j]=t; saveCats(kind,all); catMgrRefresh();
}
function catDelUI(i){ var c=catAll(subMgrKind)[i]; CATM.del=CATM.del===c?'':c; renderSubMgr(); }
function catDelDo(i){
  var kind=subMgrKind, c=catAll(kind)[i]; if(c==null) return;
  var n=catItems(kind,c).length, sel=document.getElementById('catm-to'), to=sel?sel.value:'';
  if((n||subsOf(kind,c).length)&&!to){ toast('Choisis où ranger son contenu','err'); return; }
  if(to) catMerge(kind,c,to,false);
  else { var l=loadCats(kind).filter(function(x){ return x!==c; }); saveCats(kind,l); }
  CATM.del=''; catMgrRefresh();
  toast('Catégorie « '+(c||'Sans catégorie')+' » supprimée'+(n?' — '+n+' élément'+(n>1?'s':'')+' rangé'+(n>1?'s':'')+' dans « '+to+' »':''),'ok');
}
function catTogUI(i){ var k=subMgrKind+'|'+catAll(subMgrKind)[i]; CATM.open[k]=!CATM.open[k]; renderSubMgr(); }
renderSubMgr=function(){
  var box=document.getElementById('submgr-body'); if(!box) return;
  var kind=subMgrKind, cats=catAll(kind), word=kind==='rec'?'recette':'ingrédient';
  loadSubs(kind).forEach(function(s){ if(cats.indexOf(s.parent)<0) cats.push(s.parent); });
  var ti=document.getElementById('submgr-tab-ing'), tr=document.getElementById('submgr-tab-rec');
  if(ti) ti.classList.toggle('on',kind==='ing'); if(tr) tr.classList.toggle('on',kind==='rec');
  box.innerHTML='<button class="btn btn-gold btn-sm btn-full catm-add" onclick="catAddUI()">'+ic('plus')+' Nouvelle catégorie</button>'+
    cats.map(function(c,i){
      var n=catItems(kind,c).length, subs=subsOf(kind,c), open=!!CATM.open[kind+'|'+c];
      var others=cats.filter(function(x){ return x!==c&&x!==''; });
      return '<div class="catm'+(open?' open':'')+'">'+
        '<div class="catm-h"><button class="catm-t" onclick="catTogUI('+i+')">'+ic(open?'chev-down':'chev-right')+catDot(c)+'<span class="catm-tn"><b>'+esc(c||'Sans catégorie')+'</b><small>'+n+' '+word+(n>1?'s':'')+(subs.length?' · '+subs.length+' sous-cat.':'')+'</small></span></button>'+
          '<span class="catm-b"><button title="Monter" onclick="catMoveUI('+i+',-1)"'+(i?'':' disabled')+'>'+ic('chev-up')+'</button><button title="Descendre" onclick="catMoveUI('+i+',1)"'+(i<cats.length-1?'':' disabled')+'>'+ic('chev-down')+'</button>'+
          '<button title="Renommer" onclick="catRenameUI('+i+')">'+ic('edit')+'</button><button title="Supprimer" class="del" onclick="catDelUI('+i+')">'+ic('trash')+'</button></span></div>'+
        (CATM.del===c?'<div class="catm-del">'+(n||subs.length?'<div>'+(n?n+' '+word+(n>1?'s':'')+' et ':'')+(subs.length?subs.length+' sous-catégorie'+(subs.length>1?'s':''):'')+' à ranger dans :</div><select class="fi" id="catm-to"><option value="">Choisir une catégorie…</option>'+others.map(function(o){ return '<option value="'+esc(o)+'">'+esc(o)+'</option>'; }).join('')+'</select>':'<div>Cette catégorie est vide.</div>')+
          '<div class="catm-db"><button class="btn btn-ghost btn-sm" onclick="catDelUI('+i+')">Annuler</button><button class="btn btn-sm catm-dx" onclick="catDelDo('+i+')">'+ic('trash')+' Supprimer</button></div></div>':'')+
        (open?'<div class="catm-s">'+(subs.length?subs.map(function(s){
          return '<div class="catm-sr">'+ic('folder')+'<span>'+esc(s.name)+'</span><small>'+subCount(kind,s.id)+'</small>'+
            '<button title="Renommer" onclick="renameSubUI(\''+s.id+'\')">'+ic('edit')+'</button><button title="Changer de catégorie" onclick="moveSubUI(\''+s.id+'\')">'+ic('swap')+'</button><button title="Supprimer" class="del" onclick="deleteSubUI(\''+s.id+'\')">'+ic('trash')+'</button></div>';
        }).join(''):'<div class="catm-none">Aucune sous-catégorie</div>')+
        '<button class="lnk" onclick="addSubUI(\''+escJS(c)+'\')">'+ic('plus')+' Sous-catégorie</button></div>':'')+
      '</div>';
    }).join('');
};
function openCatMgr(kind){ CATM.del=''; openSubMgr(kind); }

// ══ AJOUT AU BON : même barre de recherche que le carnet ══════
var BP_SORTS={rec:[['az','Nom : A → Z'],['za','Nom : Z → A'],['cheap','Coût croissant'],['dear','Coût décroissant'],['new','Plus récentes']],
  ing:[['az','Nom : A → Z'],['za','Nom : Z → A'],['cheap','Prix croissant'],['dear','Prix décroissant'],['use','Les plus utilisés']]};
function bpCatOpts(kind){
  var arr=kind==='rec'?recipes:ingredients, n={}, out=[];
  arr.forEach(function(x){ n[x.cat||'']=(n[x.cat||'']||0)+1; });
  catAll(kind).forEach(function(c){
    if(!n[c]) return;
    out.push({v:'c:'+c,l:c||'Sans catégorie',html:catDot(c)+esc(c||'Sans catégorie'),n:n[c]});
    subsOf(kind,c).forEach(function(s){ var k=subCount(kind,s.id); if(k) out.push({v:'s:'+s.id,l:s.name,html:ic('folder')+' '+esc(s.name),n:k,sub:true}); });
  });
  return out;
}
function bpCatOk(kind,x){
  var a=fbA('b'+kind,'cat'); if(!a.length) return true;
  return a.some(function(v){ return v.indexOf('s:')===0?x.sub===v.slice(2):(x.cat||'')===v.slice(2); });
}
function bpSort(kind,list,costFn){
  var s=fbV('b'+kind,'sort','az'), cmp=function(a,b){ return String(a.name).localeCompare(String(b.name),'fr',{sensitivity:'base'}); };
  if(s==='za') return list.sort(function(a,b){ return cmp(b,a); });
  if(s==='new') return list.sort(function(a,b){ return String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')); });
  if(s==='cheap'||s==='dear'){ var c={}; list.forEach(function(x){ c[x.id]=costFn(x)||0; }); return list.sort(function(a,b){ return s==='cheap'?c[a.id]-c[b.id]:c[b.id]-c[a.id]; }); }
  if(s==='use'){ var u=typeof catUseCount==='function'?catUseCount():{}; return list.sort(function(a,b){ return (u[b.id]||0)-(u[a.id]||0)||cmp(a,b); }); }
  return list.sort(cmp);
}
function bpClear(kind){ var i=document.getElementById(kind==='rec'?'rec-mod-s':'ing-s'); if(i){ i.value=''; try{ i.focus(); }catch(e){} } if(kind==='rec') buildRecList(); else filterIng(); }
// en-têtes de catégorie quand la liste est triée par nom
function bpGroup(kind,list,row){
  var s=fbV('b'+kind,'sort','az'); if(s!=='az'||list.length<6) return list.map(row).join('');
  var order=catAll(kind), by={};
  list.forEach(function(x){ (by[x.cat||'']=by[x.cat||'']||[]).push(x); });
  return order.filter(function(c){ return by[c]; }).map(function(c){
    return '<div class="bp-h">'+catDot(c)+esc(c||'Sans catégorie')+'<span>'+by[c].length+'</span></div>'+by[c].map(row).join('');
  }).join('');
}
fbReg('brec',{box:'brec-filters',active:'brec-active',q:'rec-mod-s',render:function(){ buildRecList(); },onReset:function(){},defs:function(){
  return [
    {k:'cat',title:'Catégories',multi:true,search:true,opts:bpCatOpts('rec')},
    {k:'tags',title:'Tags',multi:true,search:true,icon:'tag',opts:fbCountOpts(recipes,function(r){ return r.tags||[]; }),empty:'Aucun tag pour l’instant.'},
    {k:'alg',title:'Allergènes',multi:true,hint:'Masquer les recettes contenant :',opts:ALLERGENS.map(function(a){ return {v:a.k,l:a.n,short:'Sans '+a.n.toLowerCase()}; }),chip:function(l){ return 'Sans '+l.toLowerCase(); }},
    {k:'sort',title:'Trier',keep:true,opts:BP_SORTS.rec.map(function(x){ return {v:x[0],l:x[1]}; })}
  ];
}});
fbReg('bing',{box:'bing-filters',active:'bing-active',q:'ing-s',render:function(){ filterIng(); },onReset:function(){},defs:function(){
  var supN={}; ingredients.forEach(function(i){ var k=(typeof supById==='function'&&supById(i.supplierId))?i.supplierId:'__none__'; supN[k]=(supN[k]||0)+1; });
  var supOpts=(typeof supSorted==='function'?supSorted():[]).filter(function(s){ return supN[s.id]; }).map(function(s){ return {v:s.id,l:s.name,n:supN[s.id]}; });
  if(supN.__none__&&supOpts.length) supOpts.push({v:'__none__',l:'Sans fournisseur',n:supN.__none__});
  var d=[{k:'cat',title:'Catégories',multi:true,search:true,opts:bpCatOpts('ing')}];
  if(supOpts.length) d.push({k:'sup',title:'Fournisseurs',multi:true,search:supOpts.length>8,icon:'truck',opts:supOpts});
  d.push({k:'alg',title:'Allergènes',multi:true,hint:'Masquer les ingrédients contenant :',opts:ALLERGENS.map(function(a){ return {v:a.k,l:a.n,short:'Sans '+a.n.toLowerCase()}; }),chip:function(l){ return 'Sans '+l.toLowerCase(); }});
  d.push({k:'sort',title:'Trier',keep:true,opts:BP_SORTS.ing.map(function(x){ return {v:x[0],l:x[1]}; })});
  return d;
}});
fbS('brec').v.sort='az'; fbS('bing').v.sort='az';
buildRecList=function(){
  var box=document.getElementById('rec-list-m'); if(!box) return;
  var q=normTxt((document.getElementById('rec-mod-s')||{}).value||'').trim(), t=fbA('brec','tags'), a=fbA('brec','alg');
  var list=recipes.filter(function(r){
    if(q&&normTxt(r.name+' '+(r.cat||'')+' '+(r.tags||[]).join(' ')).indexOf(q)<0) return false;
    if(!bpCatOk('rec',r)) return false;
    if(t.length&&!(r.tags||[]).some(function(g){ return t.indexOf(g)>=0; })) return false;
    if(a.length){ var k=recAlgKeys(r); if(a.some(function(x){ return k.indexOf(x)>=0; })) return false; }
    return true;
  });
  bpSort('rec',list,function(r){ return recCost(r.id); });
  fbRender('brec');
  box.innerHTML=list.length?bpGroup('rec',list,function(r){
    return '<div class="rpi'+(selRec&&selRec.id===r.id?' sel':'')+'" onclick="pickRec(\''+r.id+'\')"><div class="rpe">'+recThumb(r)+'</div><div><div class="rpn">'+esc(r.name)+'</div><div class="rpm">'+catDot(r.cat||'')+esc(r.cat||'')+' · '+fEur(recCost(r.id))+' TTC</div></div></div>';
  }):'<div class="empty-s" style="padding:8px 2px">Aucune recette trouvée'+(fbCount('brec')?' — <button class="lnk" onclick="fbReset(\'brec\')">effacer les filtres</button>':'')+'</div>';
};
filterIng=function(){
  var list0=document.getElementById('ing-list'), emp=document.getElementById('ing-empty'); if(!list0) return;
  var q=normTxt((document.getElementById('ing-s')||{}).value||'').trim(), sp=fbA('bing','sup'), a=fbA('bing','alg');
  var f=ingredients.filter(function(i){
    if(q&&normTxt(i.name+' '+(i.cat||'')).indexOf(q)<0) return false;
    if(!bpCatOk('ing',i)) return false;
    if(sp.length){ var k=(typeof supById==='function'&&supById(i.supplierId))?i.supplierId:'__none__'; if(sp.indexOf(k)<0) return false; }
    if(a.length&&a.some(function(x){ return (i.allergens||[]).indexOf(x)>=0; })) return false;
    return true;
  });
  bpSort('ing',f,function(i){ return i.price; });
  fbRender('bing');
  if(!ingredients.length){ list0.innerHTML=''; emp.style.display='block'; return; }
  emp.style.display='none';
  list0.innerHTML=f.length?bpGroup('ing',f,function(i){
    return '<div class="pi2'+(selIng&&selIng.id===i.id?' sel':'')+'" onclick="pickIng(\''+i.id+'\')"><div><div class="pi2-n">'+esc(i.name)+'</div><div class="pi2-m">'+catDot(i.cat||'')+esc(i.cat||'')+' · '+unitLabel(i)+' · '+dispPrice(i)+'</div></div><span class="badge bd-g">'+esc(i.unit)+'</span></div>';
  }):'<div class="empty-s" style="padding:8px 2px">Aucun ingrédient trouvé'+(fbCount('bing')?' — <button class="lnk" onclick="fbReset(\'bing\')">effacer les filtres</button>':'')+'</div>';
};


// ══ CATALOGUE RANGÉ EN DOSSIERS ═══════════════════════════════
// Même principe que les recettes : catégories → sous-catégories → ingrédients.
function catFoldOn(){ try{ return LS.getItem('v4_catfolders')!=='0'; }catch(e){ return true; } }
function catFoldToggle(){ try{ LS.setItem('v4_catfolders',catFoldOn()?'0':'1'); }catch(e){} renderCat(); }
function catFoldFree(){
  var q=((document.getElementById('cat-srch')||{}).value||'').trim();
  return !q&&!CATF.letter&&!fbA('cat','sup').length&&!fbA('cat','alg').length&&!fbA('cat','unit').length&&!fbA('cat','st').length;
}
function catFoldBox(){
  var b=document.getElementById('cat-folders');
  if(!b){ var l=document.getElementById('cat-list'); if(!l) return null; b=document.createElement('div'); b.id='cat-folders'; l.parentNode.insertBefore(b,l); }
  return b;
}
(function(){
  var _renderCat=renderCat;
  renderCat=function(){
    var on=catFoldOn()&&catFoldFree()&&ingredients.length>0;
    window.CAT_FOLD=on?(activeIngSub?'':(activeIngCat?'cat':'root')):'';
    try{ _renderCat.apply(this,arguments); } finally { window.CAT_FOLD=''; }
    var fb=document.getElementById('cv-fold'); if(fb){ fb.classList.toggle('on',catFoldOn()); fb.title=catFoldOn()?'Dossiers : activés':'Dossiers : désactivés'; }
    var box=catFoldBox(); if(!box) return;
    var cl=document.getElementById('cat-list'); if(cl) cl.classList.toggle('folding',on);
    if(!on){ box.innerHTML=''; box.style.display='none'; return; }
    box.style.display='';
    var list=document.getElementById('cat-list'), emp=document.getElementById('cat-empty'), cc=document.getElementById('cat-count');
    if(cc) cc.innerHTML='Mes ingrédients <b>('+ingredients.length+')</b>';
    var hasList=!!(list&&list.innerHTML);
    if(!activeIngCat&&!activeIngSub){
      box.innerHTML='<div class="rf-grid">'+catAll('ing').map(function(c){
        if(c==='') return '';
        var n=catItems('ing',c).length, s=subsOf('ing',c).length;
        return recFoldTile(c,n,s,'catPickCat(\'c:'+escJS(c)+'\')',catHue(c),!n,'ingrédient');
      }).join('')+'</div>'+(hasList?'<div class="cat-loose">Sans catégorie</div>':'');
      if(emp) emp.style.display='none';
      return;
    }
    if(activeIngSub){
      var sb=subById('ing',activeIngSub);
      box.innerHTML=recFoldCrumb([{l:'Toutes les catégories',click:'catPickCat(\'\')'}].concat(sb?[{l:sb.parent||'Sans catégorie',click:'catPickCat(\'c:'+escJS(sb.parent)+'\')'}]:[]).concat([{l:sb?sb.name:'Dossier'}]));
      return;
    }
    var subs=subsOf('ing',activeIngCat);
    box.innerHTML=recFoldCrumb([{l:'Toutes les catégories',click:'catPickCat(\'\')'},{l:activeIngCat}])+
      (subs.length?'<div class="rf-grid sub">'+subs.map(function(s){ var n=subCount('ing',s.id); return recFoldTile(s.name,n,0,'catPickCat(\'s:'+s.id+'\')',catHue(activeIngCat),!n,'ingrédient'); }).join('')+'</div>':'');
    if(!hasList&&emp){ emp.style.display=subs.length?'none':'block'; var et=emp.querySelector('.empty-t'); if(et&&!subs.length) et.textContent='Aucun ingrédient dans cette catégorie.'; }
  };
})();
