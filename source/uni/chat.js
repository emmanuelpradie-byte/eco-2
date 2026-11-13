// ══ MESSAGERIE (style Messenger / WhatsApp) ═══════════════════
// Salon général + conversations privées entre comptes, avec envoi de recettes
// et d’ingrédients (le destinataire les copie en un clic), réponses citées,
// emojis, brouillons par conversation et pastilles « non lu ».
// Données : Supabase (fonctions chat_* du fichier supabase-update-v9.sql).
// Pas de temps réel : la conversation ouverte se rafraîchit toutes les 4 s,
// les pastilles toutes les 30 s.
var CHAT={ch:'general',users:[],threads:[],msgs:{},seen:{},att:null,pick:null,pq:'',open:false,err:'',loaded:false,busy:false,tick:0,
  reply:null,drafts:{},sel:null,emoji:false,lq:'',newN:0};
try{ CHAT.seen=JSON.parse(LS.getItem('v4_chat_seen')||'{}')||{}; }catch(e){}
var CH_EMO=['😀','😂','🥹','😍','😘','😎','🤔','😅','🙏','👍','👏','🙌','💪','🔥','✨','🎉','❤️','🥐','🥖','🍞','🥨','🧁','🍰','🎂','🍪','🍫','🥚','🧈','🌾','☕','👨‍🍳','👩‍🍳','⏰','📦','✅','❌','⚠️','👀','😴','🤝'];
function chReady(){ try{ return !!(typeof clActive==='function'&&clActive()&&CLOUD.me&&CLOUD.me.status==='active'); }catch(e){ return false; } }
function chMe(){ return typeof clUid==='function'?clUid():null; }
function chSaveSeen(){ try{ LS.setItem('v4_chat_seen',JSON.stringify(CHAT.seen)); }catch(e){} }
function chDm(other){ var a=String(chMe()), b=String(other); return 'dm:'+(a<b?a+':'+b:b+':'+a); }
function chOther(ch){ var p=String(ch).split(':'); return p[1]===String(chMe())?p[2]:p[1]; }
function chUser(id){ return CHAT.users.find(function(u){ return u.id===id; }); }
function chTitle(ch){ if(ch==='general') return 'Salon général'; var u=chUser(chOther(ch)); return u?u.name:'Conversation'; }
function chHue(s){ var h=0; String(s||'?').split('').forEach(function(c){ h=(h*31+c.charCodeAt(0))%360; }); return h; }
function chAv(name,cls,general){
  return '<span class="ch-av '+(cls||'')+'" style="background:'+(general?'var(--i)':'hsl('+chHue(name)+' 38% 42%)')+'">'+(general?ic('users'):esc((name||'?').trim().charAt(0).toUpperCase()))+'</span>';
}
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
  ['chat-bd','chat-bd-m','chat-bd-b'].forEach(function(id){ var e=document.getElementById(id); if(e){ e.textContent=n>9?'9+':String(n); e.style.display=n?'flex':'none'; } });
}
function chNav(){
  var on=chReady();
  ['nav-chat','chat-m-btn','bn-chat'].forEach(function(id){ var e=document.getElementById(id); if(e) e.style.display=on?'':'none'; });
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
    rows=rows||[]; var cur=CHAT.msgs[ch]||[], me=chMe(), fresh=0;
    if(first) cur=rows; else rows.forEach(function(m){ if(!cur.some(function(x){ return x.id===m.id; })){ cur.push(m); if(m.author!==me) fresh++; } });
    CHAT.msgs[ch]=cur; CHAT.err='';
    var last=chLast(ch); if(last){ CHAT.seen[ch]=last; chSaveSeen(); }
    if(CUR==='chat'&&CHAT.ch===ch&&(first||rows.length)){ chRenderThread(first,fresh); }
    if(rows.length||first) return clRpc('chat_threads',{}).then(function(t){ CHAT.threads=t||[]; chBadge(); if(CUR==='chat') chRenderList(); });
  }).catch(function(e){ CHAT.err=chErr(e); if(CUR==='chat') chRender(); }).then(function(){ CHAT.busy=false; });
}
function chOpen(ch){
  var i=document.getElementById('ch-in'); if(i) CHAT.drafts[CHAT.ch]=i.value;
  CHAT.ch=ch; CHAT.open=true; CHAT.att=null; CHAT.pick=null; CHAT.reply=null; CHAT.sel=null; CHAT.emoji=false; CHAT.newN=0; chRender();
  var n=document.getElementById('ch-in'); if(n&&CHAT.drafts[ch]){ n.value=CHAT.drafts[ch]; chGrow(n); }
  CHAT.busy=false; chFetch(true);
}
function chBack(){ var i=document.getElementById('ch-in'); if(i) CHAT.drafts[CHAT.ch]=i.value; CHAT.open=false; chRender(); }

