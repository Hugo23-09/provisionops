{
  "$schema": "https://opencode.ai/config.json",
  "model": "opencode/big-pickle",
  "default_agent": "scrum-master",
  "instructions": [
    "AGENTS.md",
    "gestion-projet/cdc.md"
  ],
  
  "formatter": false,
  "compaction": {
    "auto": true,
    "prune": true,
    "reserved": 3000
  },
  "tool_output": {
    "max_lines": 500,
    "max_bytes": 25600
  },
  "skills": {
    "paths": [".opencode/skills"]
  },
  "agent": {
    "scrum-master": {
      "mode": "primary",
      "description": "Coordinateur : analyse le besoin, décompose en tâches, délègue aux subagents et valide les livrables.",
      "skills": ["common", "scrum-master"],
      "permission": {
        "bash": {
          "*": "ask",
          "gh *": "allow",
          "gh project*": "allow"
        },
        "edit": "allow",
        "read": "allow"
      }
    },
    "fullstack-developer": {
      "mode": "subagent",
      "description": "Développe le code backend (FastAPI/SQLAlchemy) et frontend (Vanilla JS/Tailwind).",
      "skills": ["common", "developer"],
      "temperature": 0.3,
      "steps": 8
    },
    "tester": {
      "mode": "subagent",
      "description": "Écrit et exécute les tests (unitaires, intégration, fonctionnels, régression).",
      "skills": ["common", "tester"],
      "temperature": 0.1,
      "steps": 5
    },
    "devops": {
      "mode": "subagent",
      "description": "Gère le versioning Git, les pipelines CI/CD GitHub Actions et les releases.",
      "skills": ["common", "devops"],
      "temperature": 0.2,
      "steps": 8,
      "permission": {
        "bash": {
          "*": "ask",
          "git *": "allow",
          "gh *": "allow"
        },
        "read": "allow",
        "writeFiles": "allow",
        "edit": "allow"
      }
    }
  }
}