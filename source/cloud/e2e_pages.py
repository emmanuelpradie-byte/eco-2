# Pages sources des livres : import « Ajouter » d'un fichier qui joint des PDF aux recettes
import json, sys, time
sys.path.insert(0,'/tmp/claude-0/-home-claude/68738804-a68f-5f46-9b52-b8b51de84108/scratchpad/cloud')
exec(open('/tmp/claude-0/-home-claude/68738804-a68f-5f46-9b52-b8b51de84108/scratchpad/cloud/e2e_multidev.py').read().split('def live()')[0])
FULL='/mnt/user-data/outputs/pages-sources-livres.json'
F=json.load(open(FULL))
RIDS=['g3onwacje4w','hcg861roed2','tep92b91jcn']   # pain au levain, spéculoos, egg muffin
small={k:F[k] for k in ('format','version','ingredients','recipes','orders')}
small['attLinks']={r:F['attLinks'][r] for r in RIDS+['inconnue']} if 'inconnue' in F['attLinks'] else {r:F['attLinks'][r] for r in RIDS}
small['attLinks']['zzinconnue']=F['attLinks'][RIDS[0]]
ids={m['id'] for r in RIDS for m in F['attLinks'][r]}
small['attachments']={i:F['attachments'][i] for i in ids}
SP='/tmp/claude-0/-home-claude/68738804-a68f-5f46-9b52-b8b51de84108/scratchpad/att/small.json'; json.dump(small,open(SP,'w'))
def addrec(pg):
    pg.evaluate("""(()=>{ [['g3onwacje4w','Pain au levain'],['hcg861roed2','Spéculoos'],['tep92b91jcn','Egg muffin']].forEach(function(x){
      recipes.push({id:x[0],name:x[1],cat:'Boulangerie',items:[],notes:'',createdAt:now(),updatedAt:now()}); }); persist(); })()""")
def imp(pg,path):
    pg.evaluate("goPage('backup')"); pg.wait_for_timeout(300)
    pg.evaluate("(()=>{var f=document.getElementById('bk-file'); f.onchange=function(){ importBackupFile(f,'merge'); };})()")
    pg.set_input_files('#bk-file',path)
with sync_playwright() as p:
    b=p.chromium.launch()
    A=newpage(b); A.goto(APP); A.wait_for_timeout(1200)
    gate_server(A); signup(A,'Emmanuel','emmanuel@test.fr')
    if 'sont-elles' in A.inner_text('#gate').lower(): A.click("text=Oui, ce sont les miennes")
    ok(wait_sync(A),'connecté')
    addrec(A); ok(sync(A),'3 recettes envoyées')
    n0=A.evaluate("recipes.length")
    imp(A,SP); A.wait_for_timeout(2500)
    ok(A.evaluate("recipes.length")==n0,'aucune recette ajoutée ni retirée')
    got=A.evaluate("recipes.filter(r=>r.attachments).map(r=>[r.id,r.attachments.map(a=>a.name)])")
    print('   ',got)
    ok(len(got)==3,'3 recettes ont leur page jointe')
    ok(any('Spéculoos' in '' or 'p. 236-237' in n for r in got for n in r[1]),'Spéculoos → p. 236-237')
    ok('page' in A.inner_text('#toast').lower(),'message : '+A.inner_text('#toast'))
    ok(wait_sync(A,30000),'synchronisation terminée')
    ok(db("select count(*) from attachments")==str(len(ids)),'documents en ligne : '+db("select count(*) from attachments"))
    ok(db("select count(*) from user_docs where kind='rec' and data ? 'attachments'")=='3','recettes en ligne avec leurs pièces jointes')
    # 2e import : rien en double
    imp(A,SP); A.wait_for_timeout(2500)
    ok(A.evaluate("recipes.find(r=>r.id==='g3onwacje4w').attachments.length")==1,'ré-import : pas de doublon')
    # téléphone : ouvre la page depuis le serveur
    T=newpage(b,True); T.goto(APP); T.wait_for_timeout(1200); gate_server(T); gate_auth(T,'login','emmanuel@test.fr')
    if 'sont-elles' in T.inner_text('#gate').lower(): T.click("text=Non")
    ok(wait_sync(T,15000),'téléphone connecté')
    a=T.evaluate("recipes.find(r=>r.id==='hcg861roed2').attachments[0]")
    ok(a and a['name'].startswith('Grand Livre'),'téléphone : pièce jointe visible '+str(a and a['name']))
    T.evaluate("attOpen(recipes.find(r=>r.id==='hcg861roed2').attachments[0])"); T.wait_for_timeout(2500)
    ok('Télécharger' in T.inner_text('#m-att'),'téléphone : le PDF s’ouvre depuis le serveur')
    T.screenshot(path=OUT+'pages_tel.png')
    # le vrai fichier complet (21 Mo) sur un ordinateur
    B=newpage(b); B.goto(APP); B.wait_for_timeout(1200); gate_server(B); gate_auth(B,'login','emmanuel@test.fr')
    if 'sont-elles' in B.inner_text('#gate').lower(): B.click("text=Non")
    wait_sync(B,15000); B.evaluate("recipes.forEach(r=>{delete r.attachments;}); persist();"); sync(B); t=time.time(); imp(B,FULL)
    for _ in range(60):
        B.wait_for_timeout(500)
        if B.evaluate("recipes.filter(r=>r.attachments).length")==3: break
    ok(B.evaluate("recipes.filter(r=>r.attachments).length")==3,'fichier complet importé en %.1fs'%(time.time()-t))
    ok(wait_sync(B,90000),'fichier complet : envoi terminé')
    ok(not A.errs and not T.errs and not B.errs,'pas d’erreur JS '+str((A.errs+T.errs+B.errs)[:2]))
    b.close()
print('%d PASS %d FAIL'%(res.count(True),res.count(False)))
