// ══ MON COMPTE : nom, email, mot de passe ═════════════════════
// Affiché dans Réglages → Espace en ligne. Le mot de passe actuel est demandé
// pour changer l'email ou le mot de passe (et ouvre une session toute fraîche,
// que le serveur exige pour ces deux changements).
var MC={err:'',busy:false,pending:null};

function mcBox(){
  var ui=CLOUD.ui||{}, k=ui.acct||'', email=CLOUD.sess&&CLOUD.sess.user.email||'';
  function row(key,label,val,extra){
    return '<div class="mc-row'+(k===key?' open':'')+'"><div class="mc-v"><small>'+label+'</small><b>'+val+'</b>'+(extra||'')+'</div>'+
      (k===key?'':'<button class="btn btn-ghost btn-sm" onclick="mcEdit(\''+key+'\')">'+ic('edit')+' Modifier</button>')+'</div>';
  }
  var h='<div class="cl-box mc" id="mc-box"><div class="cl-h">Mon compte</div>';
  h+=row('name','Nom affiché',esc(clMyName()));
  if(k==='name') h+='<div class="mc-ed"><div class="field"><div class="fl">Nom affiché sur tes recettes partagées</div><input class="fi" id="mc-name" value="'+esc(loadProfile().name||clMyName())+'" maxlength="60" autocomplete="name" onkeydown="if(event.key===\'Enter\')mcSaveName()"></div>'+
    '<div class="cl-btns"><button class="btn btn-gold btn-sm" onclick="mcSaveName()">'+ic('check')+' Enregistrer</button><button class="btn btn-ghost btn-sm" onclick="mcEdit(\'\')">Annuler</button></div></div>';
  h+=row('email','Email',esc(email),MC.pending?'<span class="mc-pend">'+ic('clock')+' En attente de confirmation : '+esc(MC.pending)+'</span>':'');
  if(k==='email') h+='<div class="mc-ed"><div class="field"><div class="fl">Nouvelle adresse email</div><input class="fi" id="mc-email" type="email" autocomplete="email" autocapitalize="off" spellcheck="false" placeholder="nouvelle@adresse.fr"></div>'+
    '<div class="field"><div class="fl">Mot de passe actuel</div><input class="fi" id="mc-pw0" type="password" autocomplete="current-password" onkeydown="if(event.key===\'Enter\')mcSaveEmail()"></div>'+
    '<div class="cl-hint" style="margin:0 0 8px">Un email de confirmation peut t’être envoyé : clique sur son lien pour valider le changement. Jusque-là, tu te connectes avec l’ancienne adresse.</div>'+
    '<div class="cl-btns"><button class="btn btn-gold btn-sm" onclick="mcSaveEmail()">'+ic('check')+' Changer l’email</button><button class="btn btn-ghost btn-sm" onclick="mcEdit(\'\')">Annuler</button></div></div>';
  h+=row('pw','Mot de passe','••••••••');
  if(k==='pw') h+='<div class="mc-ed"><div class="field"><div class="fl">Mot de passe actuel</div><input class="fi" id="mc-pw0" type="password" autocomplete="current-password"></div>'+
    '<div class="field"><div class="fl">Nouveau mot de passe</div><input class="fi" id="mc-pw1" type="password" autocomplete="new-password" placeholder="6 caractères minimum"></div>'+
    '<div class="field"><div class="fl">Nouveau mot de passe (encore une fois)</div><input class="fi" id="mc-pw2" type="password" autocomplete="new-password" onkeydown="if(event.key===\'Enter\')mcSavePw()"></div>'+
    '<div class="cl-btns"><button class="btn btn-gold btn-sm" onclick="mcSavePw()">'+ic('check')+' Changer le mot de passe</button><button class="btn btn-ghost btn-sm" onclick="mcEdit(\'\')">Annuler</button></div></div>';
  h+='<div class="cl-err" id="mc-err">'+esc(MC.err||'')+'</div>'+
    '<button class="btn btn-ghost btn-sm mc-out" onclick="clLogout()">'+ic('logout')+' Se déconnecter</button></div>';
  return h;
}
function mcErr(m){ MC.err=m||''; var e=document.getElementById('mc-err'); if(e) e.textContent=MC.err; }
function mcBusy(on){ MC.busy=!!on; document.querySelectorAll('#mc-box .btn').forEach(function(b){ b.disabled=!!on; }); }
function mcEdit(k){
  if(!CLOUD.ui) CLOUD.ui={};
  CLOUD.ui.acct=k||''; MC.err=''; clRedraw();
  var f=document.querySelector('#mc-box .mc-ed input'); if(f) f.focus();
  if(k==='email') mcRefreshUser();
}
function mcDone(){ CLOUD.ui.acct=''; MC.err=''; clRedraw(); clUI(); }

