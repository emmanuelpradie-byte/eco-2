// ══ MENU LATÉRAL RÉDUCTIBLE ══════════════════════════════════
function sbApply(c){
  var sh=document.getElementById('shell'); if(!sh) return;
  sh.classList.toggle('col',!!c);
  var t=document.getElementById('sb-tog');
  if(t){ var l=c?'Agrandir le menu (Ctrl+B)':'Réduire le menu (Ctrl+B)'; t.title=l; t.setAttribute('aria-label',l); t.setAttribute('aria-expanded',c?'false':'true'); }
}
function toggleSidebar(){
  var sh=document.getElementById('shell'); if(!sh) return;
  var c=!sh.classList.contains('col'); sbApply(c);
  try{ localStorage.setItem('v4_sbcol',c?'1':'0'); }catch(e){}
}
(function(){
  var c=false; try{ c=localStorage.getItem('v4_sbcol')==='1'; }catch(e){}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){ sbApply(c); }); else sbApply(c);
  document.addEventListener('keydown',function(e){
    if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&!e.altKey&&String(e.key).toLowerCase()==='b'){
      var a=document.activeElement, tag=a&&a.tagName;
      if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||(a&&a.isContentEditable)) return;
      e.preventDefault(); toggleSidebar();
    }
  });
})();

// ══ AFFICHAGE ORDINATEUR / MOBILE ════════════════════════════
function layIsMob(){ var m=getLayout(); return m==='mob'||(m==='auto'&&window.innerWidth<=820&&!document.documentElement.classList.contains('lay-desk')); }
function layBtn(){
  var b=document.getElementById('tb-lay'); if(!b) return;
  var mob=layIsMob(); b.innerHTML=ic(mob?'monitor':'mobile');
  var t=mob?'Passer en affichage ordinateur':'Passer en affichage mobile'; b.title=t; b.setAttribute('aria-label',t);
}
function setLayout(m){
  try{ LS.setItem('v4_layout',m); }catch(e){ try{ localStorage.setItem('v4_layout',m); }catch(e2){} }
  applyLayout(m); layBtn();
  var c=document.getElementById('th-card'); if(c&&typeof themeCardHTML==='function') c.outerHTML=themeCardHTML();
  var sc=document.getElementById('scroll'); if(sc) sc.scrollTop=0;
  window.dispatchEvent(new Event('resize'));
}
function toggleLayout(){
  var mob=layIsMob(), want=mob?'desk':'mob';
  // revenir à l'affichage naturel de l'écran : « automatique »
  var natural=Math.min(screen.width,screen.height)<=820&&screen.width<=820?'mob':'desk';
  if(want===natural) want='auto';
  setLayout(want);
  toast(want==='auto'?'Affichage automatique':(want==='mob'?'Affichage mobile':'Affichage ordinateur'),'info');
}
(function(){ if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',layBtn); else layBtn(); window.addEventListener('resize',layBtn); })();
