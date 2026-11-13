// ══ LIVRE DE RECETTES (administrateurs) ═══════════════════════
// Page « Livre » : on choisit des recettes, on donne un titre, et on obtient un
// PDF complet : couverture, sommaire cliquable (par catégorie, avec numéros de
// page), puis une fiche par recette. Distinct des bons d’économat.
var BK_KEY='v4_book';
if(window.ALLP&&ALLP.indexOf('livre')<0) ALLP.push('livre');
function bkAdm(){ try{ return typeof clIsAdmin==='function'&&!!clIsAdmin(); }catch(e){ return false; } }
function bkGet(){
  var b=null; try{ b=JSON.parse(LS.getItem(BK_KEY)||'null'); }catch(e){}
  b=b||{}; b.title=b.title||''; b.sub=b.sub||''; b.items=Array.isArray(b.items)?b.items:[];
  b.items=b.items.filter(function(x){ return x&&recipes.some(function(r){ return r.id===x.id; }); });
  return b;
}
function bkSave(b){ try{ LS.setItem(BK_KEY,JSON.stringify(b)); }catch(e){} }
var BK={q:''};
function bkIsSub(r){ return !!r&&(r.image==='⊛'||!!(window.BK_AUTO&&BK_AUTO[r.id])); }
var BK_SUB='Sous-recettes';
function bkCatOf(r){ return bkIsSub(r)?BK_SUB:((r&&r.cat)||'Sans catégorie'); }
function bkCmpCat(a,c){ return (a===BK_SUB)-(c===BK_SUB)||a.localeCompare(c,'fr'); }
// ordre du livre : catégories (A→Z), puis recettes (A→Z)
function bkSorted(b){ return bkSortList(b.items); }
function bkSortList(list){
  return list.map(function(x){ return {x:x,r:recipes.find(function(r){ return r.id===x.id; })}; }).filter(function(o){ return o.r; })
    .sort(function(a,c){ return bkCmpCat(bkCatOf(a.r),bkCatOf(c.r))||a.r.name.localeCompare(c.r.name,'fr'); })
    .map(function(o){ return {id:o.x.id,m:o.x.m>0?o.x.m:1}; });
}
function bkHas(b,id){ return b.items.some(function(x){ return x.id===id; }); }
window.bkAdd=function(ids){
  var b=bkGet(); (ids||[]).forEach(function(x){ var id=x.id||x, m=x.m||1; var e=b.items.find(function(y){ return y.id===id; }); if(!e) b.items.push({id:id,m:m}); });
  bkSave(b); bkNav();
};
function bkToggle(id){ var b=bkGet(); if(bkHas(b,id)) b.items=b.items.filter(function(x){ return x.id!==id; }); else b.items.push({id:id,m:1}); bkSave(b); renderLivre(true); }
function bkToggleCat(cat,on){
  var b=bkGet();
  recipes.filter(function(r){ return bkCatOf(r)===cat&&(BK.subs||!bkIsSub(r)); }).forEach(function(r){
    var has=bkHas(b,r.id); if(on&&!has) b.items.push({id:r.id,m:1}); if(!on&&has) b.items=b.items.filter(function(x){ return x.id!==r.id; });
  });
  bkSave(b); renderLivre(true);
}
function bkMult(id,v){ var b=bkGet(), e=b.items.find(function(x){ return x.id===id; }); if(!e) return; var n=parseFloat(String(v).replace(',','.')); e.m=n>0?n:1; bkSave(b); }
function bkField(k,v){ var b=bkGet(); b[k]=v; bkSave(b); }
function bkClear(){ if(!confirm('Vider la sélection du livre ?')) return; var b=bkGet(); b.items=[]; bkSave(b); renderLivre(true); }
function bkQ(v){ BK.q=v; renderLivre(true,true); }
function bkAutoSubs(v){ var b=bkGet(); b.autoSubs=!!v; bkSave(b); }

