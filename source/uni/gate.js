// ══ ÉCRAN DE CONNEXION ═══════════════════════════════════════
// Tant que personne n'est connecté (ou que le compte attend sa validation),
// l'appli est cachée derrière cet écran : se connecter, créer un compte,
// ou — la toute première fois — renseigner le serveur.
var GATE={mode:'login',step:'',err:'',busy:false,eye:false,last:''};

function gateState(){
  if(!CLOUD.cfg) return 'server';
  if(LS.getItem('v4_authlink')) return 'loading';
  if(!CLOUD.sess) return 'auth';
  if(LS.getItem('v4_recovery')) return 'recovery';
  var ui=CLOUD.ui||{};
  if(ui.reloading) return 'loading';
  if(ui.claim) return 'claim';
  var st=ui.wait||(CLOUD.me&&CLOUD.me.status!=='active'&&!CLOUD.me.legacy?CLOUD.me.status:'');
  if(st) return 'wait:'+st;
  return '';
}
function gateRender(force){
  var g=document.getElementById('gate'); if(!g) return;
  var st=gateState();
  document.documentElement.classList.toggle('gated',!!st);
  if(!st){ g.innerHTML=''; GATE.last=''; return; }
  var key=st+'|'+GATE.mode+'|'+GATE.step+'|'+(CLOUD.pendingInvite?'i':'');
  if(!force&&key===GATE.last&&g.firstChild){ gateErr(GATE.err); return; }
  GATE.last=key;
  var keep={}; ['g-name','g-email'].forEach(function(id){ var e=document.getElementById(id); if(e) keep[id]=e.value; });
  g.innerHTML='<div class="gate-art">'+
      '<div class="gate-brand"><img class="gate-crest" data-crest alt=""><div class="gate-name">Économat Pro</div><div class="gate-sub">Boulangerie · Pâtisserie</div></div>'+
      '<div class="gate-card"><div class="gate-q">Bons d’économat, recettes et fiches techniques, catalogue et fournisseurs : tout ton laboratoire au même endroit.</div>'+
        '<ul class="gate-pts"><li>'+ic('book')+'Recettes avec sous-recettes, coûts et allergènes</li><li>'+ic('bon')+'Bons d’économat en PDF en un geste</li><li>'+ic('users')+'Dossiers de recettes partagés avec ton équipe</li></ul></div>'+
    '</div>'+
    '<div class="gate-side"><div class="gate-form">'+gateBody(st)+'</div></div>';
  try{ g.querySelectorAll('[data-crest]').forEach(function(e){ if(typeof BON_CREST!=='undefined') e.src=BON_CREST; }); }catch(e){}
  Object.keys(keep).forEach(function(id){ var e=document.getElementById(id); if(e&&!e.value) e.value=keep[id]; });
  gateErr(GATE.err);
  var f=g.querySelector('.gate-form input:not([type=checkbox])'); if(f&&!f.value&&window.innerWidth>820) setTimeout(function(){ try{ f.focus(); }catch(e){} },50);
}
function gateHead(kicker,title){
  return '<div class="gate-logo">'+ic('book')+'</div><div class="gate-kick">'+kicker+'</div><h1 class="gate-h">'+title+'</h1>';
}
function gateBody(st){
  var pi=CLOUD.pendingInvite;
  if(st==='loading') return gateHead('Connexion','Ouverture de ton espace…')+'<div class="gate-spin"><div class="inv-spin"></div></div>';
  if(st==='server'){
    if(GATE.step==='invite') return gateHead('Invitation','Rejoindre Économat Pro')+
      '<p class="gate-p">Colle le lien d’invitation que tu as reçu par message.</p>'+
      '<input class="gate-in" id="g-inv" placeholder="https://…#rejoindre=…" autocapitalize="off" spellcheck="false">'+
      '<button class="gate-btn" onclick="gateInvite()">'+ic('arrow-right')+' Continuer</button>'+
      '<div class="gate-err" id="g-err"></div><button class="gate-lnk" onclick="GATE.step=\'\';GATE.err=\'\';gateRender(true)">Retour</button>';
    return gateHead('Première ouverture','Bienvenue sur Économat Pro')+
      '<p class="gate-p">Pour utiliser l’appli, ouvre le <b>lien d’invitation</b> que tu as reçu. Si c’est toi qui installes l’appli pour ton équipe, renseigne l’adresse de ton serveur Supabase.</p>'+
      '<button class="gate-btn" onclick="GATE.step=\'invite\';GATE.err=\'\';gateRender(true)">'+ic('link')+' J’ai reçu une invitation</button>'+
      '<details class="gate-det"'+(GATE.step==='server'?' open':'')+'><summary>Je configure le serveur (1re fois)</summary>'+
        '<input class="gate-in" id="g-url" placeholder="https://xxxx.supabase.co" autocapitalize="off" spellcheck="false">'+
        '<input class="gate-in" id="g-key" placeholder="Clé publique (sb_publishable_…)" autocapitalize="off" spellcheck="false">'+
        '<button class="gate-btn ghost" onclick="gateServer()">'+ic('check')+' Enregistrer le serveur</button></details>'+
      '<div class="gate-err" id="g-err"></div>';
  }
  if(st==='auth'){
    var sign=GATE.mode==='signup';
    return gateHead(sign?'Créer un compte':'Connexion','Bienvenue sur Économat Pro')+
      (pi?'<div class="gate-inv">'+ic('users')+'<span>'+(pi.by?'<b>'+esc(pi.by)+'</b> t’invite. ':'Tu as reçu une invitation. ')+'Crée ton compte pour rejoindre l’équipe.</span></div>':'')+
      '<button class="gate-sw" onclick="gateMode(\''+(sign?'login':'signup')+'\')">'+(sign?'J’ai déjà un compte':'Créer un compte')+'</button>'+
      (sign?'<input class="gate-in" id="g-name" placeholder="Prénom" autocomplete="given-name" value="'+esc(loadProfile().name||'')+'">':'')+
      '<input class="gate-in" id="g-email" type="email" placeholder="Adresse email" autocomplete="email" autocapitalize="off" spellcheck="false">'+
      '<div class="gate-pw"><input class="gate-in" id="g-pw" type="'+(GATE.eye?'text':'password')+'" placeholder="Mot de passe'+(sign?' (6 caractères minimum)':'')+'" autocomplete="'+(sign?'new-password':'current-password')+'" onkeydown="if(event.key===\'Enter\')gateGo()">'+
        '<button class="gate-eye" type="button" onclick="gateEye()" aria-label="'+(GATE.eye?'Masquer':'Afficher')+' le mot de passe">'+ic(GATE.eye?'eye-off':'eye')+'</button></div>'+
      (sign?'':'<button class="gate-lnk u" onclick="gateForgot()">Mot de passe oublié ?</button>')+
      '<button class="gate-btn" id="g-go" onclick="gateGo()">'+(sign?'Créer mon compte':'Se connecter')+'</button>'+
      '<div class="gate-err" id="g-err"></div>'+
      '<div class="gate-foot">Chacun a son espace perso : tes recettes, ton catalogue et tes bons ne sont visibles que par toi.'+(CLOUD.cfg&&!CLOUD.cfg.builtin?' <button class="gate-lnk" onclick="gateForget()">Changer de serveur</button>':'')+'</div>';
  }
  if(st==='recovery'){
    return gateHead('Mot de passe oublié','Choisis un nouveau mot de passe')+
      '<p class="gate-p">Compte : <b>'+esc(CLOUD.sess&&CLOUD.sess.user.email||'')+'</b> · 6 caractères minimum</p>'+
      '<div class="gate-pw"><input class="gate-in" id="g-npw" type="'+(GATE.eye?'text':'password')+'" placeholder="Nouveau mot de passe" autocomplete="new-password">'+
        '<button class="gate-eye" type="button" onclick="gateEyeN()" aria-label="Afficher le mot de passe">'+ic(GATE.eye?'eye-off':'eye')+'</button></div>'+
      '<input class="gate-in" id="g-npw2" type="'+(GATE.eye?'text':'password')+'" placeholder="Encore une fois" autocomplete="new-password" onkeydown="if(event.key===\'Enter\')gateNewPw()">'+
      '<button class="gate-btn" id="g-go" onclick="gateNewPw()">'+ic('check')+' Enregistrer le mot de passe</button>'+
      '<div class="gate-err" id="g-err"></div>'+
      '<button class="gate-lnk" onclick="gateRecSkip()">Garder mon ancien mot de passe</button>';
  }
  if(st==='claim'){
    var nr=recipes.length;
    return gateHead('Ton espace','Ces recettes sont-elles à toi ?')+
      '<p class="gate-p">Cet appareil contient déjà <b>'+nr+' recette'+(nr>1?'s':'')+'</b> qui ne sont liées à aucun compte.</p>'+
      '<button class="gate-btn" onclick="clClaim(true)">'+ic('check')+' Oui, ce sont les miennes</button>'+
      '<button class="gate-btn ghost" onclick="clClaim(false)">'+ic('user')+' Non, ouvrir mon espace</button>'+
      '<div class="gate-foot">« Oui » les ajoute à ton compte. « Non » les laisse de côté sur l’appareil, sans les mettre dans ton compte.</div>';
  }
  if(st.indexOf('wait:')===0){
    var w=st.slice(5), email=CLOUD.sess&&CLOUD.sess.user.email||'';
    return gateHead(w==='pending'?'Inscription':'Accès',w==='pending'?'Ton compte attend sa validation':(w==='blocked'?'Ton compte est bloqué':'Ton compte a été supprimé'))+
      '<p class="gate-p">'+(w==='pending'?'L’administrateur doit valider ton inscription (<b>'+esc(email)+'</b>). Cette page s’ouvrira toute seule dès que ce sera fait.':'Contacte l’administrateur de l’appli si tu penses que c’est une erreur.')+'</p>'+
      (w==='pending'?'<div class="gate-spin"><div class="inv-spin"></div></div><button class="gate-btn ghost" onclick="gateCheck()">'+ic('refresh')+' Vérifier maintenant</button>':'')+
      '<button class="gate-lnk" onclick="gateLogout()">'+ic('logout')+' Se déconnecter</button>';
  }
  return '';
}
function gateErr(m){ GATE.err=m||''; var e=document.getElementById('g-err'); if(e){ e.textContent=GATE.err; e.style.display=GATE.err?'block':'none'; } }
function gateBusy(on){ GATE.busy=!!on; document.querySelectorAll('#gate .gate-btn').forEach(function(b){ b.disabled=!!on; }); var b=document.getElementById('g-go'); if(b) b.classList.toggle('busy',!!on); }
function gateMode(m){ GATE.mode=m; GATE.err=''; gateRender(true); }
function gateEye(){ var p=document.getElementById('g-pw'), v=p?p.value:''; GATE.eye=!GATE.eye; gateRender(true); var q=document.getElementById('g-pw'); if(q){ q.value=v; q.focus(); } }
function gateGo(){
  if(GATE.busy) return;
  var email=(document.getElementById('g-email').value||'').trim(), pw=document.getElementById('g-pw').value||'';
  var n=document.getElementById('g-name'), name=n?n.value.trim():'';
  if(!/^\S+@\S+\.\S+$/.test(email)){ gateErr('Adresse email invalide'); return; }
  if(pw.length<6){ gateErr('Mot de passe trop court (6 caractères minimum)'); return; }
  if(GATE.mode==='signup'&&!name){ gateErr('Indique ton prénom'); return; }
  gateErr(''); gateBusy(true);
  clAuthDo(GATE.mode==='signup'?'signup':'login',email,pw,name).then(function(){ gateBusy(false); gateRender(true); },function(e){
    gateBusy(false);
    if(e.confirm){ GATE.mode='login'; gateRender(true); var em=document.getElementById('g-email'); if(em) em.value=email; }
    gateErr(e.message||String(e));
  });
}
function gateForgot(){
  var e=(document.getElementById('g-email').value||'').trim();
  if(!/^\S+@\S+\.\S+$/.test(e)){ gateErr('Entre ton adresse email, puis touche à nouveau « Mot de passe oublié ? »'); return; }
  clFetch('/auth/v1/recover'+clRedirectQS(),{method:'POST',auth:false,body:{email:e}}).then(function(){ gateErr(''); toast('Email envoyé à '+e+' : ouvre le lien qu’il contient pour choisir un nouveau mot de passe','ok'); },function(er){ gateErr(er.message); });
}
// ── Liens reçus par email (mot de passe oublié, confirmation d'adresse) ──
// Supabase renvoie vers l'appli avec #access_token=…&type=recovery (ou une erreur).
function recParseHash(){
  var h=location.hash||''; if(h.length<2||h.indexOf('rejoindre=')>=0) return null;
  var q; try{ q=new URLSearchParams(h.slice(1)); }catch(e){ return null; }
  if(q.get('error_code')||q.get('error')) return {err:q.get('error_code')||q.get('error'),desc:q.get('error_description')||''};
  if(!q.get('access_token')) return null;
  return {access_token:q.get('access_token'),refresh_token:q.get('refresh_token')||'',expires_in:+q.get('expires_in')||3600,expires_at:+q.get('expires_at')||0,type:q.get('type')||''};
}
function recCheckHash(){
  var o=recParseHash(); if(!o) return false;
  try{ history.replaceState(null,'',location.href.split('#')[0]); }catch(e){}
  if(o.err){
    GATE.mode='login';
    GATE.err=/expired|invalid|otp/i.test(o.err+' '+o.desc)?'Ce lien a expiré ou a déjà servi. Entre ton email puis touche « Mot de passe oublié ? » pour en recevoir un nouveau.':'Lien refusé : '+(o.desc||o.err);
    return true;
  }
  LS.setItem('v4_authlink',JSON.stringify(o));
  return true;
}
function recResume(){
  var o=null; try{ o=JSON.parse(LS.getItem('v4_authlink')||'null'); }catch(e){}
  if(!o||!CLOUD.cfg) return;
  fetch(CLOUD.cfg.url.replace(/\/+$/,'')+'/auth/v1/user',{headers:{apikey:CLOUD.cfg.key,Authorization:'Bearer '+o.access_token}})
    .then(function(r){ if(!r.ok) throw new Error('lien'); return r.json(); })
    .then(function(u){
      if(CLOUD.sess&&CLOUD.sess.user&&CLOUD.sess.user.id!==u.id){ clLogoutDo(); return; }   // un autre compte était ouvert : on le range, puis on reprend
      LS.removeItem('v4_authlink');
      clSetSession({access_token:o.access_token,refresh_token:o.refresh_token,expires_in:o.expires_in,expires_at:o.expires_at||undefined,user:{id:u.id,email:u.email}});
      if(typeof clPendingName==='function') clPendingName();
      if(o.type==='recovery'){ LS.setItem('v4_recovery','1'); GATE.err=''; gateRender(true); return; }
      toast(o.type==='email_change'?'Nouvelle adresse email confirmée':'Adresse email confirmée','ok');
      gateRender(true);
      if(clLive()) clSync(); else clAfterLogin().catch(function(e){ console.warn(e); });
    },function(){
      LS.removeItem('v4_authlink'); GATE.mode='login';
      GATE.err='Ce lien a expiré ou a déjà servi. Entre ton email puis touche « Mot de passe oublié ? » pour en recevoir un nouveau.';
      gateRender(true);
    });
}
function gateEyeN(){ var a=document.getElementById('g-npw'), b=document.getElementById('g-npw2'), va=a?a.value:'', vb=b?b.value:''; GATE.eye=!GATE.eye; gateRender(true); var x=document.getElementById('g-npw'), y=document.getElementById('g-npw2'); if(x) x.value=va; if(y) y.value=vb; }
function gateRecDone(){ LS.removeItem('v4_recovery'); GATE.err=''; gateRender(true); if(clLive()) clSync(); else clAfterLogin().catch(function(e){ console.warn(e); }); }
function gateNewPw(){
  if(GATE.busy) return;
  var p1=(document.getElementById('g-npw')||{}).value||'', p2=(document.getElementById('g-npw2')||{}).value||'';
  if(p1.length<6){ gateErr('Mot de passe trop court (6 caractères minimum)'); return; }
  if(p1!==p2){ gateErr('Les deux mots de passe ne sont pas identiques'); return; }
  gateErr(''); gateBusy(true);
  clAuthed(function(){ return clFetch('/auth/v1/user',{method:'PUT',body:{password:p1}}); }).then(function(){
    gateBusy(false); toast('Mot de passe modifié : tu es connecté','ok'); gateRecDone();
  },function(e){ gateBusy(false); gateErr(e.message||String(e)); });
}
function gateRecSkip(){ gateRecDone(); }
(function(){ var _ci=cloudInit; cloudInit=function(){ recCheckHash(); var r=_ci.apply(this,arguments); recResume(); gateRender(true); return r; }; })();

