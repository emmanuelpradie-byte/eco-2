// ══ VÉRIFIER LES INGRÉDIENTS AVANT DE COPIER UNE RECETTE PARTAGÉE ══
// Avant d’ajouter une recette du partage (une seule, un dossier entier ou une
// recette reçue par message), on montre chaque ingrédient de chaque recette :
// quantité modifiable, et à quel ingrédient de TON catalogue il correspond
// (ou « nouveau » : il sera créé, nom et prix modifiables). On coche chaque
// ligne, ou « Tout valider » si on ne veut pas vérifier.
var SHCHK_OPT=null, CHK=null;
function chkInit(rows,after,title){
  var map={}, occ=[], secs=[], subSeen={};
  rows.forEach(function(x,ri){
    var data=JSON.parse(JSON.stringify(x.data||{}));
    x._chk=data;
    function walk(s,label,isSub){
      var sec={id:'s'+secs.length,title:s.name||'Recette',sub:isSub,rec:label,occ:[],subs:[]}; secs.push(sec);
      (s.items||[]).forEach(function(it){
        if(it.t==='i'){
          var k=normTxt(it.n);
          if(!map[k]){
            var g=ingredients.find(function(i){ return normTxt(i.name)===k; });
            map[k]=g?{id:g.id,auto:1}:{isNew:true,name:it.n,price:it.price||0,u:it.u||'kg',cat:it.cat||''};
          }
          var o={id:'o'+occ.length,it:it,k:k,sec:sec.id,ok:false}; occ.push(o); sec.occ.push(o);
        } else if(it.sub){
          var nm=normTxt(it.sub.name), ex=recipes.find(function(r){ return normTxt(r.name)===nm; });
          sec.subs.push({name:it.sub.name,qty:it.qty,unit:it.unit,ex:!!ex});
          if(!ex&&!subSeen[nm]&&(it.sub.items||[]).length){ subSeen[nm]=1; walk(it.sub,label,true); }
        }
      });
    }
    walk(data,x.data&&x.data.name,false);
  });
  CHK={rows:rows,map:map,occ:occ,secs:secs,after:after,title:title,pick:null,pq:''};
}
function chkNOk(){ return CHK.occ.filter(function(o){ return o.ok; }).length; }
function chkOpen(rows,after,title){
  chkInit(rows,after,title);
  if(!CHK.occ.length){ chkGo(); return; }
  chkModal(); chkRender(); openMod('m-shchk');
}
function chkModal(){
  if(document.getElementById('m-shchk')) return;
  var d=document.createElement('div');
  d.innerHTML='<div class="ov" id="m-shchk"><div class="modal wide ck-modal"><div class="m-grip"></div><div class="m-hdr"><h3 id="ck-title">Vérifier les ingrédients</h3><button class="m-x" onclick="closeMod(\'m-shchk\')" aria-label="Fermer">'+ic('x')+'</button></div>'+
    '<div class="m-body" id="ck-body"></div><div class="m-foot" id="ck-foot"></div></div></div>';
  document.body.appendChild(d.firstChild);
}
function chkMapLabel(m){
  if(m.rec){ var r=recipes.find(function(x){ return x.id===m.rec; }); return {cls:'ok',t:ic('sub')+' '+esc(r?r.name:'?'),s:'Sous-recette de tes recettes'}; }
  if(m.id){ var g=ingredients.find(function(i){ return i.id===m.id; }); return {cls:'ok',t:ic('check')+' '+esc(g?g.name:'?'),s:'Dans ton catalogue'+(g&&g.price?' · '+fEur(g.price)+'/'+esc(g.unit||'kg'):'')}; }
  return {cls:'new',t:ic('plus')+' '+esc(m.name),s:'Nouveau · '+(m.price?fEur(m.price)+'/'+esc(m.u||'kg'):'sans prix')};
}
function chkRowHTML(o){
  var it=o.it, m=CHK.map[o.k], L=chkMapLabel(m);
  return '<div class="ck-r'+(o.ok?' ok':'')+'" id="ck-'+o.id+'">'+
    '<label class="ck-c" title="Vérifié"><input type="checkbox"'+(o.ok?' checked':'')+' onchange="chkTick(\''+o.id+'\',this.checked)" aria-label="Vérifié : '+esc(it.n)+'"><span>'+ic('check')+'</span></label>'+
    '<div class="ck-n"><b>'+esc(it.n)+'</b><small>'+esc(it.cat||'')+'</small></div>'+
    '<div class="ck-qw"><input class="ck-q" type="number" inputmode="decimal" min="0" step="any" value="'+(Number(it.qty)>0?it.qty:'')+'" placeholder="Q.S." aria-label="Quantité de '+esc(it.n)+'" onchange="chkQty(\''+o.id+'\',this.value)"><span class="ck-u">'+esc(it.unit||'')+'</span></div>'+
    '<button type="button" class="ck-m '+L.cls+'" data-k="'+esc(o.k)+'" onclick="chkPick(\''+o.id+'\')"><span>'+L.t+'</span><small>'+L.s+'</small></button>'+
  '</div>';
}
function chkSecHTML(sec,open){
  var n=sec.occ.length, ok=sec.occ.filter(function(o){ return o.ok; }).length;
  return '<details class="ck-sec'+(ok===n?' done':'')+'" id="ck-'+sec.id+'"'+(open?' open':'')+' ontoggle="chkSecOpen(\''+sec.id+'\',this.open)">'+
    '<summary><span class="ck-st">'+(sec.sub?ic('sub'):ic('book'))+'</span><span class="ck-sn"><b>'+esc(sec.title)+'</b><small>'+(sec.sub?'Sous-recette de « '+esc(sec.rec)+' » · ':'')+n+' ingrédient'+(n>1?'s':'')+'</small></span><span class="ck-cnt" id="ck-c-'+sec.id+'">'+ok+'/'+n+'</span>'+ic('chev-down')+'</summary>'+
    '<div class="ck-in" id="ck-in-'+sec.id+'">'+(open?chkSecInner(sec):'')+'</div></details>';
}
function chkSecInner(sec){
  return sec.occ.map(chkRowHTML).join('')+
    (sec.subs.length?'<div class="ck-subs">'+sec.subs.map(function(s){ return '<div>'+ic('sub')+' <b>'+esc(s.name)+'</b> — '+(s.ex?'tu l’as déjà : la tienne sera utilisée':'sera ajoutée à tes recettes (voir plus bas)')+'</div>'; }).join('')+'</div>':'')+
    '<button type="button" class="btn btn-ghost btn-sm ck-secall" onclick="chkSecAll(\''+sec.id+'\')">'+ic('check')+' Valider cette recette</button>';
}
function chkSecOpen(id,open){ var el=document.getElementById('ck-in-'+id); if(open&&el&&!el.innerHTML){ el.innerHTML=chkSecInner(CHK.secs.find(function(s){ return s.id===id; })); } }
function chkRender(){
  var b=document.getElementById('ck-body'); if(!b) return;
  var keys=Object.keys(CHK.map), nNew=keys.filter(function(k){ return CHK.map[k].isNew; }).length;
  var nr=CHK.rows.length;
  document.getElementById('ck-title').textContent=nr>1?'Vérifier les ingrédients · '+nr+' recettes':'Vérifier les ingrédients';
  b.innerHTML='<div class="ck-head"><div class="ck-intro">'+(CHK.title?'<b>'+esc(CHK.title)+'</b><br>':'')+'Vérifie chaque ingrédient avant l’ajout : tu peux changer la quantité et choisir l’ingrédient de ton catalogue qui correspond. Si tu ne veux pas vérifier, touche « Tout valider ».</div>'+
    '<div class="ck-stats"><span><b>'+keys.length+'</b> ingrédients différents</span><span class="ok"><b>'+(keys.length-nNew)+'</b> déjà dans ton catalogue</span><span class="new"><b>'+nNew+'</b> nouveaux</span></div>'+
    '<button type="button" class="btn btn-gold ck-all" onclick="chkAll()">'+ic('check-circle')+' Tout valider</button></div>'+
    CHK.secs.map(function(s,i){ return chkSecHTML(s,i===0&&CHK.secs.length<=12||CHK.secs.length<=3); }).join('');
  chkFoot();
}
function chkFoot(){
  var f=document.getElementById('ck-foot'); if(!f) return;
  var n=CHK.occ.length, ok=chkNOk(), left=n-ok;
  f.innerHTML='<button class="btn btn-ghost" onclick="closeMod(\'m-shchk\')">Annuler</button>'+
    (left?'<button class="btn btn-ghost" onclick="chkAll()">'+ic('check')+' Tout valider</button>':'')+
    '<button class="btn btn-gold" id="ck-go" onclick="chkGo()"'+(left?' disabled':'')+'>'+(left?'Encore '+left+' à vérifier':ic('check')+' Ajouter à mes recettes')+'</button>';
}
function chkUpdSec(secId){
  var sec=CHK.secs.find(function(s){ return s.id===secId; }); if(!sec) return;
  var n=sec.occ.length, ok=sec.occ.filter(function(o){ return o.ok; }).length;
  var c=document.getElementById('ck-c-'+secId); if(c) c.textContent=ok+'/'+n;
  var d=document.getElementById('ck-'+secId); if(d) d.classList.toggle('done',ok===n);
}
function chkTick(id,on){
  var o=CHK.occ.find(function(x){ return x.id===id; }); if(!o) return; o.ok=!!on;
  var r=document.getElementById('ck-'+id); if(r) r.classList.toggle('ok',o.ok);
  chkUpdSec(o.sec); chkFoot();
}
function chkSecAll(secId){
  CHK.occ.forEach(function(o){ if(o.sec===secId){ o.ok=true; var r=document.getElementById('ck-'+o.id); if(r){ r.classList.add('ok'); var c=r.querySelector('input[type=checkbox]'); if(c) c.checked=true; } } });
  chkUpdSec(secId); chkFoot();
  var d=document.getElementById('ck-'+secId); if(d) d.open=false;
}
function chkAll(){ CHK.occ.forEach(function(o){ o.ok=true; }); CHK.secs.forEach(function(s){ var el=document.getElementById('ck-in-'+s.id); if(el&&el.innerHTML) el.innerHTML=chkSecInner(s); chkUpdSec(s.id); }); chkFoot(); }
function chkQty(id,v){ var o=CHK.occ.find(function(x){ return x.id===id; }); if(!o) return; var n=parseFloat(String(v).replace(',','.')); o.it.qty=n>0?n:0; if(!o.ok) chkTick(id,true); }

