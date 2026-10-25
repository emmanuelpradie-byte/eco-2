// ══ ADMINISTRATION ═══════════════════════════════════════════
// Réservé aux comptes administrateurs : valider les inscriptions, gérer les
// comptes et retirer n'importe quel partage. Le serveur vérifie chaque action
// (fonctions admin_*) : l'appli ne fait qu'afficher.
var ADM={users:null,err:'',busy:false,q:'',open:{accts:false,del:false,shares:false,copies:false},copies:null,copErr:'',cq:''};
function admSec(key,title,count,body,forceOpen){
  var open=forceOpen||ADM.open[key];
  return '<details class="adm-sec"'+(open?' open':'')+' ontoggle="ADM.open[\''+key+'\']=this.open"><summary><span class="adm-st">'+title+'</span><span class="adm-cnt">'+count+'</span>'+ic('chev-down')+'</summary><div class="adm-sb">'+body+'</div></details>';
}

function admNav(){
  var on=typeof clIsAdmin==='function'&&clIsAdmin();
  var n=document.getElementById('nav-admin'); if(n) n.style.display=on?'':'none';
  var b=document.getElementById('nd-admin'); if(b){ b.textContent=CLOUD.pendingN||''; b.classList.toggle('on',!!(on&&CLOUD.pendingN)); }
  if(!on&&typeof CUR!=='undefined'&&CUR==='admin') goPage('home');
}
function admLoad(){
  ADM.busy=true; ADM.err='';
  return clAuthed(function(){ return clFetch('/rest/v1/profiles?select=id,email,display_name,status,is_admin,created_at'); })
    .then(function(r){ ADM.users=(r||[]).sort(function(a,b){ return a.created_at<b.created_at?1:-1; }); CLOUD.pendingN=ADM.users.filter(function(u){ return u.status==='pending'; }).length; admNav(); },
          function(e){ ADM.err=e.message||String(e); })
    .then(function(){ return admLoadCopies(); })
    .then(function(){ ADM.busy=false; renderAdmin(); });
}
// qui a copié / ouvert les partages
function admLoadCopies(){
  return clRpc('admin_share_copies',{}).then(function(r){ ADM.copies=Array.isArray(r)?r:[]; ADM.copErr=''; },
    function(e){ ADM.copies=[]; ADM.copErr=(e&&(e.status===404||e.status===400))?'missing':(e.message||String(e)); });
}
function admDateTime(t){ try{ var d=new Date(t); return d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})+' à '+d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}); }catch(e){ return ''; } }
function admCopiesHTML(){
  if(ADM.copErr==='missing') return '<div class="imp-msg imp-warn">'+ic('info')+' Le serveur n’a pas encore le journal des copies. Lance <b>supabase-update-v8.sql</b> dans Supabase → SQL Editor.</div>';
  if(ADM.copErr) return '<div class="imp-msg imp-warn">'+esc(ADM.copErr)+'</div>';
  var all=ADM.copies||[], q=normTxt(ADM.cq), TY={rec:['book','Recette'],bon:['bon','Bon d’économat'],doc:['file','Document']};
  var rows=all.filter(function(c){ return !q||normTxt([c.item_name,c.copier_name,c.copier_email,c.owner_name,c.folder].join(' ')).indexOf(q)>=0; });
  var by={}, order=[];
  rows.forEach(function(c){ var k=c.item_id; if(!by[k]){ by[k]={c:c,list:[]}; order.push(k); } by[k].list.push(c); });
  var h='<div class="srch">'+ic('search')+'<input class="sinp" id="adm-cq" placeholder="Rechercher une recette ou une personne…" value="'+esc(ADM.cq)+'" oninput="ADM.cq=this.value;ADM.open.copies=true;renderAdmin();var i=document.getElementById(\'adm-cq\');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length);}"></div>'+
    '<div class="adm-cpbar"><span>Chaque copie de recette ou de bon et chaque document ouvert par quelqu’un d’autre que son auteur.</span><button class="btn btn-ghost btn-sm" onclick="admLoadCopies().then(function(){ADM.open.copies=true;renderAdmin();})">'+ic('refresh')+' Actualiser</button></div>';
  if(!all.length) return h+'<div class="empty" style="padding:14px"><div class="empty-s">Personne n’a encore copié de partage. Chaque copie de recette ou de bon, et chaque document ouvert, apparaîtra ici.</div></div>';
  if(!rows.length) return h+'<div class="empty" style="padding:14px"><div class="empty-s">Aucun résultat.</div></div>';
  h+='<div class="adm-cp">'+order.map(function(k){
    var g=by[k], c=g.c, ty=TY[c.item_type]||TY.rec, who={};
    g.list.forEach(function(x){ who[x.copier]=1; });
    var nw=Object.keys(who).length;
    return '<div class="adm-cpg"><div class="adm-cph"><span class="adm-cpi">'+ic(ty[0])+'</span><div class="adm-b"><div class="adm-n">'+esc(c.item_name||'—')+'</div>'+
      '<div class="adm-s">'+ty[1]+' de '+esc(c.owner_name||'—')+(c.folder?' · dossier « '+esc(c.folder)+' »':'')+'</div></div><span class="adm-cnt">'+nw+' personne'+(nw>1?'s':'')+'</span></div>'+
      g.list.map(function(x){
        var u={display_name:x.copier_name,email:x.copier_email};
        return '<div class="adm-cpr">'+admAvatar(u)+'<div class="adm-b"><div class="adm-n">'+esc(x.copier_name||'—')+'</div><div class="adm-s">'+(x.action==='open'?'a ouvert le document':'a copié')+' · '+admDateTime(x.created_at)+'</div></div></div>';
      }).join('')+'</div>';
  }).join('')+'</div>';
  return h;
}
function admName(u){ return u.display_name||String(u.email||'').split('@')[0]||'—'; }
function admDate(t){ try{ return new Date(t).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}); }catch(e){ return ''; } }
function admAvatar(u){ var n=admName(u); return '<span class="adm-av" style="--ch:'+catHue(n)+'">'+esc(n.charAt(0).toUpperCase())+'</span>'; }
function admBadge(u){
  var m={pending:['b-warn','En attente'],active:['b-ok2','Actif'],blocked:['b-err','Bloqué'],deleted:['b-err','Supprimé']}[u.status]||['b-new',u.status];
  return '<span class="ri-badge '+m[0]+'">'+m[1]+'</span>'+(u.is_admin?' <span class="ri-badge b-new">'+ic('shield')+' Admin</span>':'');
}

