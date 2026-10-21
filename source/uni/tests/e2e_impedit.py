import sys, json
from playwright.sync_api import sync_playwright
NOGATE="document.addEventListener('DOMContentLoaded',function(){var s=document.createElement('style');s.textContent='html.gated #shell{visibility:visible!important}html.gated #gate{display:none!important}html.gated body{overflow:auto!important}';document.head.appendChild(s);});"
URL="file:///mnt/user-data/outputs/economat-pro/index.html"
ok=0; ko=0
def chk(label, cond, extra=''):
    global ok, ko
    if cond: ok+=1; print('PASS', label)
    else: ko+=1; print('FAIL', label, extra)

def L(n,q,u='kg',c=90,sub=None): return {'detectedName':n,'quantity':q,'unit':u,'unitDetected':True,'confidence':c}

with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1280,'height':900}); pg.add_init_script(NOGATE); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('dialog', lambda d: d.accept())
    pg.goto(URL); pg.wait_for_timeout(300)
    pg.evaluate("()=>new Promise(r=>{localStorage.clear(); var q=indexedDB.deleteDatabase('economat-pro'); q.onsuccess=q.onerror=q.onblocked=()=>r();})")
    pg.reload(); pg.wait_for_timeout(500)
    nIng0=pg.evaluate("ingredients.length")
    pg.evaluate("""()=>RIMP.fromParsed([
       {recipeName:'Brioche',main:[%s,%s,%s],subRecipes:[],process:[{type:'process_step',text:'Pétrir 10 min',section:''}]},
       {recipeName:'Croissant',main:[%s,%s],subRecipes:[],process:[]},
       {recipeName:'Pain',main:[%s],subRecipes:[{name:'Poolish',items:[%s,%s]}],process:[]}],'multi.pdf')""" % tuple(json.dumps(x) for x in [L('Farine',1),L('Zorglub fantaisie',0.2),L('Sel',0.02,'kg',30),
                                          L('Beurre',0.5),L('Farine',0.3),
                                          L('Farine',2),L('Farine',1),L('Eau',1)]))
    chk('éditeur ouvert', pg.evaluate("CUR")=='rec-edit' and pg.evaluate("document.getElementById('p-rec-valid').style.display")=='none')
    chk('nom prérempli', pg.evaluate("document.getElementById('r-name').value")=='Brioche')
    chk('bandeau 1 sur 3', 'recette 1 sur 3' in pg.evaluate("document.getElementById('imp-bar').innerText"))
    chk('procédé dans les notes', 'Pétrir 10 min' in pg.evaluate("document.getElementById('r-notes').value"))
    rows=pg.evaluate("[].map.call(document.querySelectorAll('#r-items .ir'),r=>r.innerText.replace(/\\s+/g,' '))")
    print(rows)
    chk('2 lignes (peu fiable ignorée)', len(rows)==2)
    chk('badge Nouveau', any('Nouveau' in r for r in rows))
    chk('brouillon absent du disque', pg.evaluate("(()=>{persist();return !(JSON.parse(localStorage.getItem('v4_ing')||'[]').some(i=>/zorglub extra/i.test(i.name)))})()"))
    chk('brouillon présent en mémoire', pg.evaluate("ingredients.some(i=>i._imp)"))
    pg.screenshot(path='/tmp/imp_desktop.png')
    chk('un choix d’ingrédient par ligne', pg.evaluate("document.querySelectorAll('#r-items .imp-sel').length")==2)
    chk('nouvel ingrédient renommable', pg.evaluate("document.querySelectorAll('#r-items .imp-nm').length")==1)
    beurre=pg.evaluate("ingredients.find(i=>/beurre/i.test(i.name)&&!i._imp).id")
    pg.select_option('#r-items .ir:nth-child(3) .imp-sel', 'ing:'+beurre); pg.wait_for_timeout(100)
    chk('ligne remplacée par un ingrédient du catalogue', pg.evaluate("recItems[1].refId")==beurre and pg.evaluate("document.querySelectorAll('#r-items .imp-nm').length")==0)
    chk('badge Nouveau retiré', 'Nouveau' not in pg.evaluate("document.querySelectorAll('#r-items .ir')[1].innerText"))
    pg.select_option('#r-items .ir:nth-child(3) .imp-sel', ''); pg.wait_for_timeout(100)
    chk('retour à « nouvel ingrédient »', pg.evaluate("ingredients.some(i=>i._imp&&i.id===recItems[1].refId)"))
    pg.fill('#r-items .imp-nm','Zorglub extra'); pg.press('#r-items .imp-nm','Tab'); pg.wait_for_timeout(100)
    chk('nouvel ingrédient renommé', pg.evaluate("ingredients.find(i=>i.id===recItems[1].refId).name")=='Zorglub extra')
    pg.screenshot(path='/tmp/imp_pick.png')
    # ajout lignes ignorées
    pg.evaluate("RIMP.addIgnored()")
    chk('lignes ignorées ajoutées', pg.evaluate("recItems.length")==3)
    pg.evaluate("remRI(2)")  # retire de nouveau 'Sel'
    # édition + navigation sans perte
    pg.fill('#r-name','Brioche maison')
    pg.evaluate("RIMP.queueNext()"); pg.wait_for_timeout(100)
    chk('passe à Croissant', pg.evaluate("document.getElementById('r-name').value")=='Croissant')
    chk('brouillon Zorglub retiré en changeant', not pg.evaluate("ingredients.some(i=>i._imp)"))
    pg.evaluate("RIMP.queuePrev()"); pg.wait_for_timeout(100)
    chk('retour : édition conservée', pg.evaluate("document.getElementById('r-name').value")=='Brioche maison')
    chk('retour : lignes conservées', pg.evaluate("recItems.length")==2 and pg.evaluate("ingredients.some(i=>i._imp)"))
    # quitter + reprendre
    pg.evaluate("goPage('catalogue')")
    chk('quitter nettoie', not pg.evaluate("ingredients.some(i=>i._imp)") and pg.evaluate("document.getElementById('imp-bar')")==None)
    chk('catalogue inchangé', pg.evaluate("ingredients.length")==nIng0)
    pg.evaluate("goPage('rec-import')"); pg.wait_for_timeout(100)
    pg.evaluate("RIMP.resumeDraft()"); pg.wait_for_timeout(200)
    chk('reprise dans l’éditeur', pg.evaluate("CUR")=='rec-edit' and pg.evaluate("document.getElementById('r-name').value")=='Brioche maison')
    # enregistrer 1
    pg.evaluate("saveRecipe()"); pg.wait_for_timeout(150)
    chk('Brioche maison enregistrée', pg.evaluate("recipes.some(r=>r.name==='Brioche maison'&&r.source&&r.source.fileName==='multi.pdf')"))
    chk('ingrédient créé et réel', pg.evaluate("ingredients.some(i=>/zorglub extra/i.test(i.name)&&!i._imp)") and pg.evaluate("JSON.parse(localStorage.getItem('v4_ing')).some(i=>/zorglub/i.test(i.name))"))
    chk('passage auto à Croissant', pg.evaluate("document.getElementById('r-name').value")=='Croissant' and pg.evaluate("CUR")=='rec-edit')
    chk('bandeau 2 sur 3, 1 enregistrée', all(t in pg.evaluate("document.getElementById('imp-bar').innerText") for t in ['recette 2 sur 3','1 enregistrée']))
    # enregistrer 2
    pg.evaluate("saveRecipe()"); pg.wait_for_timeout(150)
    chk('Pain ouvert avec sous-recette', pg.evaluate("document.getElementById('r-name').value")=='Pain' and pg.evaluate("recItems.some(i=>i.type==='recipe')"))
    chk('sous-recette signalée', 'Sous-recette créée' in pg.evaluate("document.getElementById('r-items').innerText"))
    chk('sous-recette pas sur disque', pg.evaluate("(()=>{persist();return !JSON.parse(localStorage.getItem('v4_rec')).some(r=>r.name==='Poolish')})()"))
    pg.screenshot(path='/tmp/imp_sub.png')
    pg.evaluate("saveRecipe()"); pg.wait_for_timeout(200)
    chk('fin : liste des recettes', pg.evaluate("CUR")=='recettes' and pg.evaluate("!localStorage.getItem('v4_ridraft')") and pg.evaluate("document.getElementById('imp-bar')")==None)
    chk('Pain + Poolish créées et reliées', pg.evaluate("(()=>{var p=recipes.find(r=>r.name==='Pain'),s=recipes.find(r=>r.name==='Poolish');return !!(p&&s&&!s._imp&&p.items.some(i=>i.refId===s.id)&&p.items.every(i=>!i.imp))})()"))
    chk('recette Croissant enregistrée', pg.evaluate("recipes.some(r=>r.name==='Croissant')"))
    chk('plus de brouillon sur disque', pg.evaluate("!localStorage.getItem('v4_ridraft')"))
    chk('éditeur normal revenu à la normale', pg.evaluate("(openNewRec(),document.getElementById('imp-bar'))")==None and pg.evaluate("document.querySelector('#p-rec-edit button.btn-gold.btn-full').innerText.trim()")=='Enregistrer')
    # recette seule : ligne nouvelle retirée -> pas créée
    pg.evaluate("goPage('rec-valid')"); pg.evaluate("""()=>RIMP.fromParsed([{recipeName:'Test seul',main:[%s,%s],subRecipes:[],process:[]}],'seule.pdf')""" % (json.dumps(L('Farine',1)), json.dumps(L('Chimère rare',1))))
    chk('seule : pas de file', 'recette 1 sur' not in pg.evaluate("document.getElementById('imp-bar').innerText") and pg.evaluate("document.querySelectorAll('#imp-bar .imp-chips').length")==0)
    n0=pg.evaluate("ingredients.filter(i=>!i._imp).length")
    pg.evaluate("remRI(1)"); pg.evaluate("saveRecipe()"); pg.wait_for_timeout(150)
    chk('seule : enregistrée, rien de créé', pg.evaluate("recipes.some(r=>r.name==='Test seul')") and pg.evaluate("ingredients.length")==n0 and pg.evaluate("CUR")=='recettes')
    chk('aucune erreur JS', not errs, errs)
    # mobile
    pg2=b.new_page(viewport={'width':390,'height':800}); pg2.add_init_script(NOGATE); pg2.goto(URL); pg2.wait_for_timeout(400)
    pg2.evaluate("""()=>RIMP.fromParsed([{recipeName:'Brioche',main:[{detectedName:'Farine',quantity:1,unit:'kg',unitDetected:true,confidence:90},{detectedName:'Zorglub fantaisie',quantity:0.2,unit:'kg',unitDetected:true,confidence:90}],subRecipes:[],process:[]},{recipeName:'Croissant',main:[{detectedName:'Beurre',quantity:0.5,unit:'kg',unitDetected:true,confidence:90}],subRecipes:[],process:[]}],'multi.pdf')""")
    pg2.wait_for_timeout(200); pg2.screenshot(path='/tmp/imp_mobile.png')
    chk('mobile : pas de débordement', pg2.evaluate("document.documentElement.scrollWidth<=window.innerWidth+1"))
    b.close()
print(ok,'PASS',ko,'FAIL'); sys.exit(1 if ko else 0)
