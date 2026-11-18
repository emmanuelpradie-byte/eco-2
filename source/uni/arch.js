// ══ ÉLÉMENTS SUPPRIMÉS : ils restent dans les bons et les livres déjà créés ══
// Quand on supprime un ingrédient ou une recette, une copie est rangée dans
// une archive (v4_arch). Les bons gardent aussi une copie de l'ingrédient sur
// la ligne (item.snap), qui suit le bon partout. Les écrans des bons et des
// livres voient ces copies ; le catalogue et la page Recettes, non.
var ARCH_KEY='v4_arch', _archC=null, ARCH_D=0;
function archLoad(){ try{ var a=JSON.parse(LS.getItem(ARCH_KEY)||'null'); if(a&&typeof a==='object') return {ing:a.ing||{},rec:a.rec||{}}; }catch(e){} return {ing:{},rec:{}}; }
function archGet(){ return _archC||(_archC=archLoad()); }
function archPut(a){ _archC=a; try{ LS.setItem(ARCH_KEY,JSON.stringify(a)); }catch(e){} }
// copie légère : sans les très grosses images ni les pièces jointes
function archClean(x){
  var c=JSON.parse(JSON.stringify(x||{})); delete c._arch; delete c.attachments;
  Object.keys(c).forEach(function(k){ if(typeof c[k]==='string'&&c[k].length>150000) c[k]=''; });
  return c;
}
function archSnap(g){ var c=archClean(g); delete c.id; delete c.img; delete c.image; return c; }
function archNotLive(list){ var o={}; list.forEach(function(x){ if(x) o[x.id]=1; }); return o; }
function archIng(id){
  if(!id) return null;
  var a=archGet(); if(a.ing[id]) return a.ing[id];
  var bons=(typeof orders!=='undefined'&&orders||[]).concat(typeof curBon!=='undefined'&&curBon?[curBon]:[]);
  for(var i=0;i<bons.length;i++){ var its=bons[i].items||[]; for(var j=0;j<its.length;j++) if(its[j].ingId===id&&its[j].snap) return Object.assign({},its[j].snap,{id:id}); }
  return null;
}
function archRec(id){ var a=archGet(); return (id&&a.rec[id])||null; }
function archRecsFor(){
  var a=archGet(), live=archNotLive(recipes);
  return Object.keys(a.rec).filter(function(id){ return !live[id]; }).map(function(id){ return Object.assign({},a.rec[id],{id:id,_arch:true}); });
}
function archIngsFor(){
  var a=archGet(), live=archNotLive(ingredients), seen={}, out=[];
  Object.keys(a.ing).forEach(function(id){ if(!live[id]){ seen[id]=1; out.push(Object.assign({},a.ing[id],{id:id,_arch:true})); } });
  var bons=(typeof orders!=='undefined'&&orders||[]).concat(typeof curBon!=='undefined'&&curBon?[curBon]:[]);
  bons.forEach(function(o){ (o.items||[]).forEach(function(it){
    if(it&&it.snap&&!live[it.ingId]&&!seen[it.ingId]){ seen[it.ingId]=1; out.push(Object.assign({},it.snap,{id:it.ingId,_arch:true})); }
  }); });
  return out;
}
function archNo(x){ return !(x&&x._arch); }
// exécute fn avec les ingrédients (et, si demandé, les recettes) supprimés encore visibles
function withArch(fn,self,args,withRec){
  if(ARCH_D) return fn.apply(self,args||[]);
  var gi=archIngsFor(), gr=withRec?archRecsFor():[];
  if(!gi.length&&!gr.length) return fn.apply(self,args||[]);
  ARCH_D=1; ingredients=ingredients.concat(gi); if(gr.length) recipes=recipes.concat(gr);
  if(typeof memoClear==='function') memoClear();
  try{ return fn.apply(self,args||[]); }
  finally{
    ARCH_D=0;
    ingredients=ingredients.filter(archNo); if(gr.length) recipes=recipes.filter(archNo);
    if(typeof memoClear==='function') memoClear();
  }
}
function withArchIng(fn){ return withArch(fn,null,[],false); }
// les copies ne sont jamais enregistrées dans le catalogue ni dans les recettes
(function(){
  var _p=persist;
  persist=function(){
    var I=ingredients, R=recipes, dI=I.some(function(x){ return x&&x._arch; }), dR=R.some(function(x){ return x&&x._arch; });
    if(!dI&&!dR) return _p.apply(this,arguments);
    if(dI) ingredients=I.filter(archNo); if(dR) recipes=R.filter(archNo);
    try{ return _p.apply(this,arguments); } finally{ if(dI) ingredients=I; if(dR) recipes=R; }
  };
})();
// après une suppression : copie dans l'archive + sur les lignes des bons
function archKeepDeleted(before){
  var li=archNotLive(ingredients), lr=archNotLive(recipes);
  var gi=before.i.filter(function(x){ return x&&x.id&&!x._arch&&!li[x.id]; }), gr=before.r.filter(function(x){ return x&&x.id&&!x._arch&&!lr[x.id]; });
  if(!gi.length&&!gr.length) return;
  var a=archGet(), by={};
  gi.forEach(function(g){ a.ing[g.id]=archClean(g); by[g.id]=g; });
  gr.forEach(function(r){ a.rec[r.id]=archClean(r); });
  archPut(a);
  var bons=(orders||[]).concat(typeof curBon!=='undefined'&&curBon?[curBon]:[]), ch=false;
  bons.forEach(function(o){ (o.items||[]).forEach(function(it){ if(it&&by[it.ingId]&&!it.snap){ it.snap=archSnap(by[it.ingId]); ch=true; } }); });
  if(ch) try{ persist(); }catch(e){}
}
(function(){
  function guard(name){
    var f=window[name]; if(typeof f!=='function') return;
    window[name]=function(){ var b={i:ingredients.slice(),r:recipes.slice()}, r=f.apply(this,arguments); try{ archKeepDeleted(b); }catch(e){ if(window.console) console.warn(e); } return r; };
  }
  ['confirmDel','selDel'].forEach(guard);
  // écrans des bons : les ingrédients supprimés gardent leur nom, leur prix, leur catégorie
  ['renderItems','updQ','calcTots','exportCSV','buildData','livePreview','doPDF','beRecap','remItem','shOrderSnap'].forEach(function(name){
    var f=window[name]; if(typeof f!=='function') return;
    window[name]=function(){ return withArch(f,this,arguments,false); };
  });
  var fa=window.bonAppendFiches;
  if(typeof fa==='function') window.bonAppendFiches=function(){ return withArch(fa,this,arguments,true); };
})();
