package ws

import (
	"context"
	"sync"
	"time"

	"github.com/coder/websocket"
)

const (
	outBufferSize = 64
	writeTimeout  = 5 * time.Second
)

// client adapta uma conexão WebSocket à interface game.Session: envio
// não-bloqueante com buffer e desconexão de clientes lentos.
type client struct {
	conn *websocket.Conn

	out  chan []byte
	done chan struct{}
	once sync.Once
}

func newClient(conn *websocket.Conn) *client {
	c := &client{
		conn: conn,
		out:  make(chan []byte, outBufferSize),
		done: make(chan struct{}),
	}
	go c.writePump()
	return c
}

func (c *client) Send(msg []byte) bool {
	select {
	case c.out <- msg:
		return true
	case <-c.done:
		return true // já fechando; não sinalizar backpressure
	default:
		return false
	}
}

func (c *client) Close() {
	c.once.Do(func() {
		close(c.done)
		// Destrava o read pump imediatamente.
		_ = c.conn.CloseNow()
	})
}

func (c *client) writePump() {
	for {
		select {
		case <-c.done:
			return
		case msg := <-c.out:
			ctx, cancel := context.WithTimeout(context.Background(), writeTimeout)
			err := c.conn.Write(ctx, websocket.MessageText, msg)
			cancel()
			if err != nil {
				c.Close()
				return
			}
		}
	}
}
