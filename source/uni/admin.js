// ══ ADMINISTRATION ═══════════════════════════════════════════
// Réservé aux comptes administrateurs : valider les inscriptions, gérer les
// comptes et retirer n'importe quel partage. Le serveur vérifie chaque action
// (fonctions admin_*) : l'appli ne fait qu'afficher.
var ADM={users:null,err:'',busy:false,q:'',open:{accts:false,del:false,shares:false}};
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
    .then(function(){ ADM.busy=false; renderAdmin(); });
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
  w.innerHTML=h;
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