function renderAdmin(){
  var w=document.getElementById('adm-wrap'); if(!w) return;
  if(!clIsAdmin()){ w.innerHTML='<div class="empty"><div class="empty-s">Réservé à l’administrateur.</div></div>'; return; }
  if(ADM.users==null&&!ADM.busy){ admLoad(); w.innerHTML='<div class="empty"><div class="inv-spin"></div></div>'; return; }
  var me=clUid(), us=ADM.users||[], q=normTxt(ADM.q);
  var pend=us.filter(function(u){ return u.status==='pending'; });
  var rest=us.filter(function(u){ return u.status!=='pending'&&u.status!=='deleted'&&(!q||normTxt(admName(u)+' '+u.email).indexOf(q)>=0); });
  var appr=!(CLOUD.me&&CLOUD.me.approval===false);
  var h=(ADM.err?'<div class="imp-msg imp-warn">'+esc(ADM.err)+'</div>':'');
  // Inscriptions
  h+='<div class="cw"><div class="cw-t">'+ic('user')+' Inscriptions</div>'+
    '<label class="sh-tg"><input type="checkbox" id="adm-appr"'+(appr?' checked':'')+' onchange="admApproval(this.checked)"><span><b>Valider chaque nouveau compte</b><small>'+(appr?'Un nouveau compte n’a accès à rien tant que tu ne l’as pas validé ici, sauf s’il vient de ton lien d’invitation.':'Désactivé : toute personne qui a l’adresse du serveur peut créer un compte actif.')+'</small></span></label>'+
    '<div class="adm-inv"><div><b>Ton lien d’invitation</b><small>Les comptes créés avec ce lien sont validés d’office.'+(CLOUD.inv&&CLOUD.inv.expires_at?' Valable jusqu’au '+admDate(CLOUD.inv.expires_at)+'.':'')+'</small></div>'+
      '<div class="adm-acts"><button class="btn btn-gold btn-sm" onclick="clShareInvite()">'+ic('link')+' Envoyer le lien</button><button class="btn btn-ghost btn-sm" onclick="admRevoke()">Annuler les anciens liens</button></div></div></div>';
  // Serveur intégré à l'appli
  var built=CLOUD.cfg&&CLOUD.cfg.builtin;
  h+='<div class="cw"><div class="cw-t">'+ic('download')+' Appli de ton équipe</div><div class="cl-p" style="margin:0 0 10px">'+
    (built?'Ton appli contient déjà l’adresse de ton serveur : en ouvrant le site, chacun arrive directement sur l’écran de connexion.':
    'Pour que chacun arrive directement sur l’écran de connexion, sans lien d’invitation ni réglage, télécharge l’appli avec l’adresse de ton serveur intégrée, puis remplace le fichier <b>index.html</b> de ton site GitHub par celui-ci.')+'</div>'+
    '<button class="btn btn-ghost btn-sm" onclick="admBundle()">'+ic('download')+' Télécharger l’appli préconfigurée (index.html)</button></div>';
  // À valider
  h+='<div class="sh"><div class="sh-t">À valider · '+pend.length+'</div></div>';
  h+=pend.length?'<div class="adm-list">'+pend.map(function(u){
      return '<div class="adm-u pend">'+admAvatar(u)+'<div class="adm-b"><div class="adm-n">'+esc(admName(u))+'</div><div class="adm-s">'+esc(u.email||'')+' · inscrit le '+admDate(u.created_at)+'</div></div>'+
        '<div class="adm-acts"><button class="btn btn-gold btn-sm" onclick="admSet(\''+u.id+'\',\'active\')">'+ic('check')+' Valider</button><button class="btn btn-ghost btn-sm" onclick="admDelete(\''+u.id+'\',true)">Refuser</button></div></div>';
    }).join('')+'</div>':'<div class="empty" style="padding:14px"><div class="empty-s">Aucune inscription en attente.</div></div>';
  // Comptes (repliés par défaut : on ne les voit que si on le demande)
  var nAct=us.filter(function(u){ return u.status!=='pending'&&u.status!=='deleted'; }).length;
  var accts='<div class="srch">'+ic('search')+'<input class="sinp" placeholder="Rechercher un compte…" value="'+esc(ADM.q)+'" oninput="ADM.q=this.value;ADM.open.accts=true;ADM.open.del=true;renderAdmin();var i=document.querySelector(\'#adm-wrap .srch input\');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length);}"></div>'+
    '<div class="adm-list">'+(rest.length?rest.map(function(u){
      var self=u.id===me, acts='';
      if(self) acts='<span class="adm-me">C’est toi</span>';
      else acts=(u.status==='blocked'?'<button class="btn btn-ghost btn-sm" onclick="admSet(\''+u.id+'\',\'active\')">'+ic('check')+' Débloquer</button>':'<button class="btn btn-ghost btn-sm" onclick="admSet(\''+u.id+'\',\'blocked\')">Bloquer</button>')+
        (u.status==='active'?'<button class="btn btn-ghost btn-sm" onclick="admAdmin(\''+u.id+'\','+(u.is_admin?'false':'true')+')">'+ic('shield')+' '+(u.is_admin?'Retirer admin':'Nommer admin')+'</button>':'')+
        '<button class="icbtn" title="Supprimer le compte" onclick="admDelete(\''+u.id+'\')">'+ic('trash')+'</button>';
      return '<div class="adm-u">'+admAvatar(u)+'<div class="adm-b"><div class="adm-n">'+esc(admName(u))+' '+admBadge(u)+'</div><div class="adm-s">'+esc(u.email||'')+' · depuis le '+admDate(u.created_at)+'</div></div><div class="adm-acts">'+acts+'</div></div>';
    }).join(''):'<div class="empty" style="padding:14px"><div class="empty-s">Aucun compte'+(q?' ne correspond':'')+'.</div></div>')+'</div>';
  h+=admSec('accts','Comptes',nAct,accts,!!q&&rest.length>0);
  // Comptes supprimés : rétablissables
  var gone=us.filter(function(u){ return u.status==='deleted'&&(!q||normTxt(admName(u)+' '+u.email).indexOf(q)>=0); });
  var nGone=us.filter(function(u){ return u.status==='deleted'; }).length;
  var del='<div class="shr-info" style="margin:0 0 10px">'+ic('info')+'<span>Un compte supprimé n’a plus accès à rien et son espace en ligne est vide. En le rétablissant, la personne se reconnecte avec son ancien email et son ancien mot de passe : ses recettes, son catalogue et ses bons reviennent depuis ses appareils, et ses recettes partagées sont de nouveau partagées.</span></div>'+
    '<div class="adm-list">'+(gone.length?gone.map(function(u){
      return '<div class="adm-u gone">'+admAvatar(u)+'<div class="adm-b"><div class="adm-n">'+esc(admName(u))+' '+admBadge(u)+'</div><div class="adm-s">'+esc(u.email||'')+' · depuis le '+admDate(u.created_at)+'</div></div>'+
        '<div class="adm-acts"><button class="btn btn-gold btn-sm" onclick="admRestore(\''+u.id+'\')">'+ic('refresh')+' Rétablir</button></div></div>';
    }).join(''):'<div class="empty" style="padding:14px"><div class="empty-s">Aucun compte supprimé.</div></div>')+'</div>';
  h+=admSec('del','Comptes supprimés',nGone,del,!!q&&gone.length>0);
  // Partages
  var rows=sharedList(), by={};
  rows.forEach(function(x){ var k=x.owner; (by[k]=by[k]||{name:x.owner_name||'—',folders:{},loose:[]}); if(x.data.folder) (by[k].folders[x.data.folder]=by[k].folders[x.data.folder]||[]).push(x); else by[k].loose.push(x); });
  var shr=rows.length?Object.keys(by).map(function(k){
    var o=by[k];
    return '<div class="cw adm-sh"><div class="cw-t">'+ic('user')+' '+esc(o.name)+(k===me?' (toi)':'')+'</div>'+
      Object.keys(o.folders).sort().map(function(f){ var rs=o.folders[f];
        return '<div class="adm-f"><div class="adm-fh">'+ic('folder')+'<b>'+esc(f)+'</b><span>'+rs.length+' recette'+(rs.length>1?'s':'')+'</span><button class="btn btn-ghost btn-sm" onclick="admUnshareFolder(\''+k+'\',\''+escJS(f)+'\')">Retirer le dossier</button></div>'+
          rs.map(admShRow).join('')+'</div>'; }).join('')+
      (o.loose.length?'<div class="adm-f">'+o.loose.map(admShRow).join('')+'</div>':'')+'</div>';
  }).join(''):'<div class="empty" style="padding:14px"><div class="empty-s">Rien n’est partagé pour l’instant.</div></div>';
  shr+='<div class="shr-info" style="margin-top:12px">'+ic('info')+'<span>Retirer un partage le fait disparaître pour tout le monde ; la recette reste dans l’espace de son auteur, qui est prévenu. Les copies déjà faites restent chez ceux qui les ont faites.</span></div>';
  h+=admSec('shares','Partages',rows.length+' recette'+(rows.length>1?'s':''),shr);
  var ncp=(ADM.copies||[]).length;
  h+=admSec('copies',ic('download')+' Qui a copié les partages',ncp?ncp+' copie'+(ncp>1?'s':''):'—',admCopiesHTML(),!!ADM.cq);
  if(typeof themeLocks==='function') themeLocks().forEach(function(L){ h+=admSec('th-'+L.key,ic('sparkle')+' Thème '+esc(L.n),(typeof themeLock==='function'&&themeLock()&&themeLock().key===L.key)?'actif ici':'lien',admThemeHTML(L)); });
  w.innerHTML=h;
}
// ── Thèmes verrouillés : liens à donner ──
function admThemeLink(key,invite){
  var base=location.href.split('#')[0].split('?')[0]+'?theme='+key;
  if(!invite) return base;
  var inv=clInviteLink(); return inv?base+inv.slice(inv.indexOf('#')):'';
}
function admThemeHTML(L){
  var here=typeof themeLock==='function'&&themeLock()&&themeLock().key===L.key;
  function row(title,sub,invite){
    return '<div class="adm-th-l"><div class="adm-th-lt"><b>'+title+'</b><small>'+sub+'</small></div>'+
      '<div class="adm-th-u">'+esc(invite?admThemeLink(L.key,false).replace(/\?.*/,'')+'?theme='+L.key+'#rejoindre=…':admThemeLink(L.key,false))+'</div>'+
      '<div class="adm-th-b"><button class="btn btn-ghost btn-sm" onclick="admThemeCopy(\''+L.key+'\','+invite+')">'+ic('copy')+' Copier</button>'+
      (navigator.share?'<button class="btn btn-gold btn-sm" onclick="admThemeShare(\''+L.key+'\','+invite+')">'+ic('share')+' Envoyer</button>':'')+'</div></div>';
  }
  return '<div class="adm-th">'+
    '<div class="adm-th-h"><img src="'+L.logo+'" alt=""><div><b>'+esc(L.n)+'</b><div class="adm-th-c">'+L.colors.map(function(c){ return '<span style="background:'+c+'"></span>'; }).join('')+'</div>'+
      '<small>Couleurs et logo dans toute l’appli, sur les bons et les fiches (sans le « C »). Celui qui ouvre ce lien garde ce thème et ne peut pas le changer.</small></div></div>'+
    row('Lien du thème','Pour quelqu’un qui a déjà un compte, ou qui en créera un',false)+
    row('Invitation avec le thème','Crée le compte, validé d’office, et bloque le thème en même temps',true)+
    '<div class="adm-th-me">'+(here?ic('check-circle')+'<span>Ce thème est actif sur cet appareil.</span><button class="lnk" onclick="themeUnlockUI()">Le retirer</button>'
      :ic('mobile')+'<span>Voir l’appli comme ceux qui reçoivent le lien.</span><button class="lnk" onclick="admThemeTry(\''+L.key+'\')">Essayer sur cet appareil</button>')+'</div>'+
  '</div>';
}
function admThemeGet(key,invite){
  if(invite&&clIsAdmin()&&!(CLOUD.inv&&CLOUD.inv.code)) return clAdminTick().then(function(){ return admThemeLink(key,true); });
  return Promise.resolve(admThemeLink(key,invite));
}
function admThemeCopy(key,invite){
  admThemeGet(key,invite).then(function(link){ if(!link){ toast('Lien indisponible : vérifie la connexion','err'); return; }
    clCopy(link).then(function(){ toast(invite?'Invitation copiée : colle-la dans un message':'Lien du thème copié','ok'); },function(){ prompt('Copie ce lien :',link); }); });
}
function admThemeShare(key,invite){
  var L=(themeLocks().filter(function(x){ return x.key===key; })[0])||{n:''};
  admThemeGet(key,invite).then(function(link){ if(!link) return;
    navigator.share({title:'Économat Pro · '+L.n,text:invite?clMyName()+' t’invite sur Économat Pro ('+L.n+')':'Économat Pro · '+L.n,url:link}).catch(function(){}); });
}
function admThemeTry(key){
  if(!confirm('Mettre le thème sur cet appareil ?\n\nTu pourras le retirer ici ou dans les Réglages.')) return;
  location.href=admThemeLink(key,false);
}
function admShRow(x){
  return '<div class="adm-r"><span onclick="openShared(\''+escJS(x.id)+'\')">'+esc(x.data.name)+'</span><button class="lnk" onclick="admUnshare(\''+escJS(x.id)+'\')">Retirer</button></div>';
}
function admDo(fn,args,msg){
  return clRpc(fn,args).then(function(r){ if(msg) toast(msg,'ok'); return r; },function(e){ toast(e.message||String(e),'err'); throw e; });
}
function admSet(id,st){
  var u=(ADM.users||[]).find(function(x){ return x.id===id; });
  if(st==='blocked'&&!confirm('Bloquer '+(u?admName(u):'ce compte')+' ? Il n’aura plus accès à son espace en ligne ni aux partages (ses données sont gardées).')) return;
  admDo('admin_set_status',{p_user:id,p_status:st},st==='active'?(u&&u.status==='pending'?'Compte validé':'Compte débloqué'):'Compte bloqué').then(admLoad,function(){});
}
function admRestore(id){
  var u=(ADM.users||[]).find(function(x){ return x.id===id; });
  if(!confirm('Rétablir le compte de '+(u?admName(u)+' ('+u.email+')':'ce compte')+' ?\n\nLa personne retrouve l’accès à son espace en ligne et à Partage. Ses données reviennent depuis ses appareils à sa prochaine connexion.')) return;
  admDo('admin_restore_user',{p_user:id},'Compte rétabli').then(function(){ ADM.open.accts=true; admLoad(); },function(){});
}
function admAdmin(id,on){
  var u=(ADM.users||[]).find(function(x){ return x.id===id; });
  if(on&&!confirm('Nommer '+(u?admName(u):'ce compte')+' administrateur ? Il aura les mêmes droits que toi.')) return;
  admDo('admin_set_admin',{p_user:id,p_admin:on},on?'Administrateur nommé':'Droits d’administrateur retirés').then(admLoad,function(){});
}
function admDelete(id,refuse){
  var u=(ADM.users||[]).find(function(x){ return x.id===id; });
  if(!confirm((refuse?'Refuser l’inscription de ':'Supprimer le compte de ')+(u?admName(u)+' ('+u.email+')':'ce compte')+' ?\n\nSon espace en ligne (recettes, catalogue, bons, documents) est effacé et ses partages retirés. Ce qu’il a sur ses appareils n’est pas touché. Action définitive.')) return;
  admDo('admin_delete_user',{p_user:id},refuse?'Inscription refusée':'Compte supprimé').then(function(){ admLoad(); clSync(); },function(){});
}
function admUnshare(id){
  var x=(CLOUD.shared||{})[id]; if(!x) return;
  if(!confirm('Retirer « '+(x.data&&x.data.name)+' » du partage pour tout le monde ?')) return;
  admDo('admin_unshare',{p_id:id},'Partage retiré').then(function(){ return clSync(); }).then(renderAdmin,function(){});
}
function admUnshareFolder(owner,f){
  if(!confirm('Retirer tout le dossier « '+f+' » du partage ?')) return;
  admDo('admin_unshare_folder',{p_owner:owner,p_folder:f}).then(function(n){ toast('Dossier retiré ('+(n||0)+' recette'+(n>1?'s':'')+')','ok'); return clSync(); }).then(renderAdmin,function(){});
}
function admApproval(on){
  admDo('admin_set_approval',{p_on:!!on},on?'Validation des nouveaux comptes activée':'Validation désactivée').then(function(){ if(CLOUD.me) CLOUD.me.approval=!!on; clSave('v4_cloud_me',CLOUD.me); renderAdmin(); },function(){ renderAdmin(); });
}
function admRevoke(){
  if(!confirm('Annuler tous les liens d’invitation envoyés ? Les comptes déjà créés ne changent pas ; un nouveau lien sera créé.')) return;
  admDo('admin_revoke_invites',{},'Anciens liens annulés').then(function(){ CLOUD.inv=null; clSave('v4_cloud_inv',null); return clAdminTick(); }).then(renderAdmin,function(){});
}

