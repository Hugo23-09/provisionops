# Cahier des charges
## Plateforme de provisioning self-service de VM/LXC sur Proxmox

**Nom de projet (proposition) :** ProvisionOps
**Auteur :** Hugo
**Date :** Juillet 2026
**Version :** 0.1 (brouillon initial)

---

## 1. Présentation du projet

### 1.1 Résumé
Le projet consiste à développer une application web, packagée et exécutée via Docker, permettant de créer des conteneurs LXC ou des machines virtuelles (VM) sur un cluster/hyperviseur Proxmox VE, à travers une interface de type formulaire guidé (QCM / assistant pas-à-pas), sans avoir à passer par l'interface web native de Proxmox ni par la ligne de commande.

### 1.2 Objectif principal
Simplifier et fiabiliser la création de ressources virtualisées (LXC/VM) dans un environnement Proxmox personnel (homelab), en proposant une interface simplifiée qui masque la complexité de Proxmox (choix de template, stockage, réseau, ressources) derrière un parcours guidé de type questionnaire à choix multiples.

### 1.3 Vision produit
Un outil autonome, léger, déployable en une commande (`docker compose up`), qui agit comme une couche d'abstraction entre l'utilisateur et l'API Proxmox. À terme, l'outil doit pouvoir évoluer vers un véritable portail self-service (multi-utilisateurs, catalogue de templates, quotas), mais la V1 se concentre sur un usage personnel mono-utilisateur.

### 1.4 Public cible
- V1 : usage personnel (Hugo), sur son homelab Proxmox existant.
- Évolution possible : petite équipe / usage pédagogique (démonstration BTS SIO, portfolio technique).

### 1.5 Valeur ajoutée
- Gain de temps sur la création de ressources récurrentes.
- Réduction du risque d'erreur de configuration (réseau, stockage, ressources).
- Un projet vitrine technique valorisable (portfolio DevOps/SRE, alternance, entretiens).
- Brique réutilisable dans l'écosystème homelab existant (NovaOps, GitLab CE, Terraform/Ansible).

---

## 2. Contexte du projet

### 2.1 Contexte technique existant
Le porteur du projet dispose déjà d'un homelab structuré comprenant :
- Un serveur Proxmox VE hébergeant VMs et conteneurs LXC.
- Une instance GitLab CE auto-hébergée utilisée pour CI/CD.
- Des pipelines existants basés sur Terraform (provider Proxmox) et Ansible pour le déploiement d'une application de microservices (projet NovaOps).
- Une bonne maîtrise de l'API Proxmox, de la gestion des templates LXC/VM, et des contraintes réseau (bridges, VLAN, double NAT via Freebox + OPNsense).

### 2.2 Problème identifié
La création manuelle de VM/LXC via l'interface Proxmox ou via des scripts Terraform ad hoc nécessite :
- de connaître les identifiants exacts de templates, storage IDs, bridges réseau ;
- de rédiger ou adapter du code Terraform à chaque nouveau besoin ponctuel ;
- un contexte technique que l'on ne souhaite pas toujours mobiliser pour une tâche simple et récurrente (ex. "je veux vite un LXC Debian avec 2 Go de RAM pour tester un truc").

Il n'existe pas aujourd'hui, dans l'environnement du porteur de projet, d'interface simplifiée type "assistant" pour ce besoin.

### 2.3 Positionnement par rapport à l'existant
Des solutions similaires existent dans l'écosystème (ex. Proxmox Helper Scripts communautaires, Terraform + Ansible manuels, portails self-service commerciaux type Morpheus/Cockpit). Le projet ne vise pas à les remplacer mais à construire un outil sur-mesure, simple, compréhensible de bout en bout par son auteur, et intégrable à l'infrastructure existante (GitLab CI/CD, Ansible).

### 2.4 Périmètre du projet (V1)
Inclus :
- Interface web de création guidée de LXC et de VM.
- Communication avec un unique noeud/cluster Proxmox existant.
- Choix guidé des paramètres essentiels (type de ressource, OS/template, CPU, RAM, disque, réseau).
- Déclenchement de la création réelle de la ressource sur Proxmox.

