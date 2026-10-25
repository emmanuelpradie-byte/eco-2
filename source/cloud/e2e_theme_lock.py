import json, sys
exec(open('/tmp/claude-0/-home-claude/68738804-a68f-5f46-9b52-b8b51de84108/scratchpad/cloud/e2e_multidev.py').read().split('def live()')[0])
LINK=APP+'?theme=compagnons'
with sync_playwright() as p:
    b=p.chromium.launch()
    A=newpage(b); A.goto(LINK); A.wait_for_timeout(1500)
    ok(A.evaluate("document.documentElement.classList.contains('th-cdd')"),'lien : thème appliqué dès l’écran de connexion')
    A.screenshot(path=OUT+'cdd_gate.png')
    gate_server(A); signup(A,'Emmanuel','emmanuel@test.fr')
    if 'sont-elles' in A.inner_text('#gate').lower(): A.click("text=Oui, ce sont les miennes")
    wait_sync(A)
    ok(A.evaluate("BON_CREST===themeLock().logo"),'logo à la place de l’emblème')
    ok(A.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--i').trim()")=='#0F3B66','couleurs bleues')
    A.evaluate("goPage('home')"); A.wait_for_timeout(500); A.screenshot(path=OUT+'cdd_home.png')
    A.evaluate("goPage('backup')"); A.wait_for_timeout(500)
    t=A.inner_text('#th-card'); ok('Compagnons du Devoir' in t and 'Sombre' not in t and 'Lavande' not in t,'Réglages : pas de choix de couleur ni de mode')
    ok('retirer ce thème' in t.lower(),'admin : bouton pour retirer (compte admin du test ? '+str(A.evaluate("clIsAdmin()"))+')')
    A.locator('#th-card').screenshot(path=OUT+'cdd_card.png')
    A.evaluate("setThemeAccent('lavande'); setThemeMode('dark')"); A.wait_for_timeout(200)
    ok(A.evaluate("document.documentElement.getAttribute('data-theme')")=='light' and A.evaluate("document.documentElement.classList.contains('th-cdd')"),'forcer une autre couleur : sans effet')
    ok(A.evaluate("document.querySelector('link[rel=manifest]').href.startsWith('data:')"),'appli installable avec le lien et le logo')
    man=json.loads(A.evaluate("decodeURIComponent(document.querySelector('link[rel=manifest]').href.split(',')[1])"))
    ok(man['start_url'].endswith('index.html?theme=compagnons'),'start_url '+man['start_url'])
    # réouverture sans le lien
    A.goto(APP); A.wait_for_timeout(1500)
    ok(A.evaluate("document.documentElement.classList.contains('th-cdd')"),'réouverture sans le lien : toujours verrouillé')
    ok('theme=compagnons' in A.url,'adresse complétée : '+A.url)
    # mobile
    M=newpage(b,True); M.goto(LINK); M.wait_for_timeout(1200); gate_server(M); M.screenshot(path=OUT+'cdd_gate_m.png'); gate_auth(M,'login','emmanuel@test.fr')
    if 'sont-elles' in M.inner_text('#gate').lower(): M.click("text=Non")
    wait_sync(M,15000); M.evaluate("goPage('home')"); M.wait_for_timeout(600); M.screenshot(path=OUT+'cdd_home_m.png')
    # appareil normal : pas touché
    N=newpage(b); N.goto(APP); N.wait_for_timeout(1200)
    ok(not N.evaluate("document.documentElement.classList.contains('th-cdd')"),'autre appareil sans lien : apparence normale')
    # retrait par l'admin
    A.evaluate("goPage('backup')"); A.wait_for_timeout(400)
    if A.evaluate("clIsAdmin()"):
        A.click("text=retirer ce thème"); A.wait_for_timeout(1500)
        ok(not A.evaluate("document.documentElement.classList.contains('th-cdd')"),'admin : thème retiré')
    ok(not A.errs and not M.errs and not N.errs,'pas d’erreur JS '+str((A.errs+M.errs+N.errs)[:2]))
    b.close()
print('%d PASS %d FAIL'%(res.count(True),res.count(False)))
