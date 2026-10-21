import json, subprocess, time
from playwright.sync_api import sync_playwright
APP='http://localhost:8800/index.html'
URL='http://localhost:8787'; KEY='test-anon-key-0123456789abcdef'
OUT='/tmp/claude-0/-home-claude/68738804-a68f-5f46-9b52-b8b51de84108/scratchpad/uni/shots/'
res=[]
def ok(c,n): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n, flush=True)
def db(sql): return subprocess.run(['psql','-h','/tmp/pgtest','-p','54329','-U','postgres','-d','eco','-At','-c',sql],capture_output=True,text=True).stdout.strip()
def wait_sync(pg,ms=8000):
    pg.wait_for_timeout(600)
    t=time.time()
    while time.time()-t<ms/1000:
        st=pg.evaluate("({s:CLOUD.status,q:CLOUD.st?Object.keys(CLOUD.st.queue).length:0,b:CLOUD.busy})")
        if st['s']=='ok' and st['q']==0 and not st['b']: return True
        pg.wait_for_timeout(150)
    print('   sync state',pg.evaluate("({s:CLOUD.status,m:CLOUD.msg,q:CLOUD.st&&Object.keys(CLOUD.st.queue)})")); return False
def sync(pg): pg.evaluate("clSync()"); pg.wait_for_timeout(300); return wait_sync(pg)
def newpage(b,mobile=False):
    ctx=b.new_context(viewport={'width':390,'height':844} if mobile else {'width':1280,'height':860}, has_touch=mobile)
    pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e))); pg.errs=errs; pg.ctx=ctx
    return pg