// ── nom ──
function mcSaveName(){
  var v=(document.getElementById('mc-name').value||'').trim().replace(/\s+/g,' ');
  if(!v){ mcErr('Entre un nom'); return; }
  var p=loadProfile(); p.name=v; LS.setItem('v4_profile',JSON.stringify(p));
  var f=document.getElementById('pf-name'); if(f) f.value=v;
  if(CLOUD.st){ CLOUD.st.nameSent=null; clSaveState(); }
  mcBusy(true);
  clAuthed(function(){ return clFetch('/rest/v1/rpc/set_my_name',{method:'POST',body:{p_name:v}}); }).then(function(){
    if(CLOUD.st){ CLOUD.st.nameSent=v; clSaveState(); }
    return clSync();
  },function(){ /* hors ligne : partira à la prochaine synchro */ }).then(function(){
    mcBusy(false); mcDone(); try{ renderHome(); }catch(e){} toast('Nom modifié','ok');
  });
}

// ── réauthentification (mot de passe actuel) ──
function mcReauth(pw){
  if(!pw) return Promise.reject(new Error('Entre ton mot de passe actuel'));
  return clFetch('/auth/v1/token?grant_type=password',{method:'POST',auth:false,body:{email:CLOUD.sess.user.email,password:pw}})
    .then(clSetSession,function(e){ if(/incorrect/i.test(e.message)) e.message='Mot de passe actuel incorrect'; throw e; });
}
function mcRefreshUser(){
  if(!clActive()) return Promise.resolve();
  return clAuthed(function(){ return clFetch('/auth/v1/user'); }).then(function(u){
    if(!u) return;
    if(u.email&&CLOUD.sess&&u.email!==CLOUD.sess.user.email){ CLOUD.sess.user.email=u.email; clSave('v4_cloud_sess',CLOUD.sess); }
    MC.pending=(u.new_email&&u.new_email!==u.email)?u.new_email:null;
    if(document.getElementById('mc-box')) clRedraw();
  },function(){});
}

// ── email ──
function mcSaveEmail(){
  var ne=(document.getElementById('mc-email').value||'').trim().toLowerCase(), pw=document.getElementById('mc-pw0').value;
  if(!/^\S+@\S+\.\S+$/.test(ne)){ mcErr('Adresse email invalide'); return; }
  if(ne===String(CLOUD.sess.user.email||'').toLowerCase()){ mcErr('C’est déjà ton adresse actuelle'); return; }
  mcErr(''); mcBusy(true);
  mcReauth(pw).then(function(){ return clFetch('/auth/v1/user'+clRedirectQS(),{method:'PUT',body:{email:ne}}); }).then(function(u){
    mcBusy(false);
    if(u&&u.new_email&&String(u.new_email).toLowerCase()!==String(u.email||'').toLowerCase()){
      MC.pending=u.new_email; mcDone();
      toast('Email de confirmation envoyé à '+u.new_email+' : clique sur son lien pour valider','info');
    } else {
      MC.pending=null; CLOUD.sess.user.email=(u&&u.email)||ne; clSave('v4_cloud_sess',CLOUD.sess); mcDone();
      toast('Email modifié','ok');
    }
  },function(e){
    mcBusy(false);
    mcErr(/existe déjà/.test(e.message)?'Cet email est déjà utilisé par un autre compte':e.message);
  });
}

// ── mot de passe ──
function mcSavePw(){
  var p0=document.getElementById('mc-pw0').value, p1=document.getElementById('mc-pw1').value, p2=document.getElementById('mc-pw2').value;
  if(!p0){ mcErr('Entre ton mot de passe actuel'); return; }
  if(p1.length<6){ mcErr('Nouveau mot de passe trop court (6 caractères minimum)'); return; }
  if(p1!==p2){ mcErr('Les deux nouveaux mots de passe ne sont pas identiques'); return; }
  if(p1===p0){ mcErr('Le nouveau mot de passe doit être différent de l’ancien'); return; }
  mcErr(''); mcBusy(true);
  mcReauth(p0).then(function(){ return clFetch('/auth/v1/user',{method:'PUT',body:{password:p1}}); }).then(function(){
    mcBusy(false); mcDone(); toast('Mot de passe modifié','ok');
  },function(e){ mcBusy(false); mcErr(e.message); });
}