function renderLivre(keep){
  var w=document.getElementById('bk-wrap'); if(!w) return;
  var b=bkGet(), sorted=bkSorted(b);
  var sc=document.getElementById('scroll'), top=keep&&sc?sc.scrollTop:0, cats={}, sel='';
  sorted.forEach(function(it){ var r=recipes.find(function(x){ return x.id===it.id; }), c=bkCatOf(r); (cats[c]=cats[c]||[]).push({r:r,m:it.m}); });
  Object.keys(cats).forEach(function(c){
    sel+='<div class="bk-cat">'+esc(c)+' <small>'+cats[c].length+'</small></div>'+cats[c].map(function(o){
      return '<div class="bk-sel"><div class="bk-th">'+(typeof recThumb==='function'?recThumb(o.r):'')+'</div><span class="bk-n">'+esc(o.r.name)+'</span>'+
        '<label class="bk-m" title="Multiplicateur de la recette">×<input type="text" inputmode="decimal" value="'+esc(String(o.m).replace('.',','))+'" aria-label="Multiplicateur de '+esc(o.r.name)+'" onchange="bkMult(\''+o.r.id+'\',this.value)"></label>'+
        '<button type="button" class="bk-x" aria-label="Retirer '+esc(o.r.name)+'" onclick="bkToggle(\''+o.r.id+'\')">'+ic('x')+'</button></div>';
    }).join('');
  });
  w.innerHTML=
    '<div class="cw"><div class="cw-t">'+ic('book')+' Mon livre</div>'+
      '<div class="field"><div class="fl">Titre du livre</div><input class="fi" id="bk-title" value="'+esc(b.title)+'" placeholder="Ex. Viennoiseries et pâtisseries" oninput="bkField(\'title\',this.value)"></div>'+
      '<div class="field"><div class="fl">Sous-titre (facultatif)</div><input class="fi" id="bk-sub" value="'+esc(b.sub)+'" placeholder="Ex. Recueil de l’atelier — 2026" oninput="bkField(\'sub\',this.value)"></div>'+
      '<label class="bk-ck bk-auto"><input type="checkbox"'+(b.autoSubs!==false?' checked':'')+' onchange="bkAutoSubs(this.checked)"> Ajouter automatiquement les sous-recettes utilisées, sur leurs propres pages</label>'+
      '<div class="bk-sum">'+ic('list')+' <b>'+sorted.length+'</b> recette'+(sorted.length>1?'s':'')+' · sommaire et numéros de page automatiques</div>'+
      '<div class="bk-act"><button class="btn btn-gold" onclick="bkStartPick()">'+ic('plus')+' '+(sorted.length?'Ajouter des recettes':'Choisir mes recettes')+'</button>'+
      '<button class="btn btn-beige" onclick="bookBuild()"'+(sorted.length?'':' disabled')+'>'+ic('download')+' Créer le livre (PDF)</button>'+(sorted.length?'<button class="btn btn-ghost" onclick="bkClear()">Vider</button>':'')+'</div>'+
    '</div>'+
    (sorted.length?'<div class="cw"><div class="cw-t">'+ic('list')+' Dans le livre</div>'+sel+'</div>':
      '<div class="cw bk-hint">'+ic('book')+'<p>Choisis tes recettes dans ton carnet : même recherche, mêmes filtres et mêmes vignettes que la page Recettes.</p></div>');
  if(sc) sc.scrollTop=top;
}

