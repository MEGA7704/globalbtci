-- V39 : correction des plans d'abonnement.
-- Le type de plan reste un champ TEXT, donc Standard ne requiert aucune modification de schéma.
-- Cette migration recalcule uniquement l'échéance des comptes Free existants selon la nouvelle durée de 10 jours.
UPDATE companies
SET plan_expires_at = strftime('%Y-%m-%dT%H:%M:%fZ', datetime(plan_started_at, '+10 days')),
    updated_at = CURRENT_TIMESTAMP
WHERE lower(COALESCE(plan, 'free')) = 'free'
  AND plan_started_at IS NOT NULL
  AND trim(plan_started_at) <> '';
