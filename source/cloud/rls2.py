import subprocess, json, uuid
def q(sql, uid=None):
    pre = "begin; set local role authenticated; select set_config('request.jwt.claims', '%s', true);\n" % json.dumps({'sub':uid}) if uid else "begin;"
    r=subprocess.run(['psql','-h','/tmp/pgtest','-p','54329','-U','postgres','-d','eco','-At','-q','-v','ON_ERROR_STOP=1','-c',pre+sql+";\ncommit;"],capture_output=True,text=True)
    out=[l for l in r.stdout.splitlines() if l.strip()]
    return (r.returncode==0, out[1:] if uid else out, r.stderr.strip().split('\n')[0] if r.stderr else '')
A,B=[str(uuid.uuid4()) for _ in range(2)]
for u,e in [(A,'a@x.fr'),(B,'b@x.fr')]: q("insert into auth.users(id,email) values ('%s','%s')"%(u,e))
q("update profiles set status='active'")
res=[]
def check(n,c): res.append(c); print(('PASS ' if c else 'FAIL ')+n)
ok,o,e=q("insert into user_docs(kind,id,data) values ('rec','r1','{\"name\":\"Baguette\"}'),('ing','i1','{}'),('cfg','v4_ingcats','[]')",A); check('espace perso: écrire rec/ing/cfg',ok)
ok,o,e=q("insert into user_docs(kind,id,data) values ('xxx','r1','{}')",A); check('type inconnu refusé',not ok)
ok,o,e=q("select count(*) from user_docs",B); check('B ne voit pas l’espace de A',o==['0'])
ok,o,e=q("update user_docs set data='{}' ",B); ok2,o2,_=q("select data->>'name' from user_docs where id='r1'",A); check('B ne peut pas modifier l’espace de A',o2==['Baguette'])
ok,o,e=q("insert into shared_recipes(id,owner_name,data) values ('A-r1','Emmanuel','{\"name\":\"Baguette\",\"attachments\":[{\"id\":\"att1\",\"name\":\"fiche.pdf\"}]}')",A); check('A partage',ok)
ok,o,e=q("select owner_name from shared_recipes",B); check('B voit la recette partagée',o==['Emmanuel'])
ok,o,e=q("update shared_recipes set data='{\"name\":\"pirate\"}' where id='A-r1'",B); ok2,o2,_=q("select data->>'name' from shared_recipes",A); check('B ne peut pas modifier la recette de A',o2==['Baguette'])
ok,o,e=q("insert into shared_recipes(id,owner,data) values ('A-r1','%s','{}') on conflict (id) do update set data=excluded.data"%B,B); ok2,o2,_=q("select data->>'name' from shared_recipes",A); check('B ne peut pas écraser via upsert',(not ok) and o2==['Baguette'])
ok,o,e=q("insert into shared_recipes(id,owner,data) values ('B-x','%s','{}')"%A,B); check('B ne peut pas publier au nom de A',not ok)
ok,o,e=q("delete from shared_recipes",B); ok2,o2,_=q("select count(*) from shared_recipes",A); check('pas de suppression physique',o2==['1'])
ok,o,e=q("update shared_recipes set data=jsonb_set(data,'{name}','\"Baguette v2\"') where id='A-r1'",A); ok2,o2,_=q("select data->>'name' from shared_recipes",B); check('A modifie sa recette partagée, B voit la v2',o2==['Baguette v2'])
ok,o,e=q("insert into attachments(id,name,mime,size,data) values ('att1','fiche.pdf','application/pdf',10,'data:x'),('att2','prive.jpg','image/jpeg',10,'data:y')",A); check('A envoie 2 documents',ok)
ok,o,e=q("select id from attachments order by id",B); check('B lit le document joint à la recette partagée, pas l’autre',o==['att1'])
ok,o,e=q("delete from attachments where id='att1'",B); ok2,o2,_=q("select count(*) from attachments",A); check('B ne peut pas supprimer les documents de A',o2==['2'])
ok,o,e=q("update shared_recipes set deleted=true where id='A-r1'",A); ok2,o2,_=q("select id from attachments",B); check('recette retirée du partage → document plus lisible',o2==[])
ok,o,e=q("delete from attachments where id='att2'",A); ok2,o2,_=q("select count(*) from attachments",A); check('A supprime son document',o2==['1'])
ok,o,e=q("insert into attachments(id,owner,name) values ('att3','%s','x')"%A,B); check('B ne peut pas créer un document au nom de A',not ok)
ok,o,e=q("set local role anon; select count(*) from shared_recipes"); check('anonyme refusé',not ok)
print(sum(res),'/',len(res))
