// Package store é a camada de persistência (PostgreSQL via pgx): queries e
// repositórios para users, spaces, members, maps, assets e chat. Migrations
// em backend/migrations (goose). Estado volátil de sala NUNCA passa por aqui
// (ver ESPECIFICACAO.md §8).
package store
