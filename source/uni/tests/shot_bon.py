import re
src=open('e2e_bon.py').read()
SEED=re.search(r'SEED=r"""(.*?)"""',src,re.S).group(1)
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch()
    for vp,t in [({'width':1300,'height':860},'d'),({'width':390,'height':844},'m')]:
        pg=b.new_page(viewport=vp); pg.goto('file:///mnt/user-data/outputs/economat-pro/index.html'); pg.wait_for_timeout(900)
        pg.evaluate(SEED); pg.wait_for_timeout(300)
        pg.screenshot(path='../shots/%s_bonfull.png'%t)
        if t=='m':
            pg.evaluate("document.getElementById('scroll').scrollTop=1500"); pg.wait_for_timeout(200); pg.screenshot(path='../shots/m_bonfull2.png')
    b.close()
