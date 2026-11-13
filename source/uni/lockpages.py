# Génère une page fixe par thème verrouillé : economat-pro/<clé>/ (thème intégré + manifeste + icônes propres)
import json,os,base64,re,sys
from playwright.sync_api import sync_playwright
O='/mnt/user-data/outputs/economat-pro/'
html=open(O+'index.html',encoding='utf-8').read()
sw=open('sw_template.js',encoding='utf-8').read()
BUILD=re.search(r"economat-([0-9a-f]+)'",open(O+'sw.js',encoding='utf-8').read()).group(1)
JS='''(L)=>new Promise(res=>{
 var img=new Image();
 function go(){ var out={}; [180,192,512].forEach(function(n){
   var c=document.createElement('canvas'); c.width=c.height=n; var g=c.getContext('2d');
   g.fillStyle=L.bg; g.fillRect(0,0,n,n);
   if(L.logo){ var s=n*.8/Math.max(img.width,img.height); g.drawImage(img,(n-img.width*s)/2,(n-img.height*s)/2,img.width*s,img.height*s); }
   else { g.fillStyle=(L.bg.toLowerCase()<'#40'?'#f4f4f2':'#111'); g.font='700 '+Math.round(n*.52)+'px Poppins,Arial,sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('É',n/2,n*.54); }
   out[n]=c.toDataURL('image/png'); }); res(out); }
 img.onload=go; if(L.logo) img.src=L.logo; else go(); })'''
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(); pg.goto('file://'+O+'index.html'); pg.wait_for_timeout(1200)
    locks=pg.evaluate("themeLocks().map(l=>({key:l.key,n:l.n,bg:l.bg,logo:l.logo}))")
    for L in locks:
        d=O+L['key']+'/'; os.makedirs(d,exist_ok=True)
        ic=pg.evaluate(JS,L)
        for n,name in [('180','apple-touch-icon.png'),('192','icon-192.png'),('512','icon-512.png')]:
            open(d+name,'wb').write(base64.b64decode(ic[n].split(',')[1]))
        k=L['key']
        pg_html=html.replace('<head>','<head>\n<script>window.__THEME_LOCK='+json.dumps(k)+';</script>',1)
        assert '__THEME_LOCK' in pg_html
        pg_html=pg_html.replace('href="manifest.json"','href="manifest.json"').replace('href="icons/apple-touch-icon.png"','href="apple-touch-icon.png"')
        open(d+'index.html','w',encoding='utf-8').write(pg_html)
        ic_=lambda f,s,pu:{"src":f,"sizes":s,"type":"image/png","purpose":pu}
        m={"name":"Économat Pro · "+L['n'],"short_name":"Économat","start_url":"./index.html","scope":"./","display":"standalone",
           "background_color":L['bg'],"theme_color":L['bg'],"lang":"fr",
           "icons":[ic_('icon-192.png','192x192','any'),ic_('icon-512.png','512x512','any'),ic_('icon-512.png','512x512','maskable'),ic_('apple-touch-icon.png','180x180','any')]}
        json.dump(m,open(d+'manifest.json','w',encoding='utf-8'),ensure_ascii=False,indent=2)
        assets=['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png','./apple-touch-icon.png']
        open(d+'sw.js','w',encoding='utf-8').write(sw.replace('__ASSETS__',json.dumps(assets)).replace("const CACHE_NAME = 'economat-v3';","const CACHE_NAME = 'economat-"+k+"-"+BUILD+"';"))
    b.close()
print('pages thèmes :',[l['key'] for l in locks])
