import type { SyncOutcome } from '../application/stepsUseCases';

const fr = (n: number) => n.toLocaleString('fr-FR');
const time = (at: Date, timezone: string) => at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: timezone });

/** Why the steps could not be read, when they could not (nothing for a read that worked, or a phone that does not write them). */
export function outcomeProblem(outcome: SyncOutcome | null): string | undefined {
  switch (outcome?.kind) {
    case 'no-permission':
      return 'Autorise la lecture des pas dans Réglages › Pas.';
    case 'unavailable':
      return 'Health Connect n’est pas disponible sur ce téléphone.';
    case 'update-needed':
      return 'Mets à jour Health Connect pour lire les pas.';
    case 'failed':
      return `La lecture des pas a échoué : ${outcome.error}. Réessaie dans un moment.`;
    default:
      return undefined;
  }
}

/** What a sync did, in a sentence. */
export function outcomeText(outcome: SyncOutcome | null, timezone: string): string | undefined {
  if (outcome?.kind === 'synced') return `${fr(outcome.steps)} pas lus à ${time(outcome.at, timezone)}.`;
  if (outcome?.kind === 'not-writer') return 'Un autre téléphone envoie les pas.';
  return outcomeProblem(outcome);
}
