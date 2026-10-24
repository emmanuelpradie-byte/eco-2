// ══ BARRE DE FILTRES RÉUTILISABLE ═════════════════════════════
// Même apparence que le carnet de recettes (pastilles + menus déroulants),
// utilisée par le catalogue, les recettes partagées et la page Partage.
// cfg = {box, active, q, render, defs()} ; def = {k,title,multi,opts:[{v,l,n,sub,html}],hint,search,all,keep,label}
var FB={}, FB_CFG={};
function fbReg(ctx,cfg){ FB_CFG[ctx]=cfg; fbS(ctx); }
function fbS(ctx){ return FB[ctx]||(FB[ctx]={open:'',iq:'',v:{}}); }
function fbV(ctx,k,def){ var v=fbS(ctx).v[k]; return v==null?(def!=null?def:''):v; }
function fbA(ctx,k){ var v=fbS(ctx).v[k]; return Array.isArray(v)?v:[]; }
function fbQ(ctx){ var c=FB_CFG[ctx], i=c&&c.q&&document.getElementById(c.q); return i?normTxt(i.value||'').trim():''; }
function fbDefs(ctx){ var c=FB_CFG[ctx]; return c?c.defs():[]; }
function fbCount(ctx){
  var n=0; fbDefs(ctx).forEach(function(d){ if(d.keep) return; var v=fbS(ctx).v[d.k]; if(Array.isArray(v)?v.length:v) n++; });
  return n+(fbQ(ctx)?1:0);
}
function fbOptHTML(ctx,d,o){
  var cur=fbS(ctx).v[d.k], on=d.multi?(Array.isArray(cur)&&cur.indexOf(o.v)>=0):((cur||'')===o.v);
  var click=o.click||('fbPick(\''+ctx+'\',\''+d.k+'\',\''+escJS(o.v)+'\')');
  var b=rfOpt(on,o.html||esc(o.l),click,d.multi,o.n);
  if(d.search) b='<div class="cn-oi" data-n="'+esc(normTxt(o.l))+'">'+b+'</div>';
  return o.sub?'<div class="cn-sub">'+b+'</div>':b;
}
function fbLabel(ctx,d){
  if(d.label) return d.label;
  var v=fbS(ctx).v[d.k];
  var find=function(x){ var o=d.opts.filter(function(o){ return o.v===x; })[0]; return o?(o.short||o.l):x; };
  if(d.multi){ if(!v||!v.length) return d.title; return v.length===1?find(v[0]):d.title+' · '+v.length; }
  if(!v) return d.keep?find(''):d.title;
  return find(v);
}
function fbRender(ctx){
  var c=FB_CFG[ctx], box=c&&document.getElementById(c.box); if(!box) return;
  var S=fbS(ctx), defs=fbDefs(ctx);
  var op=document.querySelector('.cn-pop[data-fb="'+ctx+'"]'), keep=op?{k:op.getAttribute('data-k'),a:op.scrollTop,b:(op.querySelector('.cn-ol')||{}).scrollTop||0}:null;
  var sl=box.scrollLeft; cnSheetRm();
  if(S.open&&!defs.some(function(d){ return d.k===S.open; })) S.open='';
  box.innerHTML=defs.map(function(d){
    var v=S.v[d.k], on=!d.keep&&(Array.isArray(v)?v.length>0:!!v), pop='';
    if(S.open===d.k){
      var body=(d.all?rfOpt(d.multi?!(v&&v.length):!v,esc(d.all),'fbClear(\''+ctx+'\',\''+d.k+'\')',false,d.allN):'')+
        (d.opts.length?d.opts.map(function(o){ return fbOptHTML(ctx,d,o); }).join(''):'<div class="cn-ph">'+esc(d.empty||'Rien à filtrer pour l’instant.')+'</div>');
      pop=(d.search?'<label class="cn-psrch">'+ic('search')+'<input type="search" placeholder="Chercher…" value="'+esc(S.iq)+'" oninput="fbSearch(\''+ctx+'\',this.value)" autocomplete="off"></label>':'')+
        (d.hint?'<div class="cn-ph">'+esc(d.hint)+'</div>':'')+(d.search?'<div class="cn-ol">'+body+'</div>':body);
    }
    return '<div class="cn-f'+(S.open===d.k?' open':'')+'"><button class="cn-fb'+(on?' on':'')+'" onclick="fbOpen(event,\''+ctx+'\',\''+d.k+'\')">'+esc(fbLabel(ctx,d))+ic('chev-down')+'</button>'+
      (S.open===d.k?'<div class="cn-pop" data-fb="'+ctx+'" data-k="'+d.k+'" onclick="event.stopPropagation()">'+pop+'</div>':'')+'</div>';
  }).join('');
  box.scrollLeft=sl;
  var pop=box.querySelector('.cn-pop');
  if(pop){
    if(cnMobile()){
      var sh=document.createElement('div'); sh.id='cn-sheet'; sh.className='cn-sheet'+(box.closest('.ov')?' in-mod':'');
      sh.innerHTML='<div class="cn-sheet-bd" onclick="fbClose(\''+ctx+'\')"></div>';
      var hd=document.createElement('div'); hd.className='cn-sh';
      var d0=defs.filter(function(d){ return d.k===S.open; })[0]||{};
      hd.innerHTML='<b>'+esc(d0.title||'')+'</b><button type="button" class="cn-sh-ok" onclick="fbClose(\''+ctx+'\')">OK</button>';
      pop.insertBefore(hd,pop.firstChild);
      sh.appendChild(pop); document.body.appendChild(sh);
      document.documentElement.classList.add('cn-lock');
    }
    if(getComputedStyle(pop).position!=='fixed'){
      var r=pop.getBoundingClientRect(), vw=document.documentElement.clientWidth, md=box.closest('.modal'), lim=vw-8, l0=8;
      if(md){ var mr=md.getBoundingClientRect(); lim=Math.min(lim,mr.right-12); l0=mr.left+12; }
      if(r.right>lim) pop.style.left=Math.max(lim-r.right,l0-r.left)+'px';
    }
    if(S.iq) fbSearch(ctx,S.iq);
    if(keep&&keep.k===S.open){ pop.scrollTop=keep.a; var ol=pop.querySelector('.cn-ol'); if(ol) ol.scrollTop=keep.b; }
    else { var si=pop.querySelector('input'); if(si&&!('ontouchstart' in window)) si.focus(); }
  }
  fbActive(ctx);
}
function fbActive(ctx){
  var c=FB_CFG[ctx], box=c&&c.active&&document.getElementById(c.active); if(!box) return;
  var S=fbS(ctx), ch=[];
  fbDefs(ctx).forEach(function(d){
    if(d.keep) return; var v=S.v[d.k]; if(!v||(Array.isArray(v)&&!v.length)) return;
    (Array.isArray(v)?v:[v]).forEach(function(x){
      var o=d.opts.filter(function(o){ return o.v===x; })[0];
      var txt=(d.chip?d.chip(o?o.l:x):(o?o.l:x));
      ch.push('<button class="cn-ac" onclick="fbPick(\''+ctx+'\',\''+d.k+'\',\''+escJS(x)+'\')">'+(d.icon?ic(d.icon)+' ':'')+esc(txt)+ic('x')+'</button>');
    });
  });
  box.style.display=ch.length?'':'none';
  box.innerHTML=ch.join('')+(ch.length>1?'<button class="cn-acx" onclick="fbReset(\''+ctx+'\')">Tout effacer</button>':'');
}
function fbGo(ctx){ var c=FB_CFG[ctx]; if(c&&c.render) c.render(); }
function fbOpen(e,ctx,k){ if(e) e.stopPropagation(); var S=fbS(ctx); Object.keys(FB).forEach(function(x){ if(x!==ctx) FB[x].open=''; }); S.open=S.open===k?'':k; S.iq=''; fbRender(ctx); }
function fbClose(ctx){ var S=fbS(ctx); if(!S.open){ cnSheetRm(); return; } S.open=''; fbRender(ctx); }
function fbPick(ctx,k,v){
  var S=fbS(ctx), d=fbDefs(ctx).filter(function(d){ return d.k===k; })[0]||{};
  if(d.pick){ S.open=''; d.pick(S.v[k]===v?'':v); return; }
  if(d.multi){ var a=fbA(ctx,k).slice(), i=a.indexOf(v); if(i>=0) a.splice(i,1); else a.push(v); S.v[k]=a; }
  else { S.v[k]=(S.v[k]===v&&!d.keep)?'':v; S.open=''; if(d.store) try{ LS.setItem(d.store,S.v[k]); }catch(e){} }
  fbGo(ctx);
}
function fbClear(ctx,k){ var S=fbS(ctx), d=fbDefs(ctx).filter(function(d){ return d.k===k; })[0]||{}; if(d.pick){ S.open=''; d.pick(''); return; } S.v[k]=Array.isArray(S.v[k])?[]:''; S.open=''; fbGo(ctx); }
function fbReset(ctx){
  var S=fbS(ctx), c=FB_CFG[ctx];
  fbDefs(ctx).forEach(function(d){ if(!d.keep) S.v[d.k]=d.multi?[]:''; });
  S.open=''; var i=c&&c.q&&document.getElementById(c.q); if(i) i.value='';
  if(c&&c.onReset) c.onReset();
  fbGo(ctx);
}
function fbSearch(ctx,v){
  fbS(ctx).iq=v; var q=normTxt(v).trim(), pop=document.querySelector('.cn-pop[data-fb="'+ctx+'"]'); if(!pop) return;
  pop.querySelectorAll('.cn-oi').forEach(function(d){ d.style.display=!q||d.getAttribute('data-n').indexOf(q)>=0?'':'none'; });
}
document.addEventListener('click',function(e){
  if(e.target.closest&&e.target.closest('.cn-f')) return;
  Object.keys(FB).forEach(function(ctx){ if(FB[ctx].open) fbClose(ctx); });
});
document.addEventListener('keydown',function(e){ if(e.key==='Escape') Object.keys(FB).forEach(function(ctx){ if(FB[ctx].open) fbClose(ctx); }); });
// options utiles
function fbCountOpts(list,keyFn,labelFn){
  var n={}; list.forEach(function(x){ [].concat(keyFn(x)||[]).forEach(function(k){ if(k==null||k==='') return; n[k]=(n[k]||0)+1; }); });
  return Object.keys(n).sort(function(a,b){ return String(labelFn?labelFn(a):a).localeCompare(String(labelFn?labelFn(b):b),'fr'); }).map(function(k){ return {v:k,l:labelFn?labelFn(k):k,n:n[k]}; });
}
var FB_DATES=[['7','Cette semaine'],['30','Ce mois-ci'],['365','Cette année']];
function fbDateOk(ctx,k,iso){ var v=fbV(ctx,k); if(!v) return true; var d=Date.parse(iso||''); return d&&d>=Date.now()-Number(v)*864e5; }
