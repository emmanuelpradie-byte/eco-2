# Économat Pro — code source

Ce dossier contient tout ce qu'il faut pour modifier et republier l'appli.
Le site lui-même = les fichiers `index.html`, `sw.js`, `manifest.json` et
`icons/` à la racine du dépôt (GitHub Pages).

## Publier une nouvelle version
```
python3 source/publier.py
```
→ reconstruit l'appli à partir de `source/uni/` et remplace `index.html`,
`sw.js`, `manifest.json` et `icons/` à la racine. Il suffit ensuite de
committer : GitHub Pages met le site à jour en 1–2 minutes, et les
utilisateurs voient le bandeau « Nouvelle version disponible ».

⚠️ Si le site utilise l'appli **préconfigurée** (adresse du serveur intégrée),
remettre l'adresse et la clé publique dans `index.html` après construction :
`window.ECO_SERVER={url:"https://fbwuhejcphsjhhkfkjku.supabase.co",key:"<clé publique>"}`
(la clé publique `sb_publishable_…` n'est pas secrète ; ne jamais mettre la
clé *secret* / *service_role*).

## Organisation
- `uni/m.js` : base de l'appli (bons, recettes, catalogue, import).
  `uni/mk_app.py` y applique des retouches puis ajoute les modules :
  `features.js`, `cloud.js` (espace en ligne / Supabase), `share.js`,
  `partage.js` (Partage : dossiers, bons, PDF, mots de passe), `nav.js`,
  `admin.js`, `gate.js` (écran de connexion), `compte.js` (Mon compte),
  `carnet.js` (carnet + éditeur de recette), `boned.js` (éditeur de bon),
  `polish.js` (mise à jour, fluidité, feuilleter, finitions).
- `uni/body.html`, `uni/style.css`, `uni/theme.js`, `uni/loader.js` : page.
- `uni/build.py` : assemble tout en un seul `index.html` (+ `sw.js`).
- `cloud/supabase-setup.sql` : base Supabase complète (relançable sans risque).
- `cloud/supabase-update-v5.sql` : dernière mise à jour (mots de passe des dossiers).

## Tests
Playwright + un faux Supabase sur Postgres 16 (`cloud/mock_supabase.py`,
`cloud/stub.sql`, `cloud/start_all.sh`, `cloud/reset.sh`). Les scripts de
test contiennent des chemins absolus de l'environnement d'origine : les
adapter avant de les lancer.
