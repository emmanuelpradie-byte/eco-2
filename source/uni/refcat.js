// ══ CATALOGUE COMMUN ══════════════════════════════════════════
// L'administrateur publie ses ingrédients dans un catalogue de référence
// (table ref_ingredients) ; chaque compte peut y piocher, tout importer
// d'un coup, et reprendre les prix mis à jour.
var REF={rows:{},loaded:false,missing:false,q:'',f:'all',busy:false};
try{ REF.rows=JSON.parse(LS.getItem('v4_ref_cache')||'{}')||{}; REF.loaded=Object.keys(REF.rows).length>0; }catch(e){}
function refList(){ return Object.keys(REF.rows).map(function(k){ return REF.rows[k]; }).filter(function(r){ return r&&!r.deleted&&r.data&&r.data.name; }); }
function refLoad(){
  if(typeof clActive!=='function'||!clActive()) return Promise.resolve(false);
  return clAuthed(function(){ return clFetch('/rest/v1/ref_ingredients?select=id,data,deleted,updated_at&order=updated_at.asc&limit=5000'); })
    .then(function(rows){ var m={}; (rows||[]).forEach(function(r){ m[r.id]=r; }); REF.rows=m; REF.loaded=true; REF.missing=false;
      try{ LS.setItem('v4_ref_cache',JSON.stringify(m)); }catch(e){} refBadge(); return true; })
    .catch(function(e){ if(e&&(e.status===404||e.status===400)) REF.missing=true; return false; });
}
function refBP(o){ return o?(o.buyPrice!=null?Number(o.buyPrice):Number(o.price)||0):0; }
function refMatch(row){
  var m=ingredients.find(function(i){ return !i._imp&&i.refId===row.id; });
  if(m) return m;
  var n=normTxt(String(row.data.name).trim());
  return ingredients.find(function(i){ return !i._imp&&normTxt(String(i.name).trim())===n; })||null;
}
function refDiff(row,ing){ return !!ing&&(Math.abs(refBP(ing)-refBP(row.data))>0.0001||String(ing.unit||'kg')!==String(row.data.unit||'kg')); }
function refStats(){
  var n=0,d=0; refList().forEach(function(r){ var m=refMatch(r); if(!m) n++; else if(refDiff(r,m)&&refBP(r.data)>0) d++; }); return {nw:n,diff:d};
}
function refBadge(){
  var b=document.getElementById('ref-btn-n'); if(!b) return;
  var s=refStats(), t=s.nw+s.diff; b.textContent=t?String(t):''; b.style.display=t?'':'none';
}
// ── ajout / mise à jour chez moi ──
function refAddOne(id,quiet){
  var row=REF.rows[id]; if(!row||refMatch(row)) return false;
  var d=row.data, bp=refBP(d);
  var ing={_m:1,id:ingredients.some(function(i){ return i.id===id; })?uid():id,name:d.name,cat:d.cat||'Autre',unit:d.unit||'kg',unitWeight:d.unitWeight||null,
    buyPrice:bp,price:Number(d.price)||0,allergens:(d.allergens||[]).slice(),allergensSet:!!d.allergensSet,allergensAuto:true,refId:id,createdAt:now(),
    priceHistory:bp>0?[{d:today(),p:bp,u:d.unit||'kg',k:Number(d.price)||0}]:[]};
  ingredients.push(ing);
  if(!quiet){ persist(); renderCat(); refRender(); refBadge(); toast('« '+d.name+' » ajouté à ton catalogue','ok'); }
  return true;
}
function refUpdOne(id,quiet){
  var row=REF.rows[id], ing=row&&refMatch(row); if(!ing||!refDiff(row,ing)) return false;
  var before={p:refBP(ing),u:ing.unit,k:ing.price}, d=row.data;
  ing.buyPrice=refBP(d); ing.price=Number(d.price)||0; ing.unit=d.unit||'kg'; ing.unitWeight=d.unitWeight||null; ing.refId=id; ing.updatedAt=now();
  if(typeof pushPriceHistory==='function') try{ pushPriceHistory(ing,before); }catch(e){}
  if(!quiet){ persist(); renderCat(); refRender(); refBadge(); toast('Prix de « '+ing.name+' » mis à jour','ok'); }
  return true;
}
function refAddAll(){
  var n=0; refList().forEach(function(r){ if(refAddOne(r.id,true)) n++; });
  persist(); renderCat(); refRender(); refBadge(); toast(n?n+' ingrédient'+(n>1?'s':'')+' ajouté'+(n>1?'s':'')+' à ton catalogue':'Rien de nouveau à ajouter','ok');
}
function refUpdAll(){
  if(!confirm('Remplacer le prix de tes ingrédients par celui du catalogue commun quand ils sont différents ?')) return;
  var n=0; refList().forEach(function(r){ if(refBP(r.data)>0&&refUpdOne(r.id,true)) n++; });
  persist(); renderCat(); refRender(); refBadge(); toast(n+' prix mis à jour','ok');
}
// ── administrateur : publier ──
function refPublishable(){ return ingredients.filter(function(i){ return !i._imp&&i.name&&!/^Copie —/.test(i.name); }); }
function refPayload(i){ return {name:i.name,cat:i.cat||'Autre',unit:i.unit||'kg',unitWeight:i.unitWeight||null,buyPrice:refBP(i),price:Number(i.price)||0,allergens:(i.allergens||[]).slice(),allergensSet:!!i.allergensSet}; }
function refPublish(){
  if(!clIsAdmin()){ toast('Réservé à l’administrateur','err'); return; }
  if(REF.busy) return;
  var rows=[], ch=false;
  refPublishable().forEach(function(i){
    if(!i.refId){ i.refId=i.id; ch=true; }
    var p=refPayload(i), old=REF.rows[i.refId];
    if(!old||old.deleted||JSON.stringify(old.data)!==JSON.stringify(p)) rows.push({id:i.refId,data:p,deleted:false});
  });
  if(ch) persist();
  if(!rows.length){ toast('Le catalogue commun est déjà à jour','ok'); return; }
  REF.busy=true; refRender();
  var batches=[]; for(var k=0;k<rows.length;k+=200) batches.push(rows.slice(k,k+200));
  batches.reduce(function(p,b){ return p.then(function(){ return clAuthed(function(){ return clUpsert('ref_ingredients','id',b); }); }); },Promise.resolve())
    .then(refLoad).then(function(){ toast(rows.length+' ingrédient'+(rows.length>1?'s':'')+' publié'+(rows.length>1?'s':'')+' dans le catalogue commun','ok'); })
    .catch(function(e){ toast(REF.missing||(e&&e.status===404)?'Le serveur n’a pas encore le catalogue commun (mise à jour SQL v7 à lancer)':((e&&e.message)||'Erreur'),'err'); })
    .then(function(){ REF.busy=false; refRender(); });
}
function refRemove(id){
  if(!clIsAdmin()) return;
  var row=REF.rows[id]; if(!row||!confirm('Retirer « '+row.data.name+' » du catalogue commun ? (Les catalogues des autres comptes ne changent pas.)')) return;
  clAuthed(function(){ return clUpsert('ref_ingredients','id',[{id:id,data:row.data,deleted:true}]); }).then(refLoad).then(function(){ refRender(); toast('Retiré du catalogue commun','ok'); })
    .catch(function(e){ toast((e&&e.message)||'Erreur','err'); });
}
// ── fenêtre ──
function refOpen(){
  var ov=document.getElementById('m-ref');
  if(!ov){
    ov=document.createElement('div'); ov.className='ov'; ov.id='m-ref';
    ov.innerHTML='<div class="modal ref-m"><div class="m-grip"></div><div class="m-hdr"><h3>'+ic('users')+' Catalogue commun</h3><button class="m-x" onclick="refClose()" aria-label="Fermer">'+ic('x')+'</button></div>'+
      '<div class="ref-top" id="ref-top"></div><div class="m-body ref-b" id="ref-list"></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click',function(e){ if(e.target===ov) refClose(); });
  }
  REF.q=''; REF.f='all'; ov.classList.add('show'); refRender();
  if(typeof clActive==='function'&&clActive()) refLoad().then(function(){ refRender(); });
}
function refClose(){ var ov=document.getElementById('m-ref'); if(ov) ov.classList.remove('show'); }
function refSearch(v){ REF.q=v; refRenderList(); }
function refFilter(f){ REF.f=f; refRender(); }
function refRender(){
  var top=document.getElementById('ref-top'); if(!top) return;
  var on=typeof clActive==='function'&&clActive(), adm=on&&clIsAdmin(), s=refStats(), all=refList().length;
  var h='';
  if(!on) h+='<div class="ref-msg">Connecte-toi à ton espace en ligne pour voir le catalogue commun.</div>';
  else if(REF.missing) h+='<div class="ref-msg">Le serveur n’a pas encore le catalogue commun. '+(adm?'Lance la mise à jour SQL « v7 » dans Supabase, puis rouvre cette fenêtre.':'L’administrateur doit d’abord l’activer.')+'</div>';
  else {
    h+='<div class="ref-sub">'+(all?all+' ingrédient'+(all>1?'s':'')+' partagé'+(all>1?'s':'')+' par l’administrateur.':'Le catalogue commun est vide pour l’instant.')+'</div>';
    if(adm) h+='<button class="btn btn-gold btn-sm ref-pub" onclick="refPublish()"'+(REF.busy?' disabled':'')+'>'+ic('upload')+(REF.busy?' Publication…':' Publier mon catalogue ('+refPublishable().length+')')+'</button>';
    if(all) h+='<div class="ref-acts">'+
      '<button class="btn btn-ghost btn-sm" onclick="refAddAll()"'+(s.nw?'':' disabled')+'>'+ic('plus')+' Tout ajouter'+(s.nw?' ('+s.nw+')':'')+'</button>'+
      '<button class="btn btn-ghost btn-sm" onclick="refUpdAll()"'+(s.diff?'':' disabled')+'>'+ic('refresh')+' Mettre à jour les prix'+(s.diff?' ('+s.diff+')':'')+'</button></div>'+
      '<label class="cn-srch ref-srch"><input type="search" placeholder="Rechercher…" value="'+esc(REF.q)+'" oninput="refSearch(this.value)" autocomplete="off">'+ic('search')+'</label>'+
      '<div class="ref-chips">'+[['all','Tous',all],['new','Nouveaux pour moi',s.nw],['diff','Prix différents',s.diff]].map(function(c){
        return '<button class="chip'+(REF.f===c[0]?' on':'')+'" onclick="refFilter(\''+c[0]+'\')">'+c[1]+' <b>'+c[2]+'</b></button>'; }).join('')+'</div>';
  }
  top.innerHTML=h; refRenderList();
}
function refRenderList(){
  var box=document.getElementById('ref-list'); if(!box) return;
  var adm=typeof clIsAdmin==='function'&&clIsAdmin();
  var q=normTxt(REF.q.trim()), w=q.split(/\s+/).filter(Boolean);
  var list=refList().filter(function(r){ var n=normTxt(r.data.name+' '+(r.data.cat||'')); return w.every(function(x){ return n.indexOf(x)>=0; }); })
    .map(function(r){ return {r:r,m:refMatch(r)}; })
    .filter(function(o){ return REF.f==='all'||(REF.f==='new'&&!o.m)||(REF.f==='diff'&&o.m&&refDiff(o.r,o.m)&&refBP(o.r.data)>0); })
    .sort(function(a,b){ return String(a.r.data.cat).localeCompare(String(b.r.data.cat),'fr')||a.r.data.name.localeCompare(b.r.data.name,'fr'); });
  if(!list.length){ box.innerHTML=refList().length?'<div class="empty-s" style="padding:24px 8px;text-align:center">Aucun ingrédient ici.</div>':''; return; }
  var cat=null, html='';
  list.forEach(function(o){
    var d=o.r.data, bp=refBP(d), act;
    if(d.cat!==cat){ cat=d.cat; html+='<div class="swp-h">'+catDot(cat)+esc(cat||'Autre')+'</div>'; }
    if(!o.m) act='<button class="btn btn-gold btn-sm" onclick="refAddOne(\''+o.r.id+'\')">'+ic('plus')+' Ajouter</button>';
    else if(refDiff(o.r,o.m)&&bp>0) act='<button class="btn btn-ghost btn-sm" onclick="refUpdOne(\''+o.r.id+'\')" title="Ton prix : '+esc(fEur(refBP(o.m)))+' / '+esc(o.m.unit||'kg')+'">'+ic('refresh')+' Prendre ce prix</button>';
    else act='<span class="ref-ok">'+ic('check')+' Déjà chez toi</span>';
    html+='<div class="ref-r"><div class="ref-i"><b>'+esc(d.name)+'</b><small>'+(bp>0?fEur(bp)+' / '+esc(d.unit||'kg'):'sans prix')+
      (o.m&&refDiff(o.r,o.m)&&bp>0?' · <span class="ref-was">toi : '+fEur(refBP(o.m))+' / '+esc(o.m.unit||'kg')+'</span>':'')+'</small></div>'+
      '<div class="ref-a">'+act+(adm?'<button class="cat-d" onclick="refRemove(\''+o.r.id+'\')" title="Retirer du catalogue commun">'+ic('x')+'</button>':'')+'</div></div>';
  });
  box.innerHTML=html;
}
// bouton dans le catalogue + rafraîchissement à l'ouverture de la page
(function(){
  var _g=goPage; goPage=function(p){ var r=_g.apply(this,arguments); if(p==='catalogue'){ refBadge(); if(typeof clActive==='function'&&clActive()) refLoad(); } return r; };
})();
