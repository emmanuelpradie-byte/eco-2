// ══ INGRÉDIENT : RECETTES QUI L'UTILISENT ═══════════════════════
// Directement, ou au travers d'une sous-recette (« via »).
function ingUsage(id){
  var direct=[], via=[], memo={};
  function uses(r,depth,seen){
    if(memo[r.id]!=null) return memo[r.id];
    var ok=false;
    (r.items||[]).forEach(function(it){
      if(ok) return;
      if(it.type==='ingredient'){ if(it.refId===id) ok=true; }
      else if(depth<6&&seen.indexOf(it.refId)<0){ var s=recipes.find(function(x){ return x.id===it.refId; }); if(s&&uses(s,depth+1,seen.concat([r.id]))) ok=true; }
    });
    return (memo[r.id]=ok);
  }
  recipes.forEach(function(r){
    var lines=(r.items||[]).filter(function(it){ return it.type==='ingredient'&&it.refId===id; });
    if(lines.length){
      var kg=0, qs=false; lines.forEach(function(it){ var g=ingredients.find(function(i){ return i.id===id; }); var k=toKg(it.qty,it.unit,g); kg+=k; if(!(Number(it.qty)>0)) qs=true; });
      direct.push({r:r, kg:kg, qs:qs&&kg===0, n:lines.length});
    } else if(uses(r,0,[])) {
      var subs=(r.items||[]).filter(function(it){ return it.type==='recipe'; }).map(function(it){ return recipes.find(function(x){ return x.id===it.refId; }); })
        .filter(function(s){ return s&&uses(s,1,[r.id]); }).map(function(s){ return s.name; });
      via.push({r:r, subs:subs});
    }
  });
  var byName=function(a,b){ return a.r.name.localeCompare(b.r.name,'fr'); };
  return {direct:direct.sort(byName), via:via.sort(byName)};
}
function ingUsageHTML(id){
  var u=ingUsage(id), n=u.direct.length+u.via.length;
  var row=function(x,sub){
    return '<div class="use-r" onclick="closeMod(\'m-editcat\');openEditRec(\''+x.r.id+'\')"><span class="use-n">'+esc(x.r.name)+'</span>'+
      '<span class="use-m">'+(sub?ic('sub')+' via '+esc(x.subs.join(', ')):(x.qs?'Q.S.':fQtyNice(x.kg))+(x.n>1?' · '+x.n+' lignes':''))+'</span>'+ic('arrow-right')+'</div>';
  };
  return '<div class="use-h">'+ic('book')+' Utilisé dans '+(n?n+' recette'+(n>1?'s':''):'aucune recette')+'</div>'+
    (n?'<div class="use-list">'+u.direct.map(function(x){ return row(x,false); }).join('')+u.via.map(function(x){ return row(x,true); }).join('')+'</div>'
      :'<div class="use-empty">Cet ingrédient n’apparaît dans aucune recette.</div>');
}
(function(){
  var _o=openEditIng;
  openEditIng=function(id){
    _o.apply(this,arguments);
    var body=document.querySelector('#m-editcat .m-body'); if(!body) return;
    var box=document.getElementById('edit-cat-use');
    if(!box){ box=document.createElement('div'); box.id='edit-cat-use'; body.insertBefore(box,body.firstChild); }
    box.innerHTML=ingUsageHTML(id);
  };
})();