// ── rendu ──
function chTime(iso){ var d=new Date(iso); return isNaN(d)?'':d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}); }
function chShort(iso){
  var d=new Date(iso); if(isNaN(d)) return ''; var t=new Date();
  if(d.toDateString()===t.toDateString()) return chTime(iso);
  if(d.toDateString()===new Date(Date.now()-864e5).toDateString()) return 'Hier';
  return d.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'});
}
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
      (mine?'':'<button type="button" class="btn btn-sm btn-ghost" onclick="event.stopPropagation();chTakeRec('+m.id+')">'+(has?'Copier à nouveau':'Copier')+'</button>')+'</div>';
  }
  if(a.t==='ing'){
    var g=a.ing||{}, mine2=m.author===chMe(), has2=ingredients.some(function(i){ return normTxt(i.name)===normTxt(g.name); });
    return '<div class="ch-att">'+ic('box')+'<div class="ch-att-t"><b>'+esc(g.name||'Ingrédient')+'</b><small>Ingrédient'+(g.cat?' · '+esc(g.cat):'')+(g.price?' · '+fEur(g.price)+'/'+esc(g.unit||'kg'):'')+'</small></div>'+
      (mine2?'':(has2?'<span class="ch-has">'+ic('check')+' Au catalogue</span>':'<button type="button" class="btn btn-sm btn-ghost" onclick="event.stopPropagation();chTakeIng('+m.id+')">Ajouter</button>'))+'</div>';
  }
  return '';
}
function chPreview(t,me){
  if(!t) return '';
  var tx=t.last_body||(t.last_attach?'📎 Pièce jointe':'');
  return (t.last_author===me?'<span class="ch-tick">'+ic('check')+'</span>':'')+esc(tx);
}
function chRenderList(){
  var el=document.getElementById('ch-list'); if(!el) return;
  var me=chMe(), tmap={}, q=normTxt(CHAT.lq||''); CHAT.threads.forEach(function(t){ tmap[t.channel]=t; });
  function un(ch){ var t=tmap[ch]; return !!t&&t.last_author!==me&&t.last_id>(CHAT.seen[ch]||0)&&!(CHAT.open&&ch===CHAT.ch&&CUR==='chat'); }
  function row(ch,name,general){
    var t=tmap[ch], u=un(ch);
    return '<button type="button" class="ch-row'+(CHAT.ch===ch&&CHAT.open?' on':'')+(u?' unr':'')+'" onclick="chOpen(\''+ch+'\')">'+chAv(name,'',general)+
      '<span class="ch-rt"><span class="ch-rl"><b>'+esc(name)+'</b><time>'+(t?chShort(t.last_at):'')+'</time></span>'+
      '<span class="ch-rl"><small>'+(t?chPreview(t,me):(general?'Tous les comptes':'Nouvelle discussion'))+'</small>'+(u?'<i class="ch-dot" aria-label="Nouveau message"></i>':'')+'</span></span></button>';
  }
  var dms=CHAT.users.map(function(u){ var ch=chDm(u.id); return {u:u,ch:ch,t:tmap[ch]}; })
    .filter(function(d){ return !q||normTxt(d.u.name).indexOf(q)>=0; })
    .sort(function(a,b){ return (b.t?b.t.last_id:0)-(a.t?a.t.last_id:0)||a.u.name.localeCompare(b.u.name,'fr'); });
  var showGen=!q||normTxt('salon général').indexOf(q)>=0;
  el.innerHTML=(showGen?row('general','Salon général',true):'')+
    (dms.length?'<div class="ch-sec">Discussions</div>'+dms.map(function(d){ return row(d.ch,d.u.name,false); }).join(''):(q?'<div class="ch-none">Personne ne correspond.</div>':'<div class="ch-none">Aucun autre compte actif pour l’instant.</div>'));
}
function chRenderThread(scrollEnd,fresh){
  var el=document.getElementById('ch-msgs'); if(!el) return;
  var me=chMe(), arr=CHAT.msgs[CHAT.ch]||[], nearEnd=el.scrollHeight-el.scrollTop-el.clientHeight<90;
  var lastDay='', admin=typeof clIsAdmin==='function'&&clIsAdmin(), prev=null, prevDay='';
  el.innerHTML=arr.length?arr.map(function(m){
    var mine=m.author===me, day=chDay(m.at), h='';
    if(day!==lastDay){ h+='<div class="ch-day"><span>'+esc(day)+'</span></div>'; lastDay=day; prev=null; }
    var grp=prev&&prev.author===m.author; prev=m;
    var rp=m.attach&&m.attach.reply, sel=CHAT.sel===m.id;
    h+='<div class="ch-m'+(mine?' me':'')+(grp?' grp':'')+(sel?' sel':'')+'" id="chm-'+m.id+'" onclick="chSel('+m.id+')">'+
      (!mine&&!grp&&CHAT.ch==='general'?'<div class="ch-by" style="color:hsl('+chHue(m.name)+' 45% 38%)">'+esc(m.name||'—')+'</div>':'')+
      '<div class="ch-b">'+(rp?'<div class="ch-q" onclick="event.stopPropagation();chJump('+(+rp.id||0)+')"><b>'+esc(rp.name||'')+'</b><span>'+esc(rp.text||'')+'</span></div>':'')+
      (m.body?'<div class="ch-tx">'+chText(m.body)+'</div>':'')+chAttachHTML(m)+
      '<div class="ch-meta">'+chTime(m.at)+(mine?'<span class="ch-tick">'+ic('check')+'</span>':'')+'</div></div>'+
      (sel?'<div class="ch-act"><button type="button" onclick="event.stopPropagation();chReply('+m.id+')">Répondre</button>'+(m.body?'<button type="button" onclick="event.stopPropagation();chCopy('+m.id+')">Copier</button>':'')+((mine||admin)?'<button type="button" class="del" onclick="event.stopPropagation();chDelete('+m.id+')">Supprimer</button>':'')+'</div>':'')+
      '</div>';
    return h;
  }).join(''):'<div class="ch-empty">'+ic('chat')+'<p>Aucun message pour l’instant.</p><small>Écris le premier, ou envoie une recette ou un ingrédient avec le bouton +.</small></div>';
  if(scrollEnd===true||nearEnd){ el.scrollTop=el.scrollHeight; CHAT.newN=0; }
  else if(fresh) CHAT.newN+=fresh;
  chDownBtn();
}
function chDownBtn(){
  var el=document.getElementById('ch-msgs'), b=document.getElementById('ch-down'); if(!el||!b) return;
  var far=el.scrollHeight-el.scrollTop-el.clientHeight>240;
  b.style.display=far?'flex':'none'; b.innerHTML=ic('chev-down')+(CHAT.newN?'<i>'+CHAT.newN+'</i>':'');
}
function chToEnd(){ var el=document.getElementById('ch-msgs'); if(el){ el.scrollTo?el.scrollTo({top:el.scrollHeight,behavior:'smooth'}):(el.scrollTop=el.scrollHeight); } CHAT.newN=0; chDownBtn(); }
function chSel(id){ CHAT.sel=CHAT.sel===id?null:id; chRenderThread(false); }
function chJump(id){ var e=document.getElementById('chm-'+id); if(e){ e.scrollIntoView({block:'center',behavior:'smooth'}); e.classList.add('flash'); setTimeout(function(){ e.classList.remove('flash'); },1200); } }
function chReply(id){
  var m=chMsg(id); if(!m) return;
  var t=m.body||(m.attach&&m.attach.t==='rec'?'📖 '+m.attach.name:(m.attach&&m.attach.t==='ing'?'📦 '+m.attach.ing.name:'Message'));
  CHAT.reply={id:m.id,name:m.author===chMe()?'Toi':(m.name||''),text:String(t).slice(0,90)}; CHAT.sel=null; chRenderThread(false); chRenderAtt();
  var i=document.getElementById('ch-in'); if(i) i.focus();
}
function chCopy(id){ var m=chMsg(id); if(!m) return; CHAT.sel=null; chRenderThread(false); try{ navigator.clipboard.writeText(m.body); toast('Message copié','ok'); }catch(e){ toast('Copie impossible','err'); } }
function chLq(v){ CHAT.lq=v; chRenderList(); }
function chRender(){
  var w=document.getElementById('chat-wrap'); if(!w) return;
  document.body.classList.toggle('ch-thread',!!(CHAT.open&&chReady()&&!CHAT.err));
  if(!chReady()){
    w.innerHTML='<div class="cw ch-gate"><div class="cw-t">'+ic('chat')+' Messagerie</div><p>Connecte-toi à ton compte (Réglages) pour discuter avec les autres utilisateurs et leur envoyer des recettes ou des ingrédients.</p><button class="btn btn-gold" onclick="goPage(\'backup\')">Ouvrir les réglages</button></div>'; return;
  }
  if(CHAT.err){
    w.innerHTML='<div class="cw ch-gate"><div class="cw-t">'+ic('chat')+' Messagerie</div><p>'+esc(CHAT.err)+'</p><button class="btn btn-ghost" onclick="chInit()">Réessayer</button></div>'; return;
  }
  var inp=document.getElementById('ch-in'), draft=inp?inp.value:(CHAT.drafts[CHAT.ch]||'');
  var gen=CHAT.ch==='general';
  w.innerHTML='<div class="ch'+(CHAT.open?' open':'')+'">'+
    '<div class="ch-l"><div class="ch-lh"><span>Discussions</span></div>'+
    '<label class="ch-ls-q">'+ic('search')+'<input type="search" placeholder="Rechercher une personne…" value="'+esc(CHAT.lq)+'" oninput="chLq(this.value)" aria-label="Rechercher une personne"></label>'+
    '<div id="ch-list" class="ch-ls"></div></div>'+
    '<div class="ch-r"><div class="ch-rh"><button type="button" class="icbtn ch-back" aria-label="Retour aux discussions" onclick="chBack()">'+ic('chev-left')+'</button>'+chAv(chTitle(CHAT.ch),'sm',gen)+'<div class="ch-rt2"><b>'+esc(chTitle(CHAT.ch))+'</b><small>'+(gen?'Visible par tous les comptes':'Conversation privée')+'</small></div></div>'+
    '<div class="ch-wall"><div id="ch-msgs" class="ch-ms" aria-live="polite" onscroll="chDownBtn()"></div><button type="button" id="ch-down" class="ch-down" aria-label="Aller aux derniers messages" onclick="chToEnd()" style="display:none"></button></div>'+
    '<div id="ch-pick" class="ch-pick"></div>'+
    '<div id="ch-emo" class="ch-emo"></div>'+
    '<div id="ch-att" class="ch-attbar"></div>'+
    '<div class="ch-comp"><button type="button" class="ch-ib" aria-label="Joindre une recette ou un ingrédient" onclick="chPickToggle()">'+ic('plus')+'</button>'+
    '<div class="ch-pill"><button type="button" class="ch-emb" aria-label="Emojis" onclick="chEmoToggle()">🙂</button>'+
    '<textarea id="ch-in" rows="1" placeholder="Message" aria-label="Message" onkeydown="chKey(event)" oninput="chGrow(this)"></textarea></div>'+
    '<button type="button" class="ch-send" aria-label="Envoyer" onclick="chSend()">'+ic('send')+'</button></div></div></div>';
  var ni=document.getElementById('ch-in'); if(ni&&draft){ ni.value=draft; chGrow(ni); }
  chRenderList(); chRenderThread(true); chRenderAtt(); chRenderPick(); chRenderEmo();
}
function chGrow(t){ t.style.height='auto'; t.style.height=Math.min(t.scrollHeight,140)+'px'; }
function chKey(e){ if(e.key==='Enter'&&!e.shiftKey&&!layIsMob()){ e.preventDefault(); chSend(); } }

