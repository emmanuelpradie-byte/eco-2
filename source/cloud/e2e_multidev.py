import json, subprocess, time, os
from playwright.sync_api import sync_playwright
APP='http://localhost:8800/index.html'
URL='http://localhost:8787'; KEY='test-anon-key-0123456789abcdef'
OUT='/tmp/claude-0/-home-claude/68738804-a68f-5f46-9b52-b8b51de84108/scratchpad/uni/shots/'
D='/tmp/claude-0/-home-claude/68738804-a68f-5f46-9b52-b8b51de84108/scratchpad/cloud/'
IMG='/tmp/claude-0/-home-claude/68738804-a68f-5f46-9b52-b8b51de84108/scratchpad/uni/icons/icon-512.png'
res=[]
def ok(c,n): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n, flush=True)
def db(sql): return subprocess.run(['psql','-h','/tmp/pgtest','-p','54329','-U','postgres','-d','eco','-At','-c',sql],capture_output=True,text=True).stdout.strip()
def wait_sync(pg,ms=9000):
    pg.wait_for_timeout(700); t=time.time()
    while time.time()-t<ms/1000:
        st=pg.evaluate("({s:CLOUD.status,q:CLOUD.st?Object.keys(CLOUD.st.queue).length+Object.keys(CLOUD.st.attUp).length:0,b:CLOUD.busy,r:CLOUD.st&&CLOUD.st.ready})")
        if st['s']=='ok' and st['q']==0 and not st['b'] and st['r']: return True
        pg.wait_for_timeout(150)
    print('   sync state',pg.evaluate("({s:CLOUD.status,m:CLOUD.msg,q:CLOUD.st&&Object.keys(CLOUD.st.queue),a:CLOUD.st&&CLOUD.st.attUp,r:CLOUD.st&&CLOUD.st.ready})")); return False
def sync(pg): pg.evaluate("clSync()"); return wait_sync(pg)
def newpage(b,mobile=False):
    ctx=b.new_context(viewport={'width':390,'height':844} if mobile else {'width':1280,'height':860}, has_touch=mobile, accept_downloads=True)
    pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e))); pg.errs=errs; pg.ctx=ctx
    pg.on('dialog',lambda d: d.accept())
    return pg
def gated(pg): return pg.evaluate("document.documentElement.classList.contains('gated')")
def ui_text(pg):
    # écran de connexion s'il est affiché, sinon la carte « Espace en ligne » des Réglages
    if gated(pg): return pg.inner_text('#gate')
    pg.evaluate("goPage('backup')"); pg.wait_for_timeout(300); return pg.inner_text('#cl-card')
def gate_server(pg):
    pg.click('#gate summary'); pg.fill('#g-url',URL); pg.fill('#g-key',KEY); pg.click("#gate button:has-text('Enregistrer le serveur')"); pg.wait_for_timeout(700)
def gate_auth(pg,mode,email,name=None,pw='motdepasse'):
    want='Créer mon compte' if mode=='signup' else 'Se connecter'
    if want not in pg.inner_text('#gate'): pg.click('#gate .gate-sw'); pg.wait_for_timeout(200)
    if name and pg.locator('#g-name').count(): pg.fill('#g-name',name)
    pg.fill('#g-email',email); pg.fill('#g-pw',pw); pg.click('#g-go'); pg.wait_for_timeout(2000)
def signup(pg,name,email,pw='motdepasse'): gate_auth(pg,'signup',email,name,pw)
def lowtxt(pg): return ui_text(pg).lower()

def live(): return db("select string_agg(data->>'name',',' order by data->>'name') from shared_recipes where not deleted")
with sync_playwright() as p:
    b=p.chromium.launch()
    A=newpage(b); A.goto(APP); A.wait_for_timeout(1200)
    gate_server(A); signup(A,'Emmanuel','emmanuel@test.fr')
    if 'sont-elles' in A.inner_text('#gate').lower(): A.click("text=Oui, ce sont les miennes")
    ok(wait_sync(A),'PC connecté')
    names=A.evaluate("(()=>{var a=recipes.slice(0,2); a.forEach(r=>{r.shared=true;r.updatedAt=now();}); persist(); return a.map(r=>r.name);})()")
    ok(sync(A),'PC : partage de 2 recettes')
    ok(live()==','.join(sorted(names)),'serveur : 2 partages '+str(live()))
    # téléphone : même compte
    T=newpage(b,True); T.goto(APP); T.wait_for_timeout(1200); gate_server(T); gate_auth(T,'login','emmanuel@test.fr')
    if 'sont-elles' in T.inner_text('#gate').lower(): T.click("text=Non")
    ok(wait_sync(T,15000),'téléphone connecté')
    ok(T.evaluate("recipes.filter(r=>r.shared).length")==2,'téléphone : les 2 recettes apparaissent partagées')
    # copie ancienne sur le téléphone (drapeau absent, pas modifiée localement)
    T.evaluate("recipes.forEach(r=>{delete r.shared;})")
    T.evaluate("clPublish()"); T.wait_for_timeout(1500)
    ok(live()==','.join(sorted(names)),'copie ancienne du téléphone : les partages du PC ne sont PAS effacés')
    T.reload(); T.wait_for_timeout(1500); wait_sync(T,15000)
    # retrait volontaire depuis le téléphone
    T.evaluate("(()=>{var r=recipes.find(x=>x.name===%s); delete r.shared; delete r.shareFolder; r.updatedAt=now(); persist();})()"%json.dumps(names[0]))
    ok(sync(T),'téléphone : retire une recette du partage')
    ok(live()==names[1],'serveur : retrait volontaire appliqué ('+str(live())+')')
    ok(sync(A) and sync(A),'PC resynchronisé')
    ok(A.evaluate("recipes.filter(r=>r.shared).map(r=>r.name)")==[names[1]],'PC : la recette retirée n’est plus cochée, l’autre reste')
    ok(live()==names[1],'PC ne republie pas la recette retirée')
    # retrait par l'administrateur
    sid=db("select id from shared_recipes where not deleted")
    A.evaluate("clRpc('admin_unshare',{p_id:'%s'})"%sid); A.wait_for_timeout(800)
    ok(db("select data->>'by' from shared_recipes where id='%s'"%sid)=='admin','retrait admin marqué')
    ok(sync(T),'téléphone resynchronisé')
    ok(T.evaluate("recipes.filter(r=>r.shared).length")==0,'téléphone : recette décochée après retrait par l’admin')
    ok(sync(A) and sync(A) and live() is '' or live()=='','personne ne la republie')
    ok(not A.errs and not T.errs,'pas d’erreur JS '+str((A.errs+T.errs)[:2]))
    b.close()
print('%d PASS %d FAIL'%(res.count(True),res.count(False)))