// ══ NOTIFICATIONS (cloche) ══════════════════════════════════════
// · une recette (ou un bon) que tu as copiée depuis le partage a été
//   modifiée par son auteur ;
// · quelqu'un a partagé une nouvelle recette, un bon ou un document.
function ntfSeen(){ var v=Number(LS.getItem('v4_ntf_seen')||0); if(!v){ v=Date.now(); LS.setItem('v4_ntf_seen',String(v)); } return v; }
function ntfSig(d){ var t=JSON.stringify([d.name,d.items,d.notes,d.time||0,d.pcs||0]); var h=0; for(var i=0;i<t.length;i++){ h=((h<<5)-h+t.charCodeAt(i))|0; } return String(h); }
function ntfTs(s){ var t=Date.parse(s||''); return isNaN(t)?0:t; }
function ntfList(){
  var out=[], sh=(typeof CLOUD!=='undefined'&&CLOUD.shared)||{}, changed=false, seen=ntfSeen();
  if(!Object.keys(sh).length) return out;
  function copies(arr,kind){
    arr.forEach(function(r){
      var f=r.fromShared; if(!f||!f.id) return;
      var x=sh[f.id]; if(!x||!x.data||shrIsMine(x)) return;
      var sg=ntfSig(x.data);
      if(!f.sig){ f.sig=sg; if(!f.at) f.at=x.updated_at; changed=true; return; }   // repère de départ, sans alerte
      if(sg!==f.sig&&ntfTs(x.updated_at)>ntfTs(f.at)) out.push({k:'upd', kind:kind, x:x, copy:r, ts:ntfTs(x.updated_at)});
    });
  }
  copies(recipes,'rec'); copies(orders,'bon');
  if(changed) persist();
  var limit=Date.now()-21*864e5;
  Object.keys(sh).forEach(function(id){
    var x=sh[id]; if(!x||!x.data||shrIsMine(x)) return;
    var t=ntfTs(x.created_at||x.updated_at); if(t<limit) return;
    var copied=recipes.some(function(r){ return r.fromShared&&r.fromShared.id===id; })||orders.some(function(o){ return o.fromShared&&o.fromShared.id===id; });
    if(copied) return;
    if(!(LS.getItem('v4_ntf_new_'+id))&&t>seen-36e5) out.push({k:'new', x:x, ts:t, unread:t>seen});
  });
  out.sort(function(a,b){ return b.ts-a.ts; });
  return out;
}
function ntfCount(){ return ntfList().filter(function(n){ return n.k==='upd'||n.unread; }).length; }
function updBell(){
  var b=document.getElementById('tb-bell'), d=document.getElementById('tb-bell-n'); if(!b||!d) return;
  var n=0; try{ n=ntfCount(); }catch(e){}
  d.textContent=n>9?'9+':String(n||''); d.classList.toggle('on',n>0);
  b.classList.toggle('has',n>0);
}
function ntfItemHTML(n){
  var d=n.x.data, who=esc(n.x.owner_name||'Quelqu’un'), t=shType(n.x), what=t==='bon'?'le bon':(t==='doc'?'le document':'la recette');
  var when=new Date(n.ts).toLocaleString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
  if(n.k==='upd') return '<div class="ntf upd">'+
      '<span class="ntf-ic">'+ic('refresh')+'</span><div class="ntf-b"><div class="ntf-t"><b>'+who+'</b> a modifié '+what+' « '+esc(d.name)+' »</div>'+
      '<div class="ntf-s">Ta copie : « '+esc(n.copy.name)+' » · '+when+'</div>'+
      '<div class="ntf-a">'+(t==='rec'?'<button class="btn btn-ghost btn-xs" onclick="closeNotifs();openShared(\''+escJS(n.x.id)+'\')">'+ic('eye')+' Voir</button>':'')+
      (t==='rec'?'<button class="btn btn-gold btn-xs" onclick="ntfUpdateCopy(\''+escJS(n.x.id)+'\')">'+ic('download')+' Mettre à jour ma copie</button>':'')+
      '<button class="btn btn-ghost btn-xs" onclick="ntfIgnore(\''+escJS(n.x.id)+'\')">Ignorer</button></div></div></div>';
  var open=t==='bon'?'openSharedBon':(t==='doc'?'openSharedDoc':'openShared');
  return '<div class="ntf new'+(n.unread?' unread':'')+'">'+
    '<span class="ntf-ic">'+ic(t==='bon'?'bon':(t==='doc'?'file':'book'))+'</span><div class="ntf-b"><div class="ntf-t"><b>'+who+'</b> a partagé '+what+' « '+esc(d.name)+' »'+(d.folder?' dans « '+esc(d.folder)+' »':'')+'</div>'+
    '<div class="ntf-s">'+when+'</div>'+
    '<div class="ntf-a"><button class="btn btn-ghost btn-xs" onclick="closeNotifs();'+open+'(\''+escJS(n.x.id)+'\')">'+ic('eye')+' Voir</button>'+
    '<button class="btn btn-ghost btn-xs" onclick="ntfHide(\''+escJS(n.x.id)+'\')">Masquer</button></div></div></div>';
}
function renderNotifs(){
  var box=document.getElementById('ntf-body'); if(!box) return;
  var L=ntfList();
  var online=typeof clActive==='function'&&clActive();
  box.innerHTML=L.length?L.map(ntfItemHTML).join('')
    :'<div class="empty" style="padding:26px 8px"><span class="empty-i">'+ic('bell')+'</span><div class="empty-t">Aucune notification</div><div class="empty-s">'+
      (online?'Tu seras prévenu ici quand l’auteur d’une recette que tu as copiée la modifie, ou quand quelqu’un partage quelque chose.'
             :'Connecte ton espace en ligne pour être prévenu des modifications des recettes partagées.')+'</div></div>';
}
function openNotifs(){
  var ov=document.getElementById('m-ntf');
  if(!ov){
    ov=document.createElement('div'); ov.className='ov'; ov.id='m-ntf';
    ov.innerHTML='<div class="modal" style="max-width:520px"><div class="m-grip"></div><div class="m-hdr"><h3>'+ic('bell')+' Notifications</h3><button class="m-x" onclick="closeNotifs()">'+ic('x')+'</button></div>'+
      '<div class="m-body" id="ntf-body"></div></div>';
    ov.addEventListener('click',function(e){ if(e.target===ov) closeNotifs(); });
    document.body.appendChild(ov);
  }
  renderNotifs(); ov.classList.add('show');
}
function closeNotifs(){
  var ov=document.getElementById('m-ntf'); if(ov) ov.classList.remove('show');
  LS.setItem('v4_ntf_seen',String(Date.now())); updBell();
}
function ntfIgnore(id){
  var x=(CLOUD.shared||{})[id]; if(!x) return;
  recipes.concat(orders).forEach(function(r){ if(r.fromShared&&r.fromShared.id===id){ r.fromShared.at=x.updated_at; r.fromShared.sig=ntfSig(x.data); r.updatedAt=now(); } });
  persist(); renderNotifs(); updBell();
}
function ntfHide(id){ LS.setItem('v4_ntf_new_'+id,'1'); renderNotifs(); updBell(); }
// Met à jour la copie avec la nouvelle version de l'auteur (composition,
// procédé, temps, pièces, tags). Le nom de ta copie est conservé.
function ntfUpdateCopy(id){
  var x=(CLOUD.shared||{})[id]; if(!x||!x.data) return;
  var copy=recipes.find(function(r){ return r.fromShared&&r.fromShared.id===id; }); if(!copy) return;
  var nIng=0;
  function ingFor(it){
    var n=normTxt(it.n), g=ingredients.find(function(i){ return normTxt(i.name)===n; });
    if(g) return g.id;
    g={id:uid(),name:it.n,cat:it.cat||'Autre',unit:it.u||'kg',price:it.price||0,buyPrice:it.buyPrice!=null?it.buyPrice:(it.price||0),unitWeight:it.unitWeight||null,
       allergens:(it.allergens||[]).slice(),allergensSet:!!it.allergensSet,priceHistory:[]};
    ingredients.push(g); nIng++; return g.id;
  }
  function items(s){
    return (s.items||[]).map(function(it){
      if(it.t==='i') return {id:uid(),type:'ingredient',refId:ingFor(it),qty:it.qty,unit:it.unit};
      var nm=normTxt(it.sub&&it.sub.name), ex=recipes.find(function(r){ return normTxt(r.name)===nm; });
      if(!ex){ ex={id:uid(),name:it.sub&&it.sub.name||'Sous-recette',cat:it.sub&&it.sub.cat||'',image:'⊛',notes:it.sub&&it.sub.notes||'',items:items(it.sub||{}),createdAt:now(),updatedAt:now()}; recipes.push(ex); }
      return {id:uid(),type:'recipe',refId:ex.id,qty:it.qty,unit:it.unit||'x'};
    });
  }
  var d=x.data;
  copy.items=items(d); copy.notes=d.notes||''; if(d.time) copy.time=d.time; if(d.pcs) copy.pcs=d.pcs;
  if(d.tags&&d.tags.length) copy.tags=d.tags.slice();
  copy.fromShared.at=x.updated_at; copy.fromShared.sig=ntfSig(d); copy.updatedAt=now();
  persist(); updBadges(); renderNotifs(); updBell();
  if(CUR==='recettes') renderRec();
  toast('« '+copy.name+' » mise à jour'+(nIng?' · '+nIng+' ingrédient'+(nIng>1?'s':'')+' ajouté'+(nIng>1?'s':'')+' au catalogue':''),'ok');
}
(function(){
  var _u=updBadges; updBadges=function(){ var r=_u.apply(this,arguments); try{ updBell(); }catch(e){} return r; };
  if(typeof clAfterRemote==='function'){ var _a=clAfterRemote; clAfterRemote=function(){ var r=_a.apply(this,arguments); try{ updBell(); if(document.getElementById('m-ntf')&&document.getElementById('m-ntf').classList.contains('show')) renderNotifs(); }catch(e){} return r; }; }
  setTimeout(updBell,1500);
})();
