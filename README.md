# zmk-studio-ts-client (cormoran fork)

Simple client library for the ZMK Studio RPC layer, with the message types generated directly from the ZMK Studio
protocol buffer files.

> **This is a fork of [`zmkfirmware/zmk-studio-ts-client`](https://github.com/zmkfirmware/zmk-studio-ts-client).**
> It tracks upstream and adds two things on top of it:
>
> 1. **A custom RPC protocol** — an extension point that lets a keyboard's firmware expose its own,
>    firmware-defined "subsystems" over the same ZMK Studio connection.
> 2. **A wider Bluetooth (BLE) reach** — connection logic that works across more Web Bluetooth
>    environments (notably [Bluefy](https://apps.apple.com/app/bluefy-web-ble-browser/id1492822055) on
>    iOS/iPadOS) and finds more devices in the chooser.
>
> Everything upstream provides still works the same way; the additions below are purely additive.

## Installation

```sh
npm install @zmkfirmware/zmk-studio-ts-client
```

Because the generated protobuf sources are committed in this fork, you do **not** need `protoc` or the
message submodule to consume the library.

## Relationship to upstream

This fork points the `zmk-studio-messages` submodule at
[`cormoran/zmk-studio-messages`](https://github.com/cormoran/zmk-studio-messages) instead of the upstream
message repo. That fork adds a `custom.proto` and wires a `custom` field into the top-level
`zmk.studio` messages, which is what makes the custom protocol below possible.

---

## 1. Custom RPC protocol (`zmk.custom`)

Upstream ZMK Studio exposes a fixed set of subsystems (`core`, `behaviors`, `keymap`, …). This fork adds
a generic **custom subsystem** channel so that firmware modules can define their own request / response /
notification payloads and tunnel them over the existing ZMK Studio transport — without needing changes to
ZMK Studio or to this client for every new feature.

> **Note:** This is an *unofficial* extension to the ZMK Studio RPC protocol. It requires firmware built
> with the matching custom-protocol support (see `cormoran/zmk-studio-messages`). It is not part of the
> official `zmkfirmware` protocol.

### How it works

A new `custom` field is added to the top-level `Request`, `RequestResponse`, and `Notification` messages
(protobuf field number `100`, chosen high to avoid colliding with future upstream fields). The custom
subsystem itself defines three operations plus a notification, all in the `zmk.custom` package:

| Message | Purpose |
| --- | --- |
| `ListCustomSubsystemRequest` / `ListCustomSubsystemResponse` | Enumerate the custom subsystems a device exposes. |
| `CallRequest` / `CallResponse` | Send an opaque byte payload to a subsystem and receive one back. |
| `CustomNotification` | Receive an unsolicited, subsystem-initiated byte payload. |

Each subsystem is described by a `CustomSubsystemInfo`:

```ts
interface CustomSubsystemInfo {
  // Device-specific index used to address the subsystem in Call requests.
  // May change between firmware builds (and potentially at startup), so
  // discover it at runtime rather than hard-coding it.
  index: number;
  // Stable, unique identifier for the subsystem.
  identifier: string;
  // Optional URLs of web UIs that know how to talk to this subsystem.
  uiUrl: string[];
}
```

The `payload` in `CallRequest` / `CallResponse` / `CustomNotification` is an opaque `Uint8Array`. This
client does not interpret it — encoding and meaning are entirely up to the firmware subsystem and its
companion UI. Address a subsystem by its `subsystemIndex`, which you obtain from
`ListCustomSubsystemResponse`.

### Example

```ts
import { call_rpc } from '@zmkfirmware/zmk-studio-ts-client';

// 1. Discover which custom subsystems the connected keyboard exposes.
const listed = await call_rpc(conn, {
  custom: { listCustomSubsystems: {} },
});
const subsystems = listed.custom?.listCustomSubsystems?.subsystems ?? [];

// 2. Pick a subsystem by its stable identifier and use its (per-build) index.
const target = subsystems.find((s) => s.identifier === 'my-firmware-feature');
if (target) {
  const res = await call_rpc(conn, {
    custom: {
      call: {
        subsystemIndex: target.index,
        payload: new Uint8Array([/* subsystem-defined bytes */]),
      },
    },
  });

  const reply = res.custom?.call?.payload; // opaque Uint8Array
}

// 3. Unsolicited pushes arrive as notifications on notification_readable:
//    notification.custom?.customNotification -> { subsystemIndex, payload }
```

---

## 2. Wider Bluetooth (BLE) reach

The Web Bluetooth transport (`src/transport/gatt.ts`) has been reworked so ZMK Studio can be driven from
more environments and connect to more devices. This matters for mobile users in particular: the reference
ZMK Studio web app relies on desktop Chrome's Web Bluetooth, while this fork also works inside iOS/iPadOS
Web Bluetooth browsers such as **Bluefy**.

### What changed

- **Bluefy (iOS/iPadOS) support.** Bluefy's Web Bluetooth implementation is case-sensitive about GATT
  UUIDs and does not support `writeValueWithoutResponse`. `connect()` now:
  - detects Bluefy via the user agent and uses **upper-case** service / characteristic UUIDs for it;
  - falls back to `writeValue` with manual **20-byte MTU chunking** when write-without-response is
    unavailable, instead of assuming a single unacknowledged write works;
  - waits for GATT notifications to be fully subscribed before allowing the first write, avoiding a race
    where early bytes are lost.

- **Broader device discovery.** The `requestDevice` filters now also match the standard
  `battery_service`, so keyboards that don't advertise the ZMK Studio service UUID still show up in the
  browser's device chooser. This widens the set of devices you can actually select and connect to.

- **Caller-supplied device options.** `connect()` accepts an optional `RequestDeviceOptions` argument, so
  applications can override the default filters (or pass `acceptAllDevices`) when they need finer control
  over the chooser:

  ```ts
  import { connect } from '@zmkfirmware/zmk-studio-ts-client/transport/gatt';

  // Default behaviour (Bluefy-aware filters, battery_service fallback):
  const transport = await connect();

  // Or take full control of the device chooser:
  const transport2 = await connect({
    filters: [{ namePrefix: 'MyKeyboard' }],
  });
  ```

  Passing either `filters` or `acceptAllDevices` replaces the built-in filters; the ZMK Studio service is
  always kept in `optionalServices` so the RPC characteristic stays reachable.

---

## API

- `create_rpc_connection(transport, opts?)` — wrap a transport in an `RpcConnection`.
- `call_rpc(conn, request)` — send a request and await the matching `RequestResponse` (throws
  `NoResponseError` / `MetaError` on protocol-level failures).
- `transport/gatt` `connect(options?)` — connect over Web Bluetooth (see above).
- `transport/serial` `connect()` — connect over Web Serial.

Message types (`Request`, `Response`, `RequestResponse`, `Notification`, and the per-subsystem messages)
are generated from the protobuf definitions and re-exported from the package root and per-module entry
points (e.g. `@zmkfirmware/zmk-studio-ts-client/custom`).

## Development

```sh
npm install        # pulls the message submodule, generates TS from protobuf, builds
npm run generate   # regenerate TS message types from the .proto files
npm run build      # compile to ./lib
npm test           # run the test suite
```

## License

MIT — see [LICENSE](LICENSE).
