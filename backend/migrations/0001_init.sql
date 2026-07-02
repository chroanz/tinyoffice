-- Schema inicial do PixelRooms (ESPECIFICACAO.md §8).
-- Ferramenta de migração: goose (https://github.com/pressly/goose)

-- +goose Up
CREATE TABLE users (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email         text UNIQUE,                 -- NULL para convidados
    password_hash text,                        -- Argon2id; NULL para convidados/OAuth
    display_name  text NOT NULL,
    avatar        jsonb NOT NULL DEFAULT '{}', -- camada → itemId
    is_guest      boolean NOT NULL DEFAULT false,
    created_at    timestamptz NOT NULL DEFAULT now(),
    deleted_at    timestamptz
);

CREATE TABLE spaces (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug           text NOT NULL UNIQUE,
    name           text NOT NULL,
    owner_id       uuid NOT NULL REFERENCES users (id),
    access         text NOT NULL DEFAULT 'public', -- public | password | members
    password_hash  text,
    capacity       integer,
    default_map_id uuid,                            -- FK adicionada após criar maps
    settings       jsonb NOT NULL DEFAULT '{}',     -- raio de proximidade, allowlist de iframes, retenção de chat
    created_at     timestamptz NOT NULL DEFAULT now(),
    archived_at    timestamptz
);

CREATE TABLE space_members (
    space_id  uuid NOT NULL REFERENCES spaces (id) ON DELETE CASCADE,
    user_id   uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role      text NOT NULL DEFAULT 'member', -- owner|admin|builder|moderator|member
    joined_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (space_id, user_id)
);

CREATE TABLE space_bans (
    id        bigserial PRIMARY KEY,
    space_id  uuid NOT NULL REFERENCES spaces (id) ON DELETE CASCADE,
    user_id   uuid REFERENCES users (id),
    ip_hash   text,
    reason    text,
    banned_by uuid REFERENCES users (id),
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (user_id IS NOT NULL OR ip_hash IS NOT NULL)
);

CREATE TABLE maps (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id   uuid NOT NULL REFERENCES spaces (id) ON DELETE CASCADE,
    name       text NOT NULL,
    version    integer NOT NULL DEFAULT 1,
    tmj        jsonb NOT NULL,  -- fonte Tiled original
    compiled   jsonb NOT NULL,  -- formato interno: colisão, efeitos, spawns, portais
    width      integer NOT NULL,
    height     integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE spaces
    ADD CONSTRAINT spaces_default_map_fk
    FOREIGN KEY (default_map_id) REFERENCES maps (id) ON DELETE SET NULL;

CREATE TABLE map_objects (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    map_id      uuid NOT NULL REFERENCES maps (id) ON DELETE CASCADE,
    object_type text NOT NULL,  -- iframe | image | video | note | link | whiteboard
    x           integer NOT NULL,
    y           integer NOT NULL,
    sprite      text,
    config      jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE assets (
    id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id uuid REFERENCES spaces (id) ON DELETE CASCADE, -- NULL = asset global embutido
    kind     text NOT NULL,   -- tileset | avatar_layer | object_sprite
    path     text NOT NULL,
    license  text NOT NULL,
    author   text,
    meta     jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE chat_messages (
    id             bigserial PRIMARY KEY,
    space_id       uuid NOT NULL REFERENCES spaces (id) ON DELETE CASCADE,
    map_id         uuid REFERENCES maps (id) ON DELETE SET NULL,
    scope          text NOT NULL, -- nearby | map | space | dm
    sender_id      uuid NOT NULL REFERENCES users (id),
    target_user_id uuid REFERENCES users (id),
    body           text NOT NULL,
    created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_maps_space ON maps (space_id);
CREATE INDEX idx_map_objects_map ON map_objects (map_id);
CREATE INDEX idx_chat_space_time ON chat_messages (space_id, created_at DESC);
CREATE INDEX idx_space_bans_space ON space_bans (space_id);

-- +goose Down
DROP TABLE chat_messages;
DROP TABLE assets;
DROP TABLE map_objects;
ALTER TABLE spaces DROP CONSTRAINT spaces_default_map_fk;
DROP TABLE maps;
DROP TABLE space_bans;
DROP TABLE space_members;
DROP TABLE spaces;
DROP TABLE users;
