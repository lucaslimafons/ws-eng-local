import express from "express";
import { json } from "body-parser";
import Redlock from 'redlock'
import Redis from 'ioredis'
const DEFAULT_BALANCE = 100;

interface ChargeResult {
    isAuthorized: boolean;
    remainingBalance: number;
    charges: number;
}

let instance: Redis

async function connect(): Promise<Redis> {
    const url = `redis://${process.env.REDIS_HOST ?? "localhost"}:${process.env.REDIS_PORT ?? "6379"}`;
    console.log(`Using redis URL ${url}`);

    if (!instance) instance = new Redis(url)
    return instance
}

async function redlock(client: any) {
  const redlock = new Redlock(
    [client],
    {
      // The expected clock drift; for more details see:
      // http://redis.io/topics/distlock
      driftFactor: 0.01, // multiplied by lock ttl to determine drift time
  
      // The max number of times Redlock will attempt to lock a resource
      // before erroring.
      retryCount: 10,
  
      // the time in ms between attempts
      retryDelay: 200, // time in ms
  
      // the max time in ms randomly added to retries
      // to improve performance under high contention
      // see https://www.awsarchitectureblog.com/2015/03/backoff.html
      retryJitter: 200, // time in ms
    }
  )
  return redlock
}

async function reset(account: string): Promise<void> {
    const client = await connect();
    await client.set(`${account}/balance`, DEFAULT_BALANCE);
}

async function charge(account: string, charges: number): Promise<ChargeResult> {
    console.log(`charge account: ${account}, charges: ${charges}`)
    const client = await connect();
    const _redlock = await redlock(client)
    
    let lock = await _redlock.acquire([account], 200)
    let lockWasReleased = false
    try {
        const balance = parseInt((await client.get(`${account}/balance`)) ?? "");
        console.log(`account redis balance: ${balance}, charges: ${charges}`)
        if (balance >= charges) {
            console.log(`has funds`)

            const remainingBalance = balance - charges

            console.log(`set new balance: ${remainingBalance}`)
            await client.set(`${account}/balance`, remainingBalance);

            await lock.release()
            lockWasReleased = true

            return { isAuthorized: true, remainingBalance, charges };
        } else {
            console.log(`no funds`)

            return { isAuthorized: false, remainingBalance: balance, charges: 0 };
        }
    } finally {
      if (lock && !lockWasReleased) await lock.release()
    }
}

export function buildApp(): express.Application {
    const app = express();
    app.use(json());
    app.post("/reset", async (req, res) => {
        try {
            const account = req.body.account ?? "account";
            await reset(account);
            console.log(`Successfully reset account ${account}`);
            res.sendStatus(204);
        } catch (e) {
            console.error("Error while resetting account", e);
            res.status(500).json({ error: String(e) });
        }
    });
    app.post("/charge", async (req, res) => {
        try {
            const account = req.body.account ?? "account";
            const result = await charge(account, req.body.charges ?? 10);
            console.log(`Successfully charged account ${account}`);
            res.status(200).json(result);
        } catch (e) {
            console.error("Error while charging account", e);
            res.status(500).json({ error: String(e) });
        }
    });
    return app;
}
