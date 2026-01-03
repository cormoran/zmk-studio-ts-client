/**
 * Tests for useZMKApp hook
 */

import { renderHook, waitFor } from "@testing-library/react";
import { useZMKApp } from "../src/useZMKApp";
import type { RpcTransport } from "@zmkfirmware/zmk-studio-ts-client/transport/index";
import type { RpcConnection } from "@zmkfirmware/zmk-studio-ts-client";

// Mock the zmk-studio-ts-client
jest.mock("@zmkfirmware/zmk-studio-ts-client", () => ({
  create_rpc_connection: jest.fn(),
  call_rpc: jest.fn(),
}));

describe("useZMKApp", () => {
  let mockTransport: RpcTransport;
  let mockConnection: RpcConnection;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock transport
    mockTransport = {
      close: jest.fn(),
      send: jest.fn(),
    } as unknown as RpcTransport;

    // Create mock connection
    mockConnection = {
      label: "test",
      current_request: 0,
    } as unknown as RpcConnection;
  });

  it("should initialize with default state", () => {
    const { result } = renderHook(() => useZMKApp());

    expect(result.current.state.connection).toBeNull();
    expect(result.current.state.deviceInfo).toBeNull();
    expect(result.current.state.customSubsystems).toBeNull();
    expect(result.current.state.isLoading).toBe(false);
    expect(result.current.state.error).toBeNull();
    expect(result.current.isConnected).toBe(false);
  });

  it("should set loading state when connecting", async () => {
    const { result } = renderHook(() => useZMKApp());
    const {
      create_rpc_connection,
      call_rpc,
    } = require("@zmkfirmware/zmk-studio-ts-client");

    // Setup mocks
    create_rpc_connection.mockReturnValue(mockConnection);
    (call_rpc as jest.Mock)
      .mockResolvedValueOnce({
        core: {
          getDeviceInfo: {
            name: "Test Device",
            version: "1.0.0",
          },
        },
      })
      .mockResolvedValueOnce({
        custom: {
          listCustomSubsystems: {
            subsystems: [],
          },
        },
      });

    const connectFunction = jest.fn().mockResolvedValue(mockTransport);

    const connectPromise = result.current.connect(connectFunction);

    await waitFor(() => {
      expect(connectFunction).toHaveBeenCalled();
    });

    await connectPromise;
  });

  it("should successfully connect to a device", async () => {
    const { result } = renderHook(() => useZMKApp());
    const {
      create_rpc_connection,
      call_rpc,
    } = require("@zmkfirmware/zmk-studio-ts-client");

    const mockDeviceInfo = {
      name: "Test Device",
      version: "1.0.0",
    };

    const mockSubsystems = {
      subsystems: [
        { index: 0, identifier: "test-subsystem" },
        { index: 1, identifier: "another-subsystem" },
      ],
    };

    // Setup mocks
    create_rpc_connection.mockReturnValue(mockConnection);
    (call_rpc as jest.Mock)
      .mockResolvedValueOnce({
        core: {
          getDeviceInfo: mockDeviceInfo,
        },
      })
      .mockResolvedValueOnce({
        custom: {
          listCustomSubsystems: mockSubsystems,
        },
      });

    const connectFunction = jest.fn().mockResolvedValue(mockTransport);

    await result.current.connect(connectFunction);

    await waitFor(() => {
      expect(result.current.state.connection).toBe(mockConnection);
      expect(result.current.state.deviceInfo).toEqual(mockDeviceInfo);
      expect(result.current.state.customSubsystems).toEqual(mockSubsystems);
      expect(result.current.state.isLoading).toBe(false);
      expect(result.current.state.error).toBeNull();
      expect(result.current.isConnected).toBe(true);
    });
  });

  it("should handle connection errors", async () => {
    const { result } = renderHook(() => useZMKApp());
    const connectFunction = jest
      .fn()
      .mockRejectedValue(new Error("Connection failed"));

    await result.current.connect(connectFunction);

    await waitFor(() => {
      expect(result.current.state.connection).toBeNull();
      expect(result.current.state.isLoading).toBe(false);
      expect(result.current.state.error).toBe("Connection failed");
      expect(result.current.isConnected).toBe(false);
    });
  });

  it("should handle device info retrieval failure", async () => {
    const { result } = renderHook(() => useZMKApp());
    const {
      create_rpc_connection,
      call_rpc,
    } = require("@zmkfirmware/zmk-studio-ts-client");

    create_rpc_connection.mockReturnValue(mockConnection);
    (call_rpc as jest.Mock).mockResolvedValueOnce({
      core: {
        getDeviceInfo: null,
      },
    });

    const connectFunction = jest.fn().mockResolvedValue(mockTransport);

    await result.current.connect(connectFunction);

    await waitFor(() => {
      expect(result.current.state.error).toBe(
        "Failed to get device information"
      );
      expect(result.current.isConnected).toBe(false);
    });
  });

  it("should disconnect from device", async () => {
    const { result } = renderHook(() => useZMKApp());
    const {
      create_rpc_connection,
      call_rpc,
    } = require("@zmkfirmware/zmk-studio-ts-client");

    // First, connect
    create_rpc_connection.mockReturnValue(mockConnection);
    (call_rpc as jest.Mock)
      .mockResolvedValueOnce({
        core: {
          getDeviceInfo: { name: "Test" },
        },
      })
      .mockResolvedValueOnce({
        custom: {
          listCustomSubsystems: { subsystems: [] },
        },
      });

    const connectFunction = jest.fn().mockResolvedValue(mockTransport);

    await result.current.connect(connectFunction);

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // Then disconnect
    result.current.disconnect();

    await waitFor(() => {
      expect(result.current.state.connection).toBeNull();
      expect(result.current.state.deviceInfo).toBeNull();
      expect(result.current.state.customSubsystems).toBeNull();
      expect(result.current.isConnected).toBe(false);
    });
  });

  it("should find subsystem by identifier", async () => {
    const { result } = renderHook(() => useZMKApp());
    const {
      create_rpc_connection,
      call_rpc,
    } = require("@zmkfirmware/zmk-studio-ts-client");

    const mockSubsystems = {
      subsystems: [
        { index: 0, identifier: "test-subsystem" },
        { index: 1, identifier: "another-subsystem" },
      ],
    };

    create_rpc_connection.mockReturnValue(mockConnection);
    (call_rpc as jest.Mock)
      .mockResolvedValueOnce({
        core: {
          getDeviceInfo: { name: "Test" },
        },
      })
      .mockResolvedValueOnce({
        custom: {
          listCustomSubsystems: mockSubsystems,
        },
      });

    const connectFunction = jest.fn().mockResolvedValue(mockTransport);

    await result.current.connect(connectFunction);

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    const found = result.current.findSubsystem("another-subsystem");
    expect(found).toEqual({ index: 1, identifier: "another-subsystem" });

    const notFound = result.current.findSubsystem("non-existent");
    expect(notFound).toBeNull();
  });

  it("should return null when finding subsystem without connection", () => {
    const { result } = renderHook(() => useZMKApp());

    const found = result.current.findSubsystem("any-subsystem");
    expect(found).toBeNull();
  });
});
