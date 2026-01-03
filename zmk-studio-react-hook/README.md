# @zmkfirmware/zmk-studio-react-hook

React hooks wrapper for [@zmkfirmware/zmk-studio-ts-client](https://github.com/zmkfirmware/zmk-studio-ts-client).

## Installation

```bash
npm install @zmkfirmware/zmk-studio-react-hook
```

## Quick Start

### Basic Usage with useZMKApp Hook

```typescript
import { useZMKApp } from "@zmkfirmware/zmk-studio-react-hook";
import { request_gatt_connection } from "@zmkfirmware/zmk-studio-ts-client/transport/gatt";

function MyComponent() {
  const { state, connect, disconnect, isConnected, findSubsystem } =
    useZMKApp();

  const handleConnect = async () => {
    await connect(request_gatt_connection);
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

### Using ZMKService for RPC Calls

```typescript
import { useZMKApp, ZMKService } from "@zmkfirmware/zmk-studio-react-hook";
import { useEffect, useState } from "react";

function MyComponent() {
  const { state, connect, isConnected } = useZMKApp();
  const [service, setService] = useState<ZMKService | null>(null);

  useEffect(() => {
    if (state.connection && state.customSubsystems) {
      const subsystem = state.customSubsystems.subsystems[0];
      if (subsystem) {
        setService(new ZMKService(state.connection, subsystem.index));
      }
    }
  }, [state.connection, state.customSubsystems]);

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

## API Reference

### `useZMKApp()`

Main hook for managing ZMK device connections.

**Returns:**

- `state`: Current app state
  - `connection`: RPC connection or null
  - `deviceInfo`: Device information or null
  - `customSubsystems`: Available subsystems or null
  - `isLoading`: Loading state
  - `error`: Error message or null
- `connect(connectFunction)`: Connect to a device
- `disconnect()`: Disconnect from device
- `findSubsystem(identifier)`: Find subsystem by identifier
- `isConnected`: Boolean indicating connection status

### `ZMKService`

Service class for RPC communication with ZMK custom subsystems.

**Constructor:**

```typescript
new ZMKService(connection: RpcConnection, subsystemIndex: number)
```

**Methods:**

- `callRPC(payload: Uint8Array): Promise<Uint8Array | null>` - Make RPC call
- `isReady(): boolean` - Check if service is ready
- `getSubsystemIndex(): number` - Get subsystem index
- `getConnection(): RpcConnection` - Get RPC connection

### `ZMKServiceError`

Custom error class for service operations.

```typescript
new ZMKServiceError(
  type: 'connection' | 'rpc' | 'validation',
  message: string,
  code?: number
)
```

## TypeScript Support

This library is written in TypeScript and includes type definitions.

## License

MIT
