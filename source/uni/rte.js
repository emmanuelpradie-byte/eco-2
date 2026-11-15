// ══ TRAITEMENT DE TEXTE (procédé des recettes) ════════════════
// Éditeur « à la Word » : gras, italique, souligné, barré, titres, listes,
// retraits, alignement, couleurs, surlignage, tailles, annuler / rétablir,
// symboles, collage nettoyé. Le texte mis en forme est gardé dans
// recette.notesHtml ; recette.notes garde la version texte (recherche,
// partage vers d’anciennes versions, compatibilité).
var RTE={};
var RTE_COLORS=[['#231F20','Noir'],['#C0392B','Rouge'],['#D35400','Orange'],['#B7950B','Moutarde'],['#1E8449','Vert'],['#1F618D','Bleu'],['#7D3C98','Violet'],['#7F8C8D','Gris']];
var RTE_MARKS=[['#FFF3A3','Jaune'],['#D5F5D0','Vert'],['#FAD7E0','Rose'],['#D6EAF8','Bleu'],['#FDE2C8','Orange']];
var RTE_SYMS=['°C','°','×','½','¼','¾','→','≈','±','≤','≥','•','–','€','%','g','kg','min','h'];

// ── nettoyage du HTML (collage, enregistrement) ──
function rteClean(html){
  var t=document.createElement('template'); t.innerHTML=String(html||'');
  var BLOCK={P:1,H3:1,H4:1,LI:1,BLOCKQUOTE:1};
  function col(v){ v=String(v||'').trim(); return /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i.test(v)?v:''; }
  function align(el){ var a=(el.style&&el.style.textAlign)||el.getAttribute&&el.getAttribute('align')||''; return /^(left|center|right|justify)$/.test(a)?a:''; }
  function walk(node,out){
    Array.prototype.slice.call(node.childNodes).forEach(function(n){
      if(n.nodeType===3){ out.appendChild(document.createTextNode(n.nodeValue)); return; }
      if(n.nodeType!==1) return;
      var tag=n.tagName, mk=null;
      if(/^(SCRIPT|STYLE|META|LINK|TITLE|HEAD|IFRAME|OBJECT|SVG|IMG|VIDEO|AUDIO|CANVAS|INPUT|BUTTON|SELECT|TEXTAREA)$/.test(tag)) return;
      if(tag==='B'||tag==='STRONG') mk='b';
      else if(tag==='I'||tag==='EM') mk='i';
      else if(tag==='U'||tag==='INS') mk='u';
      else if(tag==='S'||tag==='STRIKE'||tag==='DEL') mk='s';
      else if(tag==='H1'||tag==='H2'||tag==='H3') mk='h3';
      else if(tag==='H4'||tag==='H5'||tag==='H6') mk='h4';
      else if(tag==='UL'||tag==='OL'||tag==='LI'||tag==='BLOCKQUOTE'||tag==='BR'||tag==='HR') mk=tag.toLowerCase();
      else if(tag==='P'||tag==='DIV') mk='p';
      else if(tag==='SPAN'||tag==='FONT'||tag==='MARK') mk='span';
      if(!mk){ walk(n,out); return; }
      var e=document.createElement(mk);
      if(mk==='br'||mk==='hr'){ out.appendChild(e); return; }
      if(mk==='p'||mk==='h3'||mk==='h4'||mk==='li'){ var a=align(n); if(a&&a!=='left') e.style.textAlign=a; }
      if(mk==='span'){
        var c=col(n.style&&n.style.color)||col(n.getAttribute('color')), bg=col(n.style&&n.style.backgroundColor)||(tag==='MARK'?'#FFF3A3':'');
        var fs=n.getAttribute('size'), cls=n.className||'';
        if(c) e.style.color=c; if(bg) e.style.backgroundColor=bg;
        if(/rt-sm/.test(cls)||(fs&&+fs<=2)) e.className='rt-sm'; else if(/rt-lg/.test(cls)||(fs&&+fs>=4)) e.className='rt-lg';
        if(n.style&&/bold|[6-9]00/.test(n.style.fontWeight||'')){ var bb=document.createElement('b'); e.appendChild(bb); walk(n,bb); if(!c&&!bg&&!e.className){ out.appendChild(bb); return; } out.appendChild(e); return; }
        if(n.style&&/italic/.test(n.style.fontStyle||'')){ var ii=document.createElement('i'); e.appendChild(ii); walk(n,ii); if(!c&&!bg&&!e.className){ out.appendChild(ii); return; } out.appendChild(e); return; }
        if(!c&&!bg&&!e.className){ walk(n,out); return; }
      }
      if(mk==='ol'){ var st=parseInt(n.getAttribute('start'),10); if(st>1) e.setAttribute('start',st); }
      walk(n,e); out.appendChild(e);
    });
  }
  var box=document.createElement('div'); walk(t.content,box);
  // texte nu au premier niveau → paragraphes
  var res=document.createElement('div'), cur=null;
  Array.prototype.slice.call(box.childNodes).forEach(function(n){
    var inline=n.nodeType===3||/^(B|I|U|S|SPAN|BR)$/.test(n.tagName);
    if(inline){ if(n.nodeType===3&&!n.nodeValue.trim()&&!cur) return; if(!cur){ cur=document.createElement('p'); res.appendChild(cur); } if(n.tagName==='BR'&&cur.childNodes.length){ cur=null; return; } cur.appendChild(n); }
    else { cur=null; if(n.tagName==='LI'){ var ul=document.createElement('ul'); ul.appendChild(n); res.appendChild(ul); } else res.appendChild(n); }
  });
  var h=res.innerHTML.replace(/<p><\/p>/g,'').replace(/(<br>\s*)+<\/(p|li|h3|h4)>/g,'</$2>');
  return h.length>200000?h.slice(0,200000):h;
}
// texte brut → HTML (anciennes recettes)
function rteFromText(t){
  t=String(t||'').replace(/\r/g,''); if(!t.trim()) return '';
  return t.split(/\n/).map(function(l){ return '<p>'+(l.trim()?esc(l):'<br>')+'</p>'; }).join('').replace(/(<p><br><\/p>)+$/,'');
}
// HTML → texte brut (listes numérotées / à puces conservées)
function rteToText(html){
  var d=document.createElement('div'); d.innerHTML=rteClean(html); var out=[];
  function txt(n){ return (n.textContent||'').replace(/ /g,' ').replace(/[ \t]+/g,' ').trim(); }
  Array.prototype.forEach.call(d.childNodes,function(n){
    if(n.nodeType===3){ if(n.nodeValue.trim()) out.push(n.nodeValue.trim()); return; }
    if(n.tagName==='UL'||n.tagName==='OL'){ var k=parseInt(n.getAttribute('start'),10)||1; Array.prototype.forEach.call(n.children,function(li){ out.push((n.tagName==='OL'?(k++)+'. ':'• ')+txt(li)); }); return; }
    if(n.tagName==='HR'){ out.push('—'); return; }
    out.push(txt(n));
  });
  return out.join('\n').replace(/\n{3,}/g,'\n\n').trim();
}
function rteHtmlOf(r){ return r&&r.notesHtml?rteClean(r.notesHtml):rteFromText(r&&r.notes); }

