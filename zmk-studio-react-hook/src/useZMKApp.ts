/**
 * useZMKApp Hook
 * Generic hook for managing ZMK device connection and subsystem discovery
 */

import { useState, useCallback, useEffect, useRef } from "react";
import {
  create_rpc_connection,
  call_rpc,
} from "@zmkfirmware/zmk-studio-ts-client";
import type { RpcTransport } from "@zmkfirmware/zmk-studio-ts-client/transport/index";
import type { RpcConnection } from "@zmkfirmware/zmk-studio-ts-client";
import type { GetDeviceInfoResponse } from "@zmkfirmware/zmk-studio-ts-client/core";
import type {
  ListCustomSubsystemResponse,
  CustomNotification,
} from "@zmkfirmware/zmk-studio-ts-client/custom";

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
  /** Subscribe to custom notifications for a specific subsystem */
  onNotification: (
    subsystemIndex: number,
    callback: (notification: CustomNotification) => void
  ) => () => void;
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

  const abortControllerRef = useRef<AbortController | null>(null);
  const notificationCallbacksRef = useRef<
    Map<number, Set<(notification: CustomNotification) => void>>
  >(new Map());

  /**
   * Effect: Listen for incoming notifications from the device
   * Automatically starts/stops when connection changes
   */
  useEffect(() => {
    if (!state.connection) return;

    const reader = state.connection.notification_readable.getReader();
    const abortController = new AbortController();

    /**
     * Continuously read notifications from the stream and dispatch to subscribers
     */
    const processNotifications = async () => {
      try {
        while (!abortController.signal.aborted) {
          const { done, value } = await reader.read();
          if (done) break;

          // Handle custom notifications from subsystems
          const customNotification = value.custom?.customNotification;
          if (customNotification) {
            dispatchNotification(customNotification);
          }
        }
      } catch (error) {
        // Only log errors if we weren't intentionally aborted
        if (!abortController.signal.aborted) {
          console.error("Error reading notifications:", error);
        }
      } finally {
        reader.releaseLock();
      }
    };

    processNotifications();

    return () => {
      abortController.abort();
    };
  }, [state.connection]);

  /**
   * Dispatch a notification to all registered callbacks for a subsystem
   */
  const dispatchNotification = (notification: CustomNotification) => {
    const callbacks = notificationCallbacksRef.current.get(
      notification.subsystemIndex
    );
    if (callbacks) {
      callbacks.forEach((callback) => callback(notification));
    }
  };

  /**
   * Connect to a ZMK device
   * @param connectFunction - Function that creates and returns the transport connection
   */
  const connect = useCallback(
    async (connectFunction: () => Promise<RpcTransport>) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      // Create new AbortController for this connection
      abortControllerRef.current = new AbortController();

      try {
        // Step 1: Establish transport and RPC connection
        const transport = await connectFunction();
        const connection = create_rpc_connection(transport, {
          signal: abortControllerRef.current.signal,
        });

        // Step 2: Fetch device information
        const deviceInfo = await fetchDeviceInfo(connection);
        if (!deviceInfo) {
          throw new Error("Failed to get device information");
        }

        // Step 3: Fetch custom subsystems (optional - won't fail connection)
        const customSubsystems = await fetchCustomSubsystems(connection);

        // Step 4: Update state with successful connection
        setState({
          connection,
          deviceInfo,
          customSubsystems,
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
      }
    },
    []
  );

  /**
   * Fetch device information from the connected device
   */
  const fetchDeviceInfo = async (
    connection: RpcConnection
  ): Promise<GetDeviceInfoResponse | null> => {
    try {
      const response = await call_rpc(connection, {
        core: { getDeviceInfo: true },
      });
      return response.core?.getDeviceInfo || null;
    } catch (error) {
      console.error("Failed to get device info", error);
      return null;
    }
  };

  /**
   * Fetch available custom subsystems from the device
   */
  const fetchCustomSubsystems = async (
    connection: RpcConnection
  ): Promise<ListCustomSubsystemResponse | null> => {
    try {
      const response = await call_rpc(connection, {
        custom: { listCustomSubsystems: {} },
      });
      return response.custom?.listCustomSubsystems || null;
    } catch (error) {
      console.error("Failed to get custom subsystems", error);
      return null;
    }
  };

  /**
   * Disconnect from the current device
   * Aborts any ongoing operations and clears all state
   */
  const disconnect = useCallback(() => {
    // Abort any ongoing connection and RPC calls
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Clear all notification subscriptions
    notificationCallbacksRef.current.clear();

    // Reset state to initial values
    setState({
      connection: null,
      deviceInfo: null,
      customSubsystems: null,
      isLoading: false,
      error: null,
    });
  }, []);

  /**
   * Find a subsystem by its identifier string
   * @param identifier - The unique identifier of the subsystem to find
   * @returns The subsystem with its index and identifier, or null if not found
   */
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

  /**
   * Subscribe to notifications from a specific subsystem
   * @param subsystemIndex - The index of the subsystem to listen to
   * @param callback - Function to call when a notification is received
   * @returns Unsubscribe function to stop receiving notifications
   *
   * @example
   * const unsubscribe = onNotification(0, (notification) => {
   *   console.log('Received:', notification.payload);
   * });
   * // Later: unsubscribe();
   */
  const onNotification = useCallback(
    (
      subsystemIndex: number,
      callback: (notification: CustomNotification) => void
    ) => {
      // Get or create the callback set for this subsystem
      let callbacks = notificationCallbacksRef.current.get(subsystemIndex);
      if (!callbacks) {
        callbacks = new Set();
        notificationCallbacksRef.current.set(subsystemIndex, callbacks);
      }

      // Register the callback
      callbacks.add(callback);

      // Return cleanup function to unsubscribe
      return () => {
        const callbacks = notificationCallbacksRef.current.get(subsystemIndex);
        if (callbacks) {
          callbacks.delete(callback);
          // Clean up empty sets to prevent memory leaks
          if (callbacks.size === 0) {
            notificationCallbacksRef.current.delete(subsystemIndex);
          }
        }
      };
    },
    []
  );

  const isConnected = !!state.connection;

  return {
    state,
    connect,
    disconnect,
    findSubsystem,
    isConnected,
    onNotification,
  };
}
