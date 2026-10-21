
// ══ DOCUMENTS JOINTS AUX RECETTES (PDF, images) ═══════════════
// Le fichier est gardé sur l'appareil (clé v4_att:<id>) ; la recette ne garde
// que la fiche du document {id,name,mime,size}. Avec un compte en ligne, il
// est aussi envoyé au serveur pour être retrouvé sur les autres appareils.
var REC_ED={att:[],shared:false,fromShared:null};
var ATT_MAX=15*1024*1024;
function attKey(id){ return 'v4_att:'+id; }
function attPut(id,data){ LS.setItem(attKey(id),data); }
function attLocal(id){ return LS.getItem(attKey(id)); }
function attIsPdf(m){ return /pdf/i.test((m&&m.mime)||m||''); }
function attSize(n){ n=Number(n)||0; return n>=1048576?fNum(n/1048576,1)+' Mo':fNum(Math.max(1,Math.round(n/1024)),0)+' Ko'; }
function attGet(id){
  var d=attLocal(id); if(d) return Promise.resolve(d);
  if(typeof clActive==='function'&&clActive()) return clFetchAtt(id).then(function(row){ if(!row||!row.data) throw new Error('Document introuvable'); attPut(id,row.data); return row.data; });
  return Promise.reject(new Error('Document absent de cet appareil'));
}
function attReadFile(f){
  return new Promise(function(res,rej){ var r=new FileReader(); r.onload=function(){ res(r.result); }; r.onerror=function(){ rej(new Error('Lecture impossible')); }; r.readAsDataURL(f); });
}
function attShrinkImage(dataUrl,maxDim,q){
  return new Promise(function(res){
    var im=new Image();
    im.onload=function(){
      var w=im.naturalWidth,h=im.naturalHeight,s=Math.min(1,maxDim/Math.max(w,h));
      if(s>=1&&dataUrl.length<1600000){ res(dataUrl); return; }
      var c=document.createElement('canvas'); c.width=Math.round(w*s); c.height=Math.round(h*s);
      var g=c.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,c.width,c.height); g.drawImage(im,0,0,c.width,c.height);
      try{ var out=c.toDataURL('image/jpeg',q); res(out.length<dataUrl.length?out:dataUrl); }catch(e){ res(dataUrl); }
    };
    im.onerror=function(){ res(dataUrl); };
    im.src=dataUrl;
  });
}
function attAddFiles(input){
  var files=Array.prototype.slice.call(input.files||[]); input.value='';
  if(!files.length) return;
  var chain=Promise.resolve(), added=0;
  files.forEach(function(f){
    chain=chain.then(function(){
      var isImg=/^image\//.test(f.type), isPdf=f.type==='application/pdf'||/\.pdf$/i.test(f.name);
      if(!isImg&&!isPdf){ toast(f.name+' : seuls les PDF et les images sont acceptés','err'); return; }
      if(isPdf&&f.size>ATT_MAX){ toast(f.name+' : trop gros (15 Mo maximum)','err'); return; }
      return attReadFile(f).then(function(d){ return isImg?attShrinkImage(d,2200,0.86):d; }).then(function(d){
        var id='a'+uid()+uid(), mime=isPdf?'application/pdf':(d.slice(5,d.indexOf(';'))||f.type);
        var size=Math.round((d.length-d.indexOf(',')-1)*3/4);
        if(size>ATT_MAX){ toast(f.name+' : trop gros (15 Mo maximum)','err'); return; }
        attPut(id,d); REC_ED.att.push({id:id,name:f.name||('document.'+(isPdf?'pdf':'jpg')),mime:mime,size:size,added:Date.now()}); added++;
      });
    }).catch(function(e){ toast(f.name+' : '+e.message,'err'); });
  });
  chain.then(function(){ renderAttList(); if(added) toast(added+' document'+(added>1?'s':'')+' ajouté'+(added>1?'s':'')+' — pense à enregistrer la recette','ok'); });
}
function renderAttList(){
  var box=document.getElementById('r-att'); if(!box) return;
  if(!REC_ED.att.length){ box.innerHTML='<div class="att-empty">Joins la fiche d’origine, une photo du produit fini, un schéma de façonnage… (PDF ou image, 15 Mo max.)</div>'; return; }
  box.innerHTML='<div class="att-list">'+REC_ED.att.map(function(a,i){ return attRowHTML(a,'attOpenEd('+i+')','<button class="idel" onclick="attRemove('+i+')" title="Retirer">'+ic('x')+'</button>'); }).join('')+'</div>';
}
function attRowHTML(a,open,extra){
  var d=attLocal(a.id), th=!attIsPdf(a)&&d?'<img src="'+d+'" alt="">':ic(attIsPdf(a)?'pdf':'image');
  return '<div class="att-r"><span class="att-th'+(attIsPdf(a)?' pdf':'')+'" onclick="'+open+'">'+th+'</span><div class="att-n" onclick="'+open+'"><b>'+esc(a.name)+'</b><small>'+(attIsPdf(a)?'PDF':'Image')+' · '+attSize(a.size)+(d?'':' · en ligne')+'</small></div>'+(extra||'')+'</div>';
}
function attRemove(i){
  var a=REC_ED.att[i]; if(!a) return; REC_ED.att.splice(i,1); renderAttList();
  toastUndo('« '+a.name+' » retiré',function(){ REC_ED.att.splice(Math.min(i,REC_ED.att.length),0,a); renderAttList(); });
}
function attOpenEd(i){ var a=REC_ED.att[i]; if(a) attOpen(a); }
var ATT_URLS=[];
function attOpen(a){
  var t=document.getElementById('att-title'), b=document.getElementById('att-body'), f=document.getElementById('att-foot');
  t.textContent=a.name; b.innerHTML='<div class="att-load">'+ic('refresh')+' Chargement…</div>'; f.innerHTML='<button class="btn btn-ghost" onclick="attClose()">Fermer</button>';
  document.getElementById('m-att').classList.add('show');
  attGet(a.id).then(function(d){ return fetch(d).then(function(r){ return r.blob(); }).then(function(bl){ return {d:d,bl:bl}; }); }).then(function(o){
    var url=URL.createObjectURL(o.bl); ATT_URLS.push(url);
    if(attIsPdf(a)) b.innerHTML=(isWide()?'<iframe class="att-pdf" src="'+url+'" title="'+esc(a.name)+'"></iframe>':'<div class="att-pdf-m">'+ic('pdf')+'<b>'+esc(a.name)+'</b><small>'+attSize(a.size)+'</small></div>');
    else b.innerHTML='<img class="att-img" src="'+url+'" alt="">';
    f.innerHTML='<a class="btn btn-ghost" href="'+url+'" download="'+esc(a.name)+'">'+ic('download')+' Télécharger</a><a class="btn btn-gold" href="'+url+'" target="_blank" rel="noopener">'+ic('eye')+' Ouvrir</a>';
  }).catch(function(e){ b.innerHTML='<div class="att-load err">'+ic('alert')+' '+esc(e.message)+'</div>'; });
}
function attClose(){ document.getElementById('m-att').classList.remove('show'); setTimeout(function(){ ATT_URLS.forEach(function(u){ try{ URL.revokeObjectURL(u); }catch(e){} }); ATT_URLS=[]; document.getElementById('att-body').innerHTML=''; },300); }
function attReferenced(){ var s={}; recipes.forEach(function(r){ (r.attachments||[]).forEach(function(a){ s[a.id]=1; }); }); if(typeof shDocs==='function') shDocs().forEach(function(d){ if(d.att) s[d.att.id]=1; }); return s; }
function attGc(){
  // documents qui ne sont plus joints à aucune recette (au démarrage : le délai « Annuler » est passé)
  var ref=attReferenced();
  LS.keys().forEach(function(k){
    if(k.indexOf('v4_att:')!==0) return; var id=k.slice(7);
    if(!ref[id]){ LS.removeItem(k); if(typeof clQueueAttDel==='function') clQueueAttDel(id); }
  });
}
function collectAttachments(){ var out={}, ref=attReferenced(); Object.keys(ref).forEach(function(id){ var d=attLocal(id); if(d) out[id]=d; }); return out; }

