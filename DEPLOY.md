# CT Tracker - Guide de Deploiement

## Etapes de deploiement

### 1. Creer un projet Supabase

1. Va sur https://supabase.com et connecte-toi (ou cree un compte)
2. Clique "New Project"
3. Nom: `ct-tracker`, Region: `West EU (Frankfurt)`
4. Note le mot de passe de la base de donnees
5. Une fois cree, va dans **SQL Editor** et colle le contenu de `supabase-setup.sql`
6. Execute le script
7. Va dans **Project Settings > API** et note:
   - `Project URL` → c'est ton `SUPABASE_URL`
   - `service_role key` (pas la anon key!) → c'est ton `SUPABASE_SERVICE_KEY`

### 2. Creer un repo GitHub

1. Va sur https://github.com/new
2. Nom: `ct-tracker`
3. Private repository
4. Push le code:

```bash
cd ct-tracker
git init
git add .
git commit -m "Initial commit - CT Tracker"
git branch -M main
git remote add origin https://github.com/TON-USERNAME/ct-tracker.git
git push -u origin main
```

### 3. Deployer sur Vercel

1. Va sur https://vercel.com/new
2. Importe le repo `ct-tracker` depuis GitHub
3. Framework Preset: "Other"
4. Ajoute les variables d'environnement:
   - `SUPABASE_URL` = ton URL Supabase
   - `SUPABASE_SERVICE_KEY` = ta cle service Supabase
   - `META_PIXEL_ID` = ton ID de pixel Meta
   - `META_ACCESS_TOKEN` = ton token Conversions API
   - `STATS_API_KEY` = une cle aleatoire (ex: genere avec `openssl rand -hex 32`)
   - `IP_SALT` = un sel aleatoire
5. Deploy!

### 4. Connecter le domaine hm-events.ch

1. Dans Vercel > Project Settings > Domains
2. Ajoute `hm-events.ch`
3. Vercel te donnera un enregistrement DNS (CNAME ou A)
4. Va dans Infomaniak > ton domaine hm-events.ch > Zone DNS
5. Ajoute l'enregistrement fourni par Vercel
6. Attends la propagation DNS (~5-30 minutes)

### 5. Tester

Visite: `https://hm-events.ch/go/summer-vibes`

Tu devrais voir:
1. Une page noire avec un spinner "Redirection vers la billetterie..."
2. Apres ~1 seconde, redirection vers Eventfrog
3. Un nouveau record dans ta table `clicks` sur Supabase

### 6. Mettre a jour ta campagne Meta

Dans le Gestionnaire de publicites:
1. Va dans ta pub Summer Vibes Afro
2. Change l'URL de destination:
   - Avant: `https://eventfrog.ch/fr/p/soirees-fetes/...`
   - Apres: `https://hm-events.ch/go/summer-vibes`
3. Sauvegarde

Tous les clics passeront maintenant par ton tracker!
