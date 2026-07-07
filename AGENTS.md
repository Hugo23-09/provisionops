# Équipe de développement

| Agent                  | Rôle                               | Mode      |
|------------------------|------------------------------------|-----------|
| scrum-master           | Chef de projet — planifie, coordonne| primary   |
| developer              | Développe le code                  | subagent  |
| devops                 | Infrastructure, Continuous Integration / Continuous Deployment              | subagent  |
| tester                 | Tests et qualité                   | subagent  |

## Workflow
1. L'utilisateur donne une instruction
2. Le scrum-master analyse et découpe en tâches
3. Les tâches sont déléguées aux sous-agents via `task()`
4. Chaque sous-agent produit le résultat
5. Le scrum-master consolide et présente