// ── Éditeur de recette : documents + partage ──
function openNewRec(){ openNewRecBase(); REC_ED={att:[],shared:false,fromShared:null}; recEdExtras(); }
function openEditRec(id){
  openEditRecBase(id); var r=recipes.find(function(x){ return x.id===id; }); if(!r) return;
  REC_ED={att:(r.attachments||[]).map(function(a){ return Object.assign({},a); }),shared:!!r.shared,fromShared:r.fromShared||null}; recEdExtras();
}
function recEdExtras(){
  renderAttList();
  var c=document.getElementById('r-share-card'), cb=document.getElementById('r-shared');
  if(c) c.style.display=(typeof clActive==='function'&&clActive())?'':'none';
  if(cb) cb.checked=!!REC_ED.shared;
}
function saveRecipe(){
  var before={}, prevAtt=[];
  recipes.forEach(function(r){ before[r.id]=r.updatedAt; });
  if(editRecId){ var old=recipes.find(function(r){ return r.id===editRecId; }); if(old) prevAtt=(old.attachments||[]).map(function(a){ return a.id; }); }
  var wasId=editRecId;
  saveRecipeBase();
  var rec=wasId?recipes.find(function(r){ return r.id===wasId; }):recipes.find(function(r){ return !(r.id in before); });
  if(!rec||(wasId&&before[wasId]===rec.updatedAt&&CUR==='rec-edit')) return;   // pas enregistré (champ manquant)
  rec.attachments=REC_ED.att.slice(); rec.shared=!!REC_ED.shared;
  if(REC_ED.fromShared) rec.fromShared=REC_ED.fromShared;
  if(typeof recEdApply==='function') recEdApply(rec);
  if(!rec.attachments.length) delete rec.attachments;
  if(!rec.shared) delete rec.shared;
  persist();
  if(typeof clQueueAttUp==='function') (rec.attachments||[]).forEach(function(a){ clQueueAttUp(a.id); });
  if(rec.shared&&typeof clActive==='function'&&clActive()) toast('Recette enregistrée et partagée','ok');
  // documents retirés : supprimés s'ils ne servent plus à aucune recette
  var ref=attReferenced();
  prevAtt.forEach(function(id){ if(!ref[id]){ LS.removeItem(attKey(id)); if(typeof clQueueAttDel==='function') clQueueAttDel(id); } });
}