Exclu (hors périmètre V1, pistes d'évolution) :
- Gestion multi-utilisateurs et authentification avancée (SSO, RBAC fin).
- Facturation, quotas, comptabilité de ressources.
- Gestion du cycle de vie complet (suppression, snapshot, clonage, migration) — pourra faire l'objet d'une V2.
- Orchestration multi-nœuds / multi-cluster Proxmox.
- Provisioning post-création avancé (configuration applicative via Ansible) — pourra être une intégration future avec l'existant NovaOps.

---

## 3. Contraintes techniques

### 3.1 Architecture générale
- **Conteneurisation** : l'application doit être livrée sous forme d'image(s) Docker, déployable via `docker compose`.
- **Architecture cible** : séparation logique entre un frontend (interface utilisateur), un backend (logique métier / API), et l'intégration avec l'API Proxmox VE (REST API native de Proxmox, avec authentification par token API).
- **Hébergement** : l'application tourne sur une machine du réseau local (ex. VM/LXC dédiée ou serveur Docker existant du homelab), avec accès réseau au(x) nœud(s) Proxmox concerné(s).

### 3.2 Intégration Proxmox
- Utilisation de l'API REST officielle de Proxmox VE (`/api2/json`).
- Authentification via un **token API** dédié à l'application, avec des permissions Proxmox restreintes au strict nécessaire (principe du moindre privilège : création de VM/LXC, lecture des ressources disponibles — templates, storages, bridges).
- Récupération dynamique depuis Proxmox des éléments proposés dans les QCM (templates LXC disponibles, ISOs, pools de stockage, bridges réseau existants) plutôt que des valeurs codées en dur, afin de rester synchronisé avec l'état réel de l'infrastructure.
- Gestion asynchrone de la création : suivi de la tâche Proxmox (task UPID) jusqu'à son terme, avec retour de statut à l'utilisateur (en cours / succès / erreur).

### 3.3 Stack technique (à définir/valider, propositions)
- **Backend** : langage et framework au choix du développeur selon compétences visées (ex. Python/FastAPI, ou Node.js/Express) — critère de choix : simplicité d'intégration avec l'API REST Proxmox et facilité de maintenance.
- **Frontend** : interface web simple, responsive, formulaire multi-étapes (wizard). Pas de nécessité de framework front lourd pour la V1 ; un rendu serveur ou une SPA légère sont tous deux acceptables.
- **Stockage de configuration applicative** : fichier de configuration (`.env` / YAML) pour les paramètres de connexion à Proxmox (URL API, token, nœud cible), aucune donnée sensible en dur dans le code.
- **Conteneurisation** : Dockerfile(s) + `docker-compose.yml` pour un déploiement en une commande.

### 3.4 Réseau
- L'application doit être capable de fonctionner dans l'environnement réseau du homelab (potentiellement derrière OPNsense, avec accès VPN existant type WireGuard/OpenVPN).
- Le choix du réseau pour la VM/LXC créée doit s'appuyer sur les bridges réseau réellement configurés sur le nœud Proxmox cible (ex. `vmbr0`), proposés dynamiquement dans le QCM.

### 3.5 Sécurité
- Le token API Proxmox utilisé par l'application ne doit pas être exposé côté client (frontend) ; toute communication avec l'API Proxmox transite exclusivement par le backend.
- Accès à l'interface web protégé a minima par une authentification simple (ex. identifiant/mot de passe unique, ou restriction d'accès réseau via VPN) pour la V1, en l'absence de gestion multi-utilisateurs.
- Connexion au serveur Proxmox en HTTPS (vérification ou gestion explicite du certificat, y compris auto-signé en environnement homelab).
- Validation stricte côté backend de toutes les entrées utilisateur avant transmission à l'API Proxmox (bornes de RAM, CPU, taille disque, caractères autorisés pour les noms de VM/LXC) afin d'éviter toute création erronée ou tout usage détourné de l'outil.

### 3.6 Compatibilité
- Version de Proxmox VE ciblée : celle actuellement déployée sur l'infrastructure du porteur de projet (à préciser/figer en début de développement, ex. Proxmox VE 8.x).
- Navigateurs cibles : navigateurs modernes standards (Chrome/Firefox/Edge récents), pas de contrainte de compatibilité navigateurs anciens.

### 3.7 Performance
- Le temps de réponse de l'interface (hors temps de création effective sur Proxmox, qui dépend de Proxmox lui-même) doit rester de l'ordre de quelques secondes maximum pour chaque étape du formulaire.
- L'application ne doit pas générer de charge significative sur l'hôte Proxmox en dehors des appels API nécessaires (pas de polling agressif).

