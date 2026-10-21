import sys, json
from playwright.sync_api import sync_playwright
FILE=sys.argv[1]
with sync_playwright() as p:
    b=p.chromium.launch(); page=b.new_page(); errs=[]
    page.on('pageerror',lambda e: errs.append(str(e))); page.on('dialog',lambda d:d.accept())
    page.goto('file:///mnt/user-data/outputs/'+FILE); page.wait_for_timeout(300)
    page.evaluate("()=>new Promise(r=>{localStorage.clear(); var q=indexedDB.deleteDatabase('economat-pro'); q.onsuccess=q.onerror=q.onblocked=()=>r();})"); page.reload(); page.wait_for_timeout(500)
    page.evaluate("goPage('rec-import')"); page.set_input_files('#ri-f-xls','/tmp/base_recettes.xlsx')
    page.wait_for_function("document.getElementById('ri-result').style.display==='block'", timeout=20000); page.wait_for_timeout(800)
    page.evaluate("document.getElementById('ri-save').click()"); page.wait_for_timeout(300)
    page.evaluate("document.getElementById('ri-save').click()"); page.wait_for_timeout(300)
    r=page.evaluate("""() => ({page:CUR, recs:recipes.filter(r=>['Brioche','Pain au sarrasin','Empois'].includes(r.name)).map(r=>({name:r.name,cat:r.cat,
       items:r.items.map(i=>i.type==='recipe'?('⊛'+(recipes.find(x=>x.id===i.refId)||{}).name+' ×'+i.qty):((ingredients.find(x=>x.id===i.refId)||{}).name+' '+i.qty+' '+i.unit))}))})""")
    print(json.dumps(r,ensure_ascii=False,indent=1))
    page.evaluate("goPage('rec-import')"); page.set_input_files('#ri-f-xls','/tmp/vieux.xls')
    page.wait_for_function("document.getElementById('ri-fail').style.display==='block'", timeout=20000)
    print('XLS message:', page.evaluate("document.getElementById('ri-fail').innerText")[:200].replace('\n',' '))
    print('errors:',errs); b.close()
