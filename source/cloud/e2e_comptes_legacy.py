import json, subprocess, time, os
from playwright.sync_api import sync_playwright
APP='http://localhost:8800/index.html'
URL='http://localhost:8787'; KEY='test-anon-key-0123456789abcdef'
OUT='/tmp/claude-0/-home-claude/68738804-a68f-5f46-9b52-b8b51de84108/scratchpad/uni/shots/'
D='/tmp/claude-0/-home-claude/68738804-a68f-5f46-9b52-b8b51de84108/scratchpad/cloud/'
PDF=D+'fiche-baguette.pdf'
open(PDF,'wb').write(b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]/Contents 4 0 R/Resources<<>>>>endobj 4 0 obj<</Length 44>>stream\nBT /F1 18 Tf 30 100 Td (Fiche baguette) Tj ET\nendstream endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n")
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
def auth(pg,mode,email,name=None): gate_auth(pg,mode,email,name)
def names(pg): return pg.evaluate("recipes.map(r=>r.name)")
def logout(pg):
    pg.evaluate("goPage('backup')"); pg.wait_for_timeout(300)
    pg.evaluate("clLogout()"); pg.wait_for_timeout(1800)
with sync_playwright() as p:
    db("update settings set value='false'::jsonb where key='require_approval'")
    b=p.chromium.launch(); A=newpage(b); A.goto(APP); A.wait_for_timeout(1200)
    A.evaluate("recipes.push({id:'leg',name:'Ancienne recette',cat:'Boulangerie',image:'📖',notes:'',items:[],createdAt:now(),updatedAt:now()}); persist();")
    gate_server(A)
    signup(A,'Emmanuel','emmanuel@test.fr')
    A.click("text=Oui, ce sont les miennes"); wait_sync(A)
    A.evaluate("LS.removeItem('v4_owner'); LS.removeItem('v4_acctv'); LS.flush()"); A.wait_for_timeout(300)
    A.reload(); A.wait_for_timeout(2000); wait_sync(A)
    A.evaluate("goPage('backup')"); A.wait_for_timeout(300)
    ok(A.evaluate("LS.getItem('v4_owner')")==A.evaluate("clUid()") and 'sont-elles' not in lowtxt(A) and 'Ancienne recette' in A.evaluate("recipes.map(r=>r.name).join()"),'appareil déjà connecté avant la mise à jour : aucune question, données gardées')
    b.close()
print('%d/%d PASS'%(sum(res),len(res)))
