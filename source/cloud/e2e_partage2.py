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


PDF=D+'fiche-test.pdf'
open(PDF,'wb').write(b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n")
def rows_visible(pg):
    return pg.evaluate("clFetch('/rest/v1/shared_recipes?select=id,data&deleted=eq.false').then(r=>r.map(x=>x.data&&x.data.name))")
with sync_playwright() as p:
    b=p.chromium.launch()
    A=newpage(b); A.goto(APP); A.wait_for_timeout(1200)
    gate_server(A); signup(A,'Emmanuel','emmanuel@test.fr')
    if 'sont-elles' in A.inner_text('#gate').lower(): A.click("text=Oui, ce sont les miennes")
    ok(wait_sync(A),'Emmanuel connecté')
    ok(A.is_visible('#sb-cloud .sb-out'),'menu : bouton « Se déconnecter » visible')
    link=A.evaluate("clInviteLink()")
    B=newpage(b); B.goto(APP); B.wait_for_timeout(900); B.goto(link); B.wait_for_timeout(1400); signup(B,'Paul','paul@test.fr')
    if 'sont-elles' in B.inner_text('#gate').lower(): B.click("text=Oui, ce sont les miennes")
    ok(wait_sync(B),'Paul connecté')
    # ── Emmanuel : un dossier avec une recette, un bon et un PDF ──
    A.evaluate("""(()=>{var o=mkOrder(); o.name='Bon traiteur'; o.items=[{id:uid(),ingId:ingredients[0].id,qty:2,cost:rnd(2*ingredients[0].price),uses:[{n:'x',q:2}]},{id:uid(),ingId:ingredients[1].id,qty:0.5,cost:rnd(0.5*ingredients[1].price),uses:[{n:'x',q:0.5}]}]; orders.unshift(o); persist();})()""")
    A.evaluate("PART.tab='mine';goPage('partage')"); A.wait_for_timeout(400)
    ok('Partager un bon' in A.inner_text('#part-body') and 'Partager un PDF' in A.inner_text('#part-body'),'Les miens : boutons « Partager un bon » et « Partager un PDF »')
    A.evaluate("partPick('Stage traiteur',true)"); A.wait_for_timeout(300)
    tabs=A.inner_text('#pk-tabs'); ok(all(t in tabs for t in ['Recettes','Bons','PDF','Images']),'dossier : onglets Recettes / Bons / PDF / Images')
    A.locator('#pk-list label.pk-it', has_text='Baguette').first.click()
    A.click('#pk-tabs button:has-text("Bons")'); A.wait_for_timeout(150)
    A.locator('#pk-list label.pk-it', has_text='Bon traiteur').first.click()
    A.click('#pk-tabs button:has-text("PDF")'); A.wait_for_timeout(150)
    A.set_input_files('#pk-doc-file',PDF); A.wait_for_timeout(600)
    ok('fiche-test' in A.inner_text('#pk-list'),'PDF ajouté dans le dossier')
    ok(A.inner_text('#pk-tabs').replace('\n',' ').count('1')>=3,'pastilles : 1 recette, 1 bon, 1 PDF')
    A.screenshot(path=OUT+'part_pick_tabs.png')
    ok('Partager 3 éléments' in A.inner_text('#pk-foot'),'3 éléments cochés')
    A.click('#pk-foot .btn-gold'); A.wait_for_timeout(300); ok(wait_sync(A,15000),'synchro')
    ok(db("select count(*) from shared_recipes where not deleted and data->>'folder'='Stage traiteur'")=='3','serveur : 3 éléments dans le dossier')
    ok(db("select data->>'type' from shared_recipes where not deleted and data->>'name'='Bon traiteur'")=='bon','bon publié (type bon)')
    did=db("select data->'attachments'->0->>'id' from shared_recipes where not deleted and data->>'type'='doc'")
    ok(did and db("select count(*) from attachments where id='%s'"%did)=='1','PDF envoyé sur le serveur')
    ok('1 recette · 1 bon · 1 PDF' in A.inner_text('#part-body'),'carte du dossier : 1 recette · 1 bon · 1 PDF')
    # bon seul + PDF seul
    A.evaluate("partQuick('bon')"); A.wait_for_timeout(200)
    A.evaluate("""(()=>{var o=mkOrder(); o.name='Bon seul'; orders.unshift(o); persist(); partQuick('bon');})()"""); A.wait_for_timeout(200)
    A.locator('#pk-body label.pk-r', has_text='Bon seul').first.click(); A.click('#pk-foot .btn-gold'); A.wait_for_timeout(200)
    ok(A.evaluate("orders.find(o=>o.name==='Bon seul').shared===true"),'« Partager un bon » : bon partagé seul')
    A.set_input_files('#part-doc-file',PDF); A.wait_for_timeout(700)
    ok('Partager un document' in A.inner_text('#pk-title'),'« Partager un PDF » : choix du dossier')
    A.click('#pk-foot .btn-gold'); A.wait_for_timeout(200); ok(wait_sync(A,15000),'synchro')
    t=A.inner_text('#part-body').lower(); ok('bons d’économat partagés seuls' in t and 'pdf partagés seuls' in t,'Les miens : bons et PDF seuls listés dans des sections séparées')
    ok(A.evaluate("JSON.parse(LS.getItem('v4_shdocs')).length")==2 and db("select count(*) from user_docs where kind='cfg' and id='v4_shdocs'")=='1','liste des documents sauvée dans l’espace en ligne (autres appareils)')
    # ── Paul voit et copie ──
    sync(B); B.evaluate("PART.tab='others';PART.acct=null;PART.open=null;goPage('partage')"); B.wait_for_timeout(400)
    B.locator('#part-body .pf', has_text='Emmanuel').first.click(); B.wait_for_timeout(200)
    t=B.inner_text('#part-body'); ok('Stage traiteur' in t and 'Bon seul' in t and 'fiche-test' in t,'compte d’Emmanuel : dossier + bon et PDF seuls')
    B.locator('#part-body .pf', has_text='Stage traiteur').first.click(); B.wait_for_timeout(200)
    ok(B.locator('#part-body .rt.sh-bon').count()==1 and B.locator('#part-body .rt.sh-doc').count()==1 and B.locator('#part-body .rt').count()==3,'dossier : recette + bon + PDF')
    ok(B.locator('#part-body .psec-rec .rt').count()==1 and B.locator('#part-body .psec-bon .rt').count()==1 and B.locator('#part-body .psec-pdf .rt').count()==1,'dossier : sections Recettes / Bons / PDF séparées')
    B.locator('#part-body .rt.sh-bon').first.click(); B.wait_for_timeout(300)
    ok('Articles' in B.inner_text('#shr-body') and 'Copier dans mes bons' in B.inner_text('#shr-foot'),'bon partagé : détail + « Copier dans mes bons »')
    B.screenshot(path=OUT+'shr_bon.png')
    nb=B.evaluate("orders.length"); B.click('#shr-copy'); B.wait_for_timeout(300)
    ok(B.evaluate("orders.length")==nb+1 and B.evaluate("orders[0].name")=='Bon traiteur' and B.evaluate("orders[0].items.length")==2,'bon copié chez Paul (2 articles)')
    ok(B.locator('#part-body .rt.sh-bon .rt-badge').count()==1,'badge « Copié »')
    B.locator('#part-body .rt.sh-doc').first.click(); B.wait_for_timeout(1500)
    ok(B.is_visible('#m-att') and 'Télécharger' in B.inner_text('#att-foot'),'PDF partagé : ouverture et téléchargement')
    B.evaluate("attClose()")
    B.screenshot(path=OUT+'part_folder_mixed.png')
    B.wait_for_timeout(1200)
    ok(db("select count(*) from share_copies where action='copy' and item_name='Bon traiteur'")=='1' and db("select count(*) from share_copies where action='open' and item_name='fiche-test'")=='1','journal : copie du bon et ouverture du PDF notées')
    ok(db("select count(*) from share_copies c join profiles p on p.id=c.copier where p.display_name='Paul'")=='2','journal : copies faites par Paul')
    r=B.evaluate("clRpc('admin_share_copies',{}).then(()=>'ok',e=>'refus')"); ok(r=='refus','Paul ne peut pas lire le journal')
    r=B.evaluate("clFetch('/rest/v1/share_copies?select=*').then(r=>'lu',e=>'refus')"); ok(r=='refus','journal illisible en direct')
    A.evaluate("ADM.users=null;ADM.open.copies=true;goPage('admin')"); A.wait_for_timeout(1800)
    t=A.inner_text('#adm-wrap'); ok('Qui a copié les partages' in t and 'Bon traiteur' in t and 'Paul' in t and 'a ouvert le document' in t,'admin : voit que Paul a copié le bon et ouvert le PDF')
    A.fill('#adm-cq','fiche'); A.wait_for_timeout(200); t=A.inner_text('#adm-wrap .adm-cp'); ok('fiche-test' in t and 'Bon traiteur' not in t,'admin : recherche dans le journal')
    A.fill('#adm-cq',''); A.wait_for_timeout(200)
    A.locator('#adm-wrap .adm-sec', has_text='Qui a copié').screenshot(path=OUT+'adm_copies.png')
    A.evaluate("PART.tab='mine';goPage('partage')"); A.wait_for_timeout(300)
    # ── mot de passe sur le dossier ──
    A.evaluate("partLockUI('Stage traiteur')"); A.wait_for_timeout(200)
    A.fill('#lk-pw','ab'); A.evaluate("partLockSave()"); A.wait_for_timeout(200)
    ok('trop court' in A.inner_text('#lk-err'),'mot de passe trop court refusé')
    A.fill('#lk-pw','stage2026'); A.evaluate("partLockSave()"); A.wait_for_timeout(800)
    ok(db("select count(*) from share_locks")=='1' and not db("select pw_hash from share_locks").startswith('stage'),'serveur : dossier protégé, mot de passe chiffré')
    A.evaluate("renderPartage()"); A.wait_for_timeout(200)
    ok(A.locator('#part-body .pf .pf-lk').count()==1,'Les miens : cadenas sur le dossier')
    vis=rows_visible(B); ok('Bon traiteur' not in vis and 'Bon seul' in vis,'serveur : Paul ne peut plus lire le contenu du dossier (lecture directe)')
    n=B.evaluate("clFetch('/rest/v1/attachments?id=eq.%s&select=id').then(r=>r.length)"%did)
    ok(n==0,'serveur : PDF du dossier protégé illisible pour Paul')
    sync(B); B.wait_for_timeout(500); B.evaluate("PART.acct=null;PART.open=null;renderPartage()"); B.wait_for_timeout(200)
    ok(not B.evaluate("Object.values(CLOUD.shared).some(x=>x.data&&x.data.folder==='Stage traiteur')"),'chez Paul : contenu retiré de l’appareil')
    B.locator('#part-body .pf', has_text='Emmanuel').first.click(); B.wait_for_timeout(200)
    ok(B.locator('#part-body .pf.locked').count()==1 and 'mot de passe' in B.inner_text('#part-body'),'Paul voit le dossier avec un cadenas')
    B.screenshot(path=OUT+'part_locked.png')
    B.locator('#part-body .pf.locked').first.click(); B.wait_for_timeout(300)
    B.fill('#unl-pw','faux'); B.click('#unl-go'); B.wait_for_timeout(1800)
    ok('incorrect' in B.inner_text('#unl-err'),'mauvais mot de passe refusé')
    B.screenshot(path=OUT+'part_unlock.png')
    B.fill('#unl-pw','stage2026'); B.click('#unl-go'); B.wait_for_timeout(2000)
    ok(B.locator('#part-body .rt').count()==3 and 'protégé par mot de passe' in B.inner_text('#part-body'),'bon mot de passe : dossier ouvert (3 éléments)')
    n=B.evaluate("clFetch('/rest/v1/attachments?id=eq.%s&select=id').then(r=>r.length)"%did); ok(n==1,'PDF de nouveau lisible')
    # autre appareil de Paul : déjà déverrouillé
    B2=newpage(b); B2.goto(APP); B2.wait_for_timeout(900); B2.goto(link); B2.wait_for_timeout(1400); gate_auth(B2,'login','paul@test.fr')
    if 'sont-elles' in B2.inner_text('#gate').lower(): B2.click("text=Oui, ce sont les miennes")
    wait_sync(B2); B2.wait_for_timeout(500)
    ok(B2.evaluate("Object.values(CLOUD.shared).some(x=>x.data&&x.data.folder==='Stage traiteur')"),'autre appareil de Paul : pas besoin de ressaisir')
    # changement du mot de passe → Paul doit le ressaisir
    A.evaluate("partLockUI('Stage traiteur')"); A.wait_for_timeout(200); A.fill('#lk-pw','nouveau99'); A.evaluate("partLockSave()"); A.wait_for_timeout(800)
    sync(B); B.wait_for_timeout(500)
    ok(not B.evaluate("Object.values(CLOUD.shared).some(x=>x.data&&x.data.folder==='Stage traiteur')"),'mot de passe changé : Paul doit le ressaisir')
    # renommer : le mot de passe suit
    A.evaluate("askText=function(t,p,cb){cb('Stage 2026')}; partRename('Stage traiteur')"); A.wait_for_timeout(800); wait_sync(A,15000)
    ok(db("select folder from share_locks")=='Stage 2026','renommer le dossier : le mot de passe suit')
    vis=rows_visible(B); ok('Bon traiteur' not in vis,'toujours protégé après renommage')
    # retirer le mot de passe
    A.evaluate("PICK.folder='Stage 2026';partLockSave(true)"); A.wait_for_timeout(800)
    ok(db("select count(*) from share_locks")=='0','mot de passe retiré')
    sync(B); B.wait_for_timeout(500)
    ok(B.evaluate("Object.values(CLOUD.shared).some(x=>x.data&&x.data.folder==='Stage 2026')"),'dossier de nouveau visible par tous')
    # admin retire le bon seul → Emmanuel prévenu
    # ── déconnexion ──
    A.evaluate("goPage('backup')"); A.wait_for_timeout(300)
    ok('Se déconnecter' in A.inner_text('#mc-box'),'Mon compte : bouton « Se déconnecter »')
    A.click('#sb-cloud .sb-out'); A.wait_for_timeout(2500)
    ok(gated(A) and 'Se connecter' in A.inner_text('#gate'),'déconnexion depuis le menu → écran de connexion')
    # ── mot de passe oublié : le lien revient dans l'appli ──
    rq=[]; A.on('request',lambda r: rq.append(r.url) if '/recover' in r.url else None)
    A.fill('#g-email','paul@test.fr'); A.click("#gate button:has-text('Mot de passe oublié')"); A.wait_for_timeout(800)
    ok(rq and 'redirect_to=' in rq[0] and 'localhost%3A8800' in rq[0],'email de réinitialisation : lien de retour vers l’appli')
    tok=A.evaluate("fetch('%s/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:'%s','Content-Type':'application/json'},body:JSON.stringify({email:'paul@test.fr',password:'motdepasse'})}).then(r=>r.json())"%(URL,KEY))
    R=newpage(b); R.goto(APP); R.wait_for_timeout(900); gate_server(R)
    R.goto(APP+'#access_token=%s&expires_in=3600&refresh_token=%s&token_type=bearer&type=recovery'%(tok['access_token'],tok['refresh_token'])); R.wait_for_timeout(300); R.reload(); R.wait_for_timeout(2000)
    ok(gated(R) and 'nouveau mot de passe' in R.inner_text('#gate').lower() and 'paul@test.fr' in R.inner_text('#gate'),'lien reçu : écran « Choisis un nouveau mot de passe »')
    ok('access_token' not in R.url,'le jeton est retiré de l’adresse')
    R.screenshot(path=OUT+'gate_recovery.png')
    R.fill('#g-npw','neuf123'); R.fill('#g-npw2','autre'); R.click('#g-go'); R.wait_for_timeout(300)
    ok('pas identiques' in R.inner_text('#g-err'),'confirmation différente refusée')
    R.fill('#g-npw2','neuf123'); R.click('#g-go'); R.wait_for_timeout(2500)
    if gated(R) and 'sont-elles' in R.inner_text('#gate').lower(): R.click("text=Oui, ce sont les miennes"); R.wait_for_timeout(1500)
    ok(db("select pw from auth.users where email='paul@test.fr'")=='neuf123','nouveau mot de passe enregistré')
    ok(not gated(R) and R.evaluate("CLOUD.sess.user.email")=='paul@test.fr','connecté directement dans l’appli')
    # lien expiré
    X=newpage(b); X.goto(APP); X.wait_for_timeout(900); gate_server(X)
    X.goto(APP+'#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'); X.wait_for_timeout(300); X.reload(); X.wait_for_timeout(1500)
    ok('expiré' in X.inner_text('#gate'),'lien expiré : message clair sur l’écran de connexion')
    errs=A.errs+B.errs+R.errs+X.errs; print('errors',errs)
    print('%d/%d PASS'%(sum(res),len(res)))
    b.close()
