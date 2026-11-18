# Manakh edge

The on-site control service. It runs the **same pure control engine** as the web app
(`src/engine`), so what you preview in the browser is what the controller does on the farm.

```
controller.ts   the loop: read sensors -> control() -> write actuators -> buffer -> sync
adapters/       how it talks to the greenhouse
  types.ts        the IoAdapter interface
  sim.ts          simulated device (the physics model) — no hardware needed
  modbus.ts       Modbus (bring your own client, e.g. modbus-serial); Mock for tests
  mqtt.ts         MQTT (bring your own client, e.g. mqtt); Mock for tests
buffer.ts       durable local buffer (JSONL now, SQLite in production) — idempotent
sync.ts         best-effort push to the cloud; adopts a newer strategy if returned
run.ts          CLI entry (runs the sim device by default)
```

## Run the simulated device

```bash
npm run edge:sim      # prints the control loop every 2 s
npm run test:edge     # 12 checks: sim loop, Modbus/MQTT scaling, buffer, sync
```

## Connect real hardware

1. `npm i modbus-serial` (or `mqtt`) and write a ~20-line wrapper to the `ModbusClient`
   / `MqttClient` interface in `adapters/`.
2. Fill the register / topic map for your I/O (see the tests for the shape).
3. Set `EDGE_SYNC_URL` and `EDGE_TOKEN` to push readings to the cloud.

Control keeps running locally if the cloud or the network is down; readings buffer and
sync when it returns. Hard safety limits live in the engine, outside any strategy.
