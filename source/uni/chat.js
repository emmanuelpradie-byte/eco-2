// ══ MESSAGERIE ════════════════════════════════════════════════
// Salon général + conversations privées entre comptes, avec envoi de recettes
// et d’ingrédients (le destinataire les copie en un clic).
// Données : Supabase (fonctions chat_* du fichier supabase-update-v9.sql).
// Pas de temps réel : la page ouverte se rafraîchit toutes les 4 s, et les
// pastilles « non lu » toutes les 30 s.
var CHAT={ch:'general',users:[],threads:[],msgs:{},seen:{},att:null,pick:null,pq:'',open:false,err:'',loaded:false,busy:false,tick:0};
try{ CHAT.seen=JSON.parse(LS.getItem('v4_chat_seen')||'{}')||{}; }catch(e){}
function chReady(){ try{ return !!(typeof clActive==='function'&&clActive()&&CLOUD.me&&CLOUD.me.status==='active'); }catch(e){ return false; } }
function chMe(){ return typeof clUid==='function'?clUid():null; }
function chSaveSeen(){ try{ LS.setItem('v4_chat_seen',JSON.stringify(CHAT.seen)); }catch(e){} }
function chDm(other){ var a=String(chMe()), b=String(other); return 'dm:'+(a<b?a+':'+b:b+':'+a); }
function chOther(ch){ var p=String(ch).split(':'); return p[1]===String(chMe())?p[2]:p[1]; }
function chUser(id){ return CHAT.users.find(function(u){ return u.id===id; }); }
function chTitle(ch){ if(ch==='general') return 'Salon général'; var u=chUser(chOther(ch)); return u?u.name:'Conversation'; }
function chErr(e){
  var m=(e&&e.message)||String(e||'');
  if(/chat_|function|schema cache|404/i.test(m)&&!/inaccessible|Trop|vide|long|volumineuse/i.test(m)) return 'La messagerie n’est pas encore activée sur le serveur. Un administrateur doit exécuter le fichier supabase-update-v9.sql (Supabase → SQL Editor).';
  return m||'Erreur de connexion';
}
function chLast(ch){ var a=CHAT.msgs[ch]||[]; return a.length?a[a.length-1].id:0; }
function chUnread(){
  var me=chMe(); return (CHAT.threads||[]).filter(function(t){ return t.last_author!==me&&t.last_id>(CHAT.seen[t.channel]||0); }).length;
}
function chBadge(){
  var n=chUnread();
  ['chat-bd','chat-bd-m'].forEach(function(id){ var e=document.getElementById(id); if(e){ e.textContent=n>9?'9+':String(n); e.style.display=n?'flex':'none'; } });
}
function chNav(){
  var on=chReady();
  ['nav-chat','chat-m-btn'].forEach(function(id){ var e=document.getElementById(id); if(e) e.style.display=on?'':'none'; });
  if(!on) chBadge();
}
function chLoadBase(){
  return Promise.all([clRpc('chat_users',{}),clRpc('chat_threads',{})]).then(function(r){
    CHAT.users=r[0]||[]; CHAT.threads=r[1]||[]; CHAT.err=''; CHAT.loaded=true; chBadge();
  });
}
function chFetch(first){
  var ch=CHAT.ch;
  if(!chReady()||CHAT.busy) return Promise.resolve();
  CHAT.busy=true;
  var after=first?0:chLast(ch);
  return clRpc('chat_list',{p_channel:ch,p_after:after,p_limit:80}).then(function(rows){
    rows=rows||[]; var cur=CHAT.msgs[ch]||[];
    if(first) cur=rows; else rows.forEach(function(m){ if(!cur.some(function(x){ return x.id===m.id; })) cur.push(m); });
    CHAT.msgs[ch]=cur; CHAT.err='';
    var last=chLast(ch); if(last){ CHAT.seen[ch]=last; chSaveSeen(); }
    if(CUR==='chat'&&CHAT.ch===ch&&(first||rows.length)){ chRenderThread(first||rows.length>0); }
    if(rows.length||first) return clRpc('chat_threads',{}).then(function(t){ CHAT.threads=t||[]; chBadge(); if(CUR==='chat') chRenderList(); });
  }).catch(function(e){ CHAT.err=chErr(e); if(CUR==='chat') chRender(); }).then(function(){ CHAT.busy=false; });
}
function chOpen(ch){
  CHAT.ch=ch; CHAT.open=true; CHAT.att=null; CHAT.pick=null; chRender();
  CHAT.busy=false; chFetch(true);
}
function chBack(){ CHAT.open=false; chRender(); }

