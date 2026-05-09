declare module "socket.io-client" {
  export interface Socket {
    on(event: string, listener: (...args: unknown[]) => void): Socket;
    connect(): Socket;
    disconnect(): Socket;
  }

  export interface ConnectOptions {
    reconnection?: boolean;
    forceNew?: boolean;
    timeout?: number;
    transports?: string[];
    [key: string]: unknown;
  }

  export default function io(uri: string, options?: ConnectOptions): Socket;
}
