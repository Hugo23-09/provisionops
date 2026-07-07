# ProvisionOps

Plateforme de provisioning self-service de VM/LXC sur Proxmox.

## Prérequis

- Docker & Docker Compose
- Un serveur Proxmox VE (7.x ou 8.x)
- Un token API Proxmox avec les permissions : VM.Audit, VM.Config, Datastore.AllocateSpace, Sys.Audit

## Installation

```bash
git clone https://github.com/Hugo23-09/provisionops.git
cd provisionops
cp .env.example .env
# Éditer .env avec tes informations Proxmox
docker compose up
```

Ouvre http://localhost:8080

## Configuration

| Variable | Description |
|----------|-------------|
| `PROXMOX_HOST` | URL du serveur Proxmox (ex: `https://192.168.1.100:8006`) |
| `PROXMOX_TOKEN_ID` | ID du token API (ex: `root@pam!provisionops`) |
| `PROXMOX_TOKEN_SECRET` | Secret du token API |
| `PROXMOX_NODE` | Nom du nœud Proxmox cible |
| `USE_MOCK` | `true` pour tester sans Proxmox réel (données simulées) |
| `APP_DEBUG` | Mode debug |

## Utilisation

1. Depuis le tableau de bord, clique sur **Conteneur LXC** ou **Machine Virtuelle**
2. Suis les 6 étapes du wizard :
   - **Type** : choisis LXC ou VM
   - **OS** : sélectionne un template ou ISO
   - **Ressources** : CPU, RAM, Disque (limites réelles du nœud)
   - **Réseau** : bridge et mode IP (DHCP ou statique)
   - **Confirmation** : nom et récapitulatif
   - **Création** : suivi en temps réel
3. Consulte l'**Historique** pour voir les créations passées

## Architecture

```
provisionops/
├── backend/         # API FastAPI (Python)
│   ├── app/
│   │   ├── api/     # Endpoints REST
│   │   ├── proxmox/ # Client Proxmox
│   │   ├── config.py
│   │   ├── main.py
│   │   └── schemas.py
│   └── Dockerfile
├── frontend/        # Interface web (Vanilla JS + Tailwind)
│   ├── index.html
│   ├── css/
│   ├── js/
│   └── Dockerfile
├── docker-compose.yml
└── .env.example
```

## Mode Mock

Sans serveur Proxmox, mets `USE_MOCK=true` dans le `.env`. L'application fonctionne avec des données simulées (templates, ressources, création).

## Licence

MIT