// ── rendu ──
function chTime(iso){ var d=new Date(iso); return isNaN(d)?'':d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}); }
function chDay(iso){
  var d=new Date(iso); if(isNaN(d)) return ''; var t=new Date(), y=new Date(Date.now()-864e5);
  if(d.toDateString()===t.toDateString()) return 'Aujourd’hui'; if(d.toDateString()===y.toDateString()) return 'Hier';
  return d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
}
function chText(s){ return esc(s).replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>').replace(/\n/g,'<br>'); }
function chAttachHTML(m){
  var a=m.attach; if(!a) return '';
  if(a.t==='rec'){
    var d=a.data||{}, mine=m.author===chMe(), has=recipes.some(function(r){ return normTxt(r.name)===normTxt(a.name||d.name); });
    return '<div class="ch-att">'+ic('book')+'<div class="ch-att-t"><b>'+esc(a.name||d.name||'Recette')+'</b><small>Recette'+(d.cat?' · '+esc(d.cat):'')+'</small></div>'+
      (mine?'':'<button type="button" class="btn btn-sm btn-ghost" onclick="chTakeRec('+m.id+')">'+(has?'Copier à nouveau':'Copier')+'</button>')+'</div>';
  }
  if(a.t==='ing'){
    var g=a.ing||{}, mine2=m.author===chMe(), has2=ingredients.some(function(i){ return normTxt(i.name)===normTxt(g.name); });
    return '<div class="ch-att">'+ic('box')+'<div class="ch-att-t"><b>'+esc(g.name||'Ingrédient')+'</b><small>Ingrédient'+(g.cat?' · '+esc(g.cat):'')+(g.price?' · '+fEur(g.price)+'/'+esc(g.unit||'kg'):'')+'</small></div>'+
      (mine2?'':(has2?'<span class="ch-has">'+ic('check')+' Déjà au catalogue</span>':'<button type="button" class="btn btn-sm btn-ghost" onclick="chTakeIng('+m.id+')">Ajouter</button>'))+'</div>';
  }
  return '';
}
function chRenderList(){
  var el=document.getElementById('ch-list'); if(!el) return;
  var me=chMe(), tmap={}; CHAT.threads.forEach(function(t){ tmap[t.channel]=t; });
  function row(ch,name,sub,time,unread,on){
    return '<button type="button" class="ch-row'+(on?' on':'')+'" onclick="chOpen(\''+ch+'\')"><span class="ch-av">'+esc((name||'?').trim().charAt(0).toUpperCase())+'</span>'+
      '<span class="ch-rt"><b>'+esc(name)+'</b><small>'+esc(sub||'')+'</small></span>'+(unread?'<span class="ch-dot" aria-label="Nouveau message"></span>':'')+'</button>';
  }
  function sub(t){ if(!t) return ''; return (t.last_author===me?'Toi : ':'')+(t.last_attach&&!t.last_body?'Pièce jointe':(t.last_body||'')); }
  function un(ch){ var t=tmap[ch]; return !!t&&t.last_author!==me&&t.last_id>(CHAT.seen[ch]||0)&&ch!==CHAT.ch; }
  var dms=CHAT.users.map(function(u){ var ch=chDm(u.id); return {u:u,ch:ch,t:tmap[ch]}; })
    .sort(function(a,b){ return (b.t?b.t.last_id:0)-(a.t?a.t.last_id:0)||a.u.name.localeCompare(b.u.name,'fr'); });
  el.innerHTML=row('general','Salon général',sub(tmap.general)||'Tous les comptes',null,un('general'),CHAT.ch==='general')+
    '<div class="ch-sec">Messages privés</div>'+
    (dms.length?dms.map(function(d){ return row(d.ch,d.u.name,sub(d.t)||'Nouvelle conversation',null,un(d.ch),CHAT.ch===d.ch); }).join(''):'<div class="ch-none">Aucun autre compte actif pour l’instant.</div>');
}
function chRenderThread(scrollEnd){
  var el=document.getElementById('ch-msgs'); if(!el) return;
  var me=chMe(), arr=CHAT.msgs[CHAT.ch]||[], nearEnd=el.scrollHeight-el.scrollTop-el.clientHeight<80;
  var lastDay='', admin=typeof clIsAdmin==='function'&&clIsAdmin(), prev=null;
  el.innerHTML=arr.length?arr.map(function(m){
    var mine=m.author===me, day=chDay(m.at), h='';
    if(day!==lastDay){ h+='<div class="ch-day"><span>'+esc(day)+'</span></div>'; lastDay=day; prev=null; }
    var grp=prev&&prev.author===m.author; prev=m;
    h+='<div class="ch-m'+(mine?' me':'')+(grp?' grp':'')+'" id="chm-'+m.id+'">'+
      (!mine&&!grp&&CHAT.ch==='general'?'<div class="ch-by">'+esc(m.name||'—')+'</div>':'')+
      '<div class="ch-b">'+(m.body?'<div class="ch-tx">'+chText(m.body)+'</div>':'')+chAttachHTML(m)+
      '<div class="ch-meta">'+chTime(m.at)+((mine||admin)?'<button type="button" class="ch-del" aria-label="Supprimer ce message" title="Supprimer" onclick="chDelete('+m.id+')">'+ic('x')+'</button>':'')+'</div></div></div>';
    return h;
  }).join(''):'<div class="ch-empty">'+ic('chat')+'<p>Aucun message pour l’instant.</p><small>Écris le premier, ou envoie une recette ou un ingrédient avec le bouton +.</small></div>';
  if(scrollEnd===true||nearEnd) el.scrollTop=el.scrollHeight;
}
function chRender(){
  var w=document.getElementById('chat-wrap'); if(!w) return;
  if(!chReady()){
    w.innerHTML='<div class="cw ch-gate"><div class="cw-t">'+ic('chat')+' Messagerie</div><p>Connecte-toi à ton compte (Réglages) pour discuter avec les autres utilisateurs et leur envoyer des recettes ou des ingrédients.</p><button class="btn btn-gold" onclick="goPage(\'backup\')">Ouvrir les réglages</button></div>'; return;
  }
  if(CHAT.err){
    w.innerHTML='<div class="cw ch-gate"><div class="cw-t">'+ic('chat')+' Messagerie</div><p>'+esc(CHAT.err)+'</p><button class="btn btn-ghost" onclick="chInit()">Réessayer</button></div>'; return;
  }
  var inp=document.getElementById('ch-in'), draft=inp?inp.value:'';
  w.innerHTML='<div class="ch'+(CHAT.open?' open':'')+'">'+
    '<div class="ch-l"><div class="ch-lh">'+ic('chat')+' Messages</div><div id="ch-list" class="ch-ls"></div></div>'+
    '<div class="ch-r"><div class="ch-rh"><button type="button" class="icbtn ch-back" aria-label="Retour aux conversations" onclick="chBack()">'+ic('chev-left')+'</button><div class="ch-rt2"><b>'+esc(chTitle(CHAT.ch))+'</b><small>'+(CHAT.ch==='general'?'Visible par tous les comptes':'Conversation privée')+'</small></div></div>'+
    '<div id="ch-msgs" class="ch-ms" aria-live="polite"></div>'+
    '<div id="ch-pick" class="ch-pick"></div>'+
    '<div id="ch-att" class="ch-attbar"></div>'+
    '<div class="ch-comp"><button type="button" class="icbtn ch-plus" aria-label="Joindre une recette ou un ingrédient" onclick="chPickToggle()">'+ic('plus')+'</button>'+
    '<textarea id="ch-in" rows="1" placeholder="Écrire un message…" aria-label="Message" onkeydown="chKey(event)" oninput="chGrow(this)"></textarea>'+
    '<button type="button" class="btn btn-gold ch-send" aria-label="Envoyer" onclick="chSend()">'+ic('send')+'</button></div></div></div>';
  var ni=document.getElementById('ch-in'); if(ni&&draft){ ni.value=draft; chGrow(ni); }
  chRenderList(); chRenderThread(true); chRenderAtt(); chRenderPick();
}
function chGrow(t){ t.style.height='auto'; t.style.height=Math.min(t.scrollHeight,140)+'px'; }
function chKey(e){ if(e.key==='Enter'&&!e.shiftKey&&!layIsMob()){ e.preventDefault(); chSend(); } }

// ── pièces jointes ──
function chPickToggle(){ CHAT.pick=CHAT.pick?null:'rec'; CHAT.pq=''; chRenderPick(); }
function chPickTab(t){ CHAT.pick=t; CHAT.pq=''; chRenderPick(); }
function chPickQ(v){ CHAT.pq=v; chRenderPick(true); }
function chRenderPick(keepFocus){
  var el=document.getElementById('ch-pick'); if(!el) return;
  if(!CHAT.pick){ el.style.display='none'; el.innerHTML=''; return; }
  var q=normTxt(CHAT.pq||''), rec=CHAT.pick==='rec';
  var list=(rec?recipes.filter(function(r){ return r.image!=='⊛'; }):ingredients).filter(function(x){ return !q||normTxt(x.name).indexOf(q)>=0; })
    .sort(function(a,b){ return a.name.localeCompare(b.name,'fr'); }).slice(0,60);
  el.style.display='block';
  el.innerHTML='<div class="seg"><button type="button" class="'+(rec?'on':'')+'" onclick="chPickTab(\'rec\')">Recette</button><button type="button" class="'+(rec?'':'on')+'" onclick="chPickTab(\'ing\')">Ingrédient</button></div>'+
    '<input class="fi" id="ch-pq" type="search" placeholder="Chercher…" value="'+esc(CHAT.pq)+'" oninput="chPickQ(this.value)" aria-label="Chercher">'+
    '<div class="ch-pl">'+(list.length?list.map(function(x){ return '<button type="button" class="ch-pi" onclick="chAttach(\''+(rec?'rec':'ing')+'\',\''+x.id+'\')">'+ic(rec?'book':'box')+'<span>'+esc(x.name)+'</span></button>'; }).join(''):'<div class="ch-none">Rien trouvé.</div>')+'</div>';
  if(keepFocus){ var i=document.getElementById('ch-pq'); if(i){ i.focus(); try{ i.setSelectionRange(i.value.length,i.value.length); }catch(e){} } }
}
function chAttach(t,id){
  var a=null;
  try{
    if(t==='rec'){
      var r=recipes.find(function(x){ return x.id===id; }); if(!r) return;
      var d=shareSnapshot(r); if(d&&typeof d.image==='string'&&d.image.length>20000) d.image='📖'; delete d.attachments;
      a={t:'rec',name:r.name,data:d};
    } else {
      var g=ingredients.find(function(x){ return x.id===id; }); if(!g) return;
      a={t:'ing',ing:{name:g.name,cat:g.cat||'',unit:g.unit||'kg',price:g.price||0,buyPrice:g.buyPrice!=null?g.buyPrice:(g.price||0),unitWeight:g.unitWeight||null,allergens:(g.allergens||[]).slice(),allergensSet:!!g.allergensSet}};
    }
  }catch(e){ if(window.console) console.error(e); toast('Impossible de joindre cet élément','err'); return; }
  if(JSON.stringify(a).length>190000){ toast('Cette recette est trop volumineuse pour être envoyée','err'); return; }
  CHAT.att=a; CHAT.pick=null; chRenderPick(); chRenderAtt();
  var i=document.getElementById('ch-in'); if(i) i.focus();
}
function chRenderAtt(){
  var el=document.getElementById('ch-att'); if(!el) return; var a=CHAT.att;
  if(!a){ el.style.display='none'; el.innerHTML=''; return; }
  el.style.display='flex';
  el.innerHTML=ic(a.t==='rec'?'book':'box')+'<span><b>'+esc(a.t==='rec'?a.name:a.ing.name)+'</b> · '+(a.t==='rec'?'recette':'ingrédient')+' jointe</span><button type="button" class="ch-del" aria-label="Retirer la pièce jointe" onclick="CHAT.att=null;chRenderAtt()">'+ic('x')+'</button>';
}

// ── envoi / suppression ──
function chSend(){
  var i=document.getElementById('ch-in'); if(!i) return; var body=i.value.trim(), a=CHAT.att, ch=CHAT.ch;
  if(!body&&!a) return;
  var btn=document.querySelector('.ch-send'); if(btn) btn.disabled=true;
  clRpc('chat_send',{p_channel:ch,p_body:body,p_attach:a||null}).then(function(m){
    var cur=CHAT.msgs[ch]||(CHAT.msgs[ch]=[]); if(m&&!cur.some(function(x){ return x.id===m.id; })) cur.push(m);
    if(m){ CHAT.seen[ch]=m.id; chSaveSeen(); }
    CHAT.att=null; i.value=''; chGrow(i); chRenderAtt();
    if(CHAT.ch===ch) chRenderThread(true);
    return clRpc('chat_threads',{}).then(function(t){ CHAT.threads=t||[]; chRenderList(); chBadge(); });
  }).catch(function(e){ toast(chErr(e),'err'); }).then(function(){ if(btn) btn.disabled=false; });
}
function chDelete(id){
  if(!confirm('Supprimer ce message ?')) return;
  clRpc('chat_delete',{p_id:id}).then(function(){
    var cur=CHAT.msgs[CHAT.ch]||[]; CHAT.msgs[CHAT.ch]=cur.filter(function(m){ return m.id!==id; }); chRenderThread(false);
  }).catch(function(e){ toast(chErr(e),'err'); });
}

// ── recevoir une recette / un ingrédient ──
function chMsg(id){ return (CHAT.msgs[CHAT.ch]||[]).find(function(m){ return m.id===id; }); }
function chTakeRec(id){
  var m=chMsg(id); if(!m||!m.attach||m.attach.t!=='rec') return;
  SHR_CUR={id:'chat_'+m.id,data:m.attach.data,owner_name:m.name||'',updated_at:m.at};
  shrCopy();
  setTimeout(function(){ chRenderThread(false); },400);
}
function chTakeIng(id){
  var m=chMsg(id); if(!m||!m.attach||m.attach.t!=='ing') return; var g=m.attach.ing||{};
  if(ingredients.some(function(i){ return normTxt(i.name)===normTxt(g.name); })){ toast('Cet ingrédient est déjà dans ton catalogue','info'); return; }
  ingredients.push({id:uid(),name:g.name,cat:g.cat||'Autre',unit:g.unit||'kg',price:g.price||0,buyPrice:g.buyPrice!=null?g.buyPrice:(g.price||0),unitWeight:g.unitWeight||null,
    allergens:(g.allergens||[]).slice(),allergensSet:!!g.allergensSet,priceHistory:[]});
  persist(); try{ updBadges(); }catch(e){}
  toast('« '+g.name+' » ajouté à ton catalogue','ok'); chRenderThread(false);
}

// ── démarrage / navigation ──
function chInit(){
  CHAT.err=''; chRender();
  if(!chReady()) return;
  chLoadBase().then(function(){ CHAT.busy=false; chRender(); return chFetch(true); }).catch(function(e){ CHAT.err=chErr(e); chRender(); });
}
(function(){
  if(window.ALLP&&ALLP.indexOf('chat')<0) ALLP.push('chat');
  var _g=goPage;
  goPage=function(p){
    var r=_g.apply(this,arguments);
    ['nav-chat'].forEach(function(id){ var e=document.getElementById(id); if(e) e.classList.toggle('on',p==='chat'); });
    var pg=document.getElementById('p-chat'); if(pg) pg.style.display=p==='chat'?'block':'none';
    if(p==='chat'){
      var bc=document.getElementById('tb-bc'); if(bc) bc.textContent='Messages';
      var act=document.getElementById('tb-act'); if(act) act.innerHTML='';
      CHAT.open=false; chInit();
    }
    chNav();
    return r;
  };
  setInterval(function(){
    try{
      if(document.hidden||!chReady()) { chNav(); return; }
      chNav(); CHAT.tick++;
      if(CUR==='chat'&&CHAT.loaded) chFetch(false);
      else if(CHAT.tick%8===1) clRpc('chat_threads',{}).then(function(t){ CHAT.threads=t||[]; chBadge(); },function(){});
    }catch(e){}
  },4000);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',chNav); else chNav();
})();
