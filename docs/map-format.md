# Formato de mapas (Tiled)

Mapas são Tiled JSON (`.tmj`), ortogonais, tiles 32×32. Convenções de camadas e
efeitos de tile em [ESPECIFICACAO.md §5.5–5.6](../ESPECIFICACAO.md#55-efeitos-de-tile-camada-lógica).

Resumo das camadas obrigatórias: `Ground`, `Objects`, `Above`, `Effects`, `Interactables`
(+ `Ground2` opcional). O compilador em `backend/internal/maps` valida e converte o `.tmj`
para o formato interno de runtime.

Este documento será expandido com um tutorial passo a passo no Tiled quando o
compilador de mapas for implementado (Fase 1).
