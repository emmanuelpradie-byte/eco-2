/* Apparence : mode clair / sombre et couleur de l'application.
   Lu de façon synchrone au chargement pour éviter un flash de couleur. */
(function(){
  var PAL={
    ble:{n:'Blé',h:36,s:72}, sauge:{n:'Sauge',h:105,s:24}, ardoise:{n:'Ardoise',h:212,s:32},
    terre:{n:'Terre cuite',h:16,s:56}, lavande:{n:'Lavande',h:262,s:34}, framboise:{n:'Framboise',h:340,s:48},
    pistache:{n:'Pistache',h:78,s:38}, farine:{n:'Farine',h:30,s:7},
    chocolat:{n:'Chocolat',h:22,s:30}, anthracite:{n:'Anthracite',h:215,s:9}, moutarde:{n:'Moutarde',h:46,s:68}, menthe:{n:'Menthe',h:158,s:34},
    canard:{n:'Bleu canard',h:186,s:42}, bleuet:{n:'Bleuet',h:222,s:52}, prune:{n:'Prune',h:292,s:28}, cerise:{n:'Cerise',h:354,s:58}
  };
  var KEYS=['--p','--p2','--p3','--card','--alt','--beige','--beige2','--am','--am2','--g2','--bd','--bd2','--i','--i2','--i3','--i4','--g','--on-i','--i-h','--ink-rgb','--on-rgb','--sh',
    '--re','--gr','--gr2','--bl','--warn','--gr-bg','--gr-bd','--gr-bg2','--re-bg','--re-bd','--re-bg2','--warn-bg','--warn-bd','--bl-bg'];
  function hsl(h,s,l){ return 'hsl('+h+','+(Math.round(s*10)/10)+'%,'+l+'%)'; }
  function get(){ try{ return JSON.parse(localStorage.getItem('v4_theme'))||{}; }catch(e){ return {}; } }
  function mq(){ try{ return window.matchMedia('(prefers-color-scheme: dark)'); }catch(e){ return null; } }
  function isDark(m){ if(m==='dark') return true; if(m==='light') return false; var q=mq(); return !!(q&&q.matches); }
  function vars(key,p,dark){
    var h=p.h, s=p.s, v={};
    if(!dark){
      if(key==='ble') return v;
      v['--p']=hsl(h,Math.min(s*.78,60),97); v['--p2']=hsl(h,s*.72,93); v['--p3']=hsl(h,s*.67,89);
      v['--beige']=hsl(h,s,84); v['--beige2']=hsl(h,s*.89,77); v['--alt']=hsl(h,s*.89,95);
      v['--g2']=hsl(h,Math.max(Math.min(s,64),30),33); v['--bd']=hsl(h,s*.5,88); v['--bd2']=hsl(h,s*.46,80);
      v['--am']=v['--beige']; v['--am2']=v['--g2'];
      return v;
    }
    var sd=Math.min(s,40);
    v['--p']=hsl(h,sd*.3,8.5); v['--p2']=hsl(h,sd*.3,12); v['--p3']=hsl(h,sd*.3,16); v['--card']=hsl(h,sd*.3,12.5);
    v['--alt']=hsl(h,sd*.4,15.5); v['--beige']=hsl(h,sd*.7,22); v['--beige2']=hsl(h,sd*.7,29);
    v['--g2']=hsl(h,Math.min(Math.max(sd,25)*1.3,55),72); v['--bd']=hsl(h,sd*.25,20); v['--bd2']=hsl(h,sd*.25,28);
    v['--am']=v['--beige']; v['--am2']=v['--g2'];
    v['--i']=hsl(h,20,92); v['--i2']=hsl(h,12,82); v['--i3']=hsl(h,8,66); v['--i4']=hsl(h,6,52); v['--g']=v['--i'];
    v['--on-i']=hsl(h,10,9); v['--i-h']='#fff'; v['--ink-rgb']='240,233,225'; v['--on-rgb']='20,18,18'; v['--sh']='rgba(0,0,0,.35)';
    v['--re']='#EF7D6E'; v['--gr']='#6CC592'; v['--gr2']='#6CC592'; v['--bl']='#8DB4DA'; v['--warn']='#E2A55E';
    v['--gr-bg']='rgba(108,197,146,.14)'; v['--gr-bd']='rgba(108,197,146,.32)'; v['--gr-bg2']='rgba(108,197,146,.09)';
    v['--re-bg']='rgba(239,125,110,.14)'; v['--re-bd']='rgba(239,125,110,.34)'; v['--re-bg2']='rgba(239,125,110,.22)';
    v['--warn-bg']='rgba(226,165,94,.12)'; v['--warn-bd']='rgba(226,165,94,.32)'; v['--bl-bg']='rgba(141,180,218,.15)';
    return v;
  }
  /* Thèmes verrouillés : ouverts par un lien « ?theme=<nom> ». Le choix est
     gardé sur l'appareil et ne peut plus être changé dans les Réglages. */
  var LOCKS={
    compagnons:{n:'Compagnons du Devoir',cls:'th-cdd',logo:'__CDD_LOGO__',bg:'#F7FAFD',vars:{
      '--p':'#F7FAFD','--p2':'#EEF3F9','--p3':'#E3ECF5','--card':'#fff','--alt':'#F2F6FB',
      '--beige':'#DCE8F4','--beige2':'#C5D7EA','--am':'#DCE8F4','--am2':'#C46F0E','--g2':'#C46F0E',
      '--bd':'#E1E9F2','--bd2':'#CAD7E5','--i':'#0F3B66','--i2':'#294A6D','--i3':'#4F6A86','--i4':'#7F93A8',
      '--g':'#0F3B66','--i-h':'#0F5A99','--on-i':'#fff','--ink-rgb':'15,59,102','--on-rgb':'255,255,255','--sh':'rgba(15,59,102,.07)',
      '--bl':'#0F5A99','--bl-bg':'#E4EEF8'}}
  };
  function lockKey(){
    try{
      var m=/[?&#]theme=([a-z0-9-]+)/i.exec(location.search+location.hash), k=m&&m[1].toLowerCase();
      if(k&&LOCKS[k]){ localStorage.setItem('v4_theme_lock',k); return k; }
      k=localStorage.getItem('v4_theme_lock'); return LOCKS[k]?k:null;
    }catch(e){ return null; }
  }
  var LOCK=lockKey();
  function apply(t){
    t=t||get(); var key=PAL[t.accent]?t.accent:'ble', p=PAL[key], dark=isDark(t.mode);
    var root=document.documentElement, v=vars(key,p,dark);
    if(LOCK){ dark=false; v=LOCKS[LOCK].vars; }
    Object.keys(LOCKS).forEach(function(k){ root.classList.toggle(LOCKS[k].cls,k===LOCK); });
    root.setAttribute('data-theme',dark?'dark':'light');
    KEYS.forEach(function(k){ if(v[k]) root.style.setProperty(k,v[k]); else root.style.removeProperty(k); });
    var bg=v['--p']||'#FBF8F3';
    var m=document.querySelector('meta[name=theme-color]'); if(m) m.setAttribute('content',bg);
  }
  window.THEME_PAL=PAL;
  window.loadTheme=get;
  window.applyTheme=apply;
  window.themeLock=function(){ return LOCK?{key:LOCK,n:LOCKS[LOCK].n,logo:LOCKS[LOCK].logo}:null; };
  window.themeLocks=function(){ return Object.keys(LOCKS).map(function(k){ var L=LOCKS[k]; return {key:k,n:L.n,logo:L.logo,colors:[L.vars['--i'],L.vars['--i-h'],'#EC952F',L.vars['--beige']]}; }); };
  window.themeUnlock=function(){ try{ localStorage.removeItem('v4_theme_lock'); }catch(e){} LOCK=null; themeAnim(); window.applyTheme(); };
  window.themeSetLock=function(k){ if(!LOCKS[k]) return false; try{ localStorage.setItem('v4_theme_lock',k); }catch(e){} LOCK=k; themeAnim(); window.applyTheme(); return true; };
  // Changement de thème en fondu (couleurs qui glissent de l'une à l'autre)
  function themeAnim(){
    var r=document.documentElement; r.classList.add('th-anim');
    clearTimeout(themeAnim.t); themeAnim.t=setTimeout(function(){ r.classList.remove('th-anim'); },600);
  }
  window.themeAnim=themeAnim;
  // Appli installée sur l'écran d'accueil : elle rouvre avec le même lien et le logo
  if(LOCK) document.addEventListener('DOMContentLoaded',function(){
    try{
      var L=LOCKS[LOCK], base=location.origin+location.pathname.replace(/[^\/]*$/,''), url=base+'index.html?theme='+LOCK;
      if(!/[?&]theme=/.test(location.search)&&history.replaceState) history.replaceState(null,'',location.pathname+(location.search?location.search+'&':'?')+'theme='+LOCK+location.hash);
      var img=new Image();
      img.onload=function(){
        function icon(n){
          var c=document.createElement('canvas'); c.width=c.height=n; var g=c.getContext('2d');
          g.fillStyle='#fff'; g.fillRect(0,0,n,n);
          var s=n*.8/Math.max(img.width,img.height); g.drawImage(img,(n-img.width*s)/2,(n-img.height*s)/2,img.width*s,img.height*s);
          return c.toDataURL('image/png');
        }
        var at=document.querySelector('link[rel=apple-touch-icon]'); if(at) at.href=icon(180);
        var ml=document.querySelector('link[rel=manifest]');
        if(ml) ml.href='data:application/manifest+json,'+encodeURIComponent(JSON.stringify({
          name:'Économat Pro · '+L.n, short_name:'Économat', start_url:url, scope:base, display:'standalone',
          background_color:L.bg, theme_color:L.bg, lang:'fr',
          icons:[{src:icon(192),sizes:'192x192',type:'image/png'},{src:icon(512),sizes:'512x512',type:'image/png'}]}));
      };
      img.src=L.logo;
    }catch(e){}
  });
  window.themeSwatch=function(key,dark){ var p=PAL[key]||PAL.ble; return dark?hsl(p.h,Math.min(p.s,40)*.7+10,40):(key==='ble'?'#F2DCBA':hsl(p.h,p.s,80)); };
  apply();
  var q=mq(); if(q){ var f=function(){ if((get().mode||'auto')==='auto') apply(); }; if(q.addEventListener) q.addEventListener('change',f); else if(q.addListener) q.addListener(f); }
})();

/* Affichage : automatique (selon la largeur), ordinateur ou mobile, choisi par appareil. */
(function(){
  var vp=document.querySelector('meta[name=viewport]'), VP0=vp?vp.getAttribute('content'):'';
  function get(){ try{ return localStorage.getItem('v4_layout')||'auto'; }catch(e){ return 'auto'; } }
  function apply(m){
    m=m||get(); var h=document.documentElement;
    h.classList.toggle('lay-mob',m==='mob');
    h.classList.toggle('lay-desk',m==='desk');
    // « Ordinateur » sur un téléphone : on affiche la page comme sur un écran large
    if(vp) vp.setAttribute('content',m==='desk'&&screen.width<=820?'width=1280':VP0);
  }
  window.applyLayout=apply; window.getLayout=get;
  apply();
})();

/* Écran de connexion : l'appli reste cachée tant que personne n'est connecté */
(function(){ try{ if(!localStorage.getItem('v4_cloud_sess')||localStorage.getItem('v4_cloud_sess')==='null') document.documentElement.classList.add('gated'); }catch(e){} })();
