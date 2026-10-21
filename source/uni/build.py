import re, os, json, shutil, sys
sys.path.insert(0,'.')
from icons import svg
os.system('python3 mk_app.py')
app=open('app.js',encoding='utf-8').read()
css=open('style.css',encoding='utf-8').read()

# ── Affichage « mobile » forcé sur un grand écran ──
# Les règles des écrans étroits (@media max-width 820/1020/1180) sont recopiées
# hors média, préfixées par html.lay-mob : le choix « Mobile » les applique
# quelle que soit la largeur de la fenêtre.
def _match(t,i):
    d=0
    for j in range(i,len(t)):
        if t[j]=='{': d+=1
        elif t[j]=='}':
            d-=1
            if d==0: return j
    raise ValueError('accolades')
def _prefix_block(blk):
    out=[]; i=0
    while True:
        k=blk.find('{',i)
        if k<0: break
        sel=blk[i:k].strip(); e=_match(blk,k)
        body=blk[k:e+1]
        if sel.startswith('@'): out.append(sel+body)
        elif sel:
            ps=[]
            for x in sel.split(','):
                x=x.strip()
                if x.startswith('html'): ps.append('html.lay-mob'+x[4:])
                elif x.startswith(':root'): ps.append(':root.lay-mob'+x[5:])
                else: ps.append('html.lay-mob '+x)
            out.append(','.join(ps)+body)
        i=e+1
    return ''.join(out)
def _laymob(css):
    import re as _re
    extra=[]
    for m in _re.finditer(r'@media \(max-width:(820|1020|1180)px\)\{',css):
        e=_match(css,m.end()-1)
        extra.append((int(m.group(1)),_prefix_block(css[m.end():e])))
    extra.sort(key=lambda x:-x[0])   # 1180 puis 1020 puis 820, comme en cascade réelle
    return css+'\n/* mode mobile forcé */\n'+'\n'.join(b for _,b in extra)+'\n'
css=_laymob(css)
body=open('body.html',encoding='utf-8').read()
body=re.sub(r'\{\{ic:([a-z\-]+)\}\}', lambda m: svg(m.group(1)), body)
loader=open('loader.js',encoding='utf-8').read()
import hashlib
BUILD=hashlib.sha1((css+body+loader+app).encode('utf-8')).hexdigest()[:10]
O=os.environ.get('ECO_OUT','/mnt/user-data/outputs/')
def head(manifest=None, icon=None):
    h=['<!DOCTYPE html>','<html lang="fr">','<head>','<meta charset="UTF-8">',
       '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
       '<meta name="theme-color" content="#FBF8F3">',
       '<meta name="apple-mobile-web-app-capable" content="yes">','<meta name="mobile-web-app-capable" content="yes">',
       '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
       '<meta name="apple-mobile-web-app-title" content="Économat">']
    if manifest: h.append('<link rel="manifest" href="%s">'%manifest)
    if icon: h.append('<link rel="apple-touch-icon" href="%s">'%icon)
    h.append('<title>Économat Pro</title>')
    h.append('<style>'+css+'</style>')
    h.append('<script>window.ECO_SERVER={url:"",key:""};window.ECO_BUILD="'+BUILD+'";</script>')   # serveur intégré (rempli par « Télécharger l’appli préconfigurée »)
    h.append('<script>'+open('theme.js',encoding='utf-8').read()+'</script>')
    h.append('</head>')
    return '\n'.join(h)
SWREG='''<script>
// Service worker : installation de l'appli et fonctionnement hors connexion
if('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && document.querySelector('link[rel=manifest]')){
  window.addEventListener('load',function(){ navigator.serviceWorker.register('./sw.js').catch(function(e){ console.log('Service worker non enregistré :', e && e.message); }); });
}
</script>'''
def page(manifest=None, icon=None):
    return (head(manifest,icon)+'\n'+body.replace('</body>','')+'\n<script>\n'+loader+'</script>\n'
            +'<script type="text/x-app" id="app-src">\n'+app+'\n</script>\n'+SWREG+'\n</body>\n</html>\n')
targets={
 'economat-pro/index.html':('manifest.json','icons/apple-touch-icon.png'),
 'economat-pwa/index.html':('manifest.json','icons/apple-touch-icon.png'),
 'pwa-pc/index.html':('manifest.json','icons/apple-touch-icon.png'),
 'pwa-iphone/index.html':('manifest.json','apple-touch-icon.png'),
 'economat-v4.html':(None,None),
 'economat-mobile-new.html':(None,None),
}
os.makedirs(O+'economat-pro/icons',exist_ok=True)
for t,(m,i) in targets.items():
    open(O+t,'w',encoding='utf-8').write(page(m,i))
    print('wrote',t,os.path.getsize(O+t))
# copie de travail pour les tests
open('index.html','w',encoding='utf-8').write(page())

# ── Fichiers PWA ──
import copy
sw=open('sw_template.js',encoding='utf-8').read()
def manifest(prefix, name, short):
    ic=lambda f,s,pu: {"src":prefix+f,"sizes":s,"type":"image/png","purpose":pu}
    return {"name":name,"short_name":short,"description":"Bons d’économat, recettes, fiches techniques, allergènes et fournisseurs pour la boulangerie",
      "start_url":"./index.html","scope":"./","display":"standalone","background_color":"#FBF8F3","theme_color":"#FBF8F3",
      "icons":[ic('icon-192.png','192x192','any'),ic('icon-192.png','192x192','maskable'),ic('icon-512.png','512x512','any'),ic('icon-512.png','512x512','maskable'),ic('apple-touch-icon.png','180x180','any')],
      "display_override":["window-controls-overlay","standalone","browser"],"categories":["business","productivity","food"],"lang":"fr"}
for folder,prefix in [('economat-pro','icons/'),('economat-pwa','icons/'),('pwa-pc','icons/'),('pwa-iphone','')]:
    d=O+folder+'/'
    os.makedirs(d+prefix,exist_ok=True)
    for f in ['icon-192.png','icon-512.png','apple-touch-icon.png']: shutil.copy('icons/'+f,d+prefix+f)
    json.dump(manifest(prefix,'Économat Pro','Économat'),open(d+'manifest.json','w',encoding='utf-8'),ensure_ascii=False,indent=2)
    assets=['./','./index.html','./manifest.json','./'+prefix+'icon-192.png','./'+prefix+'icon-512.png','./'+prefix+'apple-touch-icon.png']
    open(d+'sw.js','w',encoding='utf-8').write(sw.replace('__ASSETS__',json.dumps(assets)).replace("const CACHE_NAME = 'economat-v3';","const CACHE_NAME = 'economat-"+BUILD+"';"))
    shutil.copy('INSTALLATION.md',d+'INSTALLATION.md')
    shutil.copy('PARTAGE.md',d+'PARTAGE.md'); shutil.copy('../cloud/supabase-setup.sql',d+'supabase-setup.sql')
    if os.path.exists('../cloud/supabase-update-v5.sql'): shutil.copy('../cloud/supabase-update-v5.sql',d+'supabase-update-v5.sql')
print('pwa ok', BUILD)
