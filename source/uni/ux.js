// ══ CONFORT : FAVORIS, RÉCENTS, CARTES D'ACCUEIL, BOUTON + ═════
// Favoris : une étoile sur les recettes et les ingrédients (enregistrée avec
// l'élément : r.fav / i.fav). Récents : les derniers éléments ouverts ou
// utilisés, gardés sur l'appareil. Les deux apparaissent en haut des listes.
(function(){
  function item(k,id){ return (k==='rec'?recipes:ingredients).find(function(x){ return x.id===id; }); }
  function rget(){ try{ var o=JSON.parse(localStorage.getItem('v4_recent'))||{}; return {rec:o.rec||[],ing:o.ing||[]}; }catch(e){ return {rec:[],ing:[]}; } }
  window.favOn=function(k,id){ var x=item(k,id); return !!(x&&x.fav); };
  window.favBtn=function(k,id,cls){
    var on=favOn(k,id), lb=on?'Retirer des favoris':'Ajouter aux favoris';
    return '<button type="button" class="fav-b'+(on?' on':'')+(cls?' '+cls:'')+'" aria-pressed="'+on+'" aria-label="'+lb+'" title="'+lb+'" onclick="favToggle(\''+k+'\',\''+id+'\',event)">'+ic('star')+'</button>';
  };
  window.favToggle=function(k,id,ev){
    if(ev){ ev.stopPropagation(); ev.preventDefault(); }
    var x=item(k,id); if(!x) return;
    if(x.fav) delete x.fav; else x.fav=true;
    persist(); toast(x.fav?'Ajouté aux favoris':'Retiré des favoris','ok');
    if(CUR==='recettes') renderRec(); else if(CUR==='catalogue') renderCat(); else if(CUR==='home') renderHome();
  };
  window.recentPush=function(k,id){
    if(!id) return; var o=rget(); o[k]=[id].concat(o[k].filter(function(x){ return x!==id; })).slice(0,12);
    try{ localStorage.setItem('v4_recent',JSON.stringify(o)); }catch(e){}
  };
  function recents(k){ return rget()[k].map(function(id){ return item(k,id); }).filter(Boolean); }
  // on note chaque ouverture / utilisation
  [['openEditRec','rec'],['pickRec','rec'],['openEditIng','ing'],['pickIng','ing']].forEach(function(p){
    var f=window[p[0]]; if(typeof f!=='function') return;
    window[p[0]]=function(id){ var r=f.apply(this,arguments); if(typeof id==='string') recentPush(p[1],id); return r; };
  });
  // « Enregistrer » une recette recrée l'objet : on garde l'étoile
  if(typeof saveRecipe==='function'){
    var _sr=saveRecipe;
    saveRecipe=function(){
      var id=editRecId, old=id&&item('rec',id), f=old&&old.fav;
      var r=_sr.apply(this,arguments);
      if(f&&id){ var n=item('rec',id); if(n&&!n.fav){ n.fav=true; persist(); } }
      return r;
    };
  }

  // ── bandeau « Favoris · Récents » en haut des listes ──
  function chip(k,x){
    var th=k==='rec'?'<span class="ux-ci">'+recThumb(x)+'</span>':'<span class="ux-ci">'+ic('wheat')+'</span>';
    return '<button type="button" class="ux-chip" onclick="'+(k==='rec'?'openEditRec':'openEditIng')+'(\''+x.id+'\')">'+th+'<span class="ux-cn">'+esc(x.name)+'</span></button>';
  }
  function stripHTML(k){
    var fav=(k==='rec'?recipes:ingredients).filter(function(x){ return x.fav; }).sort(function(a,b){ return a.name.localeCompare(b.name,'fr'); }).slice(0,10);
    var rec=recents(k).filter(function(x){ return !x.fav; }).slice(0,6);
    if(!fav.length&&!rec.length) return '';
    return (fav.length?'<div class="ux-row"><span class="ux-lb">'+ic('star')+' Favoris</span><div class="ux-chips">'+fav.map(function(x){ return chip(k,x); }).join('')+'</div></div>':'')+
           (rec.length?'<div class="ux-row"><span class="ux-lb">'+ic('clock')+' Récents</span><div class="ux-chips">'+rec.map(function(x){ return chip(k,x); }).join('')+'</div></div>':'');
  }
  function paintStrip(k,show,before){
    var id='ux-strip-'+k, el=document.getElementById(id);
    var h=show?stripHTML(k):'';
    if(!h){ if(el) el.remove(); return; }
    if(!el){ el=document.createElement('div'); el.id=id; el.className='ux-strip'; }
    el.innerHTML=h;
    if(before&&before.parentNode&&el.nextSibling!==before) before.parentNode.insertBefore(el,before);
  }
  var _rr=renderRec;
  renderRec=function(){
    var r=_rr.apply(this,arguments);
    try{
      var none=(typeof rfActiveCount==='function'?rfActiveCount():0)===0;
      paintStrip('rec',none,document.querySelector('#rec-mine .rec-vbar')||document.getElementById('rec-grid'));
    }catch(e){}
    return r;
  };
  var _rc=renderCat;
  renderCat=function(){
    var r=_rc.apply(this,arguments);
    try{
      var q=((document.getElementById('cat-srch')||{}).value||'').trim();
      var none=!q&&!(typeof fbCount==='function'&&fbCount('cat'))&&!(window.CATF&&CATF.letter)&&window.CAT_FOLD!=='cat';
      paintStrip('ing',none,document.getElementById('cat-folders')||document.getElementById('cat-list'));
    }catch(e){}
    return r;
  };

  // ── accueil : favoris et variations de prix ──
  var _rh=renderHome;
  renderHome=function(){
    var r=_rh.apply(this,arguments);
    try{ homeExtra(); }catch(e){ if(window.console) console.error(e); }
    return r;
  };
  function homeExtra(){
    var f=document.getElementById('h-fav'), pr=document.getElementById('h-price');
    if(f){
      var favR=recipes.filter(function(x){ return x.fav; }), favI=ingredients.filter(function(x){ return x.fav; });
      var rows=favR.slice(0,4).map(function(x){ return '<div class="hc-row"><span class="rpe" style="width:30px;height:30px;font-size:15px;border-radius:8px">'+recThumb(x)+'</span><button type="button" class="nm lnk-row" onclick="openEditRec(\''+x.id+'\')">'+esc(x.name)+'</button><span class="mt">'+esc(x.cat||'')+'</span></div>'; })
        .concat(favI.slice(0,3).map(function(x){ return '<div class="hc-row"><span class="rpe" style="width:30px;height:30px;font-size:15px;border-radius:8px">'+ic('wheat')+'</span><button type="button" class="nm lnk-row" onclick="goPage(\'catalogue\');openEditIng(\''+x.id+'\')">'+esc(x.name)+'</button><span class="mt">'+esc(x.cat||'')+'</span></div>'; }));
      f.innerHTML='<div class="hc-h">'+ic('star')+' Favoris<span class="sp"></span>'+((favR.length+favI.length)?'<span class="badge bd-d">'+(favR.length+favI.length)+'</span>':'')+'</div>'+
        (rows.length?rows.join(''):'<div class="hc-empty ux-hint">Touchez l’étoile sur une recette ou un ingrédient pour la retrouver ici en un geste.</div>');
    }
    if(pr){
      var use={}; recipes.forEach(function(r){ r.items.forEach(function(it){ if(it.type==='ingredient') use[it.refId]=(use[it.refId]||0)+1; }); });
      var ch=ingredients.map(function(i){ return {i:i,t:priceTrend(i)}; }).filter(function(x){ return x.t!=null; })
        .sort(function(a,b){ return Math.abs(b.t)-Math.abs(a.t); }).slice(0,5);
      pr.innerHTML='<div class="hc-h">'+ic('chart')+' Variations de prix</div>'+
        (ch.length?ch.map(function(x){ var n=use[x.i.id]||0;
          return '<div class="hc-row"><button type="button" class="nm lnk-row" onclick="goPage(\'catalogue\');openEditIng(\''+x.i.id+'\')">'+esc(x.i.name)+'</button><span class="mt">'+(n?n+' recette'+(n>1?'s':''):'')+'</span>'+trendHtml(x.t)+'</div>'; }).join('')
          :'<div class="hc-empty ux-hint">Aucune variation pour l’instant. Elles apparaissent quand vous changez le prix d’un ingrédient.</div>');
    }
  }

  // ── bouton + flottant (téléphone) ──
  var FAB={
    bons:['Nouveau bon',function(){ openNewBon(); }],
    recettes:['Nouvelle recette',function(){ openNewRec(); }],
    catalogue:['Nouvel ingrédient',function(){ openMod('m-addcat'); }]
  };
  window.uxFab=function(p){
    var b=document.getElementById('ux-fab'); if(!b) return;
    var c=FAB[p]; b.style.display=c?'':'none';
    if(c){ b.setAttribute('aria-label',c[0]); b.title=c[0]; b.onclick=c[1]; }
  };
  var _gp=goPage;
  goPage=function(p){ var r=_gp.apply(this,arguments); uxFab(p); return r; };
})();

