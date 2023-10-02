import { performance } from "perf_hooks";
import supertest from "supertest";
import { buildApp } from "./app";

const app = supertest(buildApp());

async function basicLatencyTest() {
    await app.post("/reset").expect(204);
    const start = performance.now();
    
    await app.post("/charge").expect(200)
    await app.post("/charge").expect(200)
    await app.post("/charge").expect(200)
    await app.post("/charge").expect(200)
    await app.post("/charge").expect(200)
    await app.post("/charge").expect(200)
    
    console.log(`Latency: ${performance.now() - start} ms`);
    console.log('end basicLatencyTest - - - - ')
}

async function basicLatencyTest2() {
  await app.post("/reset").expect(204);
  const start = performance.now();
  
  await Promise.all([
    app.post("/charge").expect(200),
    app.post("/charge").expect(200),
    app.post("/charge").expect(200),
    app.post("/charge").expect(200),
    app.post("/charge").expect(200),
    app.post("/charge").expect(200),
    app.post("/charge").send({
      charges: 150
    }).expect(200),
    app.post("/charge").expect(200),
    app.post("/charge").expect(200),
    app.post("/charge").expect(200),
    app.post("/charge").expect(200),
    app.post("/charge").expect(200),
  ])
  
  console.log(`Latency: ${performance.now() - start} ms`);
  console.log('end basicLatencyTest2 - - - - ')
}

async function runTests() {
    // await basicLatencyTest();
    await basicLatencyTest2()
}

runTests().catch(console.error);