function gateInvite(){
  var o=clParseInvite(document.getElementById('g-inv').value);
  if(!o){ gateErr('Ce n’est pas un lien d’invitation Économat Pro'); return; }
  clUseInvite(o); GATE.mode='signup'; GATE.step=''; GATE.err=''; gateRender(true);
}
function gateServer(){
  var url=clNormUrl(document.getElementById('g-url').value), key=document.getElementById('g-key').value.trim();
  GATE.step='server';
  if(!/^https?:\/\/.+/.test(url)||key.length<20){ gateErr('Adresse ou clé incomplète'); return; }
  CLOUD.cfg={url:url,key:key}; gateBusy(true);
  clFetch('/auth/v1/settings',{auth:false}).then(function(){
    clSave('v4_cloud_cfg',CLOUD.cfg); GATE.mode='signup'; GATE.step=''; GATE.err=''; gateBusy(false); gateRender(true); toast('Serveur enregistré','ok'); recResume();
  },function(e){ CLOUD.cfg=null; gateBusy(false); gateErr(e.net?'Serveur injoignable : vérifie l’adresse':'Clé refusée : '+e.message); });
}
function gateForget(){ if(!confirm('Changer de serveur ?')) return; CLOUD.cfg=null; CLOUD.pendingInvite=null; clSave('v4_cloud_cfg',null); GATE.step=''; gateRender(true); }
function gateCheck(){ clAuthed(clMe).then(function(me){ if(me.status==='active'){ CLOUD.ui={}; gateRender(true); toast('Ton compte est validé','ok'); clAfterLogin().catch(function(e){ console.warn(e); }); } else toast('Pas encore validé','info'); },function(e){ toast(e.message,'err'); }); }
function gateLogout(){ GATE.mode='login'; clLogoutDo(); }

// L'écran suit chaque changement d'état de l'espace en ligne
(function(){
  var _u=clUI; clUI=function(){ _u.apply(this,arguments); gateRender(); };
  var _o=clSignedOut; clSignedOut=function(){ var r=_o.apply(this,arguments); gateRender(true); return r; };
  var _i=clUseInvite; clUseInvite=function(){ var r=_i.apply(this,arguments); GATE.mode='signup'; gateRender(true); return r; };
  if(CLOUD.ui&&CLOUD.ui.mode==='signup') GATE.mode='signup';
  if(CLOUD.pendingInvite) GATE.mode='signup';
  gateRender(true);
})();