// ── éditeur ──
function rteTool(id,cmd,arg,label,title,cls){
  return '<button type="button" class="rte-b'+(cls?' '+cls:'')+'" data-cmd="'+cmd+'" title="'+esc(title)+'" aria-label="'+esc(title)+'" onmousedown="event.preventDefault()" onclick="rteCmd(\''+id+'\',\''+cmd+'\','+(arg==null?'null':'\''+arg+'\'')+')">'+label+'</button>';
}
function rteBarHTML(id){
  var T=function(c,a,l,t,k){ return rteTool(id,c,a,l,t,k); }, sep='<span class="rte-sep"></span>';
  return '<div class="rte-bar" role="toolbar" aria-label="Mise en forme">'+
    T('undo',null,ic('undo'),'Annuler (Ctrl+Z)')+T('redo',null,ic('redo'),'Rétablir (Ctrl+Y)')+sep+
    '<select class="rte-sel" title="Style du paragraphe" aria-label="Style du paragraphe" onchange="rteCmd(\''+id+'\',\'block\',this.value);this.value=\'\'"><option value="">Style</option><option value="p">Texte normal</option><option value="h3">Titre</option><option value="h4">Sous-titre</option><option value="blockquote">Encadré (astuce)</option></select>'+
    '<select class="rte-sel" title="Taille du texte" aria-label="Taille du texte" onchange="rteCmd(\''+id+'\',\'size\',this.value);this.value=\'\'"><option value="">Taille</option><option value="sm">Petit</option><option value="md">Normal</option><option value="lg">Grand</option></select>'+sep+
    T('bold',null,'<b>G</b>','Gras (Ctrl+B)')+T('italic',null,'<i>I</i>','Italique (Ctrl+I)')+T('underline',null,'<u>S</u>','Souligné (Ctrl+U)')+T('strikeThrough',null,'<s>ab</s>','Barré')+
    '<span class="rte-dd"><button type="button" class="rte-b" title="Couleur du texte" aria-label="Couleur du texte" onmousedown="event.preventDefault()" onclick="rtePop(\''+id+'\',\'col\')"><span class="rte-a">A</span><i class="rte-u" id="'+id+'-colbar"></i></button>'+
    '<div class="rte-pop" id="'+id+'-col">'+RTE_COLORS.map(function(c){ return '<button type="button" title="'+c[1]+'" style="background:'+c[0]+'" onmousedown="event.preventDefault()" onclick="rteCmd(\''+id+'\',\'foreColor\',\''+c[0]+'\')"></button>'; }).join('')+'</div></span>'+
    '<span class="rte-dd"><button type="button" class="rte-b" title="Surligner" aria-label="Surligner" onmousedown="event.preventDefault()" onclick="rtePop(\''+id+'\',\'mk\')">'+ic('edit')+'<i class="rte-u" style="background:#FFF3A3"></i></button>'+
    '<div class="rte-pop" id="'+id+'-mk">'+RTE_MARKS.map(function(c){ return '<button type="button" title="'+c[1]+'" style="background:'+c[0]+'" onmousedown="event.preventDefault()" onclick="rteCmd(\''+id+'\',\'hiliteColor\',\''+c[0]+'\')"></button>'; }).join('')+'<button type="button" class="rte-none" title="Sans surlignage" onmousedown="event.preventDefault()" onclick="rteCmd(\''+id+'\',\'hiliteColor\',\'transparent\')">'+ic('x')+'</button></div></span>'+sep+
    T('insertUnorderedList',null,ic('list'),'Liste à puces')+T('insertOrderedList',null,'<span class="rte-t">1.</span>','Liste numérotée (étapes)')+
    T('outdent',null,'<span class="rte-t">⇤</span>','Diminuer le retrait')+T('indent',null,'<span class="rte-t">⇥</span>','Augmenter le retrait')+sep+
    T('justifyLeft',null,'<span class="rte-al l"></span>','Aligner à gauche')+T('justifyCenter',null,'<span class="rte-al c"></span>','Centrer')+T('justifyRight',null,'<span class="rte-al r"></span>','Aligner à droite')+T('justifyFull',null,'<span class="rte-al j"></span>','Justifier')+sep+
    '<span class="rte-dd"><button type="button" class="rte-b" title="Insérer un symbole" aria-label="Insérer un symbole" onmousedown="event.preventDefault()" onclick="rtePop(\''+id+'\',\'sym\')"><span class="rte-t">Ω</span></button>'+
    '<div class="rte-pop sym" id="'+id+'-sym">'+RTE_SYMS.map(function(s){ return '<button type="button" onmousedown="event.preventDefault()" onclick="rteCmd(\''+id+'\',\'insertText\',\''+s+'\')">'+esc(s)+'</button>'; }).join('')+'</div></span>'+
    T('insertHorizontalRule',null,'<span class="rte-t">―</span>','Ligne de séparation')+
    T('removeFormat',null,'<span class="rte-t rte-clr">T<sub>×</sub></span>','Effacer la mise en forme')+
  '</div>';
}
// remplace une zone de texte par l’éditeur (la zone reste, cachée, et suit le texte)
function rteMount(taId,opt){
  var ta=document.getElementById(taId); if(!ta) return null; opt=opt||{};
  var id=taId+'-rte', w=document.getElementById(id+'-w');
  if(!w){
    w=document.createElement('div'); w.className='rte'; w.id=id+'-w';
    w.innerHTML=rteBarHTML(id)+'<div class="rte-ed" id="'+id+'" contenteditable="true" role="textbox" aria-multiline="true" aria-label="'+esc(opt.label||'Procédé')+'" data-ph="'+esc(ta.getAttribute('placeholder')||'Écris ici…')+'"></div>'+
      '<div class="rte-st"><span id="'+id+'-n"></span><span class="rte-hint">Ctrl+B gras · Ctrl+I italique · Ctrl+U souligné</span></div>';
    ta.parentNode.insertBefore(w,ta); ta.style.display='none';
    var ed=document.getElementById(id);
    ed.addEventListener('input',function(){ rteSync(id); });
    ed.addEventListener('keyup',function(){ rteState(id); }); ed.addEventListener('mouseup',function(){ rteState(id); });
    ed.addEventListener('paste',function(e){
      var cd=e.clipboardData||window.clipboardData; if(!cd) return;
      var h=cd.getData('text/html'), t=cd.getData('text/plain'); e.preventDefault();
      var ins=h?rteClean(h):rteFromText(t);
      if(!h&&t&&t.indexOf('\n')<0){ document.execCommand('insertText',false,t); } else document.execCommand('insertHTML',false,ins);
      rteSync(id);
    });
    ed.addEventListener('keydown',function(e){
      if((e.ctrlKey||e.metaKey)&&!e.altKey){ var k=e.key.toLowerCase();
        if(k==='y'){ e.preventDefault(); rteCmd(id,'redo'); } }
      if(e.key==='Tab'){ e.preventDefault(); rteCmd(id,e.shiftKey?'outdent':'indent'); }
    });
    document.addEventListener('mousedown',function(e){ if(!w.contains(e.target)) w.querySelectorAll('.rte-pop.on').forEach(function(p){ p.classList.remove('on'); }); });
  }
  RTE[id]={ta:ta,on:opt.onChange||null};
  return id;
}
function rteSet(id,html){
  var ed=document.getElementById(id); if(!ed) return;
  ed.innerHTML=rteClean(html||''); rteSync(id,true);
}
function rteGet(id){ var ed=document.getElementById(id); return ed?rteClean(ed.innerHTML):''; }
function rteSync(id,silent){
  var ed=document.getElementById(id), R=RTE[id]; if(!ed||!R) return;
  var txt=rteToText(ed.innerHTML);
  R.ta.value=txt; ed.classList.toggle('empty',!txt);
  var n=document.getElementById(id+'-n'); if(n){ var w=txt?txt.split(/\s+/).filter(Boolean).length:0; n.textContent=w+' mot'+(w>1?'s':''); }
  if(!silent){ try{ R.ta.dispatchEvent(new Event('input',{bubbles:true})); }catch(e){} if(R.on) R.on(); }
}
function rtePop(id,k){
  ['col','mk','sym'].forEach(function(x){ var p=document.getElementById(id+'-'+x); if(p) p.classList.toggle('on',x===k&&!p.classList.contains('on')); });
}
function rteCmd(id,cmd,arg){
  var ed=document.getElementById(id); if(!ed) return;
  if(document.activeElement!==ed&&!(ed.contains(document.activeElement))){
    ed.focus();
    var s=window.getSelection(); if(s&&!ed.contains(s.anchorNode)){ var r=document.createRange(); r.selectNodeContents(ed); r.collapse(false); s.removeAllRanges(); s.addRange(r); }
  }
  try{ document.execCommand('styleWithCSS',false,cmd==='hiliteColor'||cmd==='foreColor'); }catch(e){}
  if(cmd==='block') document.execCommand('formatBlock',false,'<'+arg+'>');
  else if(cmd==='size'){
    if(arg==='md'){ document.execCommand('fontSize',false,'3'); }
    else document.execCommand('fontSize',false,arg==='sm'?'2':'5');
    // <font size> → classes
    ed.querySelectorAll('font[size]').forEach(function(f){ var sp=document.createElement('span'), z=+f.getAttribute('size'); if(z<=2) sp.className='rt-sm'; else if(z>=4) sp.className='rt-lg'; while(f.firstChild) sp.appendChild(f.firstChild); f.parentNode.replaceChild(sp,f); if(!sp.className){ while(sp.firstChild) sp.parentNode.insertBefore(sp.firstChild,sp); sp.remove(); } });
  }
  else if(cmd==='hiliteColor'){ if(!document.execCommand('hiliteColor',false,arg)) document.execCommand('backColor',false,arg); }
  else if(cmd==='removeFormat'){ document.execCommand('removeFormat'); document.execCommand('formatBlock',false,'<p>'); }
  else document.execCommand(cmd,false,arg==null?null:arg);
  if(cmd==='foreColor'){ var b=document.getElementById(id+'-colbar'); if(b) b.style.background=arg; }
  ed.querySelectorAll('.rte-pop.on').forEach(function(p){ p.classList.remove('on'); });
  document.querySelectorAll('#'+id+'-w .rte-pop.on').forEach(function(p){ p.classList.remove('on'); });
  rteSync(id); rteState(id);
}
function rteState(id){
  var w=document.getElementById(id+'-w'); if(!w) return;
  ['bold','italic','underline','strikeThrough','insertUnorderedList','insertOrderedList','justifyCenter','justifyRight','justifyFull'].forEach(function(c){
    var b=w.querySelector('[data-cmd="'+c+'"]'); if(!b) return; var on=false; try{ on=document.queryCommandState(c); }catch(e){} b.classList.toggle('on',!!on);
  });
}