// ══ ACCESSIBILITÉ ═══════════════════════════════════════════════
// - tout élément cliquable (carte, puce, onglet) est atteignable au clavier
//   (Tab) et s'active avec Entrée ou Espace ;
// - les fenêtres sont annoncées comme des boîtes de dialogue ;
// - la page courante est signalée dans les menus ; Échap ferme une fenêtre.
(function(){
  var SEL='[onclick]:not(button):not(a):not(input):not(select):not(textarea):not(label):not(.ov):not(.modal):not(#scroll)';
  function name(e){ return (e.getAttribute('aria-label')||e.getAttribute('title')||e.textContent||'').trim().replace(/\s+/g,' ').slice(0,80); }
  function enhance(root){
    (root||document).querySelectorAll(SEL).forEach(function(e){
      if(e.getAttribute('data-a11y')) return; e.setAttribute('data-a11y','1');
      if(e.tagName==='SPAN'&&e.closest('button,a')) return;
      if(!e.hasAttribute('role')) e.setAttribute('role','button');
      if(!e.hasAttribute('tabindex')) e.setAttribute('tabindex','0');
      if(!e.getAttribute('aria-label')&&!(e.textContent||'').trim()&&e.getAttribute('title')) e.setAttribute('aria-label',e.getAttribute('title'));
    });
    (root||document).querySelectorAll('.ov').forEach(function(o){
      if(o.getAttribute('data-a11y')) return; o.setAttribute('data-a11y','1');
      var m=o.querySelector('.modal'), h=o.querySelector('.m-hdr h3');
      if(m){ m.setAttribute('role','dialog'); m.setAttribute('aria-modal','true'); if(h) m.setAttribute('aria-label',h.textContent.trim()); }
    });
  }
  var T=null, obs=new MutationObserver(function(){ if(T) return; T=setTimeout(function(){ T=null; enhance(); },60); });
  function start(){ enhance(); obs.observe(document.body,{childList:true,subtree:true}); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
  document.addEventListener('keydown',function(e){
    var t=e.target;
    if((e.key==='Enter'||e.key===' ')&&t&&t.getAttribute&&t.getAttribute('data-a11y')&&t===e.target&&t.getAttribute('role')==='button'){
      e.preventDefault(); t.click(); return;
    }
    if(e.key==='Escape'){ var o=document.querySelector('.ov.show'); if(o&&o.id&&typeof closeMod==='function'&&!document.getElementById('gate-open')){ closeMod(o.id); } }
  });
  // page courante dans les menus
  function cur(p){
    document.querySelectorAll('#sidebar .ni, #bnav .bni, #sidebar [id^="nav-"]').forEach(function(n){ if(n.classList.contains('on')) n.setAttribute('aria-current','page'); else n.removeAttribute('aria-current'); });
  }
  var _g2=goPage;
  goPage=function(p){ var r=_g2.apply(this,arguments); try{ cur(p); }catch(e){} return r; };
})();