with sync_playwright() as p:
    b=p.chromium.launch()
    # ── A : Emmanuel crée l'espace d'équipe ──
    A=newpage(b); A.goto(APP); A.wait_for_timeout(1200)
    nrecA=A.evaluate("recipes.length"); ningA=A.evaluate("ingredients.length")
    A.evaluate("goPage('backup')"); A.wait_for_timeout(200)
    A.click("text=Créer l’espace de mon équipe"); A.fill('#cl-url',URL+'/'); A.fill('#cl-key',KEY); A.click('#cl-card .btn-gold'); A.wait_for_timeout(600)
    ok(A.evaluate("!!CLOUD.cfg&&CLOUD.cfg.url==='"+URL+"'"),'serveur enregistré (URL nettoyée)')
    A.fill('#cl-name','Emmanuel'); A.fill('#cl-email','emmanuel@test.fr'); A.fill('#cl-pw','court')
    A.click('#cl-go'); A.wait_for_timeout(200); ok('trop court' in A.inner_text('#cl-err'),'mot de passe trop court refusé')
    A.fill('#cl-pw','secret123'); A.click('#cl-go'); A.wait_for_timeout(1200)
    ok(A.evaluate("!!CLOUD.sess"),'compte créé et connecté')
    A.fill('#cl-tname','Boulangerie Test'); A.click("#cl-card button:has-text('Créer')"); A.wait_for_timeout(500)
    ok(wait_sync(A),'équipe créée, base envoyée')
    ok(int(db("select count(*) from docs where kind='rec' and not deleted"))==nrecA and int(db("select count(*) from docs where kind='ing' and not deleted"))==ningA,'serveur: %s recettes, %s ingrédients'%(nrecA,ningA))
    ncfg=A.evaluate("CL_CFG_KEYS.filter(k=>LS.getItem(k)!=null).length")
    ok(int(db("select count(*) from docs where kind='cfg'"))==ncfg,'catégories envoyées (%d)'%ncfg)
    A.evaluate("clLoadMembers()"); A.wait_for_timeout(600)
    A.screenshot(path=OUT+'team_admin_d.png',full_page=False)
    code=A.evaluate("CLOUD.team.code"); link=A.evaluate("clInviteLink()")
    ok(len(code)==9 and '#rejoindre=' in link,'code %s + lien d’invitation'%code)
    ok(A.is_visible('#tb-cloud') and A.is_visible('#sb-cloud'),'indicateur de synchro visible')
    # un bon perso de A
    A.evaluate("openNewBon(); addRecToOrder(recipes[0].id,curBon,1); document.getElementById('e-name').value='Bon Emmanuel'; saveBon();")
    ok(wait_sync(A),'bon perso envoyé')
    nord=A.evaluate("orders.length"); ok(db("select count(*) from user_docs")==str(nord),'bons dans user_docs (%d)'%nord)
    # ── B : Paul ouvre le lien d'invitation (téléphone) ──
    B=newpage(b,True); B.goto(APP); B.wait_for_timeout(1000)
    B.evaluate("recipes.push({id:'rlocal',name:'Recette locale de Paul',cat:'Boulangerie',items:[]}); persist();")
    B.goto(link.replace('index.html','index.html')); B.wait_for_timeout(1500)
    ok(B.evaluate("CUR")=='backup' and 'Boulangerie Test' in B.inner_text('#cl-card'),'invitation reconnue → écran de compte')
    ok('#rejoindre' not in B.url,'lien nettoyé de la barre d’adresse')
    B.screenshot(path=OUT+'team_invite_m.png')
    B.fill('#cl-name','Paul'); B.fill('#cl-email','paul@test.fr'); B.fill('#cl-pw','motdepasse'); B.click('#cl-go'); B.wait_for_timeout(2000)
    ok(B.evaluate("CLOUD.team&&CLOUD.team.name")=='Boulangerie Test','Paul a rejoint automatiquement')
    ok(wait_sync(B),'Paul synchronisé')
    ok(B.evaluate("CLOUD.team.role")=='reader' and B.evaluate("document.body.classList.contains('cl-ro')"),'Paul lecteur → lecture seule')
    ok(B.evaluate("recipes.length")==nrecA and not B.evaluate("recipes.some(r=>r.id==='rlocal')"),'recettes de Paul remplacées par celles de l’équipe')
    ok(B.evaluate("orders.length")==0,'Paul ne voit pas le bon d’Emmanuel')
    ok(B.evaluate("CLOUD.team.code")==None,'lecteur : code non affiché')
    B.evaluate("goPage('catalogue')"); B.wait_for_timeout(200)
    ok(B.locator('.cat-btns').first.is_hidden(),'lecteur : boutons modifier/supprimer masqués')
    # lecteur qui modifie quand même (console) → annulé
    B.evaluate("ingredients[0].price=999; persist();"); B.wait_for_timeout(2500); wait_sync(B)
    ok(B.evaluate("ingredients[0].price")!=999,'modification du lecteur annulée')
    ok(db("select count(*) from docs where (data->>'price')='999'")=='0','rien d’écrit sur le serveur')
    B.evaluate("saveRecipe()"); B.wait_for_timeout(200)
    ok('Lecture seule' in B.inner_text('#toast'),'enregistrer une recette bloqué en lecture seule')
    # ── A promeut Paul éditeur ──
    A.evaluate("goPage('backup')"); A.wait_for_timeout(300); A.evaluate("clLoadMembers()"); A.wait_for_timeout(600)
    ok(A.locator('#cl-members .cl-m').count()==2,'admin voit 2 membres')
    A.select_option('#cl-members select.cl-rsel','editor'); A.wait_for_timeout(700)
    ok(db("select role from members m join auth.users u on u.id=m.user_id where u.email='paul@test.fr'")=='editor','Paul promu éditeur')
    B.evaluate("clRefreshTeam()"); B.wait_for_timeout(700)
    ok(B.evaluate("CLOUD.team.role")=='editor' and not B.evaluate("document.body.classList.contains('cl-ro')"),'Paul passe éditeur (sans recharger)')
    # Paul ajoute un ingrédient + modifie un prix
    iid=A.evaluate("ingredients[0].id")
    B.evaluate("ingredients.push({id:'ipaul',name:'Farine de seigle T130',cat:'Farines',unit:'kg',price:1.4,buyPrice:1.4,priceHistory:[]}); ingredients.find(i=>i.id==='%s').price=1.23; persist();"%iid)
    ok(wait_sync(B),'Paul envoie ses modifications')
    ok(sync(A) and A.evaluate("ingredients.some(i=>i.id==='ipaul')") and abs(A.evaluate("ingredients.find(i=>i.id==='%s').price"%iid)-1.23)<1e-9,'Emmanuel reçoit l’ingrédient et le prix de Paul')
    A.evaluate("goPage('catalogue')"); A.wait_for_timeout(200)
    ok('Farine de seigle T130' in A.inner_text('#cat-list'),'catalogue d’Emmanuel rafraîchi à l’écran')
    # ── suppression + annuler ──
    rid=A.evaluate("recipes[0].id"); rname=A.evaluate("recipes[0].name")
    A.evaluate("askDel('recipe',recipes[0].id,recipes[0].name)"); wait_sync(A)
    ok(db("select deleted from docs where kind='rec' and id='%s'"%rid)=='t','suppression envoyée')
    sync(B); ok(not B.evaluate("recipes.some(r=>r.id==='%s')"%rid),'Paul ne voit plus la recette supprimée')
    A.evaluate("document.querySelector('#toast .tu').click()"); wait_sync(A)
    ok(db("select deleted from docs where kind='rec' and id='%s'"%rid)=='f','Annuler la rétablit sur le serveur')
    sync(B); ok(B.evaluate("recipes.some(r=>r.id==='%s')"%rid),'… et chez Paul')
    # ── hors ligne ──
    A.ctx.set_offline(True); A.evaluate("window.dispatchEvent(new Event('offline'))")
    rid0=A.evaluate("recipes[0].id"); A.evaluate("recipes[0].name='Baguette hors ligne'; persist();"); A.wait_for_timeout(1800)
    ok(A.evaluate("CLOUD.status")=='offline' and A.evaluate("Object.keys(CLOUD.st.queue).length")>=1,'hors ligne : modification en attente')
    A.reload(); A.wait_for_timeout(1500)
    ok(A.evaluate("recipes[0].name")=='Baguette hors ligne' and A.evaluate("Object.keys(CLOUD.st.queue).length")>=1,'en attente conservée après fermeture')
    A.ctx.set_offline(False); A.evaluate("window.dispatchEvent(new Event('online'))"); wait_sync(A)
    sync(B); ok(B.evaluate("recipes.some(r=>r.name==='Baguette hors ligne')"),'au retour du réseau, Paul reçoit la modification')
    # ── conflit : même recette modifiée des deux côtés → dernière écriture gagne ──
    A.evaluate("recipes.find(x=>x.id==='%s').notes='version A'; persist();"%rid0); wait_sync(A)
    B.evaluate("recipes.find(x=>x.id==='%s').notes='version B'; persist();"%rid0); wait_sync(B)
    sync(A); ok(A.evaluate("recipes.find(x=>x.id==='%s').notes"%rid0)=='version B','conflit : la dernière modification gagne')
    # ── Paul sur un 2e appareil ──
    B2=newpage(b); B2.goto(APP); B2.wait_for_timeout(1000)
    B.evaluate("openNewBon(); addRecToOrder(recipes[recipes.length-1].id,curBon,2); document.getElementById('e-name').value='Bon de Paul'; saveBon();"); wait_sync(B)
    B2.evaluate("goPage('backup')"); B2.click("text=J’ai reçu une invitation"); B2.fill('#cl-inv',link); B2.click("#cl-card .btn-gold"); B2.wait_for_timeout(300)
    B2.click("#cl-card .cl-seg button:has-text('Se connecter')"); B2.fill('#cl-email','paul@test.fr'); B2.fill('#cl-pw','faux-mdp'); B2.click('#cl-go'); B2.wait_for_timeout(700)
    ok('incorrect' in B2.inner_text('#cl-err'),'mauvais mot de passe : message clair')
    B2.fill('#cl-pw','motdepasse'); B2.click('#cl-go'); B2.wait_for_timeout(2200); wait_sync(B2)
    ok(B2.evaluate("CLOUD.team&&CLOUD.team.role")=='editor','2e appareil : équipe retrouvée')
    ok(B2.evaluate("orders.some(o=>o.name==='Bon de Paul')") and not B2.evaluate("orders.some(o=>o.name==='Bon Emmanuel')"),'2e appareil : bons de Paul récupérés, pas ceux d’Emmanuel')
    # ── session expirée → rafraîchie ──
    A.evaluate("CLOUD.sess.access_token='expire'; CLOUD.sess.expires_at=Math.floor(Date.now()/1000)+3600;")
    A.evaluate("recipes[0].notes='après expiration'; persist();"); ok(wait_sync(A),'jeton expiré : renouvelé automatiquement')
    # ── garde-fou suppression massive ──
    A.on('dialog',lambda d: d.dismiss())
    n_before=int(db("select count(*) from docs where kind='ing' and not deleted"))
    A.evaluate("ingredients.length=0; persist();"); A.wait_for_timeout(2500); wait_sync(A)
    ok(int(db("select count(*) from docs where kind='ing' and not deleted"))==n_before,'suppression massive refusée → rien supprimé sur le serveur')
    sync(A); ok(A.evaluate("ingredients.length")==n_before,'… et le catalogue local est rétabli')
    # ── retrait de Paul ──
    A.evaluate("goPage('backup')"); A.wait_for_timeout(300); A.evaluate("clLoadMembers()"); A.wait_for_timeout(600)
    pid=db("select id from auth.users where email='paul@test.fr'")
    A.evaluate("window.confirm=()=>true; clRemove('%s','Paul')"%pid); A.wait_for_timeout(700)
    nB=B.evaluate("recipes.length")
    B.evaluate("CLOUD.st.since.team=null; clSync()"); B.wait_for_timeout(1500)
    ok(B.evaluate("CLOUD.team")==None and B.evaluate("recipes.length")==nB,'Paul retiré : sort de l’équipe mais garde sa copie locale')
    A.screenshot(path=OUT+'team_admin_d2.png')
    for pg,n in [(A,'A'),(B,'B'),(B2,'B2')]:
        ok(not pg.errs,'pas d’erreur JS (%s) %s'%(n,pg.errs[:2]))
    b.close()
print(sum(res),'/',len(res))
