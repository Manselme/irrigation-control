# Configuration de l'échange de token (Module Mère)

Pour que le Module Mère puisse s'authentifier sans plan Blaze Firebase, l'échange de token se fait via une **API du site** (`/api/exchange-token`) au lieu d'une Cloud Function.

## 1. Récupérer la clé du compte de service Firebase

1. Va sur [Console Firebase](https://console.firebase.google.com) → projet **esp32-spi-projet**.
2. **Paramètres du projet** (icône engrenage) → **Comptes de service**.
3. Clique sur **Générer une nouvelle clé privée** (pour le compte "Firebase Admin SDK").
4. Un fichier JSON est téléchargé. Ouvre-le : c’est la clé du compte de service.

## 2. Configurer le site (variable d’environnement)

1. À la racine du dossier **Site**, crée ou édite le fichier **`.env.local`** (ne pas le commiter).
2. Ajoute une ligne avec le **contenu JSON complet** du fichier téléchargé (sur une seule ligne) :

   ```
   FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"esp32-spi-projet",...}
   ```

   - Tu peux copier tout le JSON du fichier, puis remplacer les retours à la ligne par des espaces, ou le minifier (une seule ligne).
   - Sous Windows, évite les guillemets en trop : utilise des guillemets simples pour entourer la valeur si ton shell les interprète.

3. Redémarre le serveur de dev si besoin : `npm run dev`.

## 3. Tester en local

1. Lance le site : `npm run dev`.
2. Sur le Module Mère, dans **config.h**, définis temporairement :

   ```c
   #define EXCHANGE_TOKEN_URL "http://IP_DE_TON_PC:3000/api/exchange-token"
   ```

   (Remplace `IP_DE_TON_PC` par l’IP de ta machine sur le réseau, par ex. `192.168.1.10`.)

3. Génère un token d’appairage sur le site (Matériel → Module Mère → icône clé), connecte le Module Mère au WiFi CeresAnalytics-Setup et entre ce token. L’ESP32 appellera ton PC en local.

## 4. Déployer le site (Vercel, Netlify, etc.)

1. Déploie le site (ex. Vercel) en ajoutant la variable **`FIREBASE_SERVICE_ACCOUNT_KEY`** dans les paramètres d’environnement du projet (valeur = le même JSON en une ligne).
2. Note l’URL du site déployé, ex. `https://ton-projet.vercel.app`.

## 5. Configurer le Module Mère pour la prod

Dans **firmware_mere/include/config.h**, mets l’URL de ton site déployé :

```c
#define EXCHANGE_TOKEN_URL "https://ton-projet.vercel.app/api/exchange-token"
```

Recompile et flashe le firmware. Désormais le Module Mère utilisera l’API de ton site en production.
