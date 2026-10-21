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
import base64
def card(pg): return ui_text(pg)
with sync_playwright() as p:
    b=p.chromium.launch()
    A=newpage(b); A.goto(APP); A.wait_for_timeout(1200)
    gate_server(A)
    signup(A,'Emmanuel','emmanuel@test.fr'); ok(wait_sync(A),'Emmanuel (1er compte) connecté')
    ok(A.evaluate("clIsAdmin()") and A.is_visible('#nav-admin'),'1er compte = administrateur, entrée « Administration » visible')
    ok('Ouvrir l’administration' in card(A),'Réglages : bouton Administration')
    link=A.evaluate("clInviteLink()")
    ok('"c":' in base64.urlsafe_b64decode(link.split('rejoindre=')[1]+'==').decode(),'lien de l’admin : contient le code d’invitation')
    # Paul via le lien admin → actif
    B=newpage(b,True); B.goto(APP); B.wait_for_timeout(900); B.goto(link); B.wait_for_timeout(1400)
    signup(B,'Paul','paul@test.fr'); ok(wait_sync(B),'Paul (lien admin) : actif, synchronisé')
    ok(not B.evaluate("clIsAdmin()") and not B.is_visible('#nav-admin') if B.locator('#nav-admin').count() else True,'Paul n’est pas admin')
    # Julie sans code → en attente
    plain=link.split('rejoindre=')[0]+'rejoindre='+base64.urlsafe_b64encode(('{"u":"%s","k":"%s","by":"Paul"}'%(URL,KEY)).encode()).decode().rstrip('=')
    C=newpage(b,True); C.goto(APP); C.wait_for_timeout(900); C.goto(plain); C.wait_for_timeout(1400)
    C.evaluate("recipes.push({id:'rj',name:'Recette de Julie',cat:'Boulangerie',image:'📖',notes:'',items:[],createdAt:now(),updatedAt:now()}); persist();")
    signup(C,'Julie','julie@test.fr'); C.wait_for_timeout(500)
    if 'sont-elles à toi' in card(C).lower(): C.click("text=Oui, ce sont les miennes"); C.wait_for_timeout(1500)
    t=card(C); ok('attend' in t,'Julie (sans lien admin) : en attente de validation')
    C.screenshot(path=OUT+'adm_pending_m.png')
    ok(db("select count(*) from user_docs d join auth.users u on u.id=d.user_id where u.email='julie@test.fr'")=='0','en attente : rien envoyé')
    # Emmanuel voit l'inscription
    sync(A); A.evaluate("goPage('admin')"); A.wait_for_timeout(1500)
    t=A.inner_text('#adm-wrap').upper(); ok('À VALIDER · 1' in t and 'JULIE' in t,'Admin : Julie à valider') if False else None
    ok('À VALIDER · 1' in t and 'JULIE' in t,'Admin : Julie à valider')
    ok(A.evaluate("document.getElementById('nd-admin').textContent")=='1','pastille « 1 » sur Administration')
    A.screenshot(path=OUT+'adm_page.png', full_page=True)
    A.click("#adm-wrap .adm-u.pend .btn-gold"); A.wait_for_timeout(1200)
    ok('À VALIDER · 0' in A.inner_text('#adm-wrap').upper(),'Julie validée')
    C.wait_for_timeout(22000); ok(wait_sync(C,15000),'Julie : compte validé, synchro démarrée toute seule')
    ok(db("select count(*) from user_docs where id='rj'")=='1','Julie : données envoyées après validation')
    # Paul partage un dossier ; l'admin le retire
    B.evaluate("['Quiche','Burger'].forEach((n,i)=>recipes.push({id:'pb'+i,name:n,cat:'Traiteur',image:'📖',notes:'',items:[{id:'q'+i,type:'ingredient',refId:ingredients[0].id,qty:1,unit:'kg'}],createdAt:now(),updatedAt:now(),shared:true,shareFolder:'Stage'})); persist();")
    ok(wait_sync(B) and db("select count(*) from shared_recipes where not deleted and data->>'folder'='Stage'")=='2','Paul partage le dossier « Stage »')
    sync(A); A.evaluate("ADM.users=null;ADM.open={accts:true,del:true,shares:true};renderAdmin()"); A.wait_for_timeout(1200)
    ok('Stage' in A.inner_text('#adm-wrap'),'Admin : voit le dossier de Paul')
    A.locator('#adm-wrap .adm-fh', has_text='Stage').locator('button').click(); A.wait_for_timeout(1500)
    ok(db("select count(*) from shared_recipes where not deleted and data->>'folder'='Stage'")=='0','dossier retiré par l’admin')
    sync(B); B.wait_for_timeout(500); sync(B)
    ok(B.evaluate("recipes.filter(r=>r.shared).length")==0,'chez Paul : recettes plus partagées (prévenu)')
    ok(db("select count(*) from shared_recipes where not deleted and owner=(select id from auth.users where email='paul@test.fr')")=='0','pas republié par Paul')
    ok(B.evaluate("recipes.some(r=>r.name==='Quiche')"),'les recettes restent chez Paul')
    # bloquer / débloquer
    A.evaluate("ADM.users=null;ADM.open={accts:true,del:true,shares:true};renderAdmin()"); A.wait_for_timeout(1200)
    A.locator('#adm-wrap .adm-u', has_text='Paul').locator("button:has-text('Bloquer')").click(); A.wait_for_timeout(1200)
    sync(B); ok(B.evaluate("CLOUD.status")=='blocked' and 'bloqué' in card(B),'Paul bloqué : synchro arrêtée, message affiché')
    A.evaluate("ADM.users=null;ADM.open={accts:true,del:true,shares:true};renderAdmin()"); A.wait_for_timeout(1200)
    A.locator('#adm-wrap .adm-u', has_text='Paul').locator("button:has-text('Débloquer')").click(); A.wait_for_timeout(1200)
    ok(sync(B) and B.evaluate("CLOUD.status")=='ok','Paul débloqué')
    # nommer admin
    A.locator('#adm-wrap .adm-u', has_text='Julie').locator("button:has-text('Nommer admin')").click(); A.wait_for_timeout(1200)
    sync(C); ok(C.evaluate("clIsAdmin()"),'Julie nommée administratrice')
    # supprimer
    A.evaluate("ADM.users=null;ADM.open={accts:true,del:true,shares:true};renderAdmin()"); A.wait_for_timeout(1200)
    A.locator('#adm-wrap .adm-u', has_text='Paul').locator(".icbtn").click(); A.wait_for_timeout(1500)
    ok(db("select status from profiles p join auth.users u on u.id=p.id where u.email='paul@test.fr'")=='deleted' and db("select count(*) from user_docs d join auth.users u on u.id=d.user_id where u.email='paul@test.fr'")=='0','Paul supprimé : espace en ligne effacé')
    sync(B); ok(B.evaluate("CLOUD.status")=='deleted','Paul : « compte supprimé »')
    # non-admin ne peut rien
    ok('Réservé' in B.evaluate("clRpc('admin_set_approval',{p_on:false}).then(()=>'ok',e=>e.message)"),'non-admin : actions refusées par le serveur')
    ok(not A.errs and not C.errs,'aucune erreur JS '+str(A.errs+C.errs))
    A.set_viewport_size({'width':390,'height':844}); A.evaluate("ADM.users=null;goPage('admin')"); A.wait_for_timeout(1500); A.screenshot(path=OUT+'adm_page_m.png')
    ok(A.evaluate("document.documentElement.scrollWidth<=window.innerWidth+1"),'mobile : pas de débordement')
    b.close()
print('%d/%d PASS'%(sum(res),len(res)))
