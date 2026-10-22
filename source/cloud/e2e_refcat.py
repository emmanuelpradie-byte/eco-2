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

with sync_playwright() as p:
    b=p.chromium.launch()
    A=newpage(b); A.goto(APP); A.wait_for_timeout(1200)
    gate_server(A); signup(A,'Emmanuel','emmanuel@test.fr')
    if 'sont-elles' in A.inner_text('#gate').lower(): A.click("text=Oui, ce sont les miennes")
    ok(wait_sync(A),'admin connecté')
    A.evaluate("ingredients.push({id:'zz1',name:'Pistache verte',cat:'Fruit sec',unit:'kg',price:35,buyPrice:35,allergens:['fruits_coque'],allergensSet:true}); persist()")
    A.evaluate("goPage('catalogue')"); A.wait_for_timeout(300)
    A.click('#ref-btn'); A.wait_for_timeout(800)
    ok('Publier mon catalogue' in A.inner_text('#ref-top'),'admin : bouton « Publier mon catalogue »')
    A.click('#ref-top .ref-pub'); A.wait_for_timeout(2500)
    n=int(db("select count(*) from ref_ingredients where not deleted"))
    ok(n==A.evaluate("refPublishable().length"),'publié sur le serveur (%d)'%n)
    ok('Déjà chez toi' in A.inner_text('#ref-list'),'admin : ses ingrédients « déjà chez toi »')
    A.evaluate("refClose()")
    link=A.evaluate("clInviteLink()")
    B=newpage(b,True); B.goto(APP); B.wait_for_timeout(900); B.goto(link); B.wait_for_timeout(1400); signup(B,'Paul','paul@test.fr')
    if 'sont-elles' in B.inner_text('#gate').lower(): B.click("text=Oui, ce sont les miennes")
    ok(wait_sync(B),'Paul connecté')
    B.evaluate("ingredients=ingredients.filter(i=>i.id!=='i1'); var f=ingredients.find(i=>/beurre/i.test(i.name)); f.buyPrice=99; f.price=99; persist()")
    B.evaluate("goPage('catalogue')"); B.wait_for_timeout(1500)
    ok(B.inner_text('#ref-btn-n').strip()!='','Paul : pastille de nouveautés sur « Catalogue commun »')
    B.click('#ref-btn'); B.wait_for_timeout(1200)
    top=B.inner_text('#ref-top')
    ok('Publier' not in top,'Paul : pas de bouton de publication')
    ok('Pistache verte' in B.inner_text('#ref-list'),'Paul voit les ingrédients de l’admin')
    B.click('#ref-top .chip:has-text("Prix différents")'); B.wait_for_timeout(200)
    ok('Beurre' in B.inner_text('#ref-list'),'filtre prix différents : beurre')
    B.click('#ref-list .btn:has-text("Prendre ce prix")'); B.wait_for_timeout(300)
    ok(B.evaluate("ingredients.find(i=>/beurre/i.test(i.name)).buyPrice")!=99,'prix du beurre repris du catalogue commun')
    B.click('#ref-top .chip:has-text("Tous")'); B.wait_for_timeout(200)
    B.fill('#ref-top input','pistache'); B.wait_for_timeout(200)
    ok(B.locator('#ref-list .ref-r').count()==1,'recherche « pistache »')
    B.click('#ref-list .btn:has-text("Ajouter")'); B.wait_for_timeout(300)
    ok(B.evaluate("!!ingredients.find(i=>i.name==='Pistache verte'&&i.refId==='zz1')"),'Pistache ajoutée au catalogue de Paul')
    B.fill('#ref-top input',''); B.wait_for_timeout(200)
    B.click('#ref-top .btn:has-text("Tout ajouter")'); B.wait_for_timeout(400)
    ok(B.evaluate("ingredients.some(i=>i.id==='i1'||i.refId==='i1')"),'Tout ajouter : ingrédient manquant ajouté')
    ok(B.evaluate("refStats().nw")==0,'plus rien de nouveau')
    B.screenshot(path=D+'../../../../ref_m.png')
    ok(sync(B),'Paul synchronisé')
    # RLS : Paul ne peut pas écrire
    r=B.evaluate("clUpsert('ref_ingredients','id',[{id:'hack',data:{name:'x'},deleted:false}]).then(()=>'ok',e=>e.status||e.message)")
    ok(r!='ok' and db("select count(*) from ref_ingredients where id='hack'")=='0','Paul ne peut pas écrire dans le catalogue commun')
    # admin met à jour un prix → Paul voit la différence
    A.evaluate("var p=ingredients.find(i=>i.id==='zz1'); p.buyPrice=40; p.price=40; persist(); refPublish()"); A.wait_for_timeout(2000)
    B.evaluate("refLoad()"); B.wait_for_timeout(1200)
    ok(B.evaluate("refStats().diff")>=1,'nouveau prix de l’admin détecté chez Paul')
    ok(not A.errs and not B.errs,'pas d’erreur JS '+str((A.errs+B.errs)[:2]))
    b.close()
print('%d PASS %d FAIL'%(res.count(True),res.count(False)))
