// ══ ÉDITEUR DE BON (plein écran, même logique que l'éditeur de recette) ══
var BE_TAB='items';
function beTab(t){
  BE_TAB=t;
  var a=document.getElementById('be-t-items'), b=document.getElementById('be-t-prev');
  if(a) a.classList.toggle('on',t==='items'); if(b) b.classList.toggle('on',t==='prev');
  document.getElementById('be-pane-items').style.display=t==='items'?'':'none';
  document.getElementById('be-pane-prev').style.display=t==='prev'?'':'none';
  if(t==='prev') livePreview();
  var m=document.getElementById('be-mid'); if(m) m.scrollTop=0;
}
function beMeta(){
  var m=document.getElementById('be-meta'); if(!m||!curBon) return;
  var d=document.getElementById('e-date').value||curBon.date, n=curBon.items.length;
  var c=curBon.items.reduce(function(s,i){ return s+(i.cost||0); },0);
  m.innerHTML='<span>'+ic('calendar')+' '+esc(fDate(d))+'</span>'+
    '<span>'+(curBon.status==='validated'?ic('check-circle')+' Validé':ic('edit')+' Brouillon')+'</span>'+
    '<span>'+n+' article'+(n>1?'s':'')+' · <b>'+fEur(c)+'</b></span>'+
    (curBon.shared?'<span>'+ic('users')+' Partagé</span>':'');
}
function beRecap(){
  var box=document.getElementById('be-recap'); if(!box||!curBon) return;
  if(!curBon.items.length){ box.innerHTML='<div class="re-hint">Ajoute des ingrédients ou une recette : le récapitulatif s’affiche ici.</div>'; return; }
  var d=buildData(), mode=curBon.groupBy||'cat', gs;
  try{ gs=groupBonItems(d.items,mode); }catch(e){ gs=groupItemsByCat(d.items); }
  var tot=d.totalCost||0;
  box.innerHTML='<div class="be-rc">'+gs.map(function(g){
      var c=g.items.reduce(function(s,i){ return s+(i.cost||0); },0), pc=tot>0?c/tot:0;
      return '<div class="be-rr"><span class="be-rn">'+(mode==='sup'?ic('truck'):catDot(g.cat))+esc(g.cat)+'<small>'+g.items.length+' article'+(g.items.length>1?'s':'')+'</small><i style="width:'+(pc*100).toFixed(1)+'%"></i></span><b>'+fEur(c)+'</b></div>';
    }).join('')+
    '<div class="be-rr tt"><span>Total TTC</span><b>'+fEur(tot)+'</b></div></div>'+
    ((d.recipesUsed||[]).length?'<div class="re-lb" style="margin-top:12px">Recettes incluses</div><div class="be-recs">'+d.recipesUsed.map(function(r){ return '<span>'+ic('book')+esc(r)+'</span>'; }).join('')+'</div>':'');
}
(function(){
  function after(name,fn){ var _f=window[name]; if(typeof _f!=='function') return; window[name]=function(){ var r=_f.apply(this,arguments); try{ fn(); }catch(e){ console.warn(e); } return r; }; }
  after('renderEd',function(){ beTab('items'); beMeta(); beRecap(); });
  after('renderItems',function(){ beMeta(); beRecap(); });
  after('calcTots',function(){ beMeta(); });
  after('validateBon',function(){ beMeta(); });
  after('saveBon',function(){ beMeta(); });
})();

// ── Couleur du bon et des fiches (écran + PDF) : celle du thème, version claire ──
function bonHslRgb(h,s,l){
  s/=100; l/=100; var k=function(n){ return (n+h/30)%12; }, a=s*Math.min(l,1-l);
  var f=function(n){ return l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1))); };
  return [Math.round(f(0)*255),Math.round(f(8)*255),Math.round(f(4)*255)];
}
function bonPal(){
  var t={}; try{ t=(window.loadTheme&&loadTheme())||{}; }catch(e){}
  // Thème verrouillé (lien d'accès) : bleu clair et encre bleu marine
  if(window.themeLock&&themeLock()) return {beige:[220,232,244],alt:[242,246,251],sep:[201,215,229],ink:[15,59,102]};
  var key=(window.THEME_PAL&&THEME_PAL[t.accent])?t.accent:'ble', INK0=[35,31,32];
  if(key==='ble') return {beige:[242,220,186],alt:[250,244,234],sep:[228,220,207],ink:INK0};
  var p=THEME_PAL[key];
  return {beige:bonHslRgb(p.h,p.s,84),alt:bonHslRgb(p.h,p.s*.89,95),sep:bonHslRgb(p.h,p.s*.5,86),ink:INK0};
}
function bonPalApply(){
  var p=bonPal(), r=document.documentElement.style, c=function(a){ return 'rgb('+a.join(',')+')'; };
  r.setProperty('--bx-beige',c(p.beige)); r.setProperty('--bx-alt',c(p.alt)); r.setProperty('--bx-sep',c(p.sep)); r.setProperty('--bx-ink',c(p.ink));
}
(function(){
  var _a=window.applyTheme;
  if(typeof _a==='function') window.applyTheme=function(){ var r=_a.apply(this,arguments); bonPalApply(); try{ if(typeof CUR!=='undefined'&&CUR==='edit') livePreview(); }catch(e){} return r; };
  bonPalApply();
})();
