/**
 * ZMK Service
 * Generic service for RPC communication with ZMK custom subsystems
 */

import type { RpcConnection } from "@zmkfirmware/zmk-studio-ts-client";
import { call_rpc } from "@zmkfirmware/zmk-studio-ts-client";

/**
 * Generic ZMK Service for basic RPC communication
 * Contains only truly generic functionality shared by all ZMK modules
 */

export class ZMKCustomSubsystem {
  private conn: RpcConnection;
  private subsystemIndex: number;

  constructor(connection: RpcConnection, subsystemIndex: number) {
    this.conn = connection;
    this.subsystemIndex = subsystemIndex;
  }

  /**
   * Make a raw RPC call to the ZMK device
   * @param payload The serialized protobuf payload to send
   * @returns The response payload, if any
   */
  async callRPC(payload: Uint8Array): Promise<Uint8Array | null> {
    const response = await call_rpc(this.conn, {
      custom: {
        call: {
          subsystemIndex: this.subsystemIndex,
          payload,
        },
      },
    });
    return response.custom?.call?.payload || null;
  }

  /**
   * Check if the subsystem is ready for use
   */
  isReady(): boolean {
    return !!this.conn;
  }

  /**
   * Get the subsystem index
   */
  getSubsystemIndex(): number {
    return this.subsystemIndex;
  }

  /**
   * Get the RPC connection
   */
  getConnection(): RpcConnection {
    return this.conn;
  }
}

/**
 * Error types for ZMK service operations
 */
export class ZMKCustomSubsystemError extends Error {
  public type: "connection" | "rpc" | "validation";
  public code?: number;

  constructor(
    type: "connection" | "rpc" | "validation",
    message: string,
    code?: number
  ) {
    super(message);
    this.name = "ZMKCustomSubsystemError";
    this.type = type;
    this.code = code;
  }
}
