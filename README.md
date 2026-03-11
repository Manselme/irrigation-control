# Contrôle d'irrigation intelligent

Plateforme web pour piloter, automatiser et surveiller l'irrigation à distance (modules IoT LoRa/ESP32).

## Stack

- **Frontend:** Next.js 14 (App Router), React, TypeScript, Tailwind CSS, Shadcn UI
- **Données:** Firebase (Authentication + Realtime Database)
- **Carte:** react-leaflet, OpenStreetMap
- **Graphiques:** Recharts
- **Météo:** API Open-Meteo (sans clé)

## Prérequis

Avant d’installer le projet, il faut :

- **Node.js** 18 ou 20 (recommandé) et **npm**
  - Télécharger depuis : https://nodejs.org
- **Git** (pour cloner le dépôt) : https://git-scm.com
- (Optionnel mais recommandé) **Visual Studio Code** avec :
  - Extension **ESLint**
  - Extension **Tailwind CSS IntelliSense**
  - Extension **Prettier** (ou équivalent)

Sur Windows, le script `setup-project.bat` aide à vérifier ces prérequis et à installer les dépendances npm.

## Installation

1. Cloner le projet et installer les dépendances (ou lancer `setup-project.bat`) :

```bash
npm install
```

2. Créer un projet Firebase sur [console.firebase.google.com](https://console.firebase.google.com) :
   - Activer **Authentication** (méthode Email/Mot de passe)
   - Créer une **Realtime Database**
   - Récupérer la config du projet

3. Copier les variables d'environnement :

```bash
cp .env.example .env.local
```

Renseigner dans `.env.local` les clés Firebase (`NEXT_PUBLIC_FIREBASE_*`).

4. (Optionnel) Déployer les règles de sécurité Realtime Database :

```bash
firebase deploy --only database
```

Le fichier `database.rules.json` à la racine peut être utilisé dans la console Firebase (Rules).

5. Lancer le serveur de développement :

```bash
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

## Parcours fonctionnel

- **Connexion** : inscription / connexion (email + mot de passe).
- **Matériel** : créer une ferme, ajouter des modules (Mère, Pompe, Champ) par ID.
- **Carte** : créer des zones (polygones), assigner pompe et capteurs Champ ; les modules Champ s’affichent par GPS.
- **Pilotage** : par zone, mode manuel (toggles pompe/vanne + suggestion météo) ou mode automatique (règles humidité + pluie).
- **Historique** : graphiques 30 jours (humidité, temps pompe, pluie).
- **Alertes** : seuils (batterie, pression, hors ligne), notifications sur le tableau de bord.

## Règles métier

- Module **hors ligne** : contrôles de la zone grisés.
- **Commande** : envoi vers Firebase ; affichage d’un état de chargement jusqu’à confirmation par l’ESP32 (ou timeout 30 s).
- **Hors connexion** : bandeau « Données non temps réel » en haut de l’écran.

## Structure Firebase (Realtime Database)

- `users/{userId}/farms` – fermes
- `users/{userId}/modules` – modules (Mère/Pompe/Champ), `lastSeen`, `online`, `battery`, `position`, `pressure`
- `users/{userId}/zones` – zones (polygone, mode, `pumpModuleId`, `fieldModuleIds`)
- `users/{userId}/commands/{moduleId}` – dernière commande (status: pending | confirmed | failed)
- `users/{userId}/sensorData/{moduleId}/latest` – dernière mesure (humidity, ph, battery)
- `users/{userId}/alerts/config` – seuils ; `users/{userId}/alerts/notifications` – liste des alertes
- `users/{userId}/pumpActivity/{moduleId}/{date}` – (optionnel) minutes de pompe par jour

L’ESP32 / module Mère doit écrire `lastSeen`, `sensorData`, `position`, `pressure` et mettre à jour `commands/{moduleId}.status` après exécution.
