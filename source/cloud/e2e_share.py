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
    # ── Emmanuel : configure le serveur, crée son compte ──
    A=newpage(b); A.goto(APP); A.wait_for_timeout(1200)
    nrA=A.evaluate("recipes.length"); niA=A.evaluate("ingredients.length")
    gate_server(A)
    signup(A,'Emmanuel','emmanuel@test.fr')
    ok(wait_sync(A),'Emmanuel connecté, espace vide → données de l’appareil envoyées')
    ok(db("select count(*) from user_docs where kind='rec'")==str(nrA) and db("select count(*) from user_docs where kind='ing'")==str(niA),'serveur : %d recettes, %d ingrédients'%(nrA,niA))
    # documents + partage dans l'éditeur
    rid=A.evaluate("recipes[0].id"); rname=A.evaluate("recipes[0].name")
    A.evaluate("openEditRec('%s')"%rid); A.wait_for_timeout(300)
    ok(A.is_visible('#r-share-card') and A.is_visible('#r-docs-card'),'éditeur : cartes Documents et Partager visibles')
    A.set_input_files('#r-att-file',[PDF,IMG]); A.wait_for_timeout(900)
    ok(A.locator('#r-att .att-r').count()==2,'2 documents joints (PDF + image)')
    A.locator('#r-att .att-n').first.click(); A.wait_for_timeout(700)
    ok(A.locator('#att-body iframe.att-pdf').count()==1,'PDF affiché dans la visionneuse')
    A.screenshot(path=OUT+'share_pdf_view.png'); A.evaluate("attClose()")
    A.check('#r-shared'); A.evaluate("saveRecipe()"); A.wait_for_timeout(300)
    ok(A.evaluate("CUR")=='recettes' and A.evaluate("recipes.find(r=>r.id==='%s').attachments.length"%rid)==2 and A.evaluate("recipes.find(r=>r.id==='%s').shared"%rid),'recette enregistrée avec documents + partagée')
    ok(wait_sync(A),'synchro après partage')
    ok(db("select count(*) from attachments")=='2','2 documents sur le serveur')
    ok(db("select owner_name||'|'||(data->>'name')||'|'||jsonb_array_length(data->'attachments') from shared_recipes where not deleted")=='Emmanuel|%s|2'%rname,'recette partagée publiée (auteur, nom, documents)')
    A.evaluate("goPage('recettes')"); A.wait_for_timeout(200); A.screenshot(path=OUT+'share_tiles_mine.png')
    # ── Paul : invitation ──
    link=A.evaluate("clInviteLink()")
    B=newpage(b,True); B.goto(APP); B.wait_for_timeout(900)
    B.evaluate("recipes.push({id:'rpaul',name:'Pain de Paul (privé)',cat:'Boulangerie',items:[{id:'x',type:'ingredient',refId:ingredients[0].id,qty:1,unit:'kg'}]}); persist();")
    B.goto(link); B.wait_for_timeout(1400)
    ok('Emmanuel' in ui_text(B) and 'invite' in ui_text(B),'invitation : « Emmanuel t’invite »')
    signup(B,'Paul','paul@test.fr')
    ok('sont-elles à toi' in lowtxt(B),'Paul : l’appli demande si les recettes de l’appareil sont à lui')
    B.click("text=Oui, ce sont les miennes"); ok(wait_sync(B),'Paul a son propre espace')
    ok(B.evaluate("recipes.some(r=>r.id==='rpaul')"),'Paul garde ses recettes')
    ok(db("select count(*) from user_docs d join auth.users u on u.id=d.user_id where u.email='paul@test.fr' and kind='rec'")==str(B.evaluate("recipes.length")),'espace de Paul envoyé')
    # Recettes partagées
    B.evaluate("goPage('partage')"); B.wait_for_timeout(800)
    ok(B.locator('#part-body .pf').count()==1 and 'Emmanuel' in B.inner_text('#part-body'),'Partage : un dossier au nom du compte qui partage')
    B.locator('#part-body .pf').first.click(); B.wait_for_timeout(300)
    ok(B.locator('#part-body .rt').count()==1 and 'Emmanuel' in B.inner_text('#part-body'),'Paul voit la recette partagée d’Emmanuel')
    ok(not B.evaluate("Object.values(CLOUD.shared).some(x=>x.data&&x.data.name==='Pain de Paul (privé)')"),'recettes privées de Paul non partagées')
    B.screenshot(path=OUT+'share_tab_m.png')
    B.locator('#part-body .rt').first.click(); B.wait_for_timeout(400)
    ok(B.locator('#shr-body .shr-i').count()>=2 and B.locator('#shr-body .att-r').count()==2,'fiche partagée : composition + 2 documents')
    ok('Ne plus partager' not in B.inner_text('#shr-foot') and 'Copier' in B.inner_text('#shr-foot'),'Paul : pas de modification possible, seulement copier')
    B.screenshot(path=OUT+'share_view_m.png')
    B.evaluate("shrOpenAtt(1)"); B.wait_for_timeout(900)
    ok(B.locator('#att-body img.att-img').count()==1,'Paul ouvre l’image (récupérée sur le serveur)')
    B.evaluate("attClose()"); B.wait_for_timeout(300)
    # Paul tente de modifier la recette d'Emmanuel par l'API
    sid=B.evaluate("Object.keys(CLOUD.shared)[0]")
    r=B.evaluate("clUpsert('shared_recipes','id',[{id:'%s',owner:clUid(),owner_name:'Pirate',data:{name:'piraté'},deleted:false}]).then(()=>'ok',e=>'refusé '+e.status)"%sid)
    ok(r.startswith('refusé') and db("select data->>'name' from shared_recipes where id='%s'"%sid)==rname,'Paul ne peut pas modifier la recette d’Emmanuel (%s)'%r)
    r=B.evaluate("clUpsert('shared_recipes','id',[{id:'%s',owner:'%s',owner_name:'Pirate',data:{name:'piraté'},deleted:true}]).then(()=>'ok',e=>'refusé '+e.status)"%(sid,db("select id from auth.users where email='emmanuel@test.fr'")))
    ok(r.startswith('refusé'),'ni la supprimer en se faisant passer pour lui')
    # Copier dans mes recettes
    nrB=B.evaluate("recipes.length"); niB=B.evaluate("ingredients.length")
    B.evaluate("openShared('%s')"%sid); B.wait_for_timeout(300); B.click('#shr-copy'); B.wait_for_timeout(1200)
    cp=B.evaluate("recipes.find(r=>r.fromShared&&r.fromShared.id==='%s')"%sid)
    ok(cp and cp['name']==rname and len(cp.get('attachments',[]))==2,'copie dans les recettes de Paul, avec ses 2 documents')
    ok(B.evaluate("ingredients.length")==niB,'ingrédients reconnus dans le catalogue de Paul (aucun doublon)')
    ok(wait_sync(B),'copie envoyée dans l’espace de Paul')
    ok(db("select count(*) from attachments a join auth.users u on u.id=a.owner where u.email='paul@test.fr'")=='2','documents copiés appartiennent à Paul')
    # ── Emmanuel modifie sa recette partagée ──
    A.evaluate("var r=recipes.find(r=>r.id==='%s'); r.name='%s v2'; r.updatedAt=now(); persist();"%(rid,rname)); ok(wait_sync(A),'Emmanuel modifie sa recette')
    ok(db("select data->>'name' from shared_recipes where id='%s'"%sid)==rname+' v2','partage mis à jour automatiquement')
    sync(B); B.evaluate("renderPartage()")
    ok(rname+' v2' in B.inner_text('#part-body'),'Paul voit la nouvelle version')
    ok(B.evaluate("recipes.find(r=>r.fromShared&&r.fromShared.id==='%s').name"%sid)==rname,'la copie de Paul ne change pas')
    # prix modifié dans le catalogue d'Emmanuel → coût republié
    c0=float(db("select data->>'cost' from shared_recipes where id='%s'"%sid))
    A.evaluate("var r=recipes.find(r=>r.id==='%s'); var it=r.items.find(i=>i.type==='ingredient'); var g=ingredients.find(x=>x.id===it.refId); g.price=g.price*2+1; persist();"%rid); wait_sync(A)
    ok(float(db("select data->>'cost' from shared_recipes where id='%s'"%sid))>c0,'changement de prix → coût partagé mis à jour')
    # ── Emmanuel ne voit pas l'espace de Paul ──
    n=A.evaluate("clFetch('/rest/v1/user_docs?select=id&kind=eq.rec').then(r=>r.length)")
    ok(n==nrA,'Emmanuel ne voit que ses propres données (%d)'%n)
    # ── deuxième appareil d'Emmanuel : choix ──
    A2=newpage(b); A2.goto(link); A2.wait_for_timeout(1200)
    gate_auth(A2,'login','emmanuel@test.fr')
    ok(A2.locator('.cl-opt').count()==0,'2e appareil vierge : aucune question')
    ok(wait_sync(A2),'espace en ligne chargé')
    ok(A2.evaluate("recipes.find(r=>r.id==='%s')&&recipes.find(r=>r.id==='%s').name"%(rid,rid))==rname+' v2' and A2.evaluate("recipes.length")==A.evaluate("recipes.length"),'2e appareil identique au premier')
    A2.evaluate("openEditRec('%s')"%rid); A2.wait_for_timeout(300)
    ok('en ligne' in A2.inner_text('#r-att'),'documents marqués « en ligne » sur le 2e appareil')
    A2.evaluate("attOpenEd(0)"); A2.wait_for_timeout(1000)
    ok(A2.locator('#att-body iframe.att-pdf').count()==1,'PDF récupéré sur le 2e appareil')
    A2.evaluate("attClose()")
    # ── retirer un document ──
    A2.evaluate("attRemove(1); saveRecipe()"); wait_sync(A2)
    ok(db("select count(*) from attachments a join auth.users u on u.id=a.owner where u.email='emmanuel@test.fr'")=='1','document retiré → supprimé du serveur')
    sync(A); ok(A.evaluate("recipes.find(r=>r.id==='%s').attachments.length"%rid)==1,'… et sur le 1er appareil')
    # ── ne plus partager ──
    A.evaluate("goPage('partage')"); A.wait_for_timeout(500)
    A.evaluate("openShared('%s')"%sid); A.wait_for_timeout(300)
    ok('Ne plus partager' in A.inner_text('#shr-foot'),'Emmanuel : bouton « Ne plus partager »')
    A.click("#shr-foot button:has-text('Ne plus partager')"); wait_sync(A)
    ok(db("select deleted from shared_recipes where id='%s'"%sid)=='t','recette retirée du partage')
    sync(B); B.evaluate("renderPartage()")
    ok(B.locator('#part-body .rt').count()==0,'Paul ne la voit plus')
    att_id=db("select id from attachments a join auth.users u on u.id=a.owner where u.email='emmanuel@test.fr' limit 1")
    n=B.evaluate("clFetch('/rest/v1/attachments?id=eq.%s&select=id').then(r=>r.length)"%att_id)
    ok(n==0,'ses documents ne sont plus lisibles par Paul')
    ok(B.evaluate("recipes.some(r=>r.fromShared&&r.fromShared.id==='%s')"%sid),'la copie de Paul reste dans son espace')
    # ── sauvegarde avec documents ──
    ok(A.evaluate("Object.keys(collectAttachments()).length")==1,'la sauvegarde .json inclut les documents')
    # ── hors ligne ──
    A.ctx.set_offline(True); A.evaluate("window.dispatchEvent(new Event('offline'))")
    A.evaluate("recipes[0].notes='écrit hors ligne'; persist();"); A.wait_for_timeout(1500)
    ok(A.evaluate("CLOUD.status")=='offline','hors ligne : en attente')
    A.ctx.set_offline(False); A.evaluate("window.dispatchEvent(new Event('online'))"); wait_sync(A)
    sync(A2); ok(A2.evaluate("recipes.some(r=>r.notes==='écrit hors ligne')"),'au retour du réseau, l’autre appareil reçoit la modif')
    for pg,n in [(A,'A'),(B,'B'),(A2,'A2')]: ok(not pg.errs,'pas d’erreur JS (%s) %s'%(n,pg.errs[:2]))
    b.close()
print(sum(res),'/',len(res))
