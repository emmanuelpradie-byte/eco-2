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

def sharepick(pg,folder,idx):
    pg.evaluate("""([f,ix])=>{ix.forEach(i=>{var r=recipes[i]; r.shared=true; if(f) r.shareFolder=f; r.updatedAt=now();}); persist();}""",[folder,idx])
with sync_playwright() as p:
    b=p.chromium.launch()
    A=newpage(b); A.goto(APP); A.wait_for_timeout(1200)
    gate_server(A); signup(A,'Emmanuel','emmanuel@test.fr')
    if 'sont-elles' in A.inner_text('#gate').lower(): A.click("text=Oui, ce sont les miennes")
    ok(wait_sync(A),'Emmanuel (admin) connecté')
    link=A.evaluate("clInviteLink()")
    def new_user(name,email):
        P=newpage(b); P.goto(APP); P.wait_for_timeout(900); P.goto(link); P.wait_for_timeout(1400)
        signup(P,name,email)
        if 'sont-elles' in P.inner_text('#gate').lower(): P.click("text=Oui, ce sont les miennes")
        ok(wait_sync(P),name+' connecté'); return P
    B=new_user('Paul','paul@test.fr'); C=new_user('Léa','lea@test.fr')
    sharepick(B,'Stage traiteur',[0,1]); sharepick(C,'',[0]); wait_sync(B); wait_sync(C)
    # ── Partage : un dossier par compte ──
    sync(A); A.evaluate("PART.tab='others';PART.acct=null;PART.open=null;goPage('partage')"); A.wait_for_timeout(500)
    t=A.inner_text('#part-body')
    ok(A.locator('#part-body .pf').count()==2 and 'Paul' in t and 'Léa' in t,'Partage : un dossier par compte (Léa, Paul)')
    ok('2 recettes' in t and '1 dossier' in t,'compteurs sur le dossier du compte : '+t.replace(chr(10),' | '))
    A.locator('#part-body .pf', has_text='Paul').first.click(); A.wait_for_timeout(250)
    t=A.inner_text('#part-body')
    ok('Stage traiteur' in t and 'Tous les comptes' in t,'dans le compte de Paul : son dossier + retour')
    A.click("text=Tous les comptes"); A.wait_for_timeout(200)
    A.locator('#part-body .pf', has_text='Léa').first.click(); A.wait_for_timeout(250)
    ok(A.locator('#part-body .rt').count()==1 and A.locator('#part-body .pf').count()==0,'compte de Léa : une recette seule, pas de sous-dossier')
    A.fill('#part-q','zzzz'); A.wait_for_timeout(150); ok('Aucun résultat' in A.inner_text('#part-body'),'recherche sans résultat')
    A.fill('#part-q',''); A.evaluate("PART.acct=null;PART.open=null;partBody()")
    A.screenshot(path=OUT+'part_accounts.png')
    # ── Administration : sections repliables ──
    A.evaluate("goPage('admin')"); A.wait_for_timeout(900)
    ok(A.locator('#adm-wrap details.adm-sec').count()==3 and A.locator('#adm-wrap details.adm-sec[open]').count()==0,'Administration : comptes, supprimés et partages repliés par défaut')
    ok('3' in A.inner_text('#adm-wrap details.adm-sec:nth-of-type(1) summary'),'compteur de comptes visible sans ouvrir')
    A.click('#adm-wrap details.adm-sec:nth-of-type(1) summary'); A.wait_for_timeout(150)
    ok('paul@test.fr' in A.inner_text('#adm-wrap') and A.is_visible('#adm-wrap details.adm-sec[open] .adm-u'),'ouvrir « Comptes » montre la liste')
    A.evaluate("admDelete('%s')"%db("select id from auth.users where email='paul@test.fr'")); A.wait_for_timeout(1500)
    pid=db("select id from auth.users where email='paul@test.fr'")
    ok(db("select status from profiles where id='%s'"%pid)=='deleted','Paul supprimé')
    ok('paul@test.fr' not in A.inner_text('#adm-wrap details.adm-sec:nth-of-type(1)'),'plus dans la liste des comptes')
    ok('Comptes supprimés' in A.inner_text('#adm-wrap') and A.locator('#adm-wrap details.adm-sec:nth-of-type(2)[open]').count()==0,'section « Comptes supprimés » repliée')
    A.click('#adm-wrap details.adm-sec:nth-of-type(2) summary'); A.wait_for_timeout(150)
    ok('paul@test.fr' in A.inner_text('#adm-wrap details.adm-sec:nth-of-type(2)') and 'Rétablir' in A.inner_text('#adm-wrap details.adm-sec:nth-of-type(2)'),'Paul listé avec « Rétablir »')
    ok(db("select count(*) from user_docs where user_id='%s'"%pid)=='0','serveur : son espace en ligne est vidé')
    A.screenshot(path=OUT+'adm_deleted.png')
    # Paul est connecté sur son appareil : il voit « supprimé »
    sync(B); B.wait_for_timeout(300); ok(B.evaluate("CLOUD.status")=='deleted','appareil de Paul : compte supprimé détecté')
    nrec=B.evaluate("recipes.length")
    A.evaluate("admRestore('%s')"%pid); A.wait_for_timeout(1500)
    ok(db("select status from profiles where id='%s'"%pid)=='active','Paul rétabli')
    ok(A.locator('#adm-wrap details.adm-sec:nth-of-type(2)[open]').count()==1 and 'paul@test.fr' in A.inner_text('#adm-wrap details.adm-sec:nth-of-type(1)'),'Paul revient dans les comptes')
    B.evaluate("clSync()"); wait_sync(B,15000); B.wait_for_timeout(1500); wait_sync(B,15000)
    ok(db("select count(*) from user_docs where user_id='%s' and kind='rec' and not deleted"%pid)==str(nrec),'son espace en ligne est reconstitué depuis son appareil (%d recettes)'%nrec)
    ok(int(db("select count(*) from shared_recipes where owner='%s' and not deleted"%pid))==2,'ses recettes partagées sont de nouveau partagées')
    r=C.evaluate("clRpc('admin_restore_user',{p_user:'%s'}).then(()=>'ok',e=>e.message)"%pid)
    ok(r!='ok','un compte non admin ne peut pas rétablir un compte ('+str(r)[:40]+')')
    ok(db("select status from profiles where id='%s'"%db("select id from auth.users where email='lea@test.fr'"))=='active','Léa toujours active')
    # ── Mon compte (Paul) ──
    B.evaluate("goPage('backup')"); B.wait_for_timeout(400)
    ok(B.is_visible('#mc-box') and 'mot de passe' in B.inner_text('#mc-box').lower(),'Réglages : fiche « Mon compte »')
    B.screenshot(path=OUT+'mc_box.png')
    B.evaluate("mcEdit('name')"); B.fill('#mc-name','Paul Martin'); B.evaluate("mcSaveName()"); B.wait_for_timeout(1500); wait_sync(B)
    ok(db("select display_name from profiles where id='%s'"%pid)=='Paul Martin','nom modifié sur le serveur')
    ok(db("select count(distinct owner_name) from shared_recipes where owner='%s' and not deleted"%pid)=='1' and db("select owner_name from shared_recipes where owner='%s' and not deleted limit 1"%pid)=='Paul Martin','nom mis à jour sur ses recettes déjà partagées')
    ok('Paul Martin' in B.inner_text('#mc-box'),'nouveau nom affiché')
    sync(A); A.evaluate("PART.acct=null;PART.open=null;goPage('partage')"); A.wait_for_timeout(400)
    ok('Paul Martin' in A.inner_text('#part-body'),'les autres voient le nouveau nom sur son dossier')
    # email
    B.evaluate("mcEdit('email')"); B.fill('#mc-email','paul.martin@test.fr'); B.fill('#mc-pw0','mauvais'); B.evaluate("mcSaveEmail()"); B.wait_for_timeout(900)
    ok('incorrect' in B.inner_text('#mc-err'),'email : mauvais mot de passe refusé')
    B.fill('#mc-pw0','motdepasse'); B.evaluate("mcSaveEmail()"); B.wait_for_timeout(1500)
    ok(db("select email from auth.users where id='%s'"%pid)=='paul.martin@test.fr','email modifié')
    ok(db("select email from profiles where id='%s'"%pid)=='paul.martin@test.fr','profil (vu par l’admin) mis à jour automatiquement')
    ok('paul.martin@test.fr' in B.inner_text('#mc-box') and B.evaluate("CLOUD.sess.user.email")=='paul.martin@test.fr','nouvel email affiché')
    B.evaluate("mcEdit('email')"); B.fill('#mc-email','emmanuel@test.fr'); B.fill('#mc-pw0','motdepasse'); B.evaluate("mcSaveEmail()"); B.wait_for_timeout(1200)
    ok('déjà utilisé' in B.inner_text('#mc-err'),'email déjà pris : message clair'); B.evaluate("mcEdit('')")
    # mot de passe
    B.evaluate("mcEdit('pw')"); B.fill('#mc-pw0','motdepasse'); B.fill('#mc-pw1','nouveaumdp'); B.fill('#mc-pw2','autrechose'); B.evaluate("mcSavePw()"); B.wait_for_timeout(300)
    ok('pas identiques' in B.inner_text('#mc-err'),'mot de passe : confirmation différente refusée')
    B.fill('#mc-pw2','nouveaumdp'); B.fill('#mc-pw1','abc'); B.evaluate("mcSavePw()"); B.wait_for_timeout(300)
    ok('trop court' in B.inner_text('#mc-err'),'mot de passe trop court refusé')
    B.fill('#mc-pw1','nouveaumdp'); B.fill('#mc-pw0','faux'); B.evaluate("mcSavePw()"); B.wait_for_timeout(900)
    ok('incorrect' in B.inner_text('#mc-err'),'ancien mot de passe faux refusé')
    B.fill('#mc-pw0','motdepasse'); B.evaluate("mcSavePw()"); B.wait_for_timeout(1500)
    ok(db("select pw from auth.users where id='%s'"%pid)=='nouveaumdp','mot de passe modifié')
    old=B.evaluate("clFetch('/auth/v1/token?grant_type=password',{method:'POST',auth:false,body:{email:'paul.martin@test.fr',password:'motdepasse'}}).then(()=>'ok',e=>e.message)")
    new=B.evaluate("clFetch('/auth/v1/token?grant_type=password',{method:'POST',auth:false,body:{email:'paul.martin@test.fr',password:'nouveaumdp'}}).then(()=>'ok',e=>e.message)")
    ok(old!='ok' and new=='ok','ancien mot de passe refusé, nouveau accepté')
    ok(wait_sync(B),'synchro toujours active après les changements')
    B.screenshot(path=OUT+'mc_done.png')
    errs=A.errs+B.errs+C.errs; print('errors',errs)
    # ── email avec confirmation par lien ──
    subprocess.run(['bash',D+'reset.sh','--pending-email'],capture_output=True)
    E=newpage(b); E.goto(APP); E.wait_for_timeout(1000)
    E.evaluate("localStorage.clear()"); E.goto(APP); E.wait_for_timeout(900)
    gate_server(E); signup(E,'Zoé','zoe@test.fr'); 
    if 'sont-elles' in E.inner_text('#gate').lower(): E.click("text=Oui, ce sont les miennes")
    wait_sync(E)
    E.evaluate("goPage('backup')"); E.wait_for_timeout(300)
    E.evaluate("mcEdit('email')"); E.fill('#mc-email','zoe.new@test.fr'); E.fill('#mc-pw0','motdepasse'); E.evaluate("mcSaveEmail()"); E.wait_for_timeout(1500)
    ok('En attente de confirmation' in E.inner_text('#mc-box') and E.evaluate("CLOUD.sess.user.email")=='zoe@test.fr','email : en attente de confirmation, l’ancien reste actif')
    uid=db("select id from auth.users where email='zoe@test.fr'")
    E.evaluate("clFetch('/auth/v1/user?confirm',{method:'POST',body:{}})"); E.wait_for_timeout(400)
    E.evaluate("mcRefreshUser()"); E.wait_for_timeout(800)
    ok(E.evaluate("CLOUD.sess.user.email")=='zoe.new@test.fr' and 'En attente' not in E.inner_text('#mc-box') and db("select email from profiles where id='%s'"%uid)=='zoe.new@test.fr','après confirmation : nouvel email partout')
    errs+=E.errs; print('errors',errs)
    print('%d/%d PASS'%(sum(res),len(res)))
    b.close()