// ══ RECETTES PARTAGÉES ════════════════════════════════════════
function shareSnapshot(r,depth,seen){
  depth=depth||0; seen=seen||{}; seen[r.id]=1;
  var items=(r.items||[]).map(function(it){
    if(it.type==='ingredient'){
      var g=ingredients.find(function(x){ return x.id===it.refId; })||{};
      return {t:'i',qty:it.qty,unit:it.unit,n:g.name||'?',cat:g.cat||'',u:g.unit||'kg',price:g.price||0,buyPrice:g.buyPrice!=null?g.buyPrice:null,unitWeight:g.unitWeight||null,
        allergens:g.allergens||[],allergensSet:!!g.allergensSet};
    }
    var s=recipes.find(function(x){ return x.id===it.refId; });
    if(!s||seen[s.id]||depth>=4) return {t:'r',qty:it.qty,unit:it.unit||'x',sub:{name:s?s.name:'?',items:[]}};
    return {t:'r',qty:it.qty,unit:it.unit||'x',sub:shareSnapshot(s,depth+1,Object.assign({},seen))};
  });
  var flat=flatten(r.id), a=allergensOfFlat(flat);
  var o={name:r.name,cat:r.cat||'',image:r.image||'',notes:r.notes||'',items:items,weight:recWeight(r.id),cost:recCost(r.id),allergens:a.keys||[]};
  if(depth===0) o.folder=(r.shared&&r.shareFolder)||'';
  if(r.tags&&r.tags.length) o.tags=r.tags.slice(); if(r.time) o.time=r.time; if(r.pcs) o.pcs=r.pcs;
  if(depth===0) o.attachments=(r.attachments||[]).map(function(x){ return {id:x.id,name:x.name,mime:x.mime,size:x.size}; });
  return o;
}
var REC_TAB='mine', SHR_Q='', SHR_MINE=false;
function setRecTab(t){
  REC_TAB=t;
  document.getElementById('rt-mine').classList.toggle('on',t==='mine'); document.getElementById('rt-shared').classList.toggle('on',t==='shared');
  document.getElementById('rec-mine').style.display=t==='mine'?'':'none';
  document.getElementById('shared-wrap').style.display=t==='shared'?'':'none';
  if(t==='shared'){ renderShared(); if(typeof clActive==='function'&&clActive()) clSync(); } else renderRec();
}
function sharedList(){
  var m=(typeof CLOUD!=='undefined'&&CLOUD.shared)||{};
  return Object.keys(m).map(function(k){ return m[k]; }).filter(function(x){ return x&&!x.deleted&&x.data; })
    .sort(function(a,b){ return a.updated_at<b.updated_at?1:-1; });
}
function shrIsMine(row){ return typeof CLOUD!=='undefined'&&CLOUD.sess&&row.owner===CLOUD.sess.user.id; }
function updSharedCount(){ var n=document.getElementById('rt-shared-n'); if(n){ var c=sharedList().length; n.textContent=c?' '+c:''; } }
function renderShared(){
  updSharedCount();
  var w=document.getElementById('shared-wrap'); if(!w) return;
  if(typeof clActive!=='function'||!clActive()){
    w.innerHTML='<div class="empty shr-empty"><span class="empty-i">'+ic('users')+'</span><div class="empty-t">Recettes partagées</div><div class="empty-s">Connecte-toi à ton espace en ligne pour voir les recettes partagées par les autres et partager les tiennes. Chacun garde son espace perso.</div><button class="btn btn-gold btn-sm" style="margin-top:12px" onclick="goPage(\'backup\');setTimeout(function(){var c=document.getElementById(\'cl-card\');if(c)c.scrollIntoView({block:\'start\'});},60)">'+ic('user')+' Se connecter</button></div>';
    return;
  }
  var q=normTxt(SHR_Q), all=sharedList();
  var list=all.filter(function(x){ if(SHR_MINE&&!shrIsMine(x)) return false; if(!q) return true; return normTxt(x.data.name).indexOf(q)>=0||normTxt(x.owner_name).indexOf(q)>=0||normTxt(x.data.cat).indexOf(q)>=0; });
  var mine=all.filter(shrIsMine).length;
  var head='<div class="srch">'+ic('search')+'<input class="sinp" id="shr-srch" placeholder="Rechercher une recette ou une personne…" value="'+esc(SHR_Q)+'" oninput="SHR_Q=this.value;renderSharedGrid()"></div>'+
    '<div class="chips"><div class="chip'+(!SHR_MINE?' on':'')+'" onclick="SHR_MINE=false;renderShared()">Toutes · '+all.length+'</div><div class="chip'+(SHR_MINE?' on':'')+'" onclick="SHR_MINE=true;renderShared()">Les miennes · '+mine+'</div></div>'+
    '<div class="shr-info">'+ic('info')+'<span>Pour partager une de tes recettes, ouvre-la et coche « Partager cette recette ». Seul l’auteur d’une recette partagée peut la modifier ; les autres peuvent la copier dans leur espace.</span></div>';
  w.innerHTML=head+'<div class="rgrid tiles" id="shr-grid"></div>';
  renderSharedGrid();
}
function renderSharedGrid(){
  var g=document.getElementById('shr-grid'); if(!g) return;
  var q=normTxt(SHR_Q);
  var list=sharedList().filter(function(x){ if(SHR_MINE&&!shrIsMine(x)) return false; if(!q) return true; return normTxt(x.data.name).indexOf(q)>=0||normTxt(x.owner_name).indexOf(q)>=0||normTxt(x.data.cat).indexOf(q)>=0; });
  if(!list.length){ g.innerHTML='<div class="empty" style="grid-column:1/-1"><div class="empty-s">'+(sharedList().length?'Aucune recette trouvée':'Aucune recette partagée pour l’instant. Sois le premier !')+'</div></div>'; return; }
  g.innerHTML=list.map(function(x){
    var d=x.data, ph=(d.image&&d.image.length>4)?'<img src="'+esc(d.image)+'" alt="" loading="lazy">':'<span class="rt-em">'+(d.image||ic('book'))+'</span>';
    var natt=(d.attachments||[]).length;
    return '<div class="rt" onclick="openShared(\''+escJS(x.id)+'\')"><div class="rt-ph'+((d.image&&d.image.length>4)?' img':'')+'" style="--ch:'+catHue(d.cat||'')+'">'+ph+
      (shrIsMine(x)?'<span class="rt-badge me">Toi</span>':'')+'</div>'+
      '<div class="rt-b"><div class="rt-n">'+esc(d.name)+'</div><div class="rt-m">'+fKg(d.weight||0)+' · '+fEur(d.cost||0)+(natt?' · '+ic('clip')+natt:'')+'</div><div class="rt-c">'+ic('user')+' '+esc(x.owner_name||'—')+'</div></div></div>';
  }).join('');
}
function shrQty(it){
  if(it.t==='r') return fNum(it.qty,2)+' ×';
  var u=String(it.unit||'kg'); if(isCountable(u)) return fNum(it.qty,2)+' '+u;
  var t=fNum(it.qty,3); if(t.indexOf(',')>=0) t=t.replace(/0+$/,'').replace(/,$/,'');
  return t+' '+u;
}
function shrItemsHTML(items,lvl){
  return (items||[]).map(function(it){
    if(it.t==='r') return '<div class="shr-i sub" style="--lv:'+lvl+'"><span>'+ic('sub')+' '+esc(it.sub&&it.sub.name||'?')+'</span><b>'+shrQty(it)+'</b></div>'+(it.sub&&it.sub.items&&lvl<4?shrItemsHTML(it.sub.items,lvl+1):'');
    return '<div class="shr-i" style="--lv:'+lvl+'"><span>'+catDot(it.cat||'')+esc(it.n)+'</span><b>'+shrQty(it)+'</b></div>';
  }).join('');
}
var SHR_CUR=null;
function openShared(id){
  var x=(CLOUD.shared||{})[id]; if(!x||!x.data) return; SHR_CUR=x; var d=x.data, mine=shrIsMine(x);
  document.getElementById('shr-title').textContent=d.name;
  var copy=recipes.find(function(r){ return r.fromShared&&r.fromShared.id===x.id; });
  var ph=(d.image&&d.image.length>4)?'<img class="shr-ph" src="'+esc(d.image)+'" alt="">':'';
  var algs=(d.allergens||[]).length?'<div class="shr-alg">'+algChips(d.allergens,'sm')+'</div>':'';
  var docs=(d.attachments||[]).length?'<div class="shr-h">'+ic('clip')+' Documents</div><div class="att-list">'+d.attachments.map(function(a,i){ return attRowHTML(a,'shrOpenAtt('+i+')',''); }).join('')+'</div>':'';
  document.getElementById('shr-body').innerHTML=ph+
    '<div class="shr-by">'+ic('user')+' Partagée par <b>'+esc(x.owner_name||'—')+(mine?' (toi)':'')+'</b> · mise à jour le '+new Date(x.updated_at).toLocaleDateString('fr-FR')+'</div>'+
    '<div class="rc-stats" style="margin:10px 0"><div class="rs"><span class="rs-v">'+fKg(d.weight||0)+'</span><div class="rs-l">Poids</div></div><div class="rs"><span class="rs-v">'+fEur(d.cost||0)+'</span><div class="rs-l">Coût (prix de l’auteur)</div></div><div class="rs"><span class="rs-v">'+(d.items||[]).length+'</span><div class="rs-l">Compos.</div></div></div>'+
    algs+'<div class="shr-h">Composition</div><div class="shr-items">'+shrItemsHTML(d.items,0)+'</div>'+
    (d.notes?'<div class="shr-h">Procédé</div><div class="shr-notes">'+esc(d.notes)+'</div>':'')+docs+
    (copy&&!mine?'<div class="shr-info" style="margin-top:12px">'+ic('check-circle')+'<span>Tu as déjà une copie de cette recette dans ton espace : « '+esc(copy.name)+' ».</span></div>':'');
  var loc=mine&&recipes.find(function(r){ return CLOUD.sess&&(CLOUD.sess.user.id.slice(0,8)+'_'+r.id)===x.id; });
  document.getElementById('shr-foot').innerHTML=mine
    ?'<button class="btn btn-ghost" onclick="shrUnshare()">Ne plus partager</button>'+(loc?'<button class="btn btn-gold" onclick="closeMod(\'m-shr\');openEditRec(\''+loc.id+'\')">'+ic('edit')+' Modifier ma recette</button>':'')
    :'<button class="btn btn-ghost" onclick="closeMod(\'m-shr\')">Fermer</button><button class="btn btn-gold" id="shr-copy" onclick="shrCopy()">'+ic('copy')+' '+(copy?'Copier à nouveau':'Copier dans mes recettes')+'</button>';
  openMod('m-shr');
}
function shrOpenAtt(i){ var a=SHR_CUR&&SHR_CUR.data.attachments[i]; if(a) attOpen(a); }
function shrUnshare(){
  var x=SHR_CUR; if(!x) return;
  var r=recipes.find(function(r){ return (CLOUD.sess.user.id.slice(0,8)+'_'+r.id)===x.id; });
  if(r){ delete r.shared; persist(); }
  else { CLOUD.st.pub[x.id]='force-delete'; clSaveState(); }
  closeMod('m-shr'); toast('Recette retirée du partage','ok'); clSync().then(function(){ if(CUR==='partage') renderPartage(); });
}
function shrCopy(){
  var x=SHR_CUR; if(!x) return; var btn=document.getElementById('shr-copy'); if(btn) btn.disabled=true;
  var created={ing:0,sub:0};
  function ingFor(it){
    var n=normTxt(it.n), g=ingredients.find(function(i){ return normTxt(i.name)===n; });
    if(g) return g.id;
    g={id:uid(),name:it.n,cat:it.cat||'Autre',unit:it.u||'kg',price:it.price||0,buyPrice:it.buyPrice!=null?it.buyPrice:(it.price||0),unitWeight:it.unitWeight||null,
       allergens:(it.allergens||[]).slice(),allergensSet:!!it.allergensSet,priceHistory:[]};
    ingredients.push(g); created.ing++; return g.id;
  }
  function recFrom(s,top){
    var items=(s.items||[]).map(function(it){
      if(it.t==='i') return {id:uid(),type:'ingredient',refId:ingFor(it),qty:it.qty,unit:it.unit};
      var nm=normTxt(it.sub&&it.sub.name), ex=recipes.find(function(r){ return normTxt(r.name)===nm; });
      var sid=ex?ex.id:recFrom(it.sub,false).id;
      return {id:uid(),type:'recipe',refId:sid,qty:it.qty,unit:it.unit||'x'};
    });
    var r={id:uid(),name:s.name,cat:s.cat||'',image:s.image||'📖',notes:s.notes||'',items:items,createdAt:now(),updatedAt:now()};
    if(s.tags&&s.tags.length) r.tags=s.tags.slice(); if(s.time) r.time=s.time; if(s.pcs) r.pcs=s.pcs;
    if(top) r.fromShared={id:x.id,by:x.owner_name||''}; else created.sub++;
    recipes.unshift(r); return r;
  }
  var atts=(x.data.attachments||[]);
  Promise.all(atts.map(function(a){
    return attGet(a.id).then(function(d){ var id='a'+uid()+uid(); attPut(id,d); return {id:id,name:a.name,mime:a.mime,size:a.size}; },function(){ return null; });
  })).then(function(newAtt){
    var r=recFrom(x.data,true); newAtt=newAtt.filter(Boolean); if(newAtt.length) r.attachments=newAtt;
    persist(); updBadges();
    if(typeof clQueueAttUp==='function') newAtt.forEach(function(a){ clQueueAttUp(a.id); });
    closeMod('m-shr');
    toast('« '+r.name+' » copiée dans tes recettes'+(created.ing?' · '+created.ing+' ingrédient'+(created.ing>1?'s':'')+' ajouté'+(created.ing>1?'s':'')+' au catalogue':''),'ok');
    if(REC_TAB==='shared') renderShared();
  });
}
