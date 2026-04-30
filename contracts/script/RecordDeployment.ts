import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const chainId = process.argv[2] ?? '84532';
const broadcastPath = resolve(import.meta.dirname, `../broadcast/Deploy.s.sol/${chainId}/run-latest.json`);
const outPath = resolve(import.meta.dirname, '../../deployments/base-sepolia.json');

interface ForgeBroadcast {
  transactions: Array<{
    contractName: string;
    contractAddress: string;
    hash: string;
    transactionType: string;
    transaction?: { from?: string };
    from?: string;
  }>;
  receipts: Array<{ transactionHash: string; blockNumber: string; contractAddress: string }>;
}

const raw = await readFile(broadcastPath, 'utf8');
const log = JSON.parse(raw) as ForgeBroadcast;
const tx = log.transactions.find(t => t.contractName === 'FleetRegistry' && t.transactionType === 'CREATE');
if (!tx) throw new Error(`No FleetRegistry CREATE tx in ${broadcastPath}`);
const receipt = log.receipts.find(r => r.transactionHash === tx.hash);
if (!receipt) throw new Error(`No receipt for tx ${tx.hash}`);

const deployer = tx.transaction?.from ?? tx.from ?? '0x0';

const record = {
  FleetRegistry: {
    address: tx.contractAddress,
    deployer,
    blockNumber: parseInt(receipt.blockNumber, 16),
    txHash: tx.hash,
    deployedAt: Date.now(),
  },
};

await mkdir(dirname(outPath), { recursive: true });
const tmp = `${outPath}.tmp`;
await writeFile(tmp, JSON.stringify(record, null, 2) + '\n', 'utf8');
await rename(tmp, outPath);
console.log(JSON.stringify({ msg: 'deployment_recorded', path: outPath, address: tx.contractAddress }));
