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
def gtxt(pg): return pg.inner_text('#gate')
with sync_playwright() as p:
    b=p.chromium.launch()
    A=newpage(b); A.goto(APP); A.wait_for_timeout(1200)
    ok(gated(A) and not A.is_visible('#nav-home'),'1re ouverture : appli cachée derrière l’écran d’accueil')
    ok('J’ai reçu une invitation' in gtxt(A),'sans serveur : invitation ou configuration')
    A.screenshot(path=OUT+'gate_server.png')
    A.click('#gate summary'); A.fill('#g-url',URL); A.fill('#g-key',KEY); A.click("#gate button:has-text('Enregistrer le serveur')"); A.wait_for_timeout(800)
    ok('Créer mon compte' in gtxt(A),'serveur enregistré → création de compte')
    A.fill('#g-name','Emmanuel'); A.fill('#g-email','emmanuel@test.fr'); A.fill('#g-pw','motdepasse'); A.click('#g-go'); A.wait_for_timeout(2500)
    ok(not gated(A) and A.is_visible('#nav-home'),'compte créé → appli ouverte'); ok(wait_sync(A),'synchro')
    ok(A.evaluate("clIsAdmin()"),'1er compte administrateur')
    # déconnexion → écran de connexion
    A.evaluate("goPage('backup')"); A.wait_for_timeout(300); A.evaluate("clLogout()"); A.wait_for_timeout(2000)
    ok(gated(A) and 'Se connecter' in gtxt(A),'déconnexion → écran de connexion')
    A.screenshot(path=OUT+'gate_login.png')
    A.fill('#g-email','emmanuel@test.fr'); A.fill('#g-pw','mauvais'); A.click('#g-go'); A.wait_for_timeout(1200)
    ok('incorrect' in gtxt(A) and gated(A),'mauvais mot de passe : message, toujours bloqué')
    A.click('.gate-eye'); ok(A.get_attribute('#g-pw','type')=='text' and A.input_value('#g-pw')=='mauvais','œil : affiche le mot de passe')
    A.fill('#g-pw','motdepasse'); A.press('#g-pw','Enter'); A.wait_for_timeout(2500)
    ok(not gated(A),'connexion (touche Entrée) → appli'); wait_sync(A)
    # invitation sans code admin → en attente
    import base64
    link=A.evaluate("clInviteLink()")
    plain=link.split('rejoindre=')[0]+'rejoindre='+base64.urlsafe_b64encode(('{"u":"%s","k":"%s","by":"Emmanuel"}'%(URL,KEY)).encode()).decode().rstrip('=')
    C=newpage(b,True); C.goto(APP); C.wait_for_timeout(900); C.goto(plain); C.wait_for_timeout(1500)
    ok(gated(C) and 'Emmanuel' in gtxt(C) and 'Créer mon compte' in gtxt(C),'lien d’invitation → création de compte, « Emmanuel t’invite »')
    C.screenshot(path=OUT+'gate_invite_m.png')
    C.fill('#g-name','Julie'); C.fill('#g-email','julie@test.fr'); C.fill('#g-pw','motdepasse'); C.click('#g-go'); C.wait_for_timeout(2500)
    ok(gated(C) and 'attend sa validation' in gtxt(C),'compte en attente : écran d’attente, appli bloquée')
    C.screenshot(path=OUT+'gate_wait_m.png')
    sync(A); A.evaluate("goPage('admin')"); A.wait_for_timeout(1500); A.click("#adm-wrap .adm-u.pend .btn-gold"); A.wait_for_timeout(1200)
    C.click("#gate button:has-text('Vérifier maintenant')"); C.wait_for_timeout(3000)
    ok(not gated(C) and C.is_visible('#bn-home'),'validé → appli ouverte')
    # lien admin → direct
    B=newpage(b); B.goto(APP); B.wait_for_timeout(900); B.goto(link); B.wait_for_timeout(1500)
    B.fill('#g-name','Paul'); B.fill('#g-email','paul@test.fr'); B.fill('#g-pw','motdepasse'); B.click('#g-go'); B.wait_for_timeout(2500)
    ok(not gated(B),'lien de l’admin → compte validé d’office')
    # appli préconfigurée
    with A.expect_download() as dl: A.evaluate("admBundle()")
    path=dl.value.path(); html=open(path,encoding='utf-8').read()
    ok(('window.ECO_SERVER={"url":"%s"'%URL) in html,'appli préconfigurée : adresse du serveur intégrée')
    open('/mnt/user-data/outputs/economat-pro/index-preconf-test.html','w',encoding='utf-8').write(html)
    D=newpage(b); D.goto(APP.replace('index.html','index-preconf-test.html')); D.wait_for_timeout(1500)
    ok(gated(D) and 'Se connecter' in gtxt(D) and 'Changer de serveur' not in gtxt(D),'appli préconfigurée : connexion directe, sans réglage')
    D.screenshot(path=OUT+'gate_preconf.png')
    D.fill('#g-email','paul@test.fr'); D.fill('#g-pw','motdepasse'); D.click('#g-go'); D.wait_for_timeout(2500)
    ok(not gated(D),'connexion sur l’appli préconfigurée')
    import os; os.remove('/mnt/user-data/outputs/economat-pro/index-preconf-test.html')
    E=newpage(b); E.goto(APP); E.wait_for_timeout(900); E.evaluate("document.documentElement.classList.add('lay-mob')"); E.set_viewport_size({'width':1280,'height':800})
    for pg in (A,B,C,D): ok(not pg.errs,'aucune erreur JS '+str(pg.errs))
    b.close()
print('%d/%d PASS'%(sum(res),len(res)))
