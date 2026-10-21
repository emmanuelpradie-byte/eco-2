/* Stockage des données : IndexedDB (pas de limite de 5 Mo, photos comprises),
   avec une copie de secours dans localStorage. Les données existantes de
   localStorage sont reprises automatiquement au premier lancement. */
(function(){
  var mem={}, db=null, pending={}, timer=null, started=false, NAME='economat-pro', STORE='kv';
  function has(k){ return Object.prototype.hasOwnProperty.call(mem,k); }
  function queue(k){ pending[k]=1; if(!timer) timer=setTimeout(flush,40); }
  function flush(){
    timer=null; if(!db){ pending={}; return; }
    var ks=Object.keys(pending); pending={}; if(!ks.length) return;
    try{
      var st=db.transaction(STORE,'readwrite').objectStore(STORE);
      ks.forEach(function(k){ if(has(k)) st.put(mem[k],k); else st.delete(k); });
    }catch(e){ console.warn('IndexedDB :',e); }
  }
  var LS={
    backend:'local',
    getItem:function(k){ return has(k)?mem[k]:null; },
    setItem:function(k,v){
      v=String(v); mem[k]=v; queue(k);
      try{ localStorage.setItem(k,v); }catch(e){ try{ localStorage.removeItem(k); }catch(e2){} }
    },
    removeItem:function(k){ delete mem[k]; queue(k); try{ localStorage.removeItem(k); }catch(e){} },
    keys:function(){ return Object.keys(mem); },
    flush:function(){ flush(); }
  };
  window.LS=LS;
  document.addEventListener('visibilitychange',function(){ if(document.visibilityState==='hidden') flush(); });
  window.addEventListener('pagehide',flush);
  function fromLocal(){
    var out=[];
    try{ for(var i=0;i<localStorage.length;i++){ var k=localStorage.key(i); if(!has(k)){ mem[k]=localStorage.getItem(k); out.push(k); } } }catch(e){}
    return out;
  }
  function start(){
    if(started) return; started=true;
    // le code de l'appli est plus bas dans la page : attendre qu'elle soit entièrement lue
    if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded',run); return; }
    run();
  }
  function run(){
    var src=document.getElementById('app-src'), s=document.createElement('script');
    s.textContent=src.textContent; document.body.appendChild(s);
  }
  function fallback(){ if(started) return; fromLocal(); LS.backend='local'; start(); }
  var guard=setTimeout(fallback,3000);
  try{
    var rq=indexedDB.open(NAME,1);
    rq.onupgradeneeded=function(){ rq.result.createObjectStore(STORE); };
    rq.onerror=function(){ clearTimeout(guard); fallback(); };
    rq.onsuccess=function(){
      var base=rq.result;
      base.onversionchange=function(){ flush(); base.close(); db=null; };
      if(started){
        // L'appli a démarré sur la copie de secours : on remet IndexedDB à jour.
        db=base; LS.backend='idb'; Object.keys(mem).forEach(queue); return;
      }
      var got={}, cur=base.transaction(STORE,'readonly').objectStore(STORE).openCursor();
      cur.onsuccess=function(){
        var c=cur.result;
        if(c){ got[c.key]=c.value; c.continue(); return; }
        clearTimeout(guard); if(started) return;
        Object.keys(got).forEach(function(k){ mem[k]=got[k]; });
        db=base; LS.backend='idb';
        fromLocal().forEach(queue);          // reprise des anciennes données
        start();
      };
      cur.onerror=function(){ clearTimeout(guard); fallback(); };
    };
  }catch(e){ clearTimeout(guard); fallback(); }
})();
