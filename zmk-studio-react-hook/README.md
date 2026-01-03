# @zmkfirmware/zmk-studio-react-hook

React hooks wrapper for [@zmkfirmware/zmk-studio-ts-client](https://github.com/zmkfirmware/zmk-studio-ts-client).

## Installation

This repository is a fork. To install, specify the GitHub repository and branch directly:

```bash
npm install "github:cormoran/zmk-studio-ts-client#custom-studio-protocol"
```

Replace `custom-studio-protocol` with the desired branch if it changes in the future.

## Quick Start

### Using ZMKConnection Component

The library provides a headless `ZMKConnection` component that renders component based on connection status.

```typescript
import { ZMKConnection } from "@zmkfirmware/zmk-studio-react-hook";
import { connect as connect_serial } from "@zmkfirmware/zmk-studio-ts-client/transport/serial";

function MyComponent() {
  return (
    <ZMKConnection
      connectFunction={connect_serial}
      renderDisconnected={({ connect, isLoading, error }) => (
        <div>
          {isLoading && <div>Connecting...</div>}
          {error && <div>Error: {error}</div>}
          {!isLoading && <button onClick={connect}>Connect to Device</button>}
        </div>
      )}
      renderConnected={({ disconnect, deviceName, subsystems }) => (
        <div>
          <h2>Connected to: {deviceName}</h2>
          <button onClick={disconnect}>Disconnect</button>
          <div>
            {subsystems.map((sub) => (
              <div key={sub.index}>
                {sub.identifier} (Index: {sub.index})
              </div>
            ))}
          </div>
        </div>
      )}
    />
  );
}
```

### Using useZMKApp Hook Directly

For more control, use the `useZMKApp` hook directly:

```typescript
import { useZMKApp } from "@zmkfirmware/zmk-studio-react-hook";
import { connect as connect_serial } from "@zmkfirmware/zmk-studio-ts-client/transport/serial";

function MyComponent() {
  const { state, connect, disconnect, isConnected, findSubsystem } =
    useZMKApp();

  const handleConnect = async () => {
    await connect(connect_serial);
  };

  if (state.isLoading) {
    return <div>Connecting...</div>;
  }

  if (state.error) {
    return <div>Error: {state.error}</div>;
  }

  if (!isConnected) {
    return <button onClick={handleConnect}>Connect to Device</button>;
  }

  return (
    <div>
      <h2>Connected to: {state.deviceInfo?.name}</h2>
      <button onClick={disconnect}>Disconnect</button>

      {state.customSubsystems?.subsystems.map((sub) => (
        <div key={sub.index}>
          {sub.identifier} (Index: {sub.index})
        </div>
      ))}
    </div>
  );
}
```

### Using ZMKCustomSubsystem to interact with your ZMK module

```typescript
import {
  useZMKApp,
  ZMKCustomSubsystem,
} from "@zmkfirmware/zmk-studio-react-hook";
import { useEffect, useState } from "react";

function MyComponent() {
  const { state, connect, isConnected } = useZMKApp();
  const [service, setService] = useState<ZMKCustomSubsystem | null>(null);

  useEffect(() => {
    if (state.connection && state.customSubsystems) {
      // Replace 'your_identifier' with the actual identifier string for your subsystem
      const found = findSubsystem("your_identifier");
      if (found) {
        setService(new ZMKCustomSubsystem(state.connection, found.index));
      }
    }
  }, [state.connection, state.customSubsystems, findSubsystem]);

  const sendRPC = async () => {
    if (service) {
      const payload = new Uint8Array([1, 2, 3]); // Your protobuf payload
      const response = await service.callRPC(payload);
      console.log("Response:", response);
    }
  };

  return (
    <div>
      {isConnected && service && <button onClick={sendRPC}>Send RPC</button>}
    </div>
  );
}
```

### Handling Custom Notifications from your ZMK module

Subscribe to custom notifications from specific subsystems:

```typescript
import { useZMKApp } from "@zmkfirmware/zmk-studio-react-hook";
import { useEffect } from "react";

function MyComponent() {
  const { findSubsystem, onNotification, isConnected } = useZMKApp();

  useEffect(() => {
    if (!isConnected) return;

    // Replace 'your_identifier' with the actual identifier string for your subsystem
    const found = findSubsystem("your_identifier");
    if (!found) return;

    // Subscribe to custom notifications from the found subsystem
    const unsubscribe = onNotification({
      type: "custom",
      subsystemIndex: found.index,
      callback: (notification) => {
        console.log("Received custom notification:", notification);
        console.log("Payload:", notification.payload);
      },
    });

    // Cleanup subscription on unmount
    return unsubscribe;
  }, [isConnected, findSubsystem, onNotification]);

  return <div>...</div>;
}
```

## API Reference

### `ZMKConnection`

Headless component providing connection management UI logic without styling.

**Props:**

- `connectFunction: () => Promise<RpcTransport>` - Function to establish transport
- `renderDisconnected: (props) => ReactNode` - Render function for disconnected state
  - Props: `{ connect, isLoading, error }`
- `renderConnected: (props) => ReactNode` - Render function for connected state
  - Props: `{ disconnect, deviceName, subsystems, findSubsystem }`

### `useZMKApp()`

Main hook for managing ZMK device connections.

**Returns:**

- `state`: Current app state
  - `connection`: RPC connection or null
  - `deviceInfo`: Device information or null
  - `customSubsystems`: Available subsystems or null
  - `isLoading`: Loading state
  - `error`: Error message or null
- `connect(connectFunction)`: Connect to a device (uses AbortController internally)
- `disconnect()`: Disconnect from device (aborts connection)
- `findSubsystem(identifier)`: Find subsystem by identifier
- `isConnected`: Boolean indicating connection status
- `onNotification(subscription)`: Subscribe to notifications
  - `subscription.type`: `'core' | 'keymap' | 'custom'`
  - For `'core'`: `{ type: 'core', callback: (notification) => void }`
  - For `'keymap'`: `{ type: 'keymap', callback: (notification) => void }`
  - For `'custom'`: `{ type: 'custom', subsystemIndex: number, callback: (notification) => void }`
  - Returns unsubscribe function

### `NotificationSubscription`

Type for notification subscriptions:

```typescript
type NotificationSubscription =
  | { type: "core"; callback: (notification: CoreNotification) => void }
  | { type: "keymap"; callback: (notification: KeymapNotification) => void }
  | {
      type: "custom";
      subsystemIndex: number;
      callback: (notification: CustomNotification) => void;
    };
```

### `ZMKCustomSubsystem`

Service class for RPC communication with ZMK custom subsystems.

**Constructor:**

```typescript
new ZMKCustomSubsystem(connection: RpcConnection, subsystemIndex: number)
```

**Methods:**

- `callRPC(payload: Uint8Array): Promise<Uint8Array | null>` - Make RPC call
- `isReady(): boolean` - Check if service is ready
- `getSubsystemIndex(): number` - Get subsystem index
- `getConnection(): RpcConnection` - Get RPC connection

### `ZMKCustomSubsystemError`

Custom error class for service operations.

```typescript
new ZMKCustomSubsystemError(
  type: 'connection' | 'rpc' | 'validation',
  message: string,
  code?: number
)
```

## TypeScript Support

This library is written in TypeScript and includes type definitions.

## License

MIT