(function(){
  var _g=goPage;
  goPage=function(p){
    var r=_g.apply(this,arguments);
    var n=document.getElementById('nav-admin'); if(n) n.classList.toggle('on',p==='admin');
    if(p==='admin'){
      var bc=document.getElementById('tb-bc'); if(bc) bc.textContent='Administration';
      ADM.users=null; renderAdmin(); if(clActive()) clSync();
    }
    return r;
  };
  admNav();
})();

// index.html avec l'adresse et la clé publique du serveur intégrées (la clé publique n'est pas secrète)
function admBundle(){
  if(!CLOUD.cfg){ toast('Aucun serveur configuré','err'); return; }
  var url=location.href.split('#')[0].split('?')[0];
  fetch(url,{cache:'no-store'}).then(function(r){ if(!r.ok) throw new Error('page'); return r.text(); }).then(function(html){
    var re=/window\.ECO_SERVER=\{[^}]*\};/;
    if(!re.test(html)) throw new Error('marque');
    var out=html.replace(re,'window.ECO_SERVER='+JSON.stringify({url:CLOUD.cfg.url,key:CLOUD.cfg.key})+';');
    var a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([out],{type:'text/html'})); a.download='index.html';
    document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },1500);
    toast('index.html téléchargé : remplace celui de ton site','ok');
  }).catch(function(){ toast('Impossible de lire l’appli : ouvre-la depuis ton site (adresse https://…) puis réessaie','err'); });
}