// ── emojis ──
function chEmoToggle(){ CHAT.emoji=!CHAT.emoji; if(CHAT.emoji) CHAT.pick=null; chRenderPick(); chRenderEmo(); }
function chRenderEmo(){
  var el=document.getElementById('ch-emo'); if(!el) return;
  if(!CHAT.emoji){ el.style.display='none'; el.innerHTML=''; return; }
  el.style.display='grid'; el.innerHTML=CH_EMO.map(function(e){ return '<button type="button" onclick="chEmoAdd(\''+e+'\')">'+e+'</button>'; }).join('');
}
function chEmoAdd(e){
  var i=document.getElementById('ch-in'); if(!i) return;
  var s=i.selectionStart==null?i.value.length:i.selectionStart, t=i.selectionEnd==null?s:i.selectionEnd;
  i.value=i.value.slice(0,s)+e+i.value.slice(t); i.selectionStart=i.selectionEnd=s+e.length; chGrow(i); i.focus();
}

// ── pièces jointes ──
function chPickToggle(){ CHAT.emoji=false; chRenderEmo(); CHAT.pick=CHAT.pick?null:'menu'; CHAT.pq=''; chRenderPick(); }
function chPickTab(t){ CHAT.pick=t; CHAT.pq=''; chRenderPick(); }
function chPickQ(v){ CHAT.pq=v; chRenderPick(true); }
function chRenderPick(keepFocus){
  var el=document.getElementById('ch-pick'); if(!el) return;
  if(!CHAT.pick){ el.style.display='none'; el.innerHTML=''; return; }
  el.style.display='block';
  if(CHAT.pick==='menu'){
    el.innerHTML='<div class="ch-menu"><button type="button" onclick="chPickTab(\'rec\')"><span class="ch-mi" style="background:#2f7d5b">'+ic('book')+'</span>Recette</button>'+
      '<button type="button" onclick="chPickTab(\'ing\')"><span class="ch-mi" style="background:#b2702e">'+ic('box')+'</span>Ingrédient</button></div>'; return;
  }
  var q=normTxt(CHAT.pq||''), rec=CHAT.pick==='rec';
  var list=(rec?recipes.filter(function(r){ return r.image!=='⊛'; }):ingredients).filter(function(x){ return !q||normTxt(x.name).indexOf(q)>=0; })
    .sort(function(a,b){ return a.name.localeCompare(b.name,'fr'); }).slice(0,60);
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
  var el=document.getElementById('ch-att'); if(!el) return; var a=CHAT.att, r=CHAT.reply;
  if(!a&&!r){ el.style.display='none'; el.innerHTML=''; return; }
  el.style.display='block';
  el.innerHTML=(r?'<div class="ch-ab"><span class="ch-abq"><b>Réponse à '+esc(r.name||'')+'</b><span>'+esc(r.text||'')+'</span></span><button type="button" class="ch-del" aria-label="Annuler la réponse" onclick="CHAT.reply=null;chRenderAtt()">'+ic('x')+'</button></div>':'')+
    (a?'<div class="ch-ab">'+ic(a.t==='rec'?'book':'box')+'<span class="ch-abq"><b>'+esc(a.t==='rec'?a.name:a.ing.name)+'</b><span>'+(a.t==='rec'?'Recette jointe':'Ingrédient joint')+'</span></span><button type="button" class="ch-del" aria-label="Retirer la pièce jointe" onclick="CHAT.att=null;chRenderAtt()">'+ic('x')+'</button></div>':'');
}

