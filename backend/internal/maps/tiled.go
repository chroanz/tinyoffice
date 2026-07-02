package maps

// Estruturas mínimas do formato Tiled JSON (.tmj) usadas pelo compilador.
// Referência: https://doc.mapeditor.org/en/stable/reference/json-map-format/

type tmjMap struct {
	Width      int        `json:"width"`  // em tiles
	Height     int        `json:"height"` // em tiles
	TileWidth  int        `json:"tilewidth"`
	TileHeight int        `json:"tileheight"`
	Layers     []tmjLayer `json:"layers"`
}

type tmjLayer struct {
	Name    string      `json:"name"`
	Type    string      `json:"type"` // tilelayer | objectgroup
	Data    []uint32    `json:"data,omitempty"`
	Objects []tmjObject `json:"objects,omitempty"`
}

type tmjObject struct {
	X          float64       `json:"x"` // em pixels
	Y          float64       `json:"y"`
	Width      float64       `json:"width"`
	Height     float64       `json:"height"`
	Properties []tmjProperty `json:"properties,omitempty"`
}

type tmjProperty struct {
	Name  string `json:"name"`
	Value any    `json:"value"`
}

func (o tmjObject) prop(name string) (any, bool) {
	for _, p := range o.Properties {
		if p.Name == name {
			return p.Value, true
		}
	}
	return nil, false
}

func (o tmjObject) stringProp(name string) string {
	if v, ok := o.prop(name); ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}