// ── choisir les recettes dans la page Recettes (même recherche, filtres et vignettes) ──
var BKP={on:false};
function bkStartPick(){ BKP.on=true; goPage('recettes'); }
function bkPickDone(){ BKP.on=false; document.body.classList.remove('bk-pick'); try{ renderRec(); }catch(e){} goPage('livre'); }
function bkPick(id){
  var b=bkGet(), on=!bkHas(b,id);
  if(on) b.items.push({id:id,m:1}); else b.items=b.items.filter(function(x){ return x.id!==id; });
  bkSave(b); bkPickSync(id);
}
function bkPickSync(id){
  var b=bkGet();
  document.querySelectorAll('[data-bk]').forEach(function(e){ if(!id||e.getAttribute('data-bk')===id) e.classList.toggle('bk-s',bkHas(b,e.getAttribute('data-bk'))); });
  var n=document.getElementById('bkp-n'); if(n) n.textContent=b.items.length+' recette'+(b.items.length>1?'s':'')+' dans le livre';
  var all=document.getElementById('bkp-all'); if(all){ var l=recFiltered(true); var allOn=l.length&&l.every(function(r){ return bkHas(b,r.id); }); all.textContent=allOn?'Tout désélectionner ('+l.length+')':'Tout sélectionner ('+l.length+')'; }
}
function bkPickAll(){
  var l=recFiltered(true), b=bkGet(), allOn=l.length&&l.every(function(r){ return bkHas(b,r.id); });
  l.forEach(function(r){ var has=bkHas(b,r.id); if(!allOn&&!has) b.items.push({id:r.id,m:1}); if(allOn&&has) b.items=b.items.filter(function(x){ return x.id!==r.id; }); });
  bkSave(b); bkPickSync();
}
function bkPickBar(){
  var bar=document.getElementById('bkp-bar');
  if(!BKP.on){ if(bar) bar.remove(); document.body.classList.remove('bk-pick'); return; }
  document.body.classList.add('bk-pick');
  if(!bar){
    bar=document.createElement('div'); bar.id='bkp-bar'; bar.className='bkp-bar';
    bar.innerHTML='<div class="bkp-t">'+ic('book')+'<span id="bkp-n"></span></div><button type="button" class="btn btn-ghost btn-sm" id="bkp-all" onclick="bkPickAll()"></button><button type="button" class="btn btn-gold btn-sm" onclick="bkPickDone()">'+ic('check')+' Terminer</button>';
    document.body.appendChild(bar);
  }
  bkPickSync();
}
// vignettes et lignes de la page Recettes : en mode livre, toucher = cocher
['recTile','recRow'].forEach(function(fn){
  var orig=window[fn]; if(typeof orig!=='function') return;
  window[fn]=function(r){
    var h=orig.apply(this,arguments); if(!BKP.on) return h;
    h=h.replace(/openEditRec\('/g,"bkPick('").replace(/quickAddRec\('/g,"bkPick('");
    h=h.replace(/^<div class="(rt|rc)"/,function(m,c){ return '<div class="'+c+(bkHas(bkGet(),r.id)?' bk-s':'')+'" data-bk="'+r.id+'" onclick="bkPick(\''+r.id+'\')"'; });
    return h.replace('>','><span class="bk-ckm" aria-hidden="true">'+ic('check')+'</span>');
  };
});
(function(){
  var _r=renderRec;
  renderRec=function(){ var r=_r.apply(this,arguments); try{ bkPickBar(); }catch(e){} return r; };
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
  items=bkExpand(b,items);
  toast('Création du livre…','info');
  withJsPDF(function(){ try{ bkPdf(b,items); }catch(e){ if(window.console) console.error(e); toast('Impossible de créer le livre','err'); } BK_AUTO={}; });
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
  var recs=items.map(function(it){ return {it:it,r:recipes.find(function(r){ return r.id===it.id; })}; });
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
  var n=document.getElementById('bk-hd-n'); if(n){ var c=bkGet().items.length; n.textContent=c?String(c):''; n.style.display=c?'flex':'none'; }
}
(function(){
  var _g=goPage;
  goPage=function(p){
    if(p==='livre'&&!bkAdm()){ toast('Réservé aux administrateurs','err'); p='home'; }
    if(BKP.on&&p!=='recettes'&&p!=='livre'){ BKP.on=false; bkPickBar(); try{ renderRec(); }catch(e){} }
    if(BKP.on&&p==='livre'){ BKP.on=false; bkPickBar(); }
    var r=_g.apply(this,arguments);
    ['nav-livre','bn-livre'].forEach(function(id){ var e=document.getElementById(id); if(e) e.classList.toggle('on',p==='livre'); });
    var pg=document.getElementById('p-livre'); if(pg) pg.style.display=p==='livre'?'block':'none';
    if(p==='livre'){
      var bc=document.getElementById('tb-bc'); if(bc) bc.textContent='Livre';
      var act=document.getElementById('tb-act'); if(act) act.innerHTML='<button class="tbtn gold" onclick="bookBuild()">'+ic('download')+' Créer le livre</button>';
      renderLivre();
    }
    if(p==='recettes'&&BKP.on){ try{ renderRec(); }catch(e){} }
    bkNav();
    return r;
  };
  setInterval(bkNav,2500);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bkNav); else bkNav();
})();
