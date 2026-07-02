// Package auth cuida de autenticação e autorização: hash de senha (Argon2id),
// emissão/validação de JWT + refresh token, sessões de convidado e o
// middleware HTTP que injeta a identidade no contexto da requisição.
package auth
