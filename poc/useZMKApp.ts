/**
 * useZMKApp Hook
 * Generic hook for managing ZMK device connection and subsystem discovery
 * This is reusable for any ZMK module application
 */

import { useState, useCallback } from "react";
import { create_rpc_connection } from "@zmkfirmware/zmk-studio-ts-client";
import { call_rpc } from "../rpc/logging";
import type { RpcTransport } from "@zmkfirmware/zmk-studio-ts-client/transport/index";
import type { RpcConnection } from "@zmkfirmware/zmk-studio-ts-client";
import type { GetDeviceInfoResponse } from "@zmkfirmware/zmk-studio-ts-client/core";
import type { ListCustomSubsystemResponse } from "@zmkfirmware/zmk-studio-ts-client/custom";

export interface ZMKAppState {
  /** RPC connection to the device */
  connection: RpcConnection | null;
  /** Device information */
  deviceInfo: GetDeviceInfoResponse | null;
  /** Available custom subsystems */
  customSubsystems: ListCustomSubsystemResponse | null;
  /** Whether the app is currently loading */
  isLoading: boolean;
  /** Any error that occurred */
  error: string | null;
}

export interface UseZMKAppReturn {
  /** Current app state */
  state: ZMKAppState;
  /** Connect to a device */
  connect: (connectFunction: () => Promise<RpcTransport>) => Promise<void>;
  /** Disconnect from the device */
  disconnect: () => void;
  /** Find a specific subsystem by identifier */
  findSubsystem: (
    identifier: string
  ) => { index: number; identifier: string } | null;
  /** Whether we're currently connected */
  isConnected: boolean;
}

/**
 * Hook for managing ZMK application state
 * Handles connection lifecycle, device discovery, and subsystem enumeration
 */
export function useZMKApp(): UseZMKAppReturn {
  const [state, setState] = useState<ZMKAppState>({
    connection: null,
    deviceInfo: null,
    customSubsystems: null,
    isLoading: false,
    error: null,
  });

  const connect = useCallback(
    async (connectFunction: () => Promise<RpcTransport>) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        // Create transport and connection
        const transport = await connectFunction();
        const connection = create_rpc_connection(transport, {});

        // Get device information
        const deviceInfo = await call_rpc(connection, {
          core: {
            getDeviceInfo: true,
          },
        })
          .then((resp) => resp.core?.getDeviceInfo)
          .catch((e) => {
            console.error("Failed to get device info", e);
            return null;
          });

        if (!deviceInfo) {
          throw new Error("Failed to get device information");
        }

        // Get custom subsystems
        const customSubsystems = await call_rpc(connection, {
          custom: {
            listCustomSubsystems: {},
          },
        })
          .then((resp) => resp.custom?.listCustomSubsystems)
          .catch((e) => {
            console.error("Failed to get custom subsystems", e);
            return null;
          });

        // Update state with successful connection
        setState({
          connection,
          deviceInfo,
          customSubsystems: customSubsystems || null,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        console.error("Connection failed:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown connection error";

        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));

        alert(`Failed to connect to device: ${errorMessage}`);
      }
    },
    []
  );

  const disconnect = useCallback(() => {
    setState({
      connection: null,
      deviceInfo: null,
      customSubsystems: null,
      isLoading: false,
      error: null,
    });
  }, []);

  const findSubsystem = useCallback(
    (identifier: string) => {
      if (!state.customSubsystems) return null;

      const subsystem = state.customSubsystems.subsystems.find(
        (s) => s.identifier === identifier
      );

      return subsystem
        ? { index: subsystem.index, identifier: subsystem.identifier }
        : null;
    },
    [state.customSubsystems]
  );

  const isConnected = !!state.connection;

  return {
    state,
    connect,
    disconnect,
    findSubsystem,
    isConnected,
  };
}
