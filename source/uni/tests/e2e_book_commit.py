import sys, json
sys.argv=[sys.argv[0], sys.argv[1], '/tmp/book_reception.pdf', '0']
exec(open('/tmp/claude-0/-home-claude/68738804-a68f-5f46-9b52-b8b51de84108/scratchpad/e2e_pdf_all.py').read().split("with sync_playwright() as p:")[0])
with sync_playwright() as p:
    b=p.chromium.launch(); page=b.new_page(); errs=[]
    page.on('pageerror',lambda e: errs.append(str(e))); page.on('dialog',lambda d:d.accept())
    page.route('https://cdnjs.cloudflare.com/**', route); page.route('https://local.pdfjs/**', route)
    page.goto('file:///mnt/user-data/outputs/'+FILE); page.wait_for_timeout(300)
    page.evaluate("()=>new Promise(r=>{localStorage.clear(); var q=indexedDB.deleteDatabase('economat-pro'); q.onsuccess=q.onerror=q.onblocked=()=>r();})"); page.reload(); page.wait_for_timeout(500)
    page.evaluate("goPage('rec-import')"); page.set_input_files('#ri-f-pdf', PDF)
    page.wait_for_function("document.getElementById('ri-result').style.display==='block'", timeout=120000); page.wait_for_timeout(1500)
    badges=page.evaluate("Array.from(document.querySelectorAll('#ri-queuenav .ri-badge')).map(b=>b.textContent)")
    for nm in ['Tourte de seigle','Pain à l’anis','Pain au lentille sur méthode inversée','Khorasan']:
        k=badges.index(nm); page.evaluate("RIMP.queueGo(%d)"%k); page.wait_for_timeout(150)
        print(nm, '→ subs card:', page.evaluate("document.getElementById('ri-subs').innerText").replace('\n',' ')[:160])
        page.evaluate("document.getElementById('ri-save').click()"); page.wait_for_timeout(250)
    r=page.evaluate("""() => recipes.filter(r=>['Tourte de seigle','Rafraîchis levain','Pain à l’anis','Sirop d’anis'].includes(r.name)).map(r=>({name:r.name,
        items:r.items.map(i=>i.type==='recipe'?('⊛'+(recipes.find(x=>x.id===i.refId)||{}).name+' ×'+i.qty):((ingredients.find(x=>x.id===i.refId)||{}).name+' '+i.qty+i.unit)), notes:r.notes.slice(0,120)}))""")
    print(json.dumps(r,ensure_ascii=False,indent=1)); print('errors:',errs); b.close()
