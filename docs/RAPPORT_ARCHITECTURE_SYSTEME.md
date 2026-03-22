# Rapport d’architecture — Système CeresAnalytics (irrigation intelligente)

**Type de document :** rapport d’architecture technique  
**Produit / projet :** CeresAnalytics — supervision et pilotage d’irrigation à distance  
**Version du document :** 1.0  
**Date :** mars 2026  

---

## Table des matières

1. [Résumé exécutif](#1-résumé-exécutif)  
2. [Introduction et contexte](#2-introduction-et-contexte)  
3. [Périmètre du système](#3-périmètre-du-système)  
4. [Principes architecturaux](#4-principes-architecturaux)  
5. [Vue d’ensemble](#5-vue-densemble)  
6. [Description des composants](#6-description-des-composants)  
7. [Modèle de données et persistance](#7-modèle-de-données-et-persistance)  
8. [Flux fonctionnels majeurs](#8-flux-fonctionnels-majeurs)  
9. [Sécurité et gouvernance des accès](#9-sécurité-et-gouvernance-des-accès)  
10. [Contraintes, limites et risques](#10-contraintes-limites-et-risques)  
11. [Évolutions envisageables](#11-évolutions-envisageables)  
12. [Conclusion](#12-conclusion)  
13. [Références documentaires](#13-références-documentaires)  

---

## 1. Résumé exécutif

Le système **CeresAnalytics** permet à un exploitant agricole de **surveiller** l’état hydrique du sol (capteurs), de **piloter** une pompe et des **vannes A/B**, et de **consulter** historiques et alertes via une **interface web**. L’architecture repose sur trois piliers :

- une **interface homme-machine (IHM)** web (Next.js) accessible par navigateur ;
- une **base de données temps réel** (Firebase Realtime Database) servant de médiateur entre l’IHM, les services et le terrain ;
- un **réseau terrain sans fil longue portée (LoRa)** reliant des **modules ESP32** (capteurs « Champ », actionneurs « Pompe ») à une **passerelle ESP32** (« Module Mère ») connectée à Internet en Wi-Fi.

Ce rapport formalise la **décomposition logique et physique** du système, les **flux d’information** essentiels, le **modèle de données** exposé par la plateforme, ainsi que les **contraintes** et **pistes d’extension** (dont un module de conseil par IA en local).

---

## 2. Introduction et contexte

### 2.1 Problématique

L’irrigation de précision exige une **mesure** fiable de l’état du sol et une **action** coordonnée sur les organes hydrauliques (pompe, vannes), souvent éloignés du bureau ou de la maison. Les solutions doivent fonctionner en **environnement rural** (couverture réseau variable, pas de câblage systématique) tout en restant **accessibles** pour un utilisateur non informaticien.

### 2.2 Réponse apportée

Le système combine :

- des **nœuds autonomes** sur le terrain (batterie / secteur selon le module) ;
- une **passerelle unique** par exploitation pour limiter les coûts et la complexité de connexion IP ;
- un **cloud** pour la disponibilité de l’IHM et la centralisation des données ;
- des **règles d’accès** par utilisateur pour le volet « compte agriculteur ».

Le nom commercial retenu pour la plateforme est **CeresAnalytics** ; le point d’accès Wi-Fi de configuration de la passerelle est notamment diffusé sous le SSID **CeresAnalytics-Setup** (firmware Module Mère).

---

## 3. Périmètre du système

### 3.1 Inclus dans le périmètre architectural

| Domaine | Description |
|---------|-------------|
| IHM web | Application Next.js (tableaux de bord, irrigation & zones, matériel, alertes, historique, simulateur intégré). |
| Authentification | Firebase Authentication (ex. e-mail / mot de passe). |
| Persistance temps réel | Firebase Realtime Database (schémas `users/…` et `gateways/…`). |
| Passerelle | Firmware « Module Mère » (ESP32, Wi-Fi + LoRa), provisioning, appairage, synchronisation cloud. |
| Nœuds terrain | Firmware « Champ » (capteurs), « Pompe » (actionneurs, vannes A/B selon évolution produit). |
| Outils | Simulateur de modules (application dédiée ou bac à sable dans le site), documentation technique. |

### 3.2 Hors périmètre ou périphérique

- Détail du **calibrage agronomique** des seuils (responsabilité métier).  
- **Hébergement** précis (Vercel, Firebase Hosting, etc.) — variable selon déploiement.  
- **Météorologie** en tant que source système intégrée (non obligatoire dans la V1 ; peut être ajoutée par extension).  

---

## 4. Principes architecturaux

1. **Séparation des responsabilités** : la BDD ne contient pas de logique métier complexe ; elle agrège l’état et les événements.  
2. **Temps réel prioritaire** : l’IHM s’abonne aux chemins pertinents pour refléter l’état courant sans rechargement manuel systématique.  
3. **Identité matérielle stable** : les modules terrain sont identifiés par des identifiants dérivés de la **MAC** ou des conventions `CHAMP-…` / `POMPE-…` / `MERE-…`.  
4. **Double voie d’accès aux commandes** : architecture **passerelle** (`gateways/{id}/commands/current` + `valveSlot`) et voie **legacy** (`users/{uid}/commands` + `actuatorState`) pour compatibilité et simulation.  
5. **Irrigation par zone liée à une vanne** : l’affichage « en cours » doit tenir compte à la fois de l’état **pompe** et de l’ouverture de la **vanne** (A ou B) associée à la zone, lorsque le modèle de données le prévoit.  

---

## 5. Vue d’ensemble

### 5.1 Décomposition en trois zones géographiques / logiques

| Zone | Éléments | Liaison principale |
|------|-----------|-------------------|
| **Cloud (Internet)** | IHM web, Firebase (Auth + RTDB) | HTTPS / SDK Firebase |
| **Site « connecté »** (ex. maison, atelier) | Module Mère ESP32 | Wi-Fi vers Internet |
| **Terrain** | Modules Champ et Pompe | LoRa vers la Mère |

### 5.2 Schéma synthétique

Une représentation graphique (Mermaid) détaillée figure dans le document **`architecture-systeme.md`** (même répertoire `docs/`). Elle illustre les flux **IHM ↔ Firebase**, **Firebase ↔ Passerelle**, **Passerelle ↔ Champ / Pompe**.

---

## 6. Description des composants

### 6.1 Interface homme-machine (IHM)

- **Technologie** : framework **Next.js** (React), interface responsive.  
- **Fonctions** : consultation des mesures, gestion des **zones** et de l’**irrigation** (y compris distinction **vannes A et B** lorsque configurée), gestion du **matériel**, **alertes**, **historique**, **simulateur** pour tests.  
- **Accès données** : bibliothèque cliente Firebase, hooks applicatifs (ex. zones, modules, états pompe, capteurs, envoi de commandes).  

### 6.2 Firebase Realtime Database

- Rôle de **bus de données** et de **stockage** synchronisé.  
- Organisation en branches **`users/{uid}`** (données « compte ») et **`gateways/{gatewayId}`** (données « passerelle / terrain » selon modèle déployé).  
- Les **règles de sécurité** (fichier `database.rules.json` dans le dépôt) encadrent les lectures/écritures.

### 6.3 Firebase Authentication

- Garantit l’**identité** de l’utilisateur de l’IHM.  
- L’UID sert de racine logique pour `users/{uid}/…`.

### 6.4 Module Mère (passerelle ESP32)

- **Wi-Fi** : connexion au réseau local / Internet.  
- **LoRa** : communication avec les nœuds Champ et Pompe.  
- **Provisioning** : au premier démarrage, point d’accès **CeresAnalytics-Setup** et portail de configuration (SSID, mot de passe, token d’appairage).  
- **Sécurité terrain** : mécanismes d’appairage (token) et, selon firmware, liste autorisée des modules remontés vers le cloud.  

### 6.5 Module Champ (ESP32)

- Acquisition **capteurs** (humidité, tension du sol en centibars, batterie, etc.).  
- Transmission vers la Mère en **LoRa** ; pas d’accès Wi-Fi direct au cloud dans l’architecture cible.  
- Optimisation **énergétique** possible (cycles veille / mesure).

### 6.6 Module Pompe (ESP32)

- Réception des **commandes** (pompe, vannes).  
- Remontée d’**états** (marche / arrêt, vannes, pression selon implémentation).  
- Mécanismes de **sécurité** (ex. temporisation sans message de la Mère) selon firmware.

---

## 7. Modèle de données et persistance

### 7.1 Principales familles de chemins

Les chemins exacts peuvent évoluer ; le tableau ci-dessous résume l’**intention** architecturale.

| Famille | Rôle |
|---------|------|
| `users/{uid}/modules` | Inventaire des modules logiques (lien ferme, passerelle, `deviceId`, etc.). |
| `users/{uid}/zones` | Polygones, association capteur / pompe, secteurs et **vanne** (A/B) si modélisé. |
| `users/{uid}/linkedGateways` | Association utilisateur ↔ passerelle. |
| `users/{uid}/commands/{moduleId}` | Commandes **legacy** (sans chemin passerelle dédié). |
| `users/{uid}/actuatorState/{moduleId}` | État agrégé actionneur (pompe, vannes) en mode legacy. |
| `gateways/{id}/sensors/{deviceId}` | Dernières mesures côté passerelle. |
| `gateways/{id}/status/{deviceId}` | État matériel (pompe, vannes, pression…). |
| `gateways/{id}/commands/current` | File de commande vue par la passerelle (`dest`, `type`, `valveSlot`, statuts). |
| `gateways/{id}/pumpActivity/…` | Agrégats d’activité (quotas, historiques). |

### 7.2 Cohérence multi-vannes

Lorsqu’une même pompe dessert **deux circuits** (vannes A et B), la base peut stocker **par vanne** des booléens dédiés (`valveAOpen`, `valveBOpen`) en plus d’un indicateur agrégé (`valveOpen`). L’IHM doit en déduire l’état **par zone** liée à chaque vanne.

---

## 8. Flux fonctionnels majeurs

### 8.1 Remontée des mesures (Champ → Cloud → IHM)

1. Le module Champ mesure et émet une trame LoRa.  
2. La Mère reçoit, valide (selon règles) et écrit dans Firebase (branche passerelle et/ou miroir utilisateur).  
3. L’IHM met à jour les tableaux et cartes (stress, alertes).  

### 8.2 Commande d’irrigation (IHM → Pompe)

1. L’utilisateur lance ou arrête une irrigation depuis une **zone** configurée.  
2. L’IHM écrit une commande (passerelle ou legacy).  
3. La Mère transmet en LoRa à la pompe concernée.  
4. La pompe exécute et l’état est répercuté dans `status` / `actuatorState`.  
5. L’IHM affiche les accusés et l’état « en cours » **par zone** lorsque la vanne correspondante est ouverte et la pompe active.  

### 8.3 Configuration initiale de la passerelle

1. Génération d’un **token d’appairage** depuis l’IHM.  
2. Connexion au Wi-Fi **CeresAnalytics-Setup**, saisie du token et des paramètres réseau.  
3. Association persistante (NVS) et accès Firebase authentifié côté Mère (selon implémentation — custom token, etc.).  

---

## 9. Sécurité et gouvernance des accès

- **Authentification** des utilisateurs IHM via Firebase Auth.  
- **Règles RTDB** : distinction accès propriétaire sur `users/{uid}` et politique spécifique pour `gateways/{…}` (secrets passerelle, compte de service, etc.).  
- **Secrets** : clés de compte de service et clés API **ne doivent pas** être versionnées ; utilisation de variables d’environnement.  
- **Recommandation** : toute **action critique** sur le terrain reste sous la responsabilité de l’exploitant ; les seuils et automatisations doivent être validés agronomiquement.  

---

## 10. Contraintes, limites et risques

| Contrainte | Impact |
|------------|--------|
| Débit LoRa limité | Pas de gros volumes binaires ; messages courts et périodiques. |
| Latence bout-en-bout | Délai entre action IHM et effet physique ; états « pending » côté UI. |
| Dépendance réseau | Passerelle hors ligne : données cloud potentiellement figées ; comportement terrain selon firmware. |
| Identifiants matériels | Cohérence entre `deviceId` en base et adressage LoRa indispensable. |
| Évolution firmware / web | Nécessité de maintenir la **compatibilité** (chemins multiples, alias d’ID). |

---

## 11. Évolutions envisageables

- **Module de conseil IA en local** : service sur poste à la ferme lisant Firebase (Admin SDK), enrichi par API météo, produisant des recommandations textuelles (LLM local type Ollama) — voir section dédiée dans `architecture-systeme.md`.  
- **Intégration météo native** dans l’IHM pour affichage et règles d’arrosage.  
- **Rapports PDF / export** étendus (déjà exports CSV côté historique).  
- **Durcissement** : audit de règles Firebase, rotation des secrets, journalisation des commandes.  

---

## 12. Conclusion

L’architecture **CeresAnalytics** articule clairement **trois niveaux** — cloud, passerelle, terrain — autour d’une **base temps réel** et d’un **protocole radio** adapté aux distances rurales. La séparation entre données **utilisateur** et données **passerelle**, ainsi que la prise en charge des **vannes A/B**, permettent de faire évoluer le système vers une irrigation plus fine par zone tout en conservant une **IHM unifiée**.

Ce rapport peut servir de base à une **revue d’architecture**, à une **formation** des utilisateurs avancés ou à un **dossier technique** d’accompagnement déploiement.

---

## 13. Références documentaires

| Document | Emplacement (indicatif) |
|----------|-------------------------|
| Architecture détaillée + diagrammes Mermaid | `Site/docs/architecture-systeme.md` |
| Architecture firmware / LoRa / site (référence projet) | `ARCHITECTURE.md` (racine dépôt) |
| Dépannage Module Mère | `Site/DEPANNAGE_MERE.md` |
| Appairage token | `Site/PAIRING_TOKEN_SETUP.md` |

---

*Fin du rapport — CeresAnalytics, architecture système.*