// ── changer l’ingrédient : même fenêtre « Changer » que dans l’éditeur de recette ──
// (s’applique partout où l’ingrédient apparaît dans les recettes copiées)
function chkPick(oid){
  var o=CHK.occ.find(function(x){ return x.id===oid; }); if(!o) return;
  var m=CHK.map[o.k], cur=m.id?{type:'ingredient',id:m.id}:(m.rec?{type:'recipe',id:m.rec}:{type:'new'});
  swapOpen({cur:cur,name:o.it.n,allowNew:true,onPick:function(val){ chkSwapPick(o.k,val); }});
  var sw=document.getElementById('m-swap'); if(sw) document.body.appendChild(sw); // devant la fenêtre de vérification
}
function chkSwapPick(k,val){
  var occ=CHK.occ.filter(function(x){ return x.k===k; }), it=occ[0]&&occ[0].it; if(!it) return;
  var v=String(val||''), name='';
  if(/^ing:/.test(v)){ var g=ingredients.find(function(x){ return x.id===v.slice(4); }); if(!g) return; CHK.map[k]={id:g.id}; name=g.name; }
  else if(/^rec:/.test(v)){ var r=recipes.find(function(x){ return x.id===v.slice(4); }); if(!r) return; CHK.map[k]={rec:r.id}; name=r.name; }
  else { var nm=/^new:/.test(v)?decodeURIComponent(v.slice(4)):it.n; CHK.map[k]={isNew:true,name:nm||it.n,price:it.price||0,u:it.u||'kg',cat:it.cat||''}; name=nm||it.n; }
  chkApply(k);
  occ.forEach(function(x){ if(!x.ok) chkTick(x.id,true); });
  toast('« '+it.n+' » → « '+name+' »','ok');
}
function chkApply(k){
  CHK.occ.forEach(function(o){ if(o.k!==k) return; var r=document.getElementById('ck-'+o.id); if(r) r.outerHTML=chkRowHTML(o); });
}

