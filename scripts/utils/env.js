import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

// FR : Le fichier .env vit a la racine du repo (partage entre contracts/, scripts/ et
//      frontend/), pas dans scripts/ -- on resout son chemin depuis ce fichier plutot que de
//      dependre du repertoire courant d'ou le script est lance.
// EN : The .env file lives at the repo root (shared between contracts/, scripts/ and
//      frontend/), not inside scripts/ -- its path is resolved from this file rather than
//      relying on the current working directory the script happens to be run from.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
config({ path: path.join(REPO_ROOT, ".env") });

/**
 * FR : Verifie que les variables d'environnement demandees sont bien definies, et arrete le
 * script immediatement avec un message clair sinon -- plutot que de laisser une erreur cryptique
 * surgir plus loin (ex: "invalid private key") sans dire QUELLE variable manque.
 * EN : Checks that the requested environment variables are actually set, and stops the script
 * immediately with a clear message otherwise -- rather than letting a cryptic error surface
 * further down (e.g. "invalid private key") without saying WHICH variable is missing.
 */
export function requireEnv(...names) {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Variables d'environnement manquantes / Missing environment variables: ${missing.join(", ")}\n` +
        "Copie .env.example en .env a la racine du repo et remplis-le. / " +
        "Copy .env.example to .env at the repo root and fill it in."
    );
  }
  return Object.fromEntries(names.map((name) => [name, process.env[name]]));
}

export { REPO_ROOT };