// ── rendu PDF (jsPDF) : paragraphes, titres, listes, gras/italique, couleurs ──
function rteBlocks(html){
  var d=document.createElement('div'); d.innerHTML=rteClean(html); var blocks=[];
  function hex(c){
    c=String(c||''); var m=/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
    if(m){ var h=m[1].length===3?m[1].replace(/./g,'$&$&'):m[1]; return [0,2,4].map(function(i){ return parseInt(h.substr(i,2),16); }); }
    m=/rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)(?:[ ,\/]+([\d.]+))?/i.exec(c); if(m){ if(m[4]!=null&&+m[4]===0) return null; return [+m[1],+m[2],+m[3]]; } return null;
  }
  function runs(node,st,out){
    Array.prototype.forEach.call(node.childNodes,function(n){
      if(n.nodeType===3){ if(n.nodeValue) out.push({t:n.nodeValue.replace(/ /g,' ').replace(/\s+/g,' '),s:Object.assign({},st)}); return; }
      if(n.nodeType!==1) return;
      if(n.tagName==='BR'){ out.push({br:1}); return; }
      if(n.tagName==='UL'||n.tagName==='OL'){ return; }
      var s=Object.assign({},st);
      if(n.tagName==='B') s.b=1; if(n.tagName==='I') s.i=1; if(n.tagName==='U') s.u=1; if(n.tagName==='S') s.s=1;
      if(n.tagName==='SPAN'){ var c=hex(n.style.color), bg=hex(n.style.backgroundColor); if(c) s.c=c; if(bg) s.bg=bg; if(n.className==='rt-sm') s.z=0.85; if(n.className==='rt-lg') s.z=1.3; }
      runs(n,s,out);
    });
  }
  function list(n,depth){
    var k=parseInt(n.getAttribute('start'),10)||1;
    Array.prototype.forEach.call(n.children,function(li){
      if(li.tagName!=='LI') return; var r=[]; runs(li,{},r);
      blocks.push({k:'li',mk:n.tagName==='OL'?(k++)+'.':'•',d:depth,runs:r,al:li.style.textAlign||''});
      Array.prototype.forEach.call(li.children,function(c){ if(c.tagName==='UL'||c.tagName==='OL') list(c,depth+1); });
    });
  }
  Array.prototype.forEach.call(d.childNodes,function(n){
    if(n.nodeType===3){ if(n.nodeValue.trim()) blocks.push({k:'p',runs:[{t:n.nodeValue,s:{}}]}); return; }
    if(n.tagName==='UL'||n.tagName==='OL'){ list(n,0); return; }
    if(n.tagName==='HR'){ blocks.push({k:'hr'}); return; }
    var r=[]; runs(n,{},r);
    blocks.push({k:n.tagName==='H3'?'h3':n.tagName==='H4'?'h4':n.tagName==='BLOCKQUOTE'?'q':'p',runs:r,al:(n.style&&n.style.textAlign)||''});
  });
  return blocks;
}
// dessine le HTML dans le PDF ; renvoie le nouveau y.
// ctx : {L,R,y,ink,brk(h,y) → y (saut de page si besoin), size}
function rtePdf(doc,F,html,ctx){
  var L=ctx.L, R=ctx.R, y=ctx.y, INK=ctx.ink||[35,31,32], BASE=ctx.size||9, TXT=ctx.txt||[59,53,54];
  function font(s,blk){ var b=s.b||blk==='h3'||blk==='h4', it=s.i||blk==='q'; doc.setFont(F,b?'bold':(it?'italic':'normal')); }
  rteBlocks(html).forEach(function(B,bi){
    if(B.k==='hr'){ y=ctx.brk(14,y); y+=8; doc.setDrawColor(200,200,200); doc.setLineWidth(0.6); doc.line(L,y,R,y); y+=4; return; }
    var size=B.k==='h3'?BASE+3:B.k==='h4'?BASE+1.5:BASE, lh=size*1.42;
    var ind=B.k==='li'?14+B.d*14:(B.k==='q'?12:0), x0=L+ind, W=R-x0;
    if(B.k==='h3'||B.k==='h4'){ y+=bi?6:2; }
    // mots avec leur style
    var words=[];
    B.runs.forEach(function(r){
      if(r.br){ words.push({br:1}); return; }
      String(r.t).split(/( )/).forEach(function(p){ if(p==='') return; words.push({t:p,s:r.s}); });
    });
    var lines=[], line=[], lw=0;
    function wsz(s){ return size*(s.z||1); }
    function width(w){ font(w.s,B.k); doc.setFontSize(wsz(w.s)); return doc.getTextWidth(w.t); }
    words.forEach(function(w){
      if(w.br){ lines.push(line); line=[]; lw=0; return; }
      if(w.t===' '&&!line.length) return;
      var ww=width(w);
      if(lw+ww>W&&line.length&&w.t!==' '){
        while(line.length&&line[line.length-1].t===' '){ lw-=line[line.length-1].w; line.pop(); }
        lines.push(line); line=[]; lw=0;
        if(ww>W){ // mot trop long : coupé
          var t=w.t, cut='';
          for(var i=0;i<t.length;i++){ font(w.s,B.k); doc.setFontSize(wsz(w.s)); if(doc.getTextWidth(cut+t[i])>W&&cut){ lines.push([{t:cut,s:w.s,w:doc.getTextWidth(cut)}]); cut=''; } cut+=t[i]; }
          w={t:cut,s:w.s}; ww=width(w);
        }
      }
      w.w=ww; line.push(w); lw+=ww;
    });
    while(line.length&&line[line.length-1].t===' ') line.pop();
    lines.push(line);
    if(B.k==='q'){ var qh=lines.length*lh+8; y=ctx.brk(qh+4,y); doc.setFillColor(245,242,236); doc.rect(L,y+2,R-L,qh,'F'); doc.setFillColor(INK[0],INK[1],INK[2]); doc.rect(L,y+2,2.5,qh,'F'); y+=4; }
    lines.forEach(function(ln,li){
      y=ctx.brk(lh,y); y+=lh;
      var tw=ln.reduce(function(s,w){ return s+w.w; },0), x=x0, gap=0;
      if(B.al==='center') x=x0+(W-tw)/2; else if(B.al==='right') x=R-tw;
      else if(B.al==='justify'&&li<lines.length-1){ var sp=ln.filter(function(w){ return w.t===' '; }).length; if(sp) gap=(W-tw)/sp; }
      if(li===0&&B.k==='li'){ doc.setFont(F,'bold'); doc.setFontSize(size); doc.setTextColor(INK[0],INK[1],INK[2]); doc.text(B.mk,x0-(B.mk==='•'?9:13),y); }
      ln.forEach(function(w){
        var s=w.s, z=wsz(s), c=s.c||(B.k==='h3'||B.k==='h4'?INK:TXT);
        if(s.bg&&w.t){ doc.setFillColor(s.bg[0],s.bg[1],s.bg[2]); doc.rect(x-0.5,y-z*0.82,w.w+1+(w.t===' '?gap:0),z*1.12,'F'); }
        if(w.t!==' '){
          font(s,B.k); doc.setFontSize(z); doc.setTextColor(c[0],c[1],c[2]); doc.text(w.t,x,y);
        }
        var adv=w.w+(w.t===' '?gap:0);
        if(s.u||s.s){ doc.setDrawColor(c[0],c[1],c[2]); doc.setLineWidth(0.5); if(s.u) doc.line(x,y+1.4,x+adv,y+1.4); if(s.s) doc.line(x,y-z*0.3,x+adv,y-z*0.3); }
        x+=adv;
      });
    });
    if(B.k==='q') y+=6;
    y+=B.k==='li'?1:(B.k==='p'?3:4);
  });
  return y;
}
// HTML sûr pour l’aperçu (fiche à l’écran, partage)
function rteView(r){ var h=rteHtmlOf(r); return h?'<div class="rt-view">'+h+'</div>':''; }

