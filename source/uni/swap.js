// ══ CHANGER UN ÉLÉMENT DE RECETTE (avec recherche) ═════════════
// Fenêtre commune à l'éditeur de recette et à l'import : on cherche dans
// tout le catalogue et dans les recettes (utilisées comme sous-recette).
var SWP={o:null,q:''};
function swpUses(rid,target,seen){
  seen=seen||{}; if(rid===target) return true; if(seen[rid]) return false; seen[rid]=1;
  var r=recipes.find(function(x){ return x.id===rid; }); if(!r) return false;
  return (r.items||[]).some(function(it){ return it.type==='recipe'&&swpUses(it.refId,target,seen); });
}
function swpRecOk(r){ return !r._imp&&!(editRecId&&swpUses(r.id,editRecId)); }
// o = {cur:{type,id}, name:'nom lu', allowNew:bool, onPick:function(val)}  val = 'ing:ID' | 'rec:ID' | ''
function swapOpen(o){
  SWP.o=o; SWP.q='';
  var ov=document.getElementById('m-swap');
  if(!ov){
    ov=document.createElement('div'); ov.className='ov'; ov.id='m-swap';
    ov.innerHTML='<div class="modal swp-m"><div class="m-grip"></div><div class="m-hdr"><h3>Changer l’ingrédient</h3>'+
      '<button class="m-x" onclick="swapClose()" aria-label="Fermer">'+ic('x')+'</button></div>'+
      '<div class="swp-s">'+ic('search')+'<input class="fi" type="text" inputmode="search" enterkeyhint="search" id="swp-q" placeholder="Rechercher un ingrédient ou une recette…" autocomplete="off" oninput="swpFilter(this.value)">'+
      '<button class="swp-cl" id="swp-cl" onclick="swpFilter(\'\');var i=document.getElementById(\'swp-q\');i.value=\'\';i.focus()" aria-label="Effacer">'+ic('x')+'</button></div>'+
      '<div class="m-body swp-b" id="swp-list"></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click',function(e){ if(e.target===ov) swapClose(); });
  }
  var inp=document.getElementById('swp-q'); inp.value='';
  swpRender(); ov.classList.add('show');
  setTimeout(function(){ try{ inp.focus(); }catch(e){} },60);
}
function swapClose(){ var ov=document.getElementById('m-swap'); if(ov) ov.classList.remove('show'); SWP.o=null; }
function swpFilter(v){ SWP.q=String(v||''); swpRender(); }
function swpPick(val){ var o=SWP.o; swapClose(); if(o&&o.onPick) o.onPick(val); }
function swpRow(val,on,title,meta,cls){
  return '<button class="swp-r'+(on?' on':'')+(cls?' '+cls:'')+'" onclick="swpPick(\''+val+'\')">'+
    '<span class="swp-t">'+title+'</span>'+(meta?'<span class="swp-mt">'+meta+'</span>':'')+
    (on?'<span class="swp-ok">'+ic('check')+'</span>':'')+'</button>';
}
function swpRender(){
  var o=SWP.o, box=document.getElementById('swp-list'); if(!o||!box) return;
  var q=normTxt(SWP.q.trim()), words=q.split(/\s+/).filter(Boolean);
  var hit=function(name){ var n=normTxt(name); return words.every(function(w){ return n.indexOf(w)>=0; }); };
  var cur=o.cur||{}, html='', shown={};
  var cl=document.getElementById('swp-cl'); if(cl) cl.style.visibility=q?'visible':'hidden';
  var ingMeta=function(i){ return esc(i.cat||'')+(i.price>0?' · '+fEur(i.price)+' / kg':''); };
  if(o.allowNew&&!q) html+='<div class="swp-h">Nouveau</div>'+swpRow('',cur.type==='new','＋ Nouvel ingrédient « '+esc(o.name||'')+' »','Créé dans le catalogue à l’enregistrement','swp-new');
  if(!q&&o.name){
    var sug=[]; try{ sug=findMatches(o.name).filter(function(x){ return !x.ing._imp; }).slice(0,5); }catch(e){}
    if(sug.length){
      html+='<div class="swp-h">Suggestions pour « '+esc(o.name)+' »</div>'+sug.map(function(x){
        shown[x.ing.id]=1; return swpRow('ing:'+x.ing.id,cur.type==='ingredient'&&cur.id===x.ing.id,esc(x.ing.name),Math.round(x.score*100)+' % · '+ingMeta(x.ing));
      }).join('');
    }
  }
  var ings=ingredients.filter(function(i){ return !i._imp&&!shown[i.id]&&(!q||hit(i.name)); })
    .sort(function(a,b){ return a.name.localeCompare(b.name,'fr'); });
  var recs=recipes.filter(function(r){ return swpRecOk(r)&&(!q||hit(r.name)); })
    .sort(function(a,b){ return a.name.localeCompare(b.name,'fr'); });
  if(ings.length) html+='<div class="swp-h">Ingrédients'+(q?' ('+ings.length+')':'')+'</div>'+ings.map(function(i){
    return swpRow('ing:'+i.id,cur.type==='ingredient'&&cur.id===i.id,esc(i.name),ingMeta(i));
  }).join('');
  if(recs.length) html+='<div class="swp-h">Utiliser une sous-recette'+(q?' ('+recs.length+')':'')+'</div>'+recs.map(function(r){
    var w=recWeight(r.id);
    return swpRow('rec:'+r.id,cur.type==='recipe'&&cur.id===r.id,ic('sub')+' '+esc(r.name),esc(r.cat||'')+(w>0?' · '+fQtyNice(w):''),'swp-rec');
  }).join('');
  if(!ings.length&&!recs.length) html+='<div class="empty-s swp-none">Aucun résultat pour « '+esc(SWP.q.trim())+' »'+
    (o.allowNew?'<br><button class="btn btn-ghost btn-sm" style="margin-top:10px" onclick="swpPick(\'new:\'+encodeURIComponent(SWP.q.trim()))">＋ Créer « '+esc(SWP.q.trim())+' »</button>':'')+'</div>';
  box.innerHTML=html;
}
document.addEventListener('keydown',function(e){
  if(!SWP.o) return;
  if(e.key==='Escape'){ e.preventDefault(); swapClose(); }
  else if(e.key==='Enter'&&e.target&&e.target.id==='swp-q'){ var b=document.querySelector('#swp-list .swp-r'); if(b){ e.preventDefault(); b.click(); } }
});

