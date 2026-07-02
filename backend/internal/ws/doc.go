// Package ws implementa o transporte WebSocket do protocolo em tempo real:
// upgrade da conexão, read/write pumps (2 goroutines por conexão, com
// backpressure), codec Protobuf (proto/pixelrooms/v1) e heartbeat ping/pong.
package ws