// ── branchement dans l’éditeur de recette ──
(function(){
  var ID='r-notes-rte', LOADED=null;
  function mount(){
    if(document.getElementById(ID)) return;
    var ta=document.getElementById('r-notes'); if(!ta) return;
    rteMount('r-notes',{label:'Procédé de la recette'});
    // un autre module remplit la zone de texte (import, annuler…) : l’éditeur suit
    var d=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value');
    if(d&&d.set) try{
      Object.defineProperty(ta,'value',{configurable:true,get:function(){ return d.get.call(this); },set:function(v){
        d.set.call(this,v); if(RTE._in) return;
        var ed=document.getElementById(ID); if(ed&&rteToText(ed.innerHTML)!==String(v||'').trim()){ RTE._in=1; try{ rteSet(ID,rteFromText(v)); } finally{ RTE._in=0; } }
      }});
    }catch(e){}
  }
  function load(r){ mount(); RTE._in=1; try{ rteSet(ID,r?rteHtmlOf(r):''); } finally{ RTE._in=0; } LOADED=r?r.id:null; }
  var _sync=rteSync;
  rteSync=function(id,silent){ var was=RTE._in; RTE._in=1; try{ return _sync.apply(this,arguments); } finally{ RTE._in=was; } };
  var _e=openEditRec; openEditRec=function(id){ var r=_e.apply(this,arguments); if(CUR==='rec-edit') load(recipes.find(function(x){ return x.id===id; })); return r; };
  var _n=openNewRec; openNewRec=function(){ var r=_n.apply(this,arguments); load(null); return r; };
  if(typeof recEdApply==='function'){
    var _a=recEdApply;
    recEdApply=function(rec){
      var h=document.getElementById(ID)?rteGet(ID):'';
      if(h&&rteToText(h)) rec.notesHtml=h; else delete rec.notesHtml;
      return _a.apply(this,arguments);
    };
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
})();
