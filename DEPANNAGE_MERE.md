# Dépannage : la Mère n’apparaît pas connectée dans Firebase Realtime Database

Dans Realtime Database, il n’y a pas de liste « clients connectés ». La Mère est « visible » uniquement via les **données** qu’elle écrit : `gateways/MERE-xxxxxxxx/lastSeen` (mis à jour toutes les 30 s).

## 1. Vérifier que les données apparaissent

1. Ouvrez **Firebase Console** → votre projet → **Realtime Database**.
2. Dans l’arbre, regardez **`gateways`** → **`MERE-XXXXXXXX`** (l’ID affiché sur le portail de la Mère, ex. `MERE-A842E35C`).
3. Si la Mère est bien connectée et écrit, vous devez voir au moins **`lastSeen`** avec un nombre (secondes depuis le boot). Ce nombre change environ toutes les 30 secondes.

Si **`gateways`** ou **`gateways/MERE-xxx`** n’existe pas, la Mère n’écrit pas (voir ci‑dessous).

## 2. Checklist côté Mère (firmware)

- **WiFi** : la Mère doit être configurée via le portail (AP AgriFlow-Setup, http://192.168.4.1). Sur l’écran ou en Serial (115200 baud) vous devez voir « WiFi OK » puis « Firebase OK ».
- **Auth anonyme** : la Mère utilise la connexion **anonyme**. Dans Firebase Console → **Authentication** → **Sign-in method** → **Anonymous** → **Activer**. Sans cela, « Firebase FAIL » ou erreur d’auth s’affiche.
- **Même base que le site** : dans `firmware_mere/include/config.h`, `FIREBASE_DATABASE_URL` doit être **exactement** la même URL que `NEXT_PUBLIC_FIREBASE_DATABASE_URL` du site (ex. `https://votre-projet-default-rtdb.europe-west1.firebasedatabase.app`).

## 3. Règles Realtime Database

Les règles doivent autoriser l’écriture sous `gateways` (pour la Mère) et la lecture pour les utilisateurs connectés (pour le site). Exemple :

```json
"gateways": {
  "$gatewayId": {
    ".read": "auth != null",
    ".write": "true"
  }
}
```

Déployez les règles : à la racine du projet, `firebase deploy --only database` (ou copiez/collez les règles dans l’onglet **Règles** de la Realtime Database).

## 4. Diagnostic sur la carte Mère

Après les changements récents du firmware, la Mère affiche **« lastSeen ERR »** sur l’écran et envoie un message en Serial si l’écriture de `lastSeen` échoue (ex. permission refusée). Branchez la Mère en USB, ouvrez le moniteur série (115200 baud) et regardez si apparaît :

- `lastSeen write FAIL: permission_denied` → règles non déployées ou trop restrictives.
- `Firebase signUp (anonymous) failed` → activer l’auth anonyme.
- `Firebase token timeout` → problème réseau ou URL/API key incorrecte.

## 5. ID passerelle identique sur le site

Sur le site (Matériel → Ajouter une passerelle), l’ID saisi doit être **exactement** celui affiché sur le portail de la Mère (ex. `MERE-A842E35C`). Sinon le site écoute un autre chemin et la passerelle reste « Hors ligne ».
