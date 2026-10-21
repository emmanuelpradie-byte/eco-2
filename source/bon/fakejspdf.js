// Simulateur minimal de l'API jsPDF utilisée par doPDF, dessiné sur canvas (pt → px ×S)
(function(){
  var S=1.6;
  function Doc(){ this.pages=[]; this.font='Poppins'; this.style='normal'; this.size=16; this.fill='#000'; this.stroke='#000'; this.tc='#000'; this.lw=1; this.vfs={}; this.addPage(true); }
  Doc.prototype.addPage=function(first){ var c=document.createElement('canvas'); c.width=Math.round(595.28*S); c.height=Math.round(841.89*S); var x=c.getContext('2d'); x.fillStyle='#fff'; x.fillRect(0,0,c.width,c.height); this.pages.push(c); this.ctx=x; return this; };
  function col(a){ return 'rgb('+a[0]+','+a[1]+','+a[2]+')'; }
  Doc.prototype.setFillColor=function(r,g,b){ this.fill=col([r,g,b]); };
  Doc.prototype.setDrawColor=function(r,g,b){ this.stroke=col([r,g,b]); };
  Doc.prototype.setTextColor=function(r,g,b){ this.tc=col([r,g,b]); };
  Doc.prototype.setLineWidth=function(w){ this.lw=w; };
  Doc.prototype.addFileToVFS=function(n,d){ this.vfs[n]=d; };
  Doc.prototype.addFont=function(){};
  Doc.prototype.setFont=function(f,s){ this.font=f; this.style=s||'normal'; };
  Doc.prototype.setFontSize=function(s){ this.size=s; };
  Doc.prototype._f=function(){ var w={normal:'400',medium:'500',bold:'700',italic:'400'}[this.style]||'400'; return (this.style==='italic'?'italic ':'')+w+' '+(this.size*S)+'px PoppinsBon'; };
  Doc.prototype.getTextWidth=function(t){ this.ctx.font=this._f(); return this.ctx.measureText(t).width/S; };
  Doc.prototype.splitTextToSize=function(t,w){ var self=this, out=[]; String(t).split('\n').forEach(function(par){ var words=par.split(' '), line=''; words.forEach(function(wd){ var tst=line?line+' '+wd:wd; if(self.getTextWidth(tst)>w && line){ out.push(line); line=wd; } else line=tst; }); out.push(line); }); return out; };
  Doc.prototype.rect=function(x,y,w,h){ this.ctx.fillStyle=this.fill; this.ctx.fillRect(x*S,y*S,w*S,h*S); };
  Doc.prototype.line=function(a,b,c,d){ var x=this.ctx; x.strokeStyle=this.stroke; x.lineWidth=this.lw*S; x.beginPath(); x.moveTo(a*S,b*S); x.lineTo(c*S,d*S); x.stroke(); };
  Doc.prototype.text=function(t,x,y,o){ o=o||{}; var c=this.ctx, lines=Array.isArray(t)?t:[t], lh=this.size*(o.lineHeightFactor||1.15); c.font=this._f(); c.fillStyle=this.tc;
    lines.forEach(function(l,i){ c.save(); var yy=y+i*lh; c.translate(x*S,yy*S); if(o.angle) c.rotate(-o.angle*Math.PI/180); var w=c.measureText(l).width; c.fillText(l, o.align==='right'?-w:(o.align==='center'?-w/2:0), 0); c.restore(); }); };
  Doc.prototype.addImage=function(src,fmt,x,y,w,h){ var im=new Image(); im.src=src; var c=this.ctx; if(im.complete&&im.naturalWidth) c.drawImage(im,x*S,y*S,w*S,h*S); else window.__imgWarn=(window.__imgWarn||0)+1; };
  Doc.prototype.save=function(){ window.__pdfPages=this.pages.map(function(p){ return p.toDataURL('image/png'); }); };
  window.jspdf={jsPDF:Doc};
})();