// Éditeur de recette : changer l'ingrédient (ou la sous-recette) d'une ligne en gardant le poids
function reSwap(idx){
  var it=recItems[idx]; if(!it) return;
  if(typeof IMPQ!=='undefined'&&IMPQ.active&&it.imp&&it.imp.lid&&!it.imp.isSub&&typeof RIMP!=='undefined'&&RIMP.swap) return RIMP.swap(idx);
  var nm=it.type==='ingredient'?((ingredients.find(function(x){ return x.id===it.refId; })||{}).name||''):((recipes.find(function(x){ return x.id===it.refId; })||{}).name||'');
  swapOpen({cur:{type:it.type,id:it.refId},name:nm,allowNew:false,onPick:function(val){ reSwapApply(idx,val); }});
}
function reItemKg(it){
  if(it.type==='recipe') return (recWeight(it.refId)||0)*(Number(it.qty)||0);
  return toKg(it.qty,it.unit,ingredients.find(function(x){ return x.id===it.refId; }));
}
function reSwapApply(idx,val){
  var it=recItems[idx]; if(!it||!val) return;
  var kg=reItemKg(it), id=val.replace(/^(ing|rec):/,'');
  if(/^rec:/.test(val)){
    if(it.type==='recipe'&&it.refId===id) return;
    var base=recWeight(id), m=(base>0&&kg>0)?Math.round(kg/base*1e6)/1e6:1;
    recItems[idx]={id:it.id,type:'recipe',refId:id,qty:m,unit:'x'};
  } else {
    var ing=ingredients.find(function(x){ return x.id===id; }); if(!ing) return;
    if(it.type==='ingredient'){
      if(it.refId===id) return;
      // même quantité ; si l'unité « pièce » n'a pas de sens pour le nouvel ingrédient, on repasse en kg
      var keep=!isCountable(it.unit)||(isCountable(ing.unit)&&ing.unitWeight>0);
      recItems[idx]={id:it.id,type:'ingredient',refId:id,qty:keep?it.qty:Math.round(kg*1000)/1000,unit:keep?it.unit:'kg'};
    } else {
      recItems[idx]={id:it.id,type:'ingredient',refId:id,qty:Math.round(kg*1000)/1000,unit:'kg'};
    }
  }
  renderRItems(); toast('Remplacé par « '+(/^rec:/.test(val)?(recipes.find(function(r){ return r.id===id; })||{}).name:ingredients.find(function(x){ return x.id===id; }).name)+' »','ok');
}