---

## 4. Contraintes fonctionnelles

### 4.1 Parcours utilisateur principal (wizard)
L'utilisateur doit pouvoir, depuis la page web :

1. **Choisir le type de ressource** à créer : LXC (conteneur) ou VM (machine virtuelle).
2. **Choisir le système d'exploitation / template** correspondant (ex. template LXC Debian/Ubuntu disponible sur le storage Proxmox, ou ISO pour une VM).
3. **Définir les ressources allouées** :
   - CPU (nombre de cœurs, éventuellement type de socket pour une VM).
   - RAM (quantité, en Mo/Go, avec valeurs proposées ou saisie encadrée par des bornes min/max).
   - Disque (taille, et pool de stockage cible parmi ceux disponibles sur le nœud).
4. **Définir la configuration réseau** :
   - Bridge réseau cible (liste dynamique selon la configuration Proxmox réelle).
   - Mode d'adressage (DHCP ou IP statique avec saisie IP/masque/passerelle, selon besoin).
5. **Nommer la ressource** (identifiant/hostname), avec vérification qu'il n'existe pas déjà un conflit d'ID ou de nom sur le nœud Proxmox.
6. **Récapitulatif** : l'utilisateur voit un résumé complet de sa configuration avant validation finale.
7. **Validation / création** : au clic sur "Créer", l'application déclenche la création réelle de la ressource sur Proxmox via l'API.
8. **Suivi du résultat** : affichage d'un statut de progression, puis confirmation de succès (avec éventuellement l'ID/l'IP attribuée) ou message d'erreur explicite en cas d'échec.

### 4.2 Règles de gestion
- Les choix proposés à chaque étape du QCM doivent être **cohérents avec le type de ressource choisi** (ex. pas de proposition d'ISO pour un LXC, pas de template LXC pour une VM).
- Les valeurs proposées (RAM, CPU, disque) doivent respecter les limites réelles des ressources disponibles sur le nœud Proxmox (ne pas permettre d'allouer plus que ce qui est physiquement disponible).
- Le système doit empêcher la soumission d'un formulaire incomplet ou invalide (contrôles de saisie côté frontend **et** côté backend).
- En cas d'échec de création côté Proxmox (ex. ID déjà utilisé, ressource insuffisante), l'utilisateur doit recevoir un message d'erreur compréhensible, pas un simple code d'erreur technique brut.

### 4.3 Fonctionnalités attendues en V1
- Création de LXC.
- Création de VM.
- Affichage dynamique des options disponibles (templates, storages, bridges) en fonction de l'état réel du cluster Proxmox.
- Historique minimal des créations effectuées depuis l'outil (liste simple, non persistante à l'infini si non nécessaire).

### 4.4 Fonctionnalités explicitement hors V1 (pistes d'évolution futures)
- Suppression / modification / clonage de VM ou LXC depuis l'outil.
- Gestion de plusieurs nœuds ou d'un cluster Proxmox multi-hôtes avec répartition automatique de charge.
- Gestion multi-utilisateurs avec droits différenciés.
- Intégration directe avec Ansible pour un provisioning applicatif post-création (pourrait rejoindre l'écosystème NovaOps existant).
- Notifications (mail, webhook) à la fin d'une création.
- Templates de configuration réutilisables/favoris ("presets" personnalisés, ex. "mon LXC de test standard").

### 4.5 Critères d'acceptation (V1)
Le projet sera considéré comme fonctionnellement abouti en V1 si :
- Un utilisateur peut créer un LXC fonctionnel de bout en bout depuis l'interface web, sans toucher à l'interface Proxmox ni à une ligne de commande.
- Un utilisateur peut créer une VM fonctionnelle de bout en bout depuis l'interface web dans les mêmes conditions.
- Les ressources créées apparaissent correctement dans Proxmox avec la configuration demandée (CPU/RAM/disque/réseau conformes).
- Les erreurs de configuration ou de création sont remontées de façon claire à l'utilisateur.
- L'application est déployable via `docker compose up` sans configuration manuelle complexe additionnelle (hors fichier de configuration initial : URL Proxmox, token API, nœud cible).


