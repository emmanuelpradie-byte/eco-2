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

// ══ THÈME « SANS LOGO » : ni blason, ni « C » (menu, connexion, bons, fiches) ══
(function(){
  var CREST0=BON_CREST, CMARK0=BON_CMARK;
  function logoSync(){
    if(typeof themeLock==='function'&&themeLock()) return;
    var off=typeof themeNoLogo==='function'&&themeNoLogo();
    BON_CREST=off?'':CREST0; BON_CMARK=off?'':CMARK0;
    document.querySelectorAll('[data-crest]').forEach(function(e){ if(off) e.removeAttribute('src'); else e.src=CREST0; });
  }
  var _at=window.applyTheme;
  window.applyTheme=function(){ var r=_at.apply(this,arguments); try{ logoSync(); }catch(e){} return r; };
  logoSync();
  var _ia=window.initApp;
  if(typeof _ia==='function') window.initApp=function(){ var r=_ia.apply(this,arguments); try{ logoSync(); }catch(e){} return r; };
})();

// ══ ADMIN : RECETTES À LA SUITE, APERÇU « FICHE », FICHES JOINTES AU BON ══
// Réservé aux administrateurs pour l'instant. L'ancien aperçu (liste avec
// cases à cocher) reste disponible : bouton « Liste ».
(function(){
  function adm(){ try{ return typeof clIsAdmin==='function'&&!!clIsAdmin(); }catch(e){ return false; } }
  window.uxAdmin=adm;
  function view(){ try{ return localStorage.getItem('v4_recview')==='list'?'list':'fiche'; }catch(e){ return 'fiche'; } }
  window.recView=function(v){ try{ localStorage.setItem('v4_recview',v); }catch(e){} refreshRecPrev(); };

  // Sections d'une recette : quantité de la recette et quantité « mise en œuvre »
  function sections(rec,mult){
    var out=[];
    (function sec(r,mb,mm,title,depth,main){
      var rows=[], subs=[], tb=0, tm=0;
      (r.items||[]).forEach(function(it){
        var q=Number(it.qty)||0;
        if(it.type==='ingredient'){
          var ing=ingredients.find(function(x){ return x.id===it.refId; }), kg=toKg(q,it.unit,ing);
          rows.push({name:ing?ing.name:'?', b:ficheQty(q*mb,it.unit,kg*mb), m:ficheQty(q*mm,it.unit,kg*mm)});
          tb+=kg*mb; tm+=kg*mm;
        } else {
          var sr=recipes.find(function(x){ return x.id===it.refId; }); if(!sr) return;
          var w=recWeight(sr.id);
          rows.push({name:sr.name, b:w*q*mb>0?fQtyNice(w*q*mb):'Q.S.', m:w*q*mm>0?fQtyNice(w*q*mm):'Q.S.', sub:true});
          tb+=w*q*mb; tm+=w*q*mm; subs.push({r:sr,b:q*mb,m:q*mm});
        }
      });
      out.push({title:title,main:main,rows:rows,tb:tb,tm:tm});
      subs.forEach(function(s){ if(depth<5) sec(s.r,s.b,s.m,s.r.name,depth+1,false); });
    })(rec,1,mult,rec.name,0,true);
    return out;
  }
  function steps(text){
    return String(text||'').split(/\r?\n/).map(function(l){ return l.trim(); }).filter(Boolean).map(function(l){
      var m=/^([^:]{2,42}?)\s*:\s*(.+)$/.exec(l); return m?{k:m[1],v:m[2]}:{k:'',v:l};
    });
  }
  function allergTxt(rec){
    var a=allergensOfFlat(flatten(rec.id));
    return a.keys.length?a.keys.map(algLabel).join(', '):(a.unknown.length?'non renseignés pour tous les ingrédients':'aucun des 14 allergènes réglementaires');
  }

  // ── aperçu « fiche » dans la fenêtre « Ajouter une recette » ──
  function ficheHTMLView(rec,mult){
    var two=Math.abs(mult-1)>1e-9, secs=sections(rec,mult);
    var h='<div class="fk"><div class="fk-t">'+esc(rec.name)+'</div>';
    secs.forEach(function(s,i){
      h+='<div class="fk-tb'+(two?' two':'')+'">'+(!s.main?'<div class="fk-st">'+esc(s.title)+'</div>':'')+
        (two?'<div class="fk-r fk-h"><span></span><b>Recette</b><b>Mise en œuvre</b></div>':'')+
        s.rows.map(function(r){ return '<div class="fk-r"><span class="n'+(r.sub?' sub':'')+'">'+esc(r.name)+'</span><b>'+esc(r.b)+'</b>'+(two?'<b>'+esc(r.m)+'</b>':'')+'</div>'; }).join('')+
        '<div class="fk-r fk-tot"><span class="n">TOTAL</span><b>'+esc(fQtyNice(s.tb))+'</b>'+(two?'<b>'+esc(fQtyNice(s.tm))+'</b>':'')+'</div></div>';
    });
    h+='<div class="fk-al"><b>Allergènes :</b> '+esc(allergTxt(rec))+'</div>';
    var st=steps(rec.notes);
    if(st.length) h+='<div class="fk-st2">'+st.map(function(x){ return '<div class="fk-s">'+(x.k?'<b>'+esc(x.k)+'</b><span>'+esc(x.v)+'</span>':'<span class="full">'+esc(x.v)+'</span>')+'</div>'; }).join('')+'</div>';
    return h+'</div>';
  }
  var _rp=refreshRecPrev;
  refreshRecPrev=function(){
    var r=_rp.apply(this,arguments);
    try{
      var seg=document.getElementById('rec-vseg'), box=document.getElementById('rec-fiche'), pw=document.getElementById('rec-prev-w');
      var on=adm(); if(seg) seg.style.display=on?'':'none';
      var f=on&&view()==='fiche'&&selRec;
      if(seg){ document.getElementById('rec-v-fiche').classList.toggle('on',view()==='fiche'); document.getElementById('rec-v-list').classList.toggle('on',view()==='list'); }
      if(box){ box.style.display=f?'':'none'; if(f) box.innerHTML=ficheHTMLView(selRec,curMult); }
      if(pw&&f) pw.style.display='none';
    }catch(e){ if(window.console) console.error(e); }
    return r;
  };
  var _im=initRecMod;
  initRecMod=function(){ var r=_im.apply(this,arguments); var b=document.getElementById('rec-more'); if(b) b.style.display=adm()?'':'none'; return r; };

  // ── recettes à la suite : la fenêtre se rouvre après chaque ajout ──
  var _cr=confirmRec;
  confirmRec=function(cont){
    var r=selRec, m=curMult, bon=curBon;
    var res=_cr.apply(this,arguments);
    try{
      if(r&&bon&&!document.getElementById('m-rec').classList.contains('show')){
        bon.recs=bon.recs||[];
        var e=bon.recs.find(function(x){ return x.id===r.id; });
        if(e) e.m=Math.round((e.m+m)*1000)/1000; else bon.recs.push({id:r.id,m:m});
        if(cont===true){ openMod('m-rec'); try{ document.getElementById('rec-mod-s').focus(); }catch(e2){} }
        if(typeof beRecap==='function') beRecap();
      }
    }catch(e3){ if(window.console) console.error(e3); }
    return res;
  };

  // ── option du bon : joindre les fiches à la suite ──
  window.bonFichesSet=function(v){ if(curBon){ curBon.fiches=!!v; } };
  window.bonFichesDel=function(id){ if(!curBon) return; curBon.recs=(curBon.recs||[]).filter(function(x){ return x.id!==id; }); beRecap(); };
  var _br=beRecap;
  beRecap=function(){
    var r=_br.apply(this,arguments);
    try{
      var box=document.getElementById('be-recap');
      if(box&&adm()&&curBon&&(curBon.recs||[]).length){
        box.insertAdjacentHTML('beforeend','<div class="be-fj"><label class="be-fj-ck"><input type="checkbox" id="be-fj-ck"'+(curBon.fiches?' checked':'')+' onchange="bonFichesSet(this.checked)"><span><b>Joindre les fiches à la suite du bon</b><small>Dans le PDF, chaque recette ajoutée a sa fiche (colonne « mise en œuvre »).</small></span></label>'+
          '<div class="be-recs">'+curBon.recs.map(function(x){ var rec=recipes.find(function(y){ return y.id===x.id; }); if(!rec) return '';
            return '<span>'+ic('book')+esc(rec.name)+(Math.abs(x.m-1)>1e-9?' ×'+fQ(x.m):'')+'<button type="button" class="be-fj-x" aria-label="Retirer la fiche de '+esc(rec.name)+'" onclick="bonFichesDel(\''+x.id+'\')">'+ic('x')+'</button></span>'; }).join('')+'</div></div>');
      }
    }catch(e){ if(window.console) console.error(e); }
    return r;
  };

  // ── PDF : les fiches viennent après le bon ──
  window.bonAppendFiches=function(doc,F,d){
    var o=(typeof curBon!=='undefined'&&curBon&&curBon.id===d.id)?curBon:orders.find(function(x){ return x.id===d.id; });
    if(!o||!o.fiches||!(o.recs||[]).length||!adm()) return;
    var PW=595.28, PH=841.89, BAND=539, L=42, R=505, BOTTOM=786, P=bonPal(), INK=P.ink, BEIGE=P.beige;
    var GREY=[110,110,110], RED=[226,72,72], GREEN=[30,150,85];
    function rgb(fn,c){ doc[fn](c[0],c[1],c[2]); }
    var y=0, label='', pageNo=doc.getNumberOfPages();
    function chrome(){
      rgb('setFillColor',BEIGE); doc.rect(BAND,0,PW-BAND,PH,'F');
      if(BON_CREST) try{ doc.addImage(BON_CREST,'PNG',BAND+(PW-BAND-44)/2,18,44,44*219/260,'bonCrest','FAST'); }catch(e){}
      if(BON_CMARK) try{ doc.addImage(BON_CMARK,'PNG',BAND+(PW-BAND-36)/2,63,36,36,'bonCmark','FAST'); }catch(e){}
      doc.setFont(F,'bold'); doc.setFontSize(24); rgb('setTextColor',INK);
      var w=doc.getTextWidth(label); doc.text(label,BAND+(PW-BAND)/2+8,PH/2+w/2,{angle:90});
      doc.setFont(F,'normal'); doc.setFontSize(9); rgb('setTextColor',GREY); doc.text(String(pageNo),R,PH-30,{align:'right'});
    }
    function newPage(){ doc.addPage(); pageNo++; chrome(); y=56; }
    function ensure(h){ if(y+h>BOTTOM) newPage(); }
    function rule(w){ rgb('setDrawColor',INK); doc.setLineWidth(w||1.6); doc.line(L,y,R,y); }
    function two(rec,mult){
      var tw=Math.abs(mult-1)>1e-9, xN=tw?208:230, xB=tw?286:244, xS=tw?300:0, xM=tw?418:0;
      sections(rec,mult).forEach(function(s,si){
        ensure(60); y+=4;
        if(si>0||tw){ doc.setFont(F,'bold'); doc.setFontSize(9.5);
          if(!s.main){ rgb('setTextColor',GREEN); doc.text(s.title,xN,y+10,{align:'right'}); }
          if(tw){ rgb('setTextColor',INK); doc.text('Recette',xB,y+10,{align:'right'}); doc.text('Mise en œuvre',xM,y+10,{align:'right'}); }
          y+=17; }
        var y0=y;
        s.rows.forEach(function(r){
          ensure(16); y+=13; doc.setFontSize(9.5);
          doc.setFont(F,'normal'); rgb('setTextColor',INK); doc.text(r.name,xN,y,{align:'right',maxWidth:xN-L});
          doc.setFont(F,'bold'); if(tw){ doc.text(r.b,xB,y,{align:'right'}); doc.text(r.m,xM,y,{align:'right'}); } else doc.text(r.b,xB+12,y);
        });
        ensure(18); y+=15; doc.setFont(F,'normal'); rgb('setTextColor',RED); doc.text('TOTAL',xN,y,{align:'right'});
        if(tw){ doc.text(fQtyNice(s.tb),xB,y,{align:'right'}); doc.text(fQtyNice(s.tm),xM,y,{align:'right'}); } else doc.text(fQtyNice(s.tb),xB+12,y);
        if(tw){ rgb('setDrawColor',INK); doc.setLineWidth(1); doc.line(xS,y0-2,xS,y+4); }
        y+=12;
      });
    }
    o.recs.forEach(function(x){
      var rec=recipes.find(function(r){ return r.id===x.id; }); if(!rec) return;
      label=(rec.cat||'Fiche').toUpperCase(); newPage();
      doc.setFont(F,'bold'); doc.setFontSize(18); rgb('setTextColor',INK);
      var tl=doc.splitTextToSize(rec.name,(R-L)-10); tl.forEach(function(t){ doc.text(t,(L+R)/2,y+8,{align:'center'}); y+=22; });
      y+=6; rule(1.8); two(rec,x.m); rule(1.8); y+=16;
      doc.setFont(F,'bold'); doc.setFontSize(8.5); rgb('setTextColor',INK); doc.text('Allergènes :',L,y);
      doc.setFont(F,'normal'); doc.text(allergTxt(rec),L+48,y,{maxWidth:R-L-48}); y+=20;
      var process=[]; try{ process=ficheData(rec).process; }catch(e){}
      process.forEach(function(pr){
        if(pr.title!==rec.name){ ensure(24); y+=6; doc.setFont(F,'bold'); doc.setFontSize(10); rgb('setTextColor',GREEN); doc.text(pr.title,L,y+10); y+=16; }
        steps(pr.text).forEach(function(s){
          var xl=206, xt=216, lines=doc.splitTextToSize(s.v,s.k?R-xt:R-L);
          ensure(14*lines.length+4); doc.setFontSize(9.5);
          if(s.k){ doc.setFont(F,'bold'); rgb('setTextColor',INK); doc.text(s.k,xl,y+10,{align:'right',maxWidth:xl-L}); }
          doc.setFont(F,'normal'); rgb('setTextColor',INK);
          lines.forEach(function(t,i){ doc.text(t,s.k?xt:L,y+10+i*13); }); y+=13*lines.length+4;
        });
      });
    });
  };
})();
