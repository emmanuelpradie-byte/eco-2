"""Construit l'appli et met à jour les fichiers du site (à la racine du dépôt).
Usage (depuis la racine du dépôt) : python3 source/publier.py"""
import os, shutil, subprocess, tempfile, sys
here=os.path.dirname(os.path.abspath(__file__)); root=os.path.dirname(here)
out=tempfile.mkdtemp()+'/'
for d in ['economat-pro/icons','economat-pwa','pwa-pc','pwa-iphone']: os.makedirs(out+d,exist_ok=True)
env=dict(os.environ,ECO_OUT=out)
r=subprocess.run([sys.executable,'build.py'],cwd=os.path.join(here,'uni'),env=env)
if r.returncode: sys.exit('Échec de la construction')
site=out+'economat-pro/'
# appli préconfigurée : on garde l'adresse du serveur déjà présente dans le site
import re
old=os.path.join(root,'index.html'); keep=None
if os.path.exists(old):
    m=re.search(r'window\.ECO_SERVER=\{[^}]*\};',open(old,encoding='utf-8').read())
    if m and '"url":"http' in m.group(0): keep=m.group(0)
if keep:
    h=open(site+'index.html',encoding='utf-8').read()
    h=re.sub(r'window\.ECO_SERVER=\{[^}]*\};',lambda _:keep,h,count=1)
    open(site+'index.html','w',encoding='utf-8').write(h); print('Serveur intégré conservé')
for f in ['index.html','sw.js','manifest.json']: shutil.copy(site+f,os.path.join(root,f))
os.makedirs(os.path.join(root,'icons'),exist_ok=True)
for f in os.listdir(site+'icons'): shutil.copy(site+'icons/'+f,os.path.join(root,'icons',f))
print('Site mis à jour : index.html, sw.js, manifest.json, icons/')
