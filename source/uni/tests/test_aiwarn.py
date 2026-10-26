from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto("file:///mnt/user-data/outputs/economat-pro/index.html")
    page.wait_for_timeout(300)
    page.evaluate("()=>new Promise(r=>{localStorage.clear(); var q=indexedDB.deleteDatabase('economat-pro'); q.onsuccess=q.onerror=q.onblocked=()=>r();})")
    page.reload()
    page.wait_for_timeout(400)

    fake_draft = {
        "name": "Test IA", "cat": "Boulangerie", "emoji": "📖",
        "lines": [], "subs": [], "process": [], "blocks": [],
        "aiWarning": "⚠️ Écart entre l'IA et l'analyse locale : IA = 2 recette(s) / 20 ingrédient(s), analyse locale = 1 / 9 — vérifiez attentivement avant d'enregistrer.",
        "src": {"thumb": None, "fileName": "test.pdf", "ts": 0}, "raw": ""
    }
    page.evaluate("(d) => (LS.setItem('v4_ridraft', JSON.stringify(d)), LS.flush())", fake_draft)
    page.evaluate("goPage('rec-import');")
    page.wait_for_timeout(100)
    page.evaluate("RIMP.resumeDraft();")
    page.wait_for_timeout(150)
    html = page.evaluate("document.getElementById('ri-aiwarn') ? document.getElementById('ri-aiwarn').innerHTML : 'MISSING'")
    print("ai warning box html contains message:", "Écart entre l'IA" in html)
    print(html[:200])
    print("errors:", errors)
    browser.close()