// ── lancer la copie avec les choix ──
function chkGo(){
  var c=CHK; if(!c) return;
  SHCHK_OPT={}; c.rows.forEach(function(x){ SHCHK_OPT[x.id]={data:x._chk,map:c.map}; });
  closeMod('m-shchk');
  c.after(); // les choix restent liés à ces recettes jusqu’à la prochaine vérification (copie asynchrone)
}

// ── branchement : copie d’une recette, d’un dossier, recette reçue par message ──
(function(){
  var _one=shrCopy, BYPASS=false;
  shrCopy=function(){
    var x=SHR_CUR; if(BYPASS||!x||!x.data) return _one.apply(this,arguments);
    try{ closeMod('m-shr'); }catch(e){}
    chkOpen([x],function(){ BYPASS=true; try{ return _one(); } finally{ BYPASS=false; } },x.data.name);
  };
  if(typeof partCopyFolder==='function'){
    var _f=partCopyFolder;
    partCopyFolder=function(key){
      if(BYPASS) return _f.apply(this,arguments);
      var rows=sharedList().filter(function(x){ return !shrIsMine(x)&&partFolderKey(x)===key&&shType(x)==='rec'&&!recipes.some(function(r){ return r.fromShared&&r.fromShared.id===x.id; }); });
      if(!rows.length) return _f.apply(this,arguments);
      chkOpen(rows,function(){ BYPASS=true; try{ return _f(key); } finally{ BYPASS=false; } },'Dossier « '+((rows[0].data&&rows[0].data.folder)||'')+' »');
    };
  }
})();
