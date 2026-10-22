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
with sync_playwright() as p:
    b=p.chromium.launch()
    A=newpage(b); A.goto(APP); A.wait_for_timeout(1200)
    A.evaluate("['Quiche lorraine','Feuilleté saucisse','Mini burger'].forEach((n,i)=>recipes.push({id:'tr'+i,name:n,cat:'Traiteur',image:'📖',notes:'',items:[{id:'x'+i,type:'ingredient',refId:ingredients[i].id,qty:0.5,unit:'kg'}],createdAt:now(),updatedAt:now()})); persist();")
    gate_server(A)
    signup(A,'Emmanuel','emmanuel@test.fr'); A.click("text=Oui, ce sont les miennes"); ok(wait_sync(A),'Emmanuel connecté')
    A.click('#nav-partage'); A.wait_for_timeout(300); ok(A.evaluate("CUR")=='partage' and A.evaluate("document.getElementById('nav-partage').classList.contains('on')"),'entrée « Partage » dans la barre')
    names=["Quiche lorraine","Feuilleté saucisse","Mini burger"]; print(names)
    A.click('#nav-partage'); A.wait_for_timeout(300)
    A.click("text=Les miens"); A.wait_for_timeout(200)
    A.evaluate("partPick('Stage traiteur',true)"); A.wait_for_timeout(300)
    for n in names[:3]: A.locator('#pk-list label.pk-it', has_text=n).first.click()
    ok('Partager 3 éléments' in A.inner_text('#pk-foot'),'sélection de 3 recettes')
    A.screenshot(path=OUT+'part_pick.png')
    A.click('#pk-foot .btn-gold'); A.wait_for_timeout(300)
    ok('Stage traiteur' in A.inner_text('#part-body') and '3 recettes' in A.inner_text('#part-body'),'dossier « Stage traiteur » (3 recettes) dans Mes partages')
    ok(wait_sync(A),'synchro')
    ok(db("select count(*) from shared_recipes where not deleted and data->>'folder'='Stage traiteur'")=='3','serveur : 3 recettes dans le dossier')
    A.screenshot(path=OUT+'part_mine.png')
    # Paul
    link=A.evaluate("clInviteLink()")
    B=newpage(b,True); B.goto(APP); B.wait_for_timeout(900); B.goto(link); B.wait_for_timeout(1400)
    signup(B,'Paul','paul@test.fr'); ok(wait_sync(B),'Paul connecté')
    B.click('#bn-partage'); B.wait_for_timeout(900); wait_sync(B); B.evaluate("renderPartage()")
    t=B.inner_text('#part-body')
    ok('Emmanuel' in t and B.locator('#part-body .pf').count()==1 and 'Stage traiteur' not in t,'Paul voit d’abord un dossier au nom du compte (Emmanuel)')
    B.screenshot(path=OUT+'part_others_m.png')
    B.locator('#part-body .pf').first.click(); B.wait_for_timeout(300)
    t=B.inner_text('#part-body')
    ok('Stage traiteur' in t and 'Emmanuel' in t and '3 recettes' in t,'dans le compte : le dossier « Stage traiteur » (3 recettes)')
    ok(B.locator('#part-body .pf-acts').count()==0,'Paul ne peut pas modifier le dossier')
    B.screenshot(path=OUT+'part_account_m.png')
    B.locator('#part-body .pf').first.click(); B.wait_for_timeout(300)
    ok(B.locator('#part-body .rt').count()==3,'dossier ouvert : 3 recettes')
    B.screenshot(path=OUT+'part_folder_m.png')
    nr=B.evaluate("recipes.length")
    B.click('#pf-copyall'); B.wait_for_timeout(1200)
    ok(B.evaluate("recipes.filter(r=>r.fromShared&&r.cat==='Stage traiteur').length")==3,'dossier copié : 3 recettes dans la catégorie « Stage traiteur »')
    ok('Déjà copié' in B.inner_text('#part-body'),'bouton « Déjà copié »')
    ok(B.locator('#part-body .rt-badge').count()==3,'badges « Copiée »')
    B.locator('#part-body .rt').first.click(); B.wait_for_timeout(300)
    ok('Ne plus partager' not in B.inner_text('#shr-foot'),'fiche : pas de modification pour Paul'); B.evaluate("closeMod('m-shr')")
    # Emmanuel renomme, ajoute via l'éditeur, puis arrête
    A.evaluate("askText=function(t,p,cb){cb('Stage traiteur 2026')}; partRename('Stage traiteur')"); A.wait_for_timeout(200)
    rid=A.evaluate("recipes.find(r=>!r.shared).id")
    A.evaluate("openEditRec('%s')"%rid); A.wait_for_timeout(300)
    A.check('#r-shared'); A.wait_for_timeout(100)
    ok(A.is_visible('#r-shfold select'),'éditeur : choix du dossier partagé')
    A.select_option('#r-shfold select','Stage traiteur 2026'); A.evaluate("saveRecipe()"); A.wait_for_timeout(300)
    ok(A.evaluate("recipes.find(r=>r.id==='%s').shareFolder"%rid)=='Stage traiteur 2026','recette ajoutée au dossier depuis l’éditeur')
    ok(wait_sync(A),'synchro')
    ok(db("select count(*) from shared_recipes where not deleted and data->>'folder'='Stage traiteur 2026'")=='4','serveur : dossier renommé, 4 recettes')
    sync(B); B.evaluate("PART.open=null;renderPartage()")
    ok('Stage traiteur 2026' in B.inner_text('#part-body') and '4 recettes' in B.inner_text('#part-body'),'Paul voit le dossier renommé (4 recettes)')
    A.evaluate("partShareCat()"); A.wait_for_timeout(200); cat=A.evaluate("recipes[recipes.length-1].cat")
    A.locator('#pk-body .pf', has_text=cat).first.click(); A.wait_for_timeout(200)
    ncat=A.evaluate("recipes.filter(r=>r.cat==='%s').length"%cat)
    ok(A.evaluate("recipes.filter(r=>r.shared&&r.shareFolder==='%s').length"%cat)==ncat,'catégorie « %s » partagée en entier (%d)'%(cat,ncat))
    A.evaluate("partStopFolder('Stage traiteur 2026')"); ok(wait_sync(A),'synchro arrêt')
    ok(not A.evaluate("recipes.some(r=>r.shareFolder==='Stage traiteur 2026')"),'arrêt conservé après la synchro (pas écrasé par le serveur)')
    ok(db("select count(*) from shared_recipes where not deleted and data->>'folder'='Stage traiteur 2026'")=='0','dossier retiré du serveur')
    sync(B); B.evaluate("renderPartage()")
    ok('Stage traiteur 2026' not in B.inner_text('#part-body'),'Paul ne le voit plus')
    ok(B.evaluate("recipes.filter(r=>r.cat==='Stage traiteur').length")==3,'les copies de Paul restent')
    # Recettes : plus d'onglet, le lien du compte mène au Partage
    A.evaluate("goPage('recettes')"); ok(not A.is_visible('#rec-tabs'),'plus d’onglet Partagées dans Recettes')
    ok(not A.errs and not B.errs,'aucune erreur JS '+str(A.errs+B.errs))
    b.close()
print('%d/%d PASS'%(sum(res),len(res)))