// ── envoi / suppression ──
function chSend(){
  var i=document.getElementById('ch-in'); if(!i) return; var body=i.value.trim(), a=CHAT.att, rp=CHAT.reply, ch=CHAT.ch;
  if(!body&&!a) return;
  var att=a?Object.assign({},a):null; if(rp){ att=att||{}; att.reply=rp; }
  var btn=document.querySelector('.ch-send'); if(btn) btn.disabled=true;
  clRpc('chat_send',{p_channel:ch,p_body:body,p_attach:att}).then(function(m){
    var cur=CHAT.msgs[ch]||(CHAT.msgs[ch]=[]); if(m&&!cur.some(function(x){ return x.id===m.id; })) cur.push(m);
    if(m){ CHAT.seen[ch]=m.id; chSaveSeen(); }
    CHAT.att=null; CHAT.reply=null; CHAT.emoji=false; CHAT.drafts[ch]=''; i.value=''; chGrow(i); chRenderAtt(); chRenderEmo();
    if(CHAT.ch===ch) chRenderThread(true);
    return clRpc('chat_threads',{}).then(function(t){ CHAT.threads=t||[]; chRenderList(); chBadge(); });
  }).catch(function(e){ toast(chErr(e),'err'); }).then(function(){ if(btn) btn.disabled=false; });
}
function chDelete(id){
  if(!confirm('Supprimer ce message ?')) return;
  clRpc('chat_delete',{p_id:id}).then(function(){
    var cur=CHAT.msgs[CHAT.ch]||[]; CHAT.msgs[CHAT.ch]=cur.filter(function(m){ return m.id!==id; }); CHAT.sel=null; chRenderThread(false);
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
    ['nav-chat','bn-chat'].forEach(function(id){ var e=document.getElementById(id); if(e) e.classList.toggle('on',p==='chat'); });
    var pg=document.getElementById('p-chat'); if(pg) pg.style.display=p==='chat'?'block':'none';
    if(p!=='chat') document.body.classList.remove('ch-thread');
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
