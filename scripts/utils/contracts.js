import { readFileSync } from "node:fs";
import path from "node:path";
import { ethers } from "ethers";
import { REPO_ROOT } from "./env.js";

// FR : On charge l'ABI (et le bytecode pour le deploiement) directement depuis les artefacts
//      compiles par Foundry (contracts/out/), plutot que de dupliquer une copie d'ABI a la main
//      dans scripts/. Une seule source de verite : si le contrat change et qu'on oublie de
//      relancer `forge build`, forge test echouera avant que ce script n'utilise une ABI perimee.
// EN : The ABI (and bytecode for deployment) is loaded directly from Foundry's compiled
//      artifacts (contracts/out/), instead of duplicating a hand-copied ABI inside scripts/.
//      Single source of truth: if the contract changes and `forge build` isn't re-run, `forge
//      test` fails before this script could ever use a stale ABI.
const CONTRACTS_OUT_DIR = path.join(REPO_ROOT, "contracts", "out");

function loadArtifact(sourceFileName, contractName) {
  const artifactPath = path.join(CONTRACTS_OUT_DIR, sourceFileName, `${contractName}.json`);
  const raw = readFileSync(artifactPath, "utf-8");
  return JSON.parse(raw);
}

const ARTIFACTS = {
  Escrow: () => loadArtifact("Escrow.sol", "Escrow"),
  ASCEscrowVerifier: () => loadArtifact("ASCEscrowVerifier.sol", "ASCEscrowVerifier"),
  SourceMilestone: () => loadArtifact("SourceMilestone.sol", "SourceMilestone"),
};

/** FR : Instancie un contrat deja deploye, pret a lire/ecrire. / EN : Instantiates an already
 * deployed contract, ready to read/write. */
export function getContract(contractName, address, signerOrProvider) {
  const { abi } = ARTIFACTS[contractName]();
  return new ethers.Contract(address, abi, signerOrProvider);
}

/** FR : Prepare un deploiement (ABI + bytecode) pour un nouveau contrat. / EN : Prepares a
 * deployment (ABI + bytecode) for a new contract. */
export function getContractFactory(contractName, signer) {
  const { abi, bytecode } = ARTIFACTS[contractName]();
  return new ethers.ContractFactory(abi, bytecode.object, signer);
}